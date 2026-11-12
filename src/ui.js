/* Rendering and touch input. Rules live in engine.js. */
(function () {
  'use strict';
  var E = window.FU_ENGINE;
  var $ = function (id) { return document.getElementById(id); };
  var STORE = 'filed-under-v1';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SAVE_VERSION = 2;  // bump when deals change, so a half-played old deal is not resumed
  var save = { v: SAVE_VERSION, unlocked: 1, stars: {}, current: 1, seenHelp: false, sound: true, game: null, daily: { last: '', streak: 0, stars: 0 } };
  try {
    var stored = JSON.parse(localStorage.getItem(STORE)) || {};
    if (stored.v !== SAVE_VERSION) stored.game = null;
    Object.assign(save, stored, { v: SAVE_VERSION });
  } catch (e) { /* storage unavailable */ }
  function snapshot() {
    return game ? { key: game.level.daily ? 'D' + game.level.daily : 'L' + game.level.n, st: game.st, slips: game.slips } : null;
  }
  function persist() {
    save.game = snapshot();
    try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
  }

  function dateKey(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function prettyDate(key) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function liveStreak() {
    var d = save.daily;
    return d.last === dateKey() || d.last === dateKey(-1) ? d.streak : 0;
  }

  /* ---------- sound and vibration ---------- */

  var audio = null;
  var SOUNDS = {
    draw: [[300, 0, 0.04, 'triangle', 0.05]],
    place: [[430, 0, 0.06, 'triangle', 0.07]],
    file: [[620, 0, 0.07, 'triangle', 0.08]],
    done: [[620, 0, 0.09, 'triangle', 0.08], [930, 0.09, 0.16, 'triangle', 0.08]],
    wrong: [[170, 0, 0.16, 'sawtooth', 0.04]],
    win: [[523, 0, 0.12, 'triangle', 0.08], [659, 0.11, 0.12, 'triangle', 0.08], [784, 0.22, 0.12, 'triangle', 0.08], [1047, 0.33, 0.3, 'triangle', 0.08]]
  };
  function sfx(name, buzz) {
    if (!save.sound) return;
    try {
      if (buzz && navigator.vibrate) navigator.vibrate(buzz);
    } catch (e) { /* vibration refused */ }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio = audio || new Ctx();
      if (audio.state === 'suspended') audio.resume();
      SOUNDS[name].forEach(function (n) {
        var t = audio.currentTime + n[1];
        var osc = audio.createOscillator(), g = audio.createGain();
        osc.type = n[3]; osc.frequency.value = n[0];
        g.gain.setValueAtTime(n[4], t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + n[2]);
        osc.connect(g); g.connect(audio.destination);
        osc.start(t); osc.stop(t + n[2] + 0.02);
      });
    } catch (e) { /* audio unavailable */ }
  }

  var game = null;       // { level, st, history, slips }
  var selection = null;  // src of the selected run
  var hintMark = null;
  var drag = null;
  var toastTimer = 0;
  var stuckTimer = 0;

  function begin(d, key, resume) {
    game = { level: d.level, st: d.state, history: [], slips: 0 };
    if (resume && resume.key === key && resume.st) { game.st = resume.st; game.slips = resume.slips || 0; }
    selection = null; hintMark = null;
    $('sheet-win').hidden = true;
    persist();
    render();
    checkStuck();
  }
  function start(n, resume) {
    save.current = n;
    begin(E.makeLevel(n), 'L' + n, resume);
  }
  function startDaily(resume) {
    var key = dateKey();
    begin(E.makeDaily(key), 'D' + key, resume);
  }
  function restart() {
    if (game.level.daily) startDaily(); else start(game.level.n);
  }

  // Tell the player when the position can no longer be finished, instead of letting them grind.
  function checkStuck() {
    clearTimeout(stuckTimer);
    $('stuck').hidden = true;
    stuckTimer = setTimeout(function () {
      if (!game || E.isWon(game.level, game.st)) return;
      if (E.isDead(game.level, game.st)) { $('stuck').hidden = false; $('btn-stuck-undo').disabled = !game.history.length; }
    }, 300);
  }

  /* ---------- rendering ---------- */

  function cardEl(id, cls) {
    var c = game.level.cards[id];
    var el = document.createElement('button');
    el.className = 'card ' + (cls || (c.kind === 'head' ? 'head' : 'word'));
    el.dataset.id = id;
    if (cls !== 'down') el.textContent = c.text;
    else { el.tabIndex = -1; el.setAttribute('aria-hidden', 'true'); }
    return el;
  }

  function fitText(el, text, width, max) {
    var longest = text.split(' ').reduce(function (m, w) { return Math.max(m, w.length); }, 0);
    var upper = el.classList.contains('head');
    var size = Math.max(9, Math.min(max, (width - 6) / (longest * (upper ? 0.56 : 0.45))));
    el.style.fontSize = size.toFixed(1) + 'px';
  }

  function sameSrc(a, b) {
    return a && b && a.t === b.t && a.i === b.i && a.idx === b.idx;
  }

  function render(fromRects) {
    var L = game.level, st = game.st, C = L.cards, P = L.params;
    var before = fromRects || rects();

    $('level-tag').textContent = L.daily ? 'Daily · ' + prettyDate(L.daily) : 'Level ' + L.n;
    $('stat-moves').textContent = st.moves;
    $('stat-slips').textContent = game.slips;
    $('btn-undo').disabled = !game.history.length;

    // trays
    var trays = $('trays');
    trays.textContent = '';
    st.slots.forEach(function (cat, i) {
      var el = document.createElement('div');
      el.dataset.slot = i;
      if (cat === null) {
        el.className = 'slot empty';
        el.textContent = 'Empty tray';
      } else {
        el.className = 'slot open';
        var head = C.find(function (c) { return c.kind === 'head' && c.cat === cat; });
        el.dataset.id = head.id;
        var name = document.createElement('span');
        name.className = 'slot-name';
        name.textContent = head.text;
        var pips = document.createElement('span');
        pips.className = 'pips';
        for (var k = 0; k < P.words; k++) {
          var pip = document.createElement('span');
          pip.className = 'pip' + (k < st.placed[cat] ? ' on' : '');
          pips.appendChild(pip);
        }
        el.setAttribute('aria-label', head.text + ', ' + st.placed[cat] + ' of ' + P.words + ' filed');
        el.appendChild(name); el.appendChild(pips);
      }
      if (hintMark && hintMark.dest && hintMark.dest.t === 'slot' && hintMark.dest.i === i) el.classList.add('target');
      trays.appendChild(el);
    });

    // piles
    var piles = $('piles');
    var gap = 6;
    var cw = Math.floor(Math.min(104, (piles.clientWidth - gap * (P.cols - 1)) / P.cols));
    var ch = Math.round(Math.max(44, Math.min(70, cw * 0.74)));
    var avail = piles.clientHeight;
    piles.style.setProperty('--cw', cw + 'px');
    piles.style.setProperty('--ch', ch + 'px');
    piles.style.setProperty('--gap', gap + 'px');
    piles.textContent = '';
    st.cols.forEach(function (col, i) {
      var el = document.createElement('div');
      el.className = 'col';
      el.dataset.col = i;
      var nDown = st.down[i], nUp = col.length - nDown;
      var downOff = 9, upOff = 24;
      var need = nDown * downOff + Math.max(0, nUp - 1) * upOff + ch;
      if (need > avail && nUp > 1) upOff = Math.max(13, (avail - ch - nDown * downOff) / (nUp - 1));
      var y = 0;
      col.forEach(function (id, idx) {
        var up = idx >= nDown;
        var card = cardEl(id, up ? null : 'down');
        card.style.top = y + 'px';
        if (up) {
          fitText(card, C[id].text, cw, 17);
          if (E.runAt(L, st, i, idx)) card.dataset.src = 'col:' + i + ':' + idx;
          if (selection && selection.t === 'col' && selection.i === i && idx >= selection.idx) card.classList.add('selected');
          if (hintMark && hintMark.src && hintMark.src.t === 'col' && hintMark.src.i === i && idx >= hintMark.src.idx) card.classList.add('hinted');
          if (hintMark && hintMark.dest && hintMark.dest.t === 'col' && hintMark.dest.i === i && idx === col.length - 1) card.classList.add('hinted', 'hint-dest');
        }
        y += up ? upOff : downOff;
        el.appendChild(card);
      });
      if (hintMark && hintMark.dest && hintMark.dest.t === 'col' && hintMark.dest.i === i && !col.length) el.classList.add('target');
      piles.appendChild(el);
    });

    // inbox
    var stock = $('stock');
    var left = st.stock.length;
    stock.className = 'stock' + (left ? '' : st.waste.length ? ' spent' : ' done') + (hintMark && hintMark.draw ? ' hinted' : '');
    stock.textContent = left ? left : 'Again';
    stock.setAttribute('aria-label', left ? 'Draw from inbox, ' + left + ' cards left' : 'Turn the inbox over');
    var waste = $('waste');
    waste.textContent = '';
    if (st.waste.length) {
      var top = st.waste[st.waste.length - 1];
      var w = cardEl(top);
      w.dataset.src = 'waste';
      fitText(w, C[top].text, waste.clientWidth || 84, 21);
      if (selection && selection.t === 'waste') w.classList.add('selected');
      if (hintMark && hintMark.src && hintMark.src.t === 'waste') w.classList.add('hinted');
      waste.appendChild(w);
    }

    animateFrom(before);
  }

  // FLIP: remember where every card was, then slide it from there to its new place.
  function rects() {
    var map = {};
    document.querySelectorAll('#app [data-id]').forEach(function (el) {
      map[el.dataset.id] = el.getBoundingClientRect();
    });
    return map;
  }
  function animateFrom(before) {
    if (reduceMotion || !before) return;
    document.querySelectorAll('#app [data-id]').forEach(function (el) {
      var a = before[el.dataset.id];
      if (!a || !el.animate) return;
      var b = el.getBoundingClientRect();
      var dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate(
        [{ transform: 'translate(' + dx + 'px,' + dy + 'px)', zIndex: 40 }, { transform: 'none', zIndex: 40 }],
        { duration: 190, easing: 'cubic-bezier(.2,.8,.3,1)' }
      );
    });
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- actions ---------- */

  function parseSrc(s) {
    if (!s) return null;
    if (s === 'waste') return { t: 'waste' };
    var p = s.split(':');
    return { t: 'col', i: +p[1], idx: +p[2] };
  }
  function destOf(el) {
    var d = el && el.closest('[data-slot],[data-col]');
    if (!d) return null;
    return d.dataset.slot !== undefined ? { t: 'slot', i: +d.dataset.slot } : { t: 'col', i: +d.dataset.col };
  }

  function attempt(src, dest, fromRects) {
    var L = game.level, st = game.st, C = L.cards;
    selection = null; hintMark = null;
    var ids = E.idsOf(L, st, src);
    if (!ids || (src.t === 'col' && dest.t === 'col' && src.i === dest.i)) { render(fromRects); return; }
    var res = E.check(L, st, ids, dest);
    if (!res.ok) {
      if (res.reason === 'mismatch') {
        game.slips++;
        var first = C[ids[0]].text;
        if (dest.t === 'slot') {
          var head = C.find(function (c) { return c.kind === 'head' && c.cat === st.slots[dest.i]; });
          toast(first + ' is not filed under ' + head.text + '.');
        } else {
          toast('Those cards do not share a heading.');
        }
      } else if (res.reason === 'needs-heading') {
        toast('A heading card has to open the tray first.');
      } else {
        toast('That tray is in use.');
      }
      sfx('wrong', res.reason === 'mismatch' ? 40 : 0);
      render(fromRects);
      ids.forEach(function (id) {
        var el = document.querySelector('.card[data-id="' + id + '"]');
        if (el) el.classList.add('shake');
      });
      persist();
      return;
    }
    var out = E.move(L, st, src, dest);
    game.history.push(st);
    game.st = out.state;
    render(fromRects);
    if (dest.t === 'slot') {
      var slotEl = document.querySelector('[data-slot="' + dest.i + '"]');
      if (slotEl) slotEl.classList.add('bump');
    }
    if (out.filed !== null) {
      var done = C.find(function (c) { return c.kind === 'head' && c.cat === out.filed; });
      toast(done.text + ' is complete. The tray is free again.');
    }
    sfx(out.filed !== null ? 'done' : dest.t === 'slot' ? 'file' : 'place', out.filed !== null ? 15 : 0);
    persist();
    if (E.isWon(L, game.st)) { clearTimeout(stuckTimer); setTimeout(win, 350); }
    else checkStuck();
  }

  function drawCard() {
    var s = E.draw(game.st);
    if (!s) return;
    selection = null; hintMark = null;
    game.history.push(game.st);
    game.st = s;
    sfx('draw');
    render();
    persist();
    checkStuck();
  }

  function undo() {
    if (!game.history.length || E.isWon(game.level, game.st)) return;
    selection = null; hintMark = null;
    game.st = game.history.pop();
    sfx('draw');
    render();
    persist();
    checkStuck();
  }

  function showHint() {
    if (E.isWon(game.level, game.st)) return;
    var h = E.hint(game.level, game.st);
    selection = null;
    if (!h) { toast('No route found from here. Undo a few moves or restart.'); return; }
    game.slips++;
    hintMark = h.type === 'draw' ? { draw: true } : { src: h.src, dest: h.dest };
    render();
    persist();
  }

  function win() {
    var L = game.level, s = E.stars(game.slips);
    var line = game.st.moves + ' moves, ' + game.slips + (game.slips === 1 ? ' slip.' : ' slips.');
    if (L.daily) {
      var d = save.daily;
      if (d.last !== L.daily) {
        d.streak = d.last === dateKey(-1) ? d.streak + 1 : 1;
        d.last = L.daily; d.stars = s;
      } else d.stars = Math.max(d.stars, s);
      line += ' ' + (d.streak === 1 ? 'First day of a new streak.' : d.streak + ' days in a row.');
      $('win-eyebrow').textContent = 'Daily deal · ' + prettyDate(L.daily);
      $('btn-next').textContent = 'Back to levels';
    } else {
      save.stars[L.n] = Math.max(save.stars[L.n] || 0, s);
      save.unlocked = Math.max(save.unlocked, L.n + 1);
      $('win-eyebrow').textContent = 'Level ' + L.n;
      $('btn-next').textContent = 'Next level';
    }
    var keep = game; game = null; persist(); game = keep;
    var stamps = $('win-stamps');
    stamps.textContent = '';
    for (var i = 0; i < 3; i++) {
      var el = document.createElement('span');
      el.className = 'stamp' + (i < s ? ' on' : '');
      el.textContent = 'FILED';
      stamps.appendChild(el);
    }
    $('win-line').textContent = line;
    $('sheet-win').hidden = false;
    $('btn-next').focus();
    sfx('win', [20, 60, 20]);
  }

  function openMenu() {
    var grid = $('level-grid');
    grid.textContent = '';
    var shown = Math.max(12, Math.ceil((save.unlocked + 1) / 6) * 6);
    var total = 0;
    for (var n = 1; n <= shown; n++) {
      var b = document.createElement('button');
      b.dataset.level = n;
      b.disabled = n > save.unlocked;
      if (game && !game.level.daily && n === game.level.n) b.setAttribute('aria-current', 'true');
      var s = save.stars[n] || 0;
      total += s;
      b.innerHTML = n + '<small>' + '●'.repeat(s) + '</small>';
      b.setAttribute('aria-label', 'Level ' + n + (s ? ', ' + s + ' of 3 stamps' : ''));
      grid.appendChild(b);
    }
    Object.keys(save.stars).forEach(function (k) { if (+k > shown) total += save.stars[k]; });
    $('tally').textContent = total + (total === 1 ? ' stamp' : ' stamps');

    var today = dateKey(), streak = liveStreak(), doneToday = save.daily.last === today;
    $('daily-date').textContent = prettyDate(today) + (doneToday ? ' · filed, ' + save.daily.stars + ' of 3 stamps' : ' · the same deal for everyone');
    $('daily-side').textContent = streak ? streak + (streak === 1 ? ' day' : ' days') + ' running' : doneToday ? '' : 'Start a streak';
    $('howto').open = !save.seenHelp;
    paintSound();
    $('sheet-menu').hidden = false;
  }
  function paintSound() {
    $('btn-sound').textContent = save.sound ? 'Sound on' : 'Sound off';
    $('btn-sound').setAttribute('aria-pressed', save.sound ? 'true' : 'false');
  }
  function closeMenu() {
    $('sheet-menu').hidden = true;
    if (!save.seenHelp) { save.seenHelp = true; persist(); }
  }

  /* ---------- input: tap to select then tap a destination, or drag ---------- */

  function tap(el) {
    if (!el) return;
    if (el.closest('#stock')) { drawCard(); return; }
    var srcEl = el.closest('.card[data-src]');
    var src = srcEl ? parseSrc(srcEl.dataset.src) : null;
    var dest = destOf(el);
    if (selection) {
      var sameCol = dest && dest.t === 'col' && selection.t === 'col' && selection.i === dest.i;
      if (dest && !sameCol) { attempt(selection, dest); return; }
      if (src && !sameSrc(src, selection)) { select(src); return; }
      selection = null; render(); return;
    }
    if (src) select(src);
  }
  function select(src) {
    selection = src;
    if (hintMark && !sameSrc(hintMark.src, src)) hintMark = null;
    render();
  }

  var board = $('app');
  board.addEventListener('pointerdown', function (e) {
    if (e.button || drag || !game) return;
    var inPlay = e.target.closest('#board, .inbox');
    if (!inPlay) return;
    var srcEl = e.target.closest('.card[data-src]');
    drag = { el: e.target, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, src: null, els: [] };
    if (srcEl) {
      drag.src = parseSrc(srcEl.dataset.src);
      var ids = E.idsOf(game.level, game.st, drag.src) || [];
      drag.els = ids.map(function (id) { return document.querySelector('.card[data-id="' + id + '"]'); }).filter(Boolean);
    }
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  });
  board.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !drag.els.length) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 7) return;
    if (!drag.active) {
      drag.active = true;
      drag.els.forEach(function (el) {
        el.getAnimations && el.getAnimations().forEach(function (a) { a.cancel(); });
        el.classList.add('dragging');
      });
    }
    drag.els.forEach(function (el) { el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
    markTarget(document.elementFromPoint(e.clientX, e.clientY));
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    markTarget(null);
    if (!d.active) { if (e.type === 'pointerup') tap(d.el); return; }
    var from = rects();
    var dest = e.type === 'pointerup' ? destOf(document.elementFromPoint(e.clientX, e.clientY)) : null;
    if (dest) attempt(d.src, dest, from);
    else { selection = null; render(from); }
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);
  // keyboard and assistive tech fire click without pointer events
  board.addEventListener('click', function (e) { if (e.detail === 0 && e.target.closest('#board, .inbox')) tap(e.target); });

  function markTarget(el) {
    document.querySelectorAll('.drop-hover').forEach(function (x) { x.classList.remove('drop-hover', 'target'); });
    var d = el && el.closest('[data-slot],[data-col]');
    if (d) d.classList.add('drop-hover', 'target');
  }

  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', showHint);
  $('btn-menu').addEventListener('click', openMenu);
  $('btn-close-menu').addEventListener('click', closeMenu);
  $('btn-restart').addEventListener('click', function () { closeMenu(); restart(); });
  $('btn-replay').addEventListener('click', restart);
  $('btn-next').addEventListener('click', function () {
    start(game.level.daily ? Math.min(save.current || 1, save.unlocked) : game.level.n + 1);
  });
  $('btn-daily').addEventListener('click', function () { closeMenu(); startDaily(); });
  $('btn-sound').addEventListener('click', function () { save.sound = !save.sound; paintSound(); persist(); sfx('file'); });
  $('btn-stuck-undo').addEventListener('click', undo);
  $('btn-stuck-restart').addEventListener('click', restart);
  $('level-grid').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-level]');
    if (!b || b.disabled) return;
    closeMenu();
    start(+b.dataset.level);
  });
  window.addEventListener('resize', function () { if (game) render({}); });

  /* ---------- boot ---------- */

  function boot(hot) {
    var resume = (hot && hot.game) || save.game;
    var key = resume && resume.key ? resume.key : '';
    if (key === 'D' + dateKey()) startDaily(resume);
    else start(key.charAt(0) === 'L' ? +key.slice(1) : Math.min(save.current || 1, save.unlocked), resume);
    if (E.isWon(game.level, game.st)) restart();
    if (!save.seenHelp) openMenu();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (game) render({}); });
  }

  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) {
    try { hot.snapshot(function () { return { game: snapshot() }; }); } catch (e) { /* not in a viewer */ }
  }
  if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline play is optional */ });
  }
})();
