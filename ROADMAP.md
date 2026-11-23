# The Mims: Roadmap of ideas

Ideas that came up while reviewing milestones but are out of scope for the milestone at hand. `PLAN.md` stays the source of truth for milestones. This file collects ideas to make each system deeper, funnier or more immersive, so they aren't lost. Each idea notes the PR where it came up.

## Needs, objects and free will (from M2 review, PR #4)

### Make daily life read better
- **Walking pace that shows how a Mim feels:** Tired Mims shuffle, bladder-desperate Mims hurry with a little hop, happy Mims bounce. It's cheap to build (a speed multiplier plus a gait tweak in `mimDraw`) and says more than a need bar.
- **"Why" thoughts:** When free will picks something, show the need it serves for a beat (🍗 → 🍳) before the Mim walks off. When a Mim gives up on an unreachable object, show the object's icon with a ❓, not just a ❓.
- **Getting-up beat:** Add a short exit animation when leaving a bed, sofa or toilet, rather than snapping to the route tile. M2 has an unused `'exit'` phase that could carry this.
- **Reactions to the TV:** Mims laugh, gasp or groan at the TV now and then, with a matching small bubble. Channels could be satirical, like "Infomercial Channel" or "Competitive Napping". Fun gain could vary by channel and by personality later.

### Deeper chores and consequences
- **Dirty dishes:** Eating leaves a plate on the table or counter. Dishes lower the room score and can be cleaned at the sink, which uses the sink and adds a light chore. Leaving them out long enough attracts flies, setting up a later mishap.
- **Cooking outcomes:** Meal quality varies (burnt, ok, great) and later ties into the Cooking skill. Hunger gain and the "sad cold sandwich" text scale with quality. Burned food is already planned under Mishaps.
- **Servings:** Cooking makes a platter with several servings, so other household members (M4) can grab a plate without cooking again.
- **Fail-forward when interrupted:** When a desperate need interrupts an activity, the Mim drops what it's holding (the book on the floor, the TV left on) instead of quietly cancelling. Small leftover mess makes the house feel lived in.

### Social hooks (for M4)
- **Shared meals:** Mims eating at the same table chat on their own and gain Social and relationship.
- **Sofa company:** Watching TV side by side gives a small Social trickle, and couples cuddle.
- **Bathroom etiquette:** A Mim who walks into an occupied bathroom gets an embarrassed reaction and a short wait.

### Personality and memory (post-v1, with traits)
- **Favorite seat or object:** A Mim remembers objects it enjoyed and prefers them, with a small free will bonus. It grumbles if someone else is in its favorite chair.
- **Disliked objects:** A Mim avoids a toilet or shower that "betrayed" it (clogged, cold water) for a day.
- **Room memory:** Mims comment on a room getting nicer after build mode changes. This would make M3 decorating feel rewarding.

### UI polish
- **Need trends:** Show small ▲▼ arrows on need bars while a need is rising or falling quickly, so players can see the interaction working.
- **Queue previews:** Show a ghost icon over the target object for each queued action, so players can see where their Mim is going next.

## Build and buy (from M3 review, PR #6)

### Faster building
- **Room tool:** Drag a rectangle to place four walls at once (and optionally floor the inside), with the same live cost label. Most players build boxes first and tweak later.
- **Eyedropper:** Long-press (or Alt+click) a wall, floor or object to pick up its style or start placing another of it.
- **Paint a whole room:** Shift-tap (or double-tap on touch) with Paint or Floor to fill every wall or tile of the room the player tapped.
- **Redo:** Ctrl+Shift+Z and a redo button next to Undo.

### Make shopping feel good
- **Placement juice:** A little drop-and-bounce with a dust puff and a "thunk" when an object lands, and a coin-shower when selling.
- **Live object stats in the catalog:** Show the needs an object serves (🍗 🛁 🎉) and its room-score bonus on each card, so decor choices feel meaningful.
- **Show depreciation:** Show the current sell value in the object menu before the player taps Sell, with a short "Bought 3 days ago" line.
- **Confirm expensive sales:** Ask once before selling something worth more than ₥500 that a Mim is using.

### Mims reacting to the build
- **Mims watch you build:** While time is paused, Mims idle-animate (look around, glance at the camera) instead of freezing, so the house still feels alive.
- **Reactions to bad changes too:** Mirror "Pim-shawa!" with a grumble when a room score drops a lot (a favorite chair sold, a room bulldozed).
- **New-object curiosity:** After returning to Live, a Mim may wander over to inspect a newly bought object ("Ooh, shiny!"), with a small Fun boost. This also makes it obvious where the new thing went.
- **Trapped-Mim comedy:** Instead of a flat refusal, the toast shows the Mim's face with a worried thought bubble ("Gus would rather not live in a box").

### Later
- **Wall decorations:** Paintings and mirrors that hang on wall faces, using the same edge picking as doors and windows.
- **Lot value:** Show home value (lot plus walls plus objects), which feeds into later goals and the bills system.
