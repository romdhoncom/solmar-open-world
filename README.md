# Solmar

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar is a 2D top-down open-world crime game that runs in a desktop browser from static files, built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty. Dani is new in a sun-soaked coastal city and means to become its king: nine story missions, cars to steal, a five-star wanted level with police who chase, ram, block roads and send a helicopter, plus taxi fares, twelve hidden packages and a street rank that unlocks cars.

## Play

Serve the `game/` folder with any static file server, then open `index.html`:

```sh
cd game
python3 -m http.server 8000
```

Then open http://localhost:8000 in desktop Chrome. There is no build step and no network request: every script is a file under `game/`, and every sound is synthesized in the browser.

## Controls

- **W A S D** — walk, or drive when in a car
- **E** — get in or out of a car (repairs a wreck at Marlowe Motors)
- **Mouse** — aim, **click** — shoot, **F** — punch
- **H** — horn, **P** — pause, **M** — mute

## What is in the game

- A seeded city: a road grid with five districts (downtown, beach, market, hills, marina), a harbour with boats, a boardwalk, a pier and a plaza fountain, painted once to an offscreen canvas.
- Nine story missions in order: New in Town, Borrowed Wheels, The Drop, Breakers on the Boardwalk, Taxi for Rosa, The Courier Run, Harbour Lights, The Solmar Score, and the finale, King of Solmar.
- Nine car models with their own speed and handling, a damage model with smoke and wrecks, garage repair, skid marks, crash sparks and a deterministic camera shake.
- About thirty traffic cars and forty-eight pedestrians who slow, step aside and flee from gunfire.
- A wanted level from 0 to 5 stars: cruisers chase and ram, four stars bring roadblocks, five stars bring a helicopter, and laying low drops the heat.
- Side jobs: repeatable taxi fares with tips for speed, and twelve hidden packages worth $50 each plus a $500 bonus for all of them.
- A street rank (Street Rat to King of Solmar) with a progress bar; reaching Made unlocks a gold Sunset by the marina.
- A HUD with speed, money, health, wanted stars and rank, a minimap with mission, fare, package and police blips, mission banners and a countdown for timed jobs, plus start, pause and finale screens.
- A save in localStorage (money, missions, kills, fares, packages, rank) that still loads an older save shape.
- Synthesized sound throughout: engine hum, siren, gunshots, horn, skid, fare chime, rank fanfare and a looping bassline.

## Files

One job per file, named for what it does, under `game/src/`: `main.js` boots the game and owns the loop, `config.js` holds every tuning number, `random.js` the seeded generator, `world.js` the city, `player.js` Dani on foot, `vehicles.js` the cars, `traffic.js` the streets, `police.js` the wanted level, `missions.js` the nine missions, `sidejobs.js` fares and packages, `rank.js` the ladder, `combat.js` bullets and pickups, `hud.js` the panels and menus, `render.js` the frame, `input.js` keys and mouse, `audio.js` the synth, `save.js` the save, and `shots.js` the staging for the four screenshots.

The screenshots in `screenshots/` are real renders of the game's own code, staged by `shots.js` and captured from a headless browser at a fixed seed.

Optional: earn referral rewards, a second way to make money — https://make.fun/r/j1qv1zx6
