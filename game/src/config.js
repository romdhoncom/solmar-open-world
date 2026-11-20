// Solmar 3D — all tuning numbers and constants in one place.
// Written fresh in this session for the v5 rebuild (prose spec only).

export const SEED = 1;

// World layout (units are metres, ground plane y = 0).
export const ISLAND_HALF = 210; // island spans -210..210 in x and z
export const ROAD_HALF = 6; // road width 12
export const ROADS_X = [-160, -80, 0, 80, 160];
export const ROADS_Z = [-160, -80, 0, 80, 160];
export const BEACH_Z = 175; // sand starts here (south edge)
export const BOARDWALK_Z = 168;
export const CHANNEL_X0 = 185; // harbour channel: water strip on the east edge
export const CHANNEL_X1 = 215;
export const PIER = { x0: -44, x1: -24, z0: 210, z1: 262 }; // pier deck into the sea
export const BRIDGE = { x0: 160, x1: 215, z0: -8, z1: 8, y: 0.35 }; // deck over the channel at z=0
export const LIGHTHOUSE = { x: 228, z: -192 };

// Named places (x, z) on the map.
export const PLACES = {
  garage: { x: -72, z: -72, name: 'Marlowe Motors' },
  bank: { x: 72, z: -8, name: 'Solmar Bank' },
  hospital: { x: -8, z: 72, name: 'St. Coral Hospital' },
  safehouse: { x: -152, z: 152, name: 'Safehouse' },
  marina: { x: 172, z: 40, name: 'Marina' },
  policeStation: { x: 8, z: -152, name: 'Police Station' },
  hideout: { x: -152, z: -152, name: 'Hideout' },
  docks: { x: 186, z: 90, name: 'The Docks' },
  boardwalk: { x: 40, z: 172, name: 'Boardwalk' },
  plaza: { x: -120, z: 0, name: 'Market Plaza' },
};

// Districts: name, roof colours, building height range.
export const DISTRICTS = {
  downtown: { roofs: [0xb5653a, 0xc2703e, 0xa8542f], hMin: 14, hMax: 34 },
  beach: { roofs: [0xf2d8c9, 0xf7e6d2, 0xe8c8b8], hMin: 8, hMax: 16 },
  market: { roofs: [0x9c4a2f, 0x8a3f28, 0xa85438], hMin: 8, hMax: 18 },
  hills: { roofs: [0x5a6470, 0x4a545f, 0x6b7683], hMin: 10, hMax: 22 },
  marina: { roofs: [0x7a8a99, 0x8b9aa8, 0x6b7f8f], hMin: 8, hMax: 16 },
};
export const PARK_EVERY = 6; // one block in six is a park

export const STREETS_X = ['Lighthouse Rd', 'Coral St', 'Solmar Blvd', 'Palm Row', 'Marina Drive'];
export const STREETS_Z = ['Harbour Way', 'Market St', 'Sunset Ave', 'Boardwalk Rd', 'Pier St'];

// Player.
export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 10, jumpSpeed: 8, gravity: 22,
  health: 100, armour: 0, startMoney: 150, radius: 0.6,
};

// Car models: name, colour, top speed (m/s), accel, grip (turn), rare.
export const CAR_MODELS = [
  { name: 'Pinto', color: 0x7a8a7a, top: 24, accel: 14, grip: 2.4, rare: false },
  { name: 'Comet', color: 0x3a6ab5, top: 28, accel: 16, grip: 2.6, rare: false },
  { name: 'Falcon', color: 0xc23b2e, top: 36, accel: 20, grip: 3.0, rare: false },
  { name: 'Bruiser', color: 0x5a5a5a, top: 22, accel: 12, grip: 2.0, rare: false },
  { name: 'Cab', color: 0xe8b93a, top: 27, accel: 15, grip: 2.5, rare: false },
  { name: 'Vagabond', color: 0x4a7a5a, top: 25, accel: 13, grip: 2.2, rare: false },
  { name: 'Strider', color: 0xd4af37, top: 40, accel: 24, grip: 3.2, rare: true },
  { name: 'Raptor', color: 0x1a1a2e, top: 44, accel: 26, grip: 3.4, rare: true },
  { name: 'Sunset', color: 0xffb347, top: 42, accel: 25, grip: 3.3, rare: true },
];
export const PARKED_CARS = 26;
export const CAR_REPAIR_COST = 120;

// Traffic and pedestrians.
export const TRAFFIC_CARS = 30;
export const PEDESTRIANS = 48;
export const TRAFFIC_SPEED = 9;

// Police.
export const WANTED_MAX = 5;
export const POLICE_DECAY_TIME = 25; // seconds out of sight to lose a star
export const CRUISER_COLOR = 0x1a2a4a;

// Combat.
export const WEAPONS = [
  { name: 'Fists', key: '1', damage: 12, ammo: Infinity, rate: 0.45 },
  { name: 'Pistol', key: '2', damage: 22, ammo: 60, rate: 0.28 },
  { name: 'SMG', key: '3', damage: 12, ammo: 120, rate: 0.09 },
  { name: 'Shotgun', key: '4', damage: 34, ammo: 24, rate: 0.8 },
];
export const PICKUPS = { ammo: 24, armour: 40, cash: 25 };

// Missions: id, act, name, reward money, reward rank points, timed (seconds, 0 = not timed).
export const MISSIONS = [
  { id: 1, act: 1, name: 'New in Town', money: 200, rank: 40, time: 0 },
  { id: 2, act: 1, name: 'Borrowed Wheels', money: 250, rank: 50, time: 0 },
  { id: 3, act: 1, name: 'The Drop', money: 300, rank: 50, time: 150 },
  { id: 4, act: 1, name: 'Breakers on the Boardwalk', money: 400, rank: 70, time: 0 },
  { id: 5, act: 2, name: 'Taxi for Rosa', money: 350, rank: 60, time: 120 },
  { id: 6, act: 2, name: 'The Courier Run', money: 450, rank: 70, time: 240 },
  { id: 7, act: 2, name: 'Harbour Lights', money: 600, rank: 80, time: 0 },
  { id: 8, act: 2, name: 'The Solmar Score', money: 1200, rank: 120, time: 0 },
  { id: 9, act: 3, name: 'Night Shift', money: 700, rank: 90, time: 300 },
  { id: 10, act: 3, name: "The Rival's Offer", money: 500, rank: 90, time: 0 },
  { id: 11, act: 3, name: 'The Docks', money: 900, rank: 120, time: 0 },
  { id: 12, act: 3, name: 'King of Solmar', money: 2500, rank: 200, time: 0 },
];
export const ACT_NAMES = { 1: 'Act I — New in Town', 2: 'Act II — Rising', 3: 'Act III — King of Solmar' };

// Side jobs.
export const PACKAGES = 12;
export const PACKAGE_VALUE = 50;
export const PACKAGE_BONUS = 500;
export const JUMPS = 5;
export const JUMP_VALUE = 100;
export const FARE_BASE = 60;
export const FARE_TIP = 40;

// Rank ladder: title, points needed.
export const RANKS = [
  { title: 'Street Rat', points: 0 },
  { title: 'Wheelman', points: 100 },
  { title: 'Hustler', points: 300 },
  { title: 'Made', points: 600 },
  { title: 'King of Solmar', points: 1000 },
];

// Day clock: game starts at golden late afternoon; a full day is 12 real minutes.
export const DAY_LENGTH = 720; // seconds per full day
export const START_HOUR = 17.5; // 17:30, golden late afternoon
export const SUNSET_HOUR = 18.6;
export const NIGHT_HOUR = 20.5;

// Colours.
export const COLORS = {
  skyDay: 0x9fc8e8, skySunset: 0xf7b267, skyNight: 0x1a2340,
  sunDay: 0xfff2d8, sunSunset: 0xff9a3c, sunNight: 0x8a9cc8,
  water: 0x2e6f9e, waterDeep: 0x1e4a6e,
  sand: 0xe8d8a8, grass: 0x6a9a4a, asphalt: 0x3a3a40, pavement: 0xb8b8b0,
  wood: 0x8a6a42, boardwalk: 0xa8825a,
};
