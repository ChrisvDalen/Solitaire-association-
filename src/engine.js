/* Game rules, deal generation and solver. No DOM in here, so it runs under node for tests.

   State shape:
     cols:   number[][]   card ids per pile, bottom first
     down:   number[]     how many cards at the bottom of each pile are face down
     stock:  number[]     inbox, top is the last element
     waste:  number[]     drawn cards, top is the last element
     slots:  (number|null)[]  heading (category index) open in each tray
     placed: number[]     words already filed per category
     moves:  number
*/
(function (root) {
  'use strict';

  var DATA = root.FU_DATA || (typeof require !== 'undefined' ? require('./data.js') : []);

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, r) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // Difficulty curve: more headings, more words per heading, deeper piles.
  function paramsFor(n) {
    if (n <= 1) return { cats: 3, words: 3, slots: 2, cols: 3, depth: 1 };
    if (n <= 2) return { cats: 3, words: 4, slots: 2, cols: 4, depth: 1 };
    if (n <= 4) return { cats: 4, words: 4, slots: 2, cols: 4, depth: 1 };
    if (n <= 7) return { cats: 5, words: 4, slots: 3, cols: 4, depth: 2 };
    if (n <= 11) return { cats: 5, words: 5, slots: 3, cols: 5, depth: 1 };
    if (n <= 16) return { cats: 6, words: 5, slots: 3, cols: 5, depth: 2 };
    if (n <= 24) return { cats: 7, words: 5, slots: 3, cols: 5, depth: 2 };
    return { cats: 8, words: 6, slots: 3, cols: 5, depth: 3 };
  }

  function deal(n, attempt) {
    var p = paramsFor(n);
    var r = rng(n * 7919 + attempt * 104729 + 17);
    var idx = [];
    for (var i = 0; i < DATA.length; i++) idx.push(i);
    var chosen = shuffle(idx, r).slice(0, p.cats);

    var cards = [];
    chosen.forEach(function (di, cat) {
      cards.push({ id: cards.length, cat: cat, kind: 'head', text: DATA[di].name });
      shuffle(DATA[di].words.slice(), r).slice(0, p.words).forEach(function (w) {
        cards.push({ id: cards.length, cat: cat, kind: 'word', text: w });
      });
    });

    var order = shuffle(cards.map(function (c) { return c.id; }), r);
    var cols = [], down = [];
    for (var c = 0; c < p.cols; c++) {
      var size = c + p.depth;
      cols.push(order.splice(0, size));
      down.push(size - 1);
    }
    var placed = [];
    for (var k = 0; k < p.cats; k++) placed.push(0);
    var slots = [];
    for (var s = 0; s < p.slots; s++) slots.push(null);

    return {
      level: { n: n, params: p, cards: cards },
      state: { cols: cols, down: down, stock: order, waste: [], slots: slots, placed: placed, moves: 0 }
    };
  }

  // Every level is checked by the solver, so no deal is impossible from the start.
  function makeLevel(n) {
    var d;
    for (var attempt = 0; attempt < 60; attempt++) {
      d = deal(n, attempt);
      if (solve(d.level, d.state)) return d;
    }
    return d;
  }

  function clone(st) { return JSON.parse(JSON.stringify(st)); }

  // Cards from idx to the top of a pile move together when they are face up and share a heading.
  function runAt(level, st, col, idx) {
    var c = st.cols[col];
    if (!c || idx < st.down[col] || idx >= c.length) return null;
    var cat = level.cards[c[idx]].cat;
    for (var i = idx + 1; i < c.length; i++) if (level.cards[c[i]].cat !== cat) return null;
    return c.slice(idx);
  }

  function idsOf(level, st, src) {
    if (src.t === 'waste') return st.waste.length ? [st.waste[st.waste.length - 1]] : null;
    return runAt(level, st, src.i, src.idx);
  }

  function check(level, st, ids, dest) {
    var C = level.cards;
    var cat = C[ids[0]].cat;
    var hasHead = ids.some(function (id) { return C[id].kind === 'head'; });
    if (dest.t === 'slot') {
      var cur = st.slots[dest.i];
      if (cur === null) return hasHead ? { ok: true } : { ok: false, reason: 'needs-heading' };
      if (hasHead) return { ok: false, reason: 'occupied' };
      return cur === cat ? { ok: true } : { ok: false, reason: 'mismatch' };
    }
    var col = st.cols[dest.i];
    if (!col.length) return { ok: true };
    return C[col[col.length - 1]].cat === cat ? { ok: true } : { ok: false, reason: 'mismatch' };
  }

  function place(level, st, ids, dest) {
    var C = level.cards, W = level.params.words, filed = null;
    if (dest.t === 'slot') {
      var cat = C[ids[0]].cat;
      st.slots[dest.i] = cat;
      ids.forEach(function (id) { if (C[id].kind === 'word') st.placed[cat]++; });
      if (st.placed[cat] === W) { st.slots[dest.i] = null; filed = cat; }
    } else {
      st.cols[dest.i] = st.cols[dest.i].concat(ids);
    }
    return filed;
  }

  function flip(st, i) {
    var len = st.cols[i].length;
    if (len && st.down[i] >= len) st.down[i] = len - 1;
    if (!len) st.down[i] = 0;
  }

  // Returns { state, filed } or null when the move is not allowed.
  function move(level, st, src, dest) {
    var ids = idsOf(level, st, src);
    if (!ids) return null;
    if (src.t === 'col' && dest.t === 'col' && src.i === dest.i) return null;
    if (!check(level, st, ids, dest).ok) return null;
    var s = clone(st);
    if (src.t === 'waste') s.waste.pop();
    else { s.cols[src.i].length = src.idx; flip(s, src.i); }
    var filed = place(level, s, ids, dest);
    s.moves++;
    return { state: s, filed: filed };
  }

  function draw(st) {
    if (!st.stock.length && !st.waste.length) return null;
    var s = clone(st);
    if (s.stock.length) s.waste.push(s.stock.pop());
    else { s.stock = s.waste.reverse(); s.waste = []; }
    s.moves++;
    return s;
  }

  function isWon(level, st) {
    var W = level.params.words;
    return st.placed.every(function (p) { return p === W; });
  }

  /* ---------- solver ----------
     Drawing one card at a time with unlimited passes means every inbox card is
     reachable, so the solver treats stock + waste as one pool. */

  function absMoves(level, s) {
    var C = level.cards, i, j, c, t, si;

    // Filing a word under its open heading never hurts, so take it immediately.
    for (i = 0; i < s.cols.length; i++) {
      c = s.cols[i];
      if (!c.length) continue;
      t = C[c[c.length - 1]];
      if (t.kind === 'word' && (si = s.slots.indexOf(t.cat)) >= 0) {
        return [{ src: { t: 'col', i: i, idx: c.length - 1 }, dest: { t: 'slot', i: si } }];
      }
    }
    for (i = 0; i < s.pool.length; i++) {
      t = C[s.pool[i]];
      if (t.kind === 'word' && (si = s.slots.indexOf(t.cat)) >= 0) {
        return [{ src: { t: 'pool', id: t.id }, dest: { t: 'slot', i: si } }];
      }
    }

    var out = [];
    var runStart = s.cols.map(function (col, k) {
      if (!col.length) return 0;
      var rs = col.length - 1, cat = C[col[rs]].cat;
      while (rs > s.down[k] && C[col[rs - 1]].cat === cat) rs--;
      return rs;
    });
    var emptySlot = s.slots.indexOf(null);
    var emptyCol = -1;
    for (i = 0; i < s.cols.length; i++) if (!s.cols[i].length) { emptyCol = i; break; }

    if (emptySlot >= 0) {
      var reach = s.placed.map(function () { return 0; });
      s.pool.forEach(function (id) { reach[C[id].cat]++; });
      s.cols.forEach(function (col, k) { for (var q = runStart[k]; q < col.length; q++) reach[C[col[q]].cat]++; });
      for (i = 0; i < s.cols.length; i++) {
        c = s.cols[i];
        for (j = runStart[i]; j < c.length; j++) {
          if (C[c[j]].kind === 'head') {
            out.push({ src: { t: 'col', i: i, idx: runStart[i] }, dest: { t: 'slot', i: emptySlot }, w: 40 + reach[C[c[j]].cat] });
            break;
          }
        }
      }
      s.pool.forEach(function (id) {
        if (C[id].kind === 'head') out.push({ src: { t: 'pool', id: id }, dest: { t: 'slot', i: emptySlot }, w: 40 + reach[C[id].cat] });
      });
    }

    for (i = 0; i < s.cols.length; i++) {
      c = s.cols[i];
      if (!c.length) continue;
      var rs = runStart[i], cat = C[c[rs]].cat;
      var uncovers = rs === s.down[i];
      for (j = 0; j < s.cols.length; j++) {
        var d = s.cols[j];
        if (j === i || !d.length || C[d[d.length - 1]].cat !== cat) continue;
        out.push({ src: { t: 'col', i: i, idx: rs }, dest: { t: 'col', i: j }, w: uncovers ? 60 : 30 });
      }
      if (emptyCol >= 0 && rs > 0) {
        out.push({ src: { t: 'col', i: i, idx: rs }, dest: { t: 'col', i: emptyCol }, w: uncovers ? 20 : 10 });
      }
    }
    out.sort(function (a, b) { return b.w - a.w; });
    return out;
  }

  function absApply(level, s, m) {
    var t = {
      cols: s.cols.slice(), down: s.down.slice(), pool: s.pool,
      slots: s.slots.slice(), placed: s.placed.slice()
    };
    var ids;
    if (m.src.t === 'pool') {
      ids = [m.src.id];
      t.pool = s.pool.filter(function (id) { return id !== m.src.id; });
    } else {
      ids = s.cols[m.src.i].slice(m.src.idx);
      t.cols[m.src.i] = s.cols[m.src.i].slice(0, m.src.idx);
      flip(t, m.src.i);
    }
    place(level, t, ids, m.dest);
    return t;
  }

  function absKey(s) {
    var cols = s.cols.map(function (c, i) { return s.down[i] + ':' + c.join(','); }).sort().join('|');
    return cols + '#' + s.pool.slice().sort(function (a, b) { return a - b; }).join(',') + '#' + s.slots.slice().sort().join(',');
  }

  // Returns the list of moves that finishes the level, or null if none was found within the budget.
  function solve(level, st, cap) {
    cap = cap || 20000;
    var seen = Object.create(null), nodes = 0;
    // Pool order is the order cards come to hand: the drawn card, the rest of the inbox,
    // then the older drawn cards after the inbox is turned over. Hints rely on this so that
    // following them never chases a card that keeps slipping back under the pile.
    var w = st.waste, pool = w.length ? [w[w.length - 1]] : [];
    pool = pool.concat(st.stock.slice().reverse(), w.slice(0, -1));
    var start = { cols: st.cols, down: st.down, pool: pool, slots: st.slots, placed: st.placed };
    function dfs(s) {
      if (isWon(level, s)) return [];
      var key = absKey(s);
      if (seen[key] || ++nodes > cap) return null;
      seen[key] = 1;
      var ms = absMoves(level, s);
      for (var i = 0; i < ms.length; i++) {
        var r = dfs(absApply(level, s, ms[i]));
        if (r) { r.unshift(ms[i]); return r; }
      }
      return null;
    }
    return dfs(start);
  }

  // Next step toward a solution from the current position.
  function hint(level, st) {
    var path = solve(level, st);
    if (!path || !path.length) return null;
    var m = path[0];
    if (m.src.t === 'pool') {
      var top = st.waste[st.waste.length - 1];
      if (top !== m.src.id) return { type: 'draw' };
      return { type: 'move', src: { t: 'waste' }, dest: m.dest };
    }
    return { type: 'move', src: m.src, dest: m.dest };
  }

  function stars(slips) { return slips <= 1 ? 3 : slips <= 4 ? 2 : 1; }

  var api = {
    paramsFor: paramsFor, deal: deal, makeLevel: makeLevel, runAt: runAt, idsOf: idsOf,
    check: check, move: move, draw: draw, isWon: isWon, solve: solve, hint: hint, stars: stars
  };
  root.FU_ENGINE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
