const test = require('node:test');
const assert = require('node:assert');
const DATA = require('../src/data.js');
const E = require('../src/engine.js');

test('word list: unique, short, enough per heading', () => {
  const seen = new Map();
  for (const h of DATA) {
    assert.ok(h.words.length >= 6, h.name);
    for (const w of [h.name, ...h.words]) {
      const k = w.toLowerCase();
      assert.ok(!seen.has(k), `"${w}" appears under ${seen.get(k)} and ${h.name}`);
      seen.set(k, h.name);
    }
    for (const w of h.words) assert.ok(w.length <= 9, w);
  }
});

// Replays a solver path through the real rules (draw one card at a time, waste top only).
function replay(level, st, path) {
  for (const m of path) {
    let src = m.src;
    if (src.t === 'pool') {
      let guard = 0;
      while (st.waste[st.waste.length - 1] !== src.id) {
        st = E.draw(st);
        assert.ok(++guard < 500, 'card never surfaced');
      }
      src = { t: 'waste' };
    }
    const r = E.move(level, st, src, m.dest);
    assert.ok(r, 'solver produced an illegal move');
    st = r.state;
  }
  return st;
}

test('levels 1-40 are solvable and the solution replays under the real rules', () => {
  for (let n = 1; n <= 40; n++) {
    const { level, state } = E.makeLevel(n);
    const path = E.solve(level, state);
    assert.ok(path, `level ${n} unsolved`);
    assert.ok(E.isWon(level, replay(level, state, path)), `level ${n} replay`);
  }
});

test('deals are deterministic', () => {
  assert.deepStrictEqual(E.makeLevel(9), E.makeLevel(9));
});

test('placement rules', () => {
  const { level, state } = E.makeLevel(1);
  const C = level.cards;
  const head = C.find((c) => c.kind === 'head' && c.cat === 0).id;
  const word = C.find((c) => c.kind === 'word' && c.cat === 0).id;
  const other = C.find((c) => c.kind === 'word' && c.cat === 1).id;
  assert.strictEqual(E.check(level, state, [word], { t: 'slot', i: 0 }).reason, 'needs-heading');
  assert.ok(E.check(level, state, [head], { t: 'slot', i: 0 }).ok);
  const open = { ...state, slots: [0, null] };
  assert.ok(E.check(level, open, [word], { t: 'slot', i: 0 }).ok);
  assert.strictEqual(E.check(level, open, [other], { t: 'slot', i: 0 }).reason, 'mismatch');
  assert.strictEqual(E.check(level, open, [C.find((c) => c.kind === 'head' && c.cat === 1).id], { t: 'slot', i: 0 }).reason, 'occupied');
});

test('hint always leads somewhere from a fresh deal', () => {
  for (let n = 1; n <= 12; n++) {
    const { level, state } = E.makeLevel(n);
    assert.ok(E.hint(level, state));
  }
});

test('following hints alone finishes the level', () => {
  for (const n of [1, 2, 5, 9, 14, 20, 26, 33]) {
    let { level, state } = E.makeLevel(n);
    let steps = 0;
    while (!E.isWon(level, state)) {
      const h = E.hint(level, state);
      assert.ok(h, `level ${n}: no hint at step ${steps}`);
      state = h.type === 'draw' ? E.draw(state) : E.move(level, state, h.src, h.dest).state;
      assert.ok(++steps < 1500, `level ${n}: hints go in circles`);
    }
  }
});

test('daily deals are solvable, deterministic and differ by day', () => {
  const a = E.makeDaily('2026-11-12'), b = E.makeDaily('2026-11-13');
  assert.deepStrictEqual(a, E.makeDaily('2026-11-12'));
  assert.notDeepStrictEqual(a.state, b.state);
  assert.strictEqual(a.level.daily, '2026-11-12');
  for (let d = 1; d <= 28; d++) {
    const k = `2027-02-${String(d).padStart(2, '0')}`;
    const { level, state } = E.makeDaily(k);
    assert.ok(E.solve(level, state), k);
  }
});

test('every card is dealt exactly once and most of them onto the piles', () => {
  for (const n of [1, 4, 9, 20, 30]) {
    const { level, state } = E.makeLevel(n);
    const all = [...state.cols.flat(), ...state.stock].sort((x, y) => x - y);
    assert.deepStrictEqual(all, level.cards.map((c) => c.id));
    assert.ok(state.cols.flat().length > state.stock.length, `level ${n}`);
    assert.ok(state.cols.every((c) => c.length >= 1));
  }
});

test('a dead position is recognised and a live one is not', () => {
  const { level, state } = E.makeLevel(3);
  assert.strictEqual(E.isDead(level, state), false);

  // Hand-built: both trays are held by headings whose only word sits under another heading.
  const cards = [];
  for (let cat = 0; cat < 4; cat++) {
    cards.push({ id: cards.length, cat, kind: 'head', text: 'H' + cat });
    cards.push({ id: cards.length, cat, kind: 'word', text: 'W' + cat });
  }
  const tiny = { n: 0, daily: null, params: { cats: 4, words: 1, slots: 2, cols: 2 }, cards };
  const dead = { cols: [[1, 4], [3, 6]], down: [1, 1], stock: [5, 7], waste: [], slots: [0, 1], placed: [0, 0, 0, 0], moves: 0 };
  assert.strictEqual(E.isDead(tiny, dead), true);
  // Free one tray and the same layout can be finished.
  assert.strictEqual(E.isDead(tiny, { ...dead, slots: [0, null], cols: [[1, 4], [6]], down: [1, 0], stock: [5, 7, 3, 2] }), false);
});
