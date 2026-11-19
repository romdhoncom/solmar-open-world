// Solmar — every tuning number and colour in one place.
// The world is a fixed 3200 by 2400 logical area; the renderer scales the
// 1280 by 720 view to the window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

export const WORLD = { width: 3200, height: 2400 };

// Roads: the avenues run north-south, the streets east-west. Every road is
// 120 wide; the lists below are the centre lines.
export const ROADS = {
  width: 120,
  vertical: [240, 720, 1200, 1680, 2160, 2640],
  horizontal: [220, 620, 1020, 1420, 1820, 2120],
};

// The beach strip along the south edge, and the harbour basin on the east.
export const BEACH = { y: 2240, sand: '#e8cf9a', water: '#2e7fa8', deep: '#1d5c7d' };
export const HARBOUR = { x: 2940, y: 1380, width: 260, height: 420 };

// The plaza: a fountain square in the block between 3rd and 4th Avenues.
export const PLAZA = { x: 1440, y: 1220 };

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  health: 100,
  punchDamage: 18,
  punchRange: 46,
  punchInterval: 0.45,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 3.2,
  handbrakeGrip: 0.9,
  // A wrecked car loses this much of its top speed at full damage.
  damageSlow: 0.45,
};

// Car models: name, colour, top-speed multiplier, acceleration multiplier.
// The first six are the everyday cars of Solmar; the last three are rarer
// and only turn up in the richer districts, the marina and the hills.
export const CAR_MODELS = [
  { name: 'Pinto', color: '#c94f3d', top: 0.82, accel: 0.9 },
  { name: 'Comet', color: '#3d7ac9', top: 1.0, accel: 1.0 },
  { name: 'Vagabond', color: '#e8b93c', top: 0.9, accel: 0.95 },
  { name: 'Strider', color: '#7a4fc9', top: 1.12, accel: 1.1 },
  { name: 'Marlin', color: '#2fae8a', top: 1.05, accel: 1.0 },
  { name: 'Dune Buggy', color: '#d97b2f', top: 0.95, accel: 1.05 },
  { name: 'Falcon', color: '#e8e3d0', top: 1.18, accel: 1.12 },
  { name: 'Hauler', color: '#5a6b3a', top: 0.78, accel: 0.85 },
  { name: 'Sunset', color: '#f27bb1', top: 1.08, accel: 1.05 },
];

export const POLICE_COLOR = '#20242e';
export const POLICE_LIGHT_A = '#e33f2f';
export const POLICE_LIGHT_B = '#2f6fe3';

export const TRAFFIC_COUNT = 30;
export const PED_COUNT = 48;
export const MAX_POLICE_CARS = 5;
export const MAX_OFFICERS = 6;

export const WANTED = {
  decaySeconds: 26,
  bustDistance: 46,
  bustSeconds: 2.5,
  finePerStar: 200,
  max: 5,
  roadblockAt: 4,
  heliAt: 5,
};

export const COMBAT = {
  bulletSpeed: 900,
  bulletDamage: 34,
  fireInterval: 0.22,
  magazine: 12,
  reloadSeconds: 1.1,
  enemyHealth: 70,
  enemyDamage: 9,
  enemyRange: 420,
  enemyFireInterval: 0.9,
  bruteHealth: 170,
  bruteDamage: 16,
  bruteRange: 380,
  bruteFireInterval: 1.3,
  runnerHealth: 50,
  runnerDamage: 6,
  runnerRange: 340,
  runnerFireInterval: 0.6,
};

export const MONEY = {
  start: 150,
  // Nine story jobs, in order.
  missionReward: [200, 350, 600, 800, 500, 700, 900, 2500, 5000],
  pickup: 25,
  hospitalLoss: 0.1,
  fareBase: 60,
  fareTipMax: 40,
  packageAmount: 50,
  packageBonus: 500,
  packageCount: 12,
  ammoPickup: 24,
};

// Street rank: a score from jobs, fights, thefts and finds. A new rank
// unlocks a car and a shout from Rosa; the HUD shows the next one coming.
export const RANKS = [
  { score: 0, name: 'Street Rat' },
  { score: 100, name: 'Wheelman' },
  { score: 250, name: 'Hustler' },
  { score: 500, name: 'Made' },
  { score: 1000, name: 'King of Solmar' },
];

// Taxi fares: one fare at a time, a passenger to fetch, a clock to beat.
export const TAXI = {
  fareSeconds: 80,
  pickupRadius: 90,
  destRadius: 100,
  cooldownSeconds: 18,
};

export const SAVE_KEY = 'solmar.save.v2';

export const PALETTE = {
  grass: '#7fae62',
  park: '#5d9b4a',
  sidewalk: '#b9b3a4',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8e3c8',
  sand: '#e8cf9a',
  water: '#2e7fa8',
  text: '#f4f1e6',
  muted: '#c9c4b2',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4f8ff7',
  green: '#58b368',
  panel: 'rgba(12, 16, 24, 0.78)',
  panelEdge: 'rgba(244, 241, 230, 0.25)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Arial Black", "Trebuchet MS", sans-serif';
