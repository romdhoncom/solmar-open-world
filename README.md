# solmar-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/romdhoncom/solmar-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar is an original 2D open-world crime game in the spirit of GTA 6, built as plain static files that play offline in a desktop browser. Dani Vega, fresh off the bus with $150, explores the sun-soaked coastal city of Solmar on foot and by car: steal cars, outrun the Solmar PD under a five-star wanted level, fight the Breakers on the boardwalk, and run nine story missions — from meeting Rosa Marlowe at her garage to the bank job and the finale against Marco Vane, the Breakers' boss. Between jobs there is more to do: taxi fares with a clock to beat, twelve hidden packages scattered around the city, and a street rank — Street Rat to King of Solmar — that unlocks cars, including a gold Sunset by the marina. Traffic and pedestrians fill the streets, the police set roadblocks at four stars and send a helicopter at five, and the HUD carries a live minimap, cash, health, rank and the current objective. Progress saves in the browser. All art is drawn in code and all sound is synthesized with WebAudio; nothing is borrowed from any commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — or serve the `game/` folder with any static file server and open `index.html`. The port comes from `PORT`, then `--port`, then 8080.

## Controls

WASD move and drive, Shift run, mouse aim, click shoot, F punch, R reload, E enter or leave a car, Space handbrake, H horn, P pause, M mute, Enter start the next job.

## The nine jobs

1. **New in Town** — meet Rosa at Marlowe Motors.
2. **Borrowed Wheels** — steal a car and bring it to the garage.
3. **The Drop** — a package from the docks to the Sunset Motel, quietly.
4. **Breakers on the Boardwalk** — settle it with the crew on the beach.
5. **Taxi for Rosa** — a fare from the plaza to the marina, against the clock.
6. **The Courier Run** — three parcels, three corners of the city.
7. **Harbour Lights** — steal the gold Strider from the marina pier.
8. **The Solmar Score** — hold up the bank, then lose the heat.
9. **King of Solmar** — end Marco Vane's crew at the docks and shake five stars.

## Files

- `game/index.html` — the page; `game/src/main.js` — boot and the game loop.
- `game/src/game.js` — the simulation step; `world.js` — the city; `traffic.js` — traffic and pedestrians; `vehicles.js` — cars and driving; `player.js` — Dani on foot; `combat.js` — shooting and the Breakers; `police.js` — the wanted level; `missions.js` — the nine jobs; `sidejobs.js` — fares and packages; `rank.js` — street rank; `render.js` + `hud.js` — drawing; `audio.js` — synthesized sound; `save.js` — browser saves; `input.js` — keyboard and mouse; `shots.js` — the four screenshot scenes.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `shots.json` — the four screenshots: the title, a drive, a police chase and the finale.

---

Entered on [make.fun](https://make.fun/?ref=j1qv1zx6&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
