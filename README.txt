TACTIX 2 Prototype

How to run:
1. Unzip the folder.
2. Start a simple local web server in that folder.
   Examples:
   - Python: python3 -m http.server 8000
   - Node: npx serve
3. Open http://localhost:8000 in a browser.

Notes:
- This is a brand new prototype built from scratch for Tactix 2.
- It uses Phaser 3 loaded from a CDN in index.html.
- The prototype includes title flow, mode/team select, squad building, hex-grid combat, AI turns, mines, med packs, teleporter, melee, and capture-the-flag support.
- Included file main.js is the runtime build. A TypeScript-style source copy is also included at src/main.ts for reference/editing.
