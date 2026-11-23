# The Mims: Game Plan

A browser-based life simulation with a playful, satirical tone. You guide a household of little people called Mims through their needs, jobs, friendships and home renovations. The mechanics draw on early life sims (needs, free will, build/buy, careers), while the name, characters, art, writing and UI are all our own.

## Decisions so far

| Area | Choice |
| --- | --- |
| View | 2D isometric, drawn on HTML canvas, camera rotates between 4 fixed stops |
| Art | Procedural shapes in code for v1, built so sprites can be swapped in later |
| Stack | TypeScript + Vite, static site, no server |
| Saves | Browser storage (IndexedDB), versioned and autosaved |
| Household | Up to 8 Mims |
| Input | Touch first (phones and tablets), then mouse and keyboard; one Pointer Events code path |
| Control | Tap or click objects for a pie menu, queue actions, free will fills empty queues (toggleable) |
| Tone | Playful satire: gibberish "Mimlish" speech, deadpan item descriptions, absurd mishaps |
| Audio | Synthesized Mimlish babble with a distinct voice per Mim, plus simple sound effects |
| Hosting | GitHub Pages, deployed by GitHub Actions on every push to `main` |
| Content | All names, careers, objects and jokes drafted in [`CONTENT.md`](CONTENT.md) |
| v1 systems | Needs + free will, build/buy, jobs and money, relationships |
| Later | Skills, character creator with traits, aging and life events, neighborhood of lots |

## Core loop

1. Mims have needs that decay over time.
2. Objects in the house "advertise" how much they satisfy each need.
3. The player queues actions, or idle Mims choose for themselves.
4. Mims go to work, earn money, and bills arrive every few days.
5. Money buys better objects and bigger rooms, which satisfy needs faster and free up time for friends, fun and promotions.
6. Neglect leads to funny (and occasionally dire) consequences.

## Architecture

```
src/
  main.ts            boot, wire systems together
  engine/
    loop.ts          fixed-step simulation tick + requestAnimationFrame render
    clock.ts         game time (minutes/days), speeds: pause, 1x, 2x, 3x
    rng.ts           seeded RNG so simulations are reproducible in tests
    events.ts        small typed event bus (UI <-> sim)
    input.ts         Pointer Events -> gestures (tap, long-press, drag, pinch, twist) and key bindings
  audio/
    voice.ts         per-Mim babble synthesizer (Web Audio)
    sfx.ts           synthesized sound effects, volume and mute settings
  world/
    grid.ts          lot tiles, wall segments on tile edges, doors, floors
    iso.ts           world <-> screen projection, picking
    camera.ts        pan, zoom, rotation between 4 stops (90 degree steps)
    pathfinding.ts   A* on tiles, respects walls and doors, path caching
    render/          depth sorting, wall cutaway modes, procedural drawing of Mims and objects
  sim/
    mim.ts           a Mim: needs, mood, action queue, current interaction, position
    needs.ts         need definitions, decay rates, mood formula
    objects/         object definitions as data (price, footprint, slots, interactions)
    interactions.ts  interaction state machine: route -> approach slot -> perform -> finish
    freewill.ts      utility scoring for autonomous choices
    social.ts        relationship scores and social interactions
    career.ts        career tracks, schedules, pay, promotions
    economy.ts       funds, purchases, refunds, bills, repossession
    mishaps.ts       failure states (passing out, accidents, unpaid bills)
  ui/                DOM overlay on top of the canvas (HTML/CSS)
    hud.ts           clock, speed, funds, household portraits
    needsPanel.ts    need bars, mood, relationships, job tab
    pieMenu.ts       radial interaction menu
    buildMode.ts     wall/floor/door tools, catalog, undo
    bubbles.ts       thought and speech bubbles with icons
  content/           data from CONTENT.md: careers, objects, interactions, phrases
  save/
    serialize.ts     versioned save schema with migrations
    storage.ts       IndexedDB slots + autosave
tests/               Vitest unit tests and headless sim runs
```

Keeping the simulation independent of rendering lets us run thousands of in-game days headlessly to tune balance, and keeps a later art swap contained to `world/render`.

## Key systems

### Camera
The camera views the lot from one of four fixed corners (northeast, southeast, southwest, northwest), 90 degrees apart.

- **Controls:** On touch, a two-finger twist snaps to the next stop, one-finger drag pans, and pinch zooms. On-screen rotate buttons are always visible. With a keyboard, `Q`/`E` rotate, WASD or arrows pan, and the mouse wheel or `+`/`-` zoom. Zoom snaps between three or four fixed levels so procedural art stays crisp.
- **Rotation around the view center:** Rotating keeps whatever tile is in the middle of the screen in the middle, so you don't lose your place.
- **Short transition:** A quick (around 200 ms) fade or swing between stops, so the change reads clearly without needing true 3D. Input is ignored during the transition.
- **One projection function:** The sim always works in world coordinates. `iso.ts` applies the current rotation when converting world to screen and back, so pathfinding, saves and game logic never know which way the camera faces.
- **Drawing per facing:** Mims and objects store a world facing (N/E/S/W). The renderer combines that with the camera rotation to pick which of four views to draw, so a couch facing the TV still looks right from every corner. Procedural drawing functions take a view direction argument from the start, which keeps sprite art swappable later (four views per object).
- **Depth sorting and picking:** Draw order and click detection are recomputed from rotated coordinates, with tests that click the same tile from all four rotations and get the same result.
- **Walls follow the camera:** Cutaway mode lowers the walls nearest the camera, so which walls drop changes with each rotation.
- **Build mode:** Placement previews, rotating an object (a rotate handle on touch, `,` and `.` keys on desktop) and wall dragging all work in screen-relative terms, so "rotate clockwise" feels the same from any corner.
- **Saved with the game:** The current rotation, pan and zoom are stored in the save so you return to the same view.

### Touch-first input
Touch is the primary design target, and mouse and keyboard map onto the same actions.

| Action | Touch | Mouse and keyboard |
| --- | --- | --- |
| Select a Mim | Tap the Mim or its portrait | Click |
| Open pie menu | Tap an object or Mim | Click |
| Walk somewhere | Tap a floor tile | Click |
| Pan | One-finger drag | Drag, WASD or arrows |
| Zoom | Pinch | Wheel, `+`/`-` |
| Rotate camera | Two-finger twist or rotate buttons | `Q`/`E` |
| Cancel a queued action | Tap its icon in the queue | Click |
| Inspect (tooltip info) | Long-press | Hover |
| Game speed | Speed buttons | `1`-`3`, space to pause |

- **Sized for fingers:** Every button and pie menu slice is at least 44 px, and the pie menu opens around the tapped point while staying inside the screen.
- **No hover required:** Anything shown on hover on desktop is also reachable by long-press, so nothing is desktop-only.
- **Build mode on touch:** The object being placed floats slightly above the finger so it isn't hidden, snaps to the grid, and gets confirmed with a checkmark button (or by releasing on desktop). Walls are drawn by dragging from a start point, with the length shown as you go.
- **Responsive layout:** The HUD works in portrait and landscape, with the needs panel and catalog as collapsible drawers on small screens, and respects notches and safe areas.
- **Performance on phones:** Static layers (floors, walls) are cached to offscreen canvases and only redrawn when they change, and the pixel ratio is capped to keep frame rates up.
- **Installable:** A web app manifest so the game can be added to a home screen and run full screen.

### Audio and Mimlish babble
All sound is synthesized with the Web Audio API, so there are no audio files to license or download.

- **A voice per Mim:** Each Mim gets voice settings generated from a seed when they are created: base pitch, pitch range, speaking speed, timbre (vowel formants and waveform), and a favorite set of syllables. The same Mim always sounds the same, and household members sound clearly different.
- **How babble works:** A phrase is a string of Mimlish syllables (see `CONTENT.md`). Each syllable plays as a short tone shaped by two vowel formants, with small random pitch wobble.
- **Emotion changes delivery:** Questions rise at the end, happy chatter bounces higher, arguments are faster and lower with harsher timbre, and sleepy Mims mumble slowly.
- **Saved with the Mim:** Voice settings are part of the save, and the character creator (post-v1) will expose them as sliders with a preview button.
- **Mixing:** Only the few Mims closest to the camera center babble at once, quieter when zoomed out, so 8 talking Mims never turn into noise.
- **Sound effects:** Synthesized blips for UI, cash register for purchases, toilet flush, snoring, and the carpool horn.
- **Mobile audio rules:** Browsers block sound until the first tap, so audio starts on the first interaction. Settings include volume sliders and mute.

### Needs and mood
Eight needs, each 0 to 100: **Hunger, Energy, Hygiene, Bladder, Fun, Social, Comfort, Room** (how pleasant the surroundings are). Each decays at its own rate, with modifiers (sleeping slows hunger, work drains energy). Mood is a weighted sum where low needs weigh more heavily, so one desperate need drags mood down sharply. Thresholds trigger thought bubbles, then complaints, then mishaps.

### Objects and advertisements
Every object is a data entry: name, satirical description, price, footprint, rotation, use slots, and a list of interactions. Each interaction advertises need changes (for example, Fridge "Grab a Snack": Hunger +25 over 10 minutes). Object quality tiers mean a cheap couch gives less Comfort than an expensive one. Starter catalog of around 25 objects: fridge, stove, counter, table, chairs, beds, toilet, shower, sink, couch, TV, stereo, bookshelf, lamps, plants, paintings, trash can, phone, computer, mailbox, and a few gag items.

### Free will
When a Mim's queue is empty, it scores every available interaction:

`score = sum over needs of (need weight curve x advertised gain) - distance penalty - "already in use" penalty + small random jitter`

The Mim picks from the top few choices with weighted randomness so behavior feels alive and slightly irrational. Desperate needs override everything (a Mim at 5 Bladder will drop the TV remote mid-show).

### Actions and interactions
The player clicks an object, picks from the pie menu, and the action joins that Mim's queue (max 6). Interactions are small state machines: path to the object, reserve a slot, play the action, apply need changes per tick, then finish or get interrupted. Slot reservation keeps 8 Mims from all sitting in the same chair.

### Build/buy mode
Pauses the simulation. Tools for walls (drag along tile edges), floors, wallpaper, doors, windows, and object placement with rotation, plus sell (with depreciation), move, and undo. Validation prevents blocking doors or sealing a Mim inside a wall. Wall view modes: walls up, cutaway, walls down.

### Relationships
Each pair of Mims has a **daily** score (decays) and a **lifetime** score (moves slowly toward daily). Social interactions (Chat, Joke, Compliment, Hug, Back Rub, Argue, Insult, Slap Fight) have acceptance chances based on mood and relationship. Successful ones raise Social need and scores; rejections are played for comedy. Speech bubbles show icons and Mimlish gibberish.

### Jobs and money
Three or four satirical career tracks at launch (ideas: Corporate Synergy, Fringe Science, Fast Food Empire, Public Nuisance/Mime Arts), each with around 6 levels, a work schedule, and a carpool that arrives at a set time. Miss it and you lose a day's pay. Promotion chance depends on mood when leaving for work (and later skills and friend count). Bills arrive every 3 days based on home value; unpaid bills eventually bring the Repo Mim to take furniture.

### Mishaps (v1)
Passing out from exhaustion, bladder accidents, refusing to do anything when mood is awful, burned food, and getting fired after too many missed days. Fire, death and other heavier outcomes are saved for the life events phase.

### Saves
Versioned JSON schema stored in IndexedDB, several save slots, autosave each in-game morning, plus export/import to a file for backups.

## Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Skeleton | Vite + TS project deployed to GitHub Pages, canvas renders an isometric lot, touch and mouse input, camera pan/zoom and rotation between 4 stops (picking verified from every rotation), game clock with speed controls |
| M1 | A Mim walks | Procedurally drawn Mim, tap or click a tile to walk there via A*, walls block movement |
| M2 | Needs + objects | 8 needs decaying, ~10 objects with interactions, touch-friendly pie menu, action queue, free will toggle |
| M3 | Build/buy | Walls, floors, doors, catalog, funds, sell/move/undo, wall cutaway |
| M4 | Full household | Up to 8 Mims, slot reservation, social interactions, relationship panel, per-Mim babble voices |
| M5 | Work and bills | Careers, carpool, promotions, bills, repossession, v1 mishaps |
| M6 | Playable v1 | Saves, starter house and family, catalog of ~25 objects, balance pass from headless runs, sound effects, installable on phones |

Post-v1, roughly in priority order:

- **Skills:** Cooking, Mechanical, Charisma, Body, Logic, Creativity, built through objects (bookshelf, mirror, easel) and required for promotions.
- **Character creator:** Name, look (procedural body, skin, hair, outfit colors), and personality traits that shift need decay and free will preferences.
- **Aging and life events:** Babies, children, adults, elders; neglect and accidents can be fatal (with a satirical afterlife touch, like a ghost who rattles the fridge).
- **Neighborhood:** A map of several lots, moving families in and out, visitors walking by, inviting neighbors over.

## Testing approach

- **Vitest** for pure simulation logic: need decay, scoring, pathfinding, economy, save migrations.
- **Headless balance runs:** Simulate a household for 30 in-game days with free will on and assert they survive with reasonable mood and money.
- **Playwright smoke tests:** Run on an emulated phone (touch) and a desktop browser: load the page, place an object, run time forward, rotate the camera, confirm nothing throws.
- **Gesture tests:** Unit tests feed recorded pointer sequences into `input.ts` and check they become the right gestures (a slow drag is a pan, not a tap).

## Deployment
- A GitHub Actions workflow builds the site and publishes it to GitHub Pages on every push to `main`, at `https://zacksimon.github.io/themims/` (Vite's `base` set to `/themims/`).
- Pull requests run type checks, tests and a build, so broken changes don't reach the live site.
- **One manual step for you:** In the repo's Settings, then Pages, set the source to "GitHub Actions". I'll add the workflow in M0 and remind you when it's time.
