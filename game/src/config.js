// Solmar tuning: every number the game runs on lives in this one file,
// so a balance change never means hunting through the other modules.

export const SEED = 1337;

export const WORLD = { width: 4800, height: 3600 };

export const ROADS = {
  vertical: [600, 1400, 2200, 3000, 3800],
  horizontal: [500, 1100, 1700, 2300, 2900],
  width: 96,
};

export const BEACH = {
  y: 3200,
  sand: '#e8c98f',
  water: '#54a9c9',
  deep: '#2f7ea8',
};

export const HARBOUR = { x: 4200, y: 400, width: 600, height: 1000 };

export const PALETTE = {
  grass: '#8fae5e',
  park: '#6f9a4e',
  road: '#4a4a52',
  roadEdge: '#d8d2c0',
  lane: '#e8e2c8',
  water: '#54a9c9',
  boardwalk: '#c9a06b',
};

// Named places the missions, the HUD and the screenshots point at.
// All of them sit on or just beside a road, so a car can reach them.
export const LANDMARKS = {
  garage: { x: 1400, y: 1180, name: 'Marlowe Motors' },
  bank: { x: 2200, y: 470, name: 'Solmar Bank' },
  hideout: { x: 600, y: 2380, name: 'Hideout' },
  docks: { x: 4150, y: 900, name: 'The Docks' },
  fountain: { x: 2600, y: 2000, name: 'Plaza Fountain' },
  marina: { x: 4250, y: 1550, name: 'Marina' },
  boardwalk: { x: 2200, y: 3180, name: 'Boardwalk' },
  pier: { x: 3100, y: 3350, name: 'Pier' },
};

export const PLAYER = {
  speed: 230,
  radius: 14,
  hp: 100,
  startMoney: 150,
  ammoMax: 60,
  startAmmo: 24,
  punchDamage: 25,
  punchRange: 48,
  punchCooldown: 0.45,
  bulletDamage: 34,
  fireCooldown: 0.22,
  bulletSpeed: 720,
};

export const DRIVING = {
  // Top speeds are in world units per second; handling is 0..1.
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  drag: 0.55,
  grip: 6.5,
  turnRate: 2.6,
  skidSpeed: 420,
  crashDamage: 14,
};

export const WANTED = {
  max: 5,
  // Cruisers on the street per star level.
  cruisers: [0, 1, 2, 3, 4, 4],
  // Seconds out of every cruiser's sight before a star drops.
  decaySeconds: 10,
  sightRange: 520,
  // How close a cruiser has to get before it starts shooting on foot.
  shootRange: 340,
  shootCooldown: 1.1,
};

export const RANKS = [
  { name: 'Street Rat', points: 0 },
  { name: 'Wheelman', points: 60 },
  { name: 'Hustler', points: 150 },
  { name: 'Made', points: 300 },
  { name: 'King of Solmar', points: 600 },
];

// Pay per story mission, in the order the missions run.
export const MISSION_PAY = [200, 300, 400, 500, 250, 600, 800, 1500, 3000];

// Rank points per story mission, in the same order.
export const MISSION_POINTS = [20, 25, 30, 35, 40, 45, 50, 60, 100];

export const SIDEJOBS = {
  packageCount: 12,
  packagePay: 50,
  packageBonus: 500,
  farePay: 80,
  fareTipPerSecond: 2,
  fareCooldown: 12,
};

export const TRAFFIC_COUNT = 30;
export const PED_COUNT = 48;
export const PARKED_COUNT = 14;
