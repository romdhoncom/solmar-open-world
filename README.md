[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar — a 3D open-world crime game

Solmar is a 3D open-world crime game that runs in a desktop browser from
static files — no build step, no network. You are Dani, a newcomer to a
sun-soaked coastal island city, and your goal is to become the King of
Solmar. Steal cars, outrun the police under a five-star wanted level,
fight Marco Vane's crew, and run twelve story missions in three acts.

## How to play

Open `game/index.html` in a desktop browser. Click START, then:

- **WASD** — move (on foot) or drive (in a car), camera-relative
- **Mouse** — look around (click the game to lock the mouse)
- **Shift** — sprint · **Space** — jump (on foot) or handbrake (in a car)
- **F** — punch · **E** — enter or leave a car
- **Click** — shoot · **1–4** — weapon slots (fists, pistol, SMG, shotgun) · **R** — reload
- **H** — horn · **C** — camera near/far
- **M** — full city map · **L** — mission list · **Esc** — pause

Progress is saved automatically on this device.

## The city

Solmar is a road-grid island city with five districts: downtown with
terracotta roofs, a beach district with pastel roofs along the sand, a
market quarter, slate-roofed hills, and a harbour with a marina, boats
and a lighthouse on the headland. A bridge crosses the harbour channel,
a boardwalk runs along the beach, and a pier reaches into the sea. The
day starts in golden late afternoon and the sun sets as you play;
street lamps turn on at dusk. Traffic cars drive the grid and
pedestrians walk the pavements; both react when shots are fired.

## Cars and police

Nine car models, each with its own name, colour, top speed and handling,
built from the city itself: steal any parked car with E. Cars take
damage in crashes and gunfights, smoke when badly damaged, and can be
repaired at Marlowe Motors. Stealing cars, shooting and hitting
pedestrians raise the wanted level from 0 to 5 stars: cruisers chase
and ram, roadblocks appear at 4 stars, and a police helicopter circles
at 5. Stay out of sight to cool down.

## The 12 missions in 3 acts

- **Act I — New in Town:** New in Town, Borrowed Wheels, The Drop, Breakers on the Boardwalk
- **Act II — Rising:** Taxi for Rosa, The Courier Run, Harbour Lights, The Solmar Score
- **Act III — King of Solmar:** Night Shift, The Rival's Offer, The Docks, King of Solmar

Each mission shows a banner, an objective on the HUD, a marker on the
map and minimap, and a timer where it fits. Completing a mission pays
money and unlocks the next.

## Side jobs and rank

Repeatable taxi fares pay plus a tip for speed. Twelve hidden packages
are scattered around the city ($50 each, $500 bonus for all twelve).
Five stunt jumps pay $100 each. Rank points from missions, fares,
packages, jumps and escapes move you up the ladder — Street Rat,
Wheelman, Hustler, Made, King of Solmar — and reaching Made unlocks the
gold Sunset car parked by the marina.

## Sound

All sound is synthesized in the browser: engine hum that rises with
speed, police sirens, gunshots, a horn, skid screeches, fare chimes and
a rank-up fanfare, over a simple looping music line. There is a mute
toggle in the pause menu.

## Screenshots

Four renders of the real game: a 4-star sunset chase, Dani on foot in
the market plaza, a drive over the harbour bridge, and the finale
shootout on the docks.

## Tech

Three.js 0.160.0, vendored under `game/vendor/`. All game code is plain
JavaScript modules under `game/src/`, one file per system: world,
player, vehicles, traffic, police, combat, missions, side jobs, rank,
HUD, rendering, input, audio and save. `main.ts` at the repo root
copies `game/` and `screenshots/` into the output directory and writes
the dossier.
