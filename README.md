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
| Select a Mim | Tap the Mim | Click the Mim |
| Use an object | Tap it, then pick from the pie menu | Click it, then pick |
| Object or Mim info | Long-press | Hover |
| Cancel an action | Tap its icon in the queue | Click its icon |
| Walk somewhere | Tap a tile | Click a tile |
| Pan | One-finger drag | Drag, WASD or arrows |
| Zoom | Pinch | Wheel or trackpad pinch, `+`/`-` |
| Rotate camera | Two-finger twist or ⟲ ⟳ buttons | `Q`/`E` |
| Speed | Speed buttons | `1`-`3`, space to pause |

## Deploy

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`. One-time setup: in the repo's Settings, then Pages, set the source to "GitHub Actions".
