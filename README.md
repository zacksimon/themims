# The Mims

A browser-based life sim with a satirical streak. See [PLAN.md](PLAN.md) for the design and roadmap and [CONTENT.md](CONTENT.md) for names, careers and jokes.

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build
npm run e2e        # browser smoke test on phone + desktop (after build), screenshots in tests/e2e/out
```

## Controls

| Action | Touch | Mouse and keyboard |
| --- | --- | --- |
| Select a Mim | Tap the Mim or their portrait | Click the Mim or their portrait |
| Socialize | With a Mim selected, tap another Mim | Same, with a click |
| Use an object | Tap it, then pick from the pie menu | Click it, then pick |
| Object or Mim info | Long-press | Hover |
| Cancel an action | Tap its icon in the queue | Click its icon |
| Walk somewhere | Tap a tile | Click a tile |
| Pan | One-finger drag | Drag, WASD or arrows |
| Zoom | Pinch | Wheel or trackpad pinch, `+`/`-` |
| Rotate camera | Two-finger twist or ⟲ ⟳ buttons | `Q`/`E` |
| Speed | Speed buttons | `1`-`3`, space to pause |
| Buy furniture | 🛋️ Buy, pick an item, tap a spot (drag to adjust), ✓ | Buy, pick an item, click to place |
| Rotate while placing | ⟳ button | `,` and `.` |
| Move, rotate or sell | In Buy mode, tap the object | In Buy mode, click the object |
| Build walls / floors | 🔨 Build, pick a tool, drag | Same, with the mouse (right-drag pans) |
| Doors, windows, paint | Pick the tool, tap a wall | Click a wall |
| Undo | Undo button | Ctrl+Z |
| Sound | 🔊 button (volume, mute) | Same |

## Deploy

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`. One-time setup: in the repo's Settings, then Pages, set the source to "GitHub Actions".
