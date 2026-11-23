# The Mims: Content Draft

First pass at all names, numbers and jokes. Everything here is a starting point: numbers will move during the balance pass, and any joke can be swapped. In code, this lives as data in `src/content/`.

## Currency and basics

- **Currency:** Mints, written `₥`. "Freshly printed, slightly minty."
- **Starting funds:** ₥20,000 for a new household on an empty lot, ₥5,000 for the starter house.
- **Time:** 1 real second = 1 game minute at 1x speed. A game day is 24 minutes at 1x.
- **Bills:** Arrive every 3 days at 7% of home value (house plus objects), due within 3 days. After that, the Repo Mim arrives.

## Starter household: the Fumblewicks

| Mim | Age | Vibe | Career at start | Voice |
| --- | --- | --- | --- | --- |
| Bartley Fumblewick | Adult | Optimist who has read one book on leadership | Corporate Synergy, level 1 | Medium pitch, slow, warm |
| Dotty Fumblewick | Adult | Inventor of things nobody requested | Fringe Science, level 2 | High pitch, fast, bright |
| Gus Fumblewick | Adult (cousin, "just staying a week", three years ago) | Professional napper | None | Low pitch, mumbly |
| Pim Fumblewick | Adult (until aging arrives) | Aspiring mime, refuses to explain | Mime Arts, level 1 | Very high, bouncy |

Next door (for the neighborhood phase): the **Gristlethorpes**, who own a lawn flamingo and a grudge.

## Careers

Each track has 6 levels. Pay is per work day. Hours are game hours. Carpool arrives 1 hour before the shift. From level 3 up, promotions also need skills (post-v1); in v1 they depend on mood leaving for work and days worked.

### Corporate Synergy
*"Leverage your core competencies, whatever those are."* Vehicle: a beige sedan with a "Proud Synergist" bumper sticker.

| Lvl | Title | Hours | Pay | Days to promote |
| --- | --- | --- | --- | --- |
| 1 | Coffee Fetch Associate | 9-17 | ₥140 | 3 |
| 2 | Spreadsheet Whisperer | 9-17 | ₥210 | 4 |
| 3 | Junior Synergist | 9-18 | ₥320 | 5 |
| 4 | Manager of Managers | 8-18 | ₥480 | 6 |
| 5 | VP of Vision | 10-16 | ₥720 | 7 |
| 6 | Chief Buzzword Officer | 11-15 | ₥1,100 | - |

### Fringe Science
*"Results not guaranteed. Explosions somewhat guaranteed."* Vehicle: a van that hums at a frequency only dogs can hear.

| Lvl | Title | Hours | Pay | Days to promote |
| --- | --- | --- | --- | --- |
| 1 | Beaker Rinser | 8-16 | ₥130 | 3 |
| 2 | Lab Rat Wrangler | 8-16 | ₥200 | 4 |
| 3 | Theoretical Guesser | 10-18 | ₥310 | 5 |
| 4 | Doctor of Probably | 10-19 | ₥470 | 6 |
| 5 | Mad Scientist (Licensed) | 20-03 | ₥760 | 7 |
| 6 | Inventor of New Problems | 12-17 | ₥1,200 | - |

### Fast Food Empire
*"Climb the ladder. The ladder is slightly greasy."* Vehicle: a hatchback with a giant fiberglass bun on the roof.

| Lvl | Title | Hours | Pay | Days to promote |
| --- | --- | --- | --- | --- |
| 1 | Fry Philosopher | 16-23 | ₥110 | 2 |
| 2 | Drive-Thru Whisperer | 16-23 | ₥170 | 3 |
| 3 | Shift Overlord | 14-22 | ₥260 | 4 |
| 4 | Regional Sauce Strategist | 9-17 | ₥420 | 5 |
| 5 | Franchise Baron | 10-16 | ₥680 | 6 |
| 6 | Burger Monarch | 11-14 | ₥1,000 | - |

### Mime Arts
*"Say nothing. Earn something."* Vehicle: an invisible car. (It honks.)

| Lvl | Title | Hours | Pay | Days to promote |
| --- | --- | --- | --- | --- |
| 1 | Unpaid Street Mime | 11-17 | ₥60 | 2 |
| 2 | Invisible Box Specialist | 11-17 | ₥150 | 3 |
| 3 | Professional Wall Leaner | 12-19 | ₥270 | 4 |
| 4 | Silent Headliner | 18-23 | ₥450 | 5 |
| 5 | Mime Laureate | 18-22 | ₥740 | 6 |
| 6 | Voice of a Generation (Silently) | 19-21 | ₥1,150 | - |

### Job messages
- **Hired:** "Congratulations! {name} is now a {title}. Please do not ask what that means."
- **Promoted:** "{name} has been promoted to {title}! The raise is ₥{pay}. The responsibility is unclear."
- **Missed carpool:** "{name} missed the carpool. The driver waited 4 seconds, which they consider generous."
- **Warning:** "{name}'s boss called. They used the phrase 'circle back' in a threatening way."
- **Fired:** "{name} has been let go, effective immediately. Their stapler has been confiscated."
- **Bad mood demotion warning:** "{name} went to work in a foul mood and was described as 'a presence'."

## Needs

| Need | Low thought bubble | Desperate message |
| --- | --- | --- |
| Hunger | A drumstick | "{name} is so hungry they're eyeing the houseplant." |
| Energy | A pillow | "{name} is about to fall asleep standing up. Again." |
| Hygiene | A stink cloud | "{name} has developed a visible aura. Not the good kind." |
| Bladder | A toilet | "{name} needs a bathroom. Urgently. Very urgently." |
| Fun | A yawning face | "{name} is so bored they're counting ceiling tiles. There are no ceiling tiles." |
| Social | Two faces | "{name} has started narrating their day to the fridge." |
| Comfort | A chair | "{name}'s back is filing a formal complaint." |
| Room | A wilting flower | "{name} finds this room spiritually beige." |

## Objects (v1 catalog, 26 items)

Need gains are per hour of use unless marked. Tiers in parentheses share an interaction set.

### Kitchen

| Object | Price | Interactions and needs | Description |
| --- | --- | --- | --- |
| Chillmaster Basic Fridge | ₥600 | Grab Snack (Hunger +20 once), Cook Meal (Hunger +60 once, needs counter + stove) | "Keeps food cold and secrets colder." |
| Chillmaster Deluxe Fridge | ₥2,100 | Same, meals give +75 | "Has a little light inside. It never turns off. We checked." |
| Hot Box Stove | ₥400 | Used by Cook Meal; small fire chance post-v1 | "Four burners, one of which works reliably." |
| Countertop of Destiny | ₥250 | Prep surface for Cook Meal | "A flat surface. That's the whole pitch." |
| Mostly Clean Sink | ₥300 | Wash Dishes, Wash Hands (Hygiene +5) | "Pre-stained for your convenience." |
| Wobblewood Table | ₥200 | Eat Here (Comfort +, Social + if others sit) | "Three legs are perfectly level." |
| Folding Chair of Regret | ₥80 | Sit (Comfort +10) | "Folds when you least expect it." |
| Dining Chair, Respectable | ₥350 | Sit (Comfort +25) | "For when the in-laws visit." |
| Dumpling Trash Can | ₥50 | Throw Away, Empty (Room - when full) | "Holds up to one day of shame." |

### Bathroom

| Object | Price | Interactions and needs | Description |
| --- | --- | --- | --- |
| Porcelain Throne, Economy | ₥300 | Use (Bladder to full), Unclog | "Clogs on a schedule only it understands." |
| Porcelain Throne, Royal | ₥1,200 | Use (Bladder to full, Comfort +10), heated seat | "Heated seat. Ambient music. You may never leave." |
| Drizzle Shower | ₥650 | Shower (Hygiene +50/hr) | "Water pressure: emotional." |
| Clawfoot Soaker Tub | ₥1,800 | Bathe (Hygiene +40/hr, Comfort +20/hr) | "The feet are decorative. Probably." |
| Mirror, Honest | ₥120 | Check Self (Fun +5), Practice Speech (Charisma skill post-v1) | "Reflects reality. No refunds." |

### Bedroom and living room

| Object | Price | Interactions and needs | Description |
| --- | --- | --- | --- |
| Lumpy Single Bed | ₥300 | Sleep (Energy +12/hr, Comfort +5/hr), Nap | "Each lump has a name." |
| Cloud Nine Double Bed | ₥2,400 | Sleep (Energy +20/hr, Comfort +15/hr), Cuddle | "Clinically proven to make mornings harder." |
| Sofa of Questionable Origin | ₥450 | Sit, Nap (Energy +6/hr), Watch TV with others | "Found on a curb. Cleaned once." |
| Lounge-o-Matic 3000 | ₥1,500 | Sit (Comfort +30/hr), Recline | "Reclines so far you'll see your past." |
| Gloworama TV | ₥500 | Watch (Fun +25/hr), channels: Cooking, Romance, Explosions | "Shows 11 channels, 9 of which are infomercials." |
| Boombox Supreme | ₥350 | Listen (Fun +15/hr), Dance (Fun +25/hr, Social + with others) | "Plays every genre loudly." |
| Bookshelf of Unread Classics | ₥400 | Read (Fun +10/hr), Study (skills post-v1) | "Makes the room look smarter." |
| Clackbox Computer | ₥1,000 | Play Games (Fun +30/hr), Find Job | "Dial-up included, at no extra charge." |
| Yellow Phone | ₥75 | Call a Friend (Social +), Order Pizza (Hunger +50, ₥40) | "Rings at dinner. Every time." |

### Decor

| Object | Price | Interactions and needs | Description |
| --- | --- | --- | --- |
| Potted Fern Named Steve | ₥90 | Water (Room + when healthy) | "Steve needs you. Steve will remember this." |
| Lava Lamp of Ambiance | ₥140 | Light, Stare At (Fun +5/hr) | "Blobs. Endless blobs." |
| Painting of a Slightly Sad Horse | ₥600 | Room + | "The horse knows something." |
| Lawn Flamingo | ₥40 | Room + outdoors, Kick (Fun +3) | "Pink, plastic, judgmental." |

## Social interactions

Acceptance depends on both Mims' mood and their relationship. Each has a success and a rejection line shown as an icon in the speech bubble, plus a log message.

| Interaction | Needs relationship | Success | Rejection |
| --- | --- | --- | --- |
| Chat | Any | Social +, daily +2 | "{target} pretends to get a phone call." |
| Tell Joke | Any | Social +, Fun +, daily +4 | "{target} explains the joke back, incorrectly." |
| Compliment | Any | daily +5 | "{target} suspects a sales pitch." |
| Talk About Weather | Any | daily +1, always accepted | (never rejected; it's the weather) |
| Mime Act | Any | Fun +, daily +3 | "{target} walks through the invisible wall on purpose." |
| High Five | Daily 20+ | daily +4 | "{actor} is left hanging. Forever." |
| Hug | Daily 40+ | daily +8 | "{target} offers a firm handshake instead." |
| Back Rub | Daily 50+ | Comfort +, daily +6 | "{target} says their back is 'fine, thanks'." |
| Dance Together | Daily 30+, needs music | Fun +, daily +6 | "{target} does the robot instead. Badly." |
| Gossip | Daily 30+ | daily +5, third Mim -3 | "{target} says they don't gossip, then gossips about {actor}." |
| Argue | Any | daily -8 | (both lose) |
| Insult | Any | daily -12 | "{target} doesn't understand the insult. Somehow worse." |
| Slap Fight | Daily below -40 | daily -15, Fun + for the winner | (a cloud of dust and flailing) |

Relationship labels: below -60 *Nemesis*, -60 to -20 *Not a Fan*, -20 to 20 *Acquaintance*, 20 to 50 *Friendly*, 50 to 80 *Friend*, above 80 *Best Friend*.

## Mishaps (v1)

- **Pass out:** Energy hits 0. "{name} has decided the floor is a bed now."
- **Bladder accident:** Bladder hits 0. A puddle appears, Hygiene drops, Room drops. "{name} couldn't make it. Nobody speaks of this."
- **Mood strike:** Mood very low; the Mim refuses non-urgent actions and waves their arms. "{name} is too upset to {action}."
- **Burnt meal:** 15% chance when cooking tired. "Dinner is now charcoal-flavored."
- **Clogged toilet:** Random chance per use on the economy model. Needs Unclog or a call to a repair Mim (₥50).
- **Broken folding chair:** Folding Chair of Regret has a 2% chance per sit to fold. Comfort -20, Fun +5 for anyone watching.
- **Repossession:** Bills 3 days overdue. The Repo Mim takes objects until the debt is covered. "The Repo Mim apologizes, but not convincingly."

## Mimlish

Gibberish built from a fixed syllable set so it sounds consistent. Each Mim favors a seeded subset of these, which, combined with their voice settings, gives them a recognizable way of speaking.

- **Syllables:** ba, bo, bim, blee, da, doo, fa, fim, ga, goo, ka, kip, la, loo, ma, mim, mee, na, noo, pa, pim, ploo, ra, sa, sha, ta, tib, va, wa, wub, za, zoo
- **Stock phrases** (used in log text and as fixed babble patterns):
  - *Mim-ba!* Hello
  - *Fa-loo noo?* How are you?
  - *Zib zib.* Yes
  - *Noo-ka.* No
  - *Pim-shawa!* Hooray
  - *Blee-dooga.* Oops
  - *Wub ta ploo.* I'm hungry
  - *Mimmasa.* Goodnight
  - *Gaa-RA!* (an expression of rage best not translated)

## Bills and mail

- **Bill notice:** "BILL: Your house continues to exist. That'll be ₥{amount}."
- **Overdue:** "FINAL NOTICE: We are no longer asking nicely. We were never asking nicely."
- **Junk mail:** "You may have already won a slightly used blender."
- **Fan mail (Mime Arts level 4+):** a blank sheet of paper, framed.

## Loading screen lines

- Inflating the furniture
- Teaching Mims to walk in straight lines
- Hiding the ladders
- Untangling the carpool schedule
- Rehearsing small talk
- Convincing the fern to live
- Calibrating awkward silences
- Adding one more cushion
- Sorting Mints by mintiness
- Lowering expectations
