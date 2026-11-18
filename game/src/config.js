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

export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  health: 100,
  punchDamage: 12,
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
};

// Car models: name, colour, top-speed multiplier, acceleration multiplier.
export const CAR_MODELS = [
  { name: 'Pinto', color: '#c94f3d', top: 0.82, accel: 0.9 },
  { name: 'Comet', color: '#3d7ac9', top: 1.0, accel: 1.0 },
  { name: 'Vagabond', color: '#e8b93c', top: 0.9, accel: 0.95 },
  { name: 'Strider', color: '#7a4fc9', top: 1.12, accel: 1.1 },
  { name: 'Marlin', color: '#2fae8a', top: 1.05, accel: 1.0 },
  { name: 'Dune Buggy', color: '#d97b2f', top: 0.95, accel: 1.05 },
];

export const POLICE_COLOR = '#20242e';
export const POLICE_LIGHT_A = '#e33f2f';
export const POLICE_LIGHT_B = '#2f6fe3';

export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 40;
export const MAX_POLICE_CARS = 5;
export const MAX_OFFICERS = 6;

export const WANTED = {
  decaySeconds: 26,
  bustDistance: 46,
  bustSeconds: 2.5,
  finePerStar: 200,
  max: 5,
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
};

export const MONEY = {
  start: 150,
  missionReward: [200, 350, 600, 800, 2500],
  pickup: 25,
  hospitalLoss: 0.1,
};

export const SAVE_KEY = 'solmar.save.v1';

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
