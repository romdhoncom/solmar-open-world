// Solmar 3D — all tuning numbers and constants in one place.
// A sun-soaked coastal island city; the world is a road grid 480 units
// across, districts by compass, and the day starts in golden late afternoon.

export const WORLD = {
  seed: 1337,
  half: 240, // island half-size; roads run from -180 to 180
  roadEvery: 60,
  roadWidth: 12,
  block: 48,
  groundY: 0,
};

export const ROADS = [-180, -120, -60, 0, 60, 120, 180];

export const DISTRICTS = {
  downtown: { x0: -90, z0: -90, x1: 90, z1: 90, roof: 0xc96a3f, name: 'Downtown' },
  beach: { x0: -240, z0: 90, x1: 240, z1: 240, roof: 0xe8b4a0, name: 'Beach District' },
  market: { x0: -240, z0: -90, x1: -90, z1: 90, roof: 0x9a5a3a, name: 'Market Quarter' },
  hills: { x0: -90, z0: -240, x1: 240, z1: -90, roof: 0x5a6a7a, name: 'The Hills' },
  harbour: { x0: 90, z0: -90, x1: 240, z1: 90, roof: 0x3f7a8a, name: 'Harbour' },
};

export const STREETS_X = ['Lighthouse Rd', 'Marina Ave', 'Coral St', 'Solmar Blvd', 'Palm Row', 'Anchor St', 'Quay Lane'];
export const STREETS_Z = ['Boardwalk Rd', 'Sunset Way', 'Harbour St', 'Market St', 'Hillcrest Ave', 'Pier Rd', 'Dune St'];

export const CARS = [
  { name: 'Rustler', color: 0x8a8f96, top: 26, accel: 14, grip: 2.6, price: 0 },
  { name: 'Falcon', color: 0xc22e2e, top: 34, accel: 18, grip: 3.0, price: 0 },
  { name: 'Comet', color: 0x2e6ac2, top: 32, accel: 17, grip: 3.2, price: 0 },
  { name: 'Vagabond', color: 0xd8a13c, top: 28, accel: 15, grip: 2.8, price: 0 },
  { name: 'Strider', color: 0xd8b400, top: 36, accel: 20, grip: 3.4, price: 0 },
  { name: 'Manta', color: 0x2ec2a8, top: 30, accel: 16, grip: 3.0, price: 0 },
  { name: 'Bruiser', color: 0x3a3f46, top: 29, accel: 15, grip: 2.4, price: 0 },
  { name: 'Pixie', color: 0xe86ab0, top: 24, accel: 16, grip: 3.6, price: 0 },
  { name: 'Sunset', color: 0xf2c200, top: 40, accel: 22, grip: 3.6, price: 0, rare: true },
];

export const WEAPONS = [
  { name: 'Fists', slot: 1, damage: 12, rate: 0.45, ammo: Infinity, auto: false },
  { name: 'Pistol', slot: 2, damage: 34, rate: 0.28, ammo: 60, auto: false },
  { name: 'SMG', slot: 3, damage: 20, rate: 0.09, ammo: 120, auto: true },
  { name: 'Shotgun', slot: 4, damage: 55, rate: 0.9, ammo: 24, auto: false },
];

export const RANKS = [
  { title: 'Street Rat', points: 0 },
  { title: 'Wheelman', points: 150 },
  { title: 'Hustler', points: 400 },
  { title: 'Made', points: 800 },
  { title: 'King of Solmar', points: 1500 },
];

export const PLAYER = {
  walkSpeed: 6, sprintSpeed: 10, jumpSpeed: 8.5, gravity: 22,
  health: 100, armour: 0, startMoney: 150, radius: 0.7,
};

export const POLICE = {
  maxCruisers: 6, chaseSpeed: 30, ramDamage: 8, shootRange: 26,
  decaySeconds: 14, heliHeight: 42, heliOrbit: 30,
};

export const TIME = {
  startHour: 17.4, // golden late afternoon
  dayLengthSec: 480, // one full day in seconds of play
};

export const SAVE_KEY = 'solmar-save-v2';
export const MISSION_REWARD = [100, 150, 200, 250, 200, 300, 400, 600, 500, 600, 800, 1500];
