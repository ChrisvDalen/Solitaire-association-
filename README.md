# Filed Under

A word-association solitaire game for phones. Cards carry words instead of suits.
Heading cards open trays, and every word has to be filed in the tray it belongs under.
The game never tells you which heading a word belongs to; working that out is the puzzle.

It is an original game in the word-solitaire genre: its own name, rules, artwork and word lists.

## Play

- A **heading card** opens a tray. Drag it up, or tap it and then tap an empty tray.
- File each **word** in the tray with the matching heading.
- On the piles, cards stack only on a card with the same heading. Any card can start an empty pile.
- Draw from the inbox when stuck. A full tray empties itself and can be reused.
- Wrong guesses and hints count as slips. One slip or fewer earns three stamps.

Levels are endless and generated from the level number, so level 12 is the same deal for everyone.
Most cards start face down on the piles and trays are scarce, so which headings you open, and when,
decides whether the words you need can be dug out.

- **Today's deal**: one extra deal per calendar day, the same for everyone, with a streak counter.
- **Solver-checked**: every deal is verified as winnable before it is shown. Hint uses the same solver.
- **Stuck warning**: when no way to finish is left, the game says so and offers Undo or Restart.
- **Sound and vibration**: short synthesised cues, switched off from the menu.

## Run

No build step and no dependencies. Serve the folder and open it on a phone:

```bash
npm start
```

Then visit `http://<your-computer>:8080`. Over HTTPS (for example GitHub Pages) it installs to the
home screen and works offline.

```bash
npm test
```

```bash
npm run build
```

`build` writes `dist/filed-under.html`, the whole game in one file.

## Layout

| Path | What it holds |
| --- | --- |
| `src/data.js` | 48 headings with 8 words each |
| `src/engine.js` | rules, deal generation, solver, hints (no DOM, tested under node) |
| `src/ui.js` | rendering, tap and drag input, saved progress |
| `styles.css` | light and dark themes |
| `sw.js`, `manifest.webmanifest` | install and offline support |
