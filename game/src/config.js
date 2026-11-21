// Solmar tuning numbers and constants, all in one place.
export const CFG = {
  seed: 20261121,
  // Island and roads. Roads run at x/z = -150, -75, 0, 75, 150.
  island: 420,
  sea: 1500,
  roads: [-150, -75, 0, 75, 150],
  roadW: 12,
  paveW: 3,
  // Clock: game starts in golden late afternoon; 1 game hour per 150 s.
  startHour: 17.4,
  hoursPerSecond: 1 / 150,
  // Player on foot.
  walkSpeed: 7,
  sprintSpeed: 11,
  jumpVel: 8.5,
  gravity: 22,
  playerRadius: 0.9,
  // Weapons: name, damage, fire interval (s), bullet speed, spread.
  weapons: [
    { name: 'Fists', dmg: 18, rate: 0.45, speed: 0, spread: 0, auto: false },
    { name: 'Pistol', dmg: 22, rate: 0.28, speed: 90, spread: 0.02, auto: false },
    { name: 'SMG', dmg: 12, rate: 0.09, speed: 95, spread: 0.05, auto: true },
    { name: 'Shotgun', dmg: 16, rate: 0.85, speed: 80, spread: 0.12, auto: false },
  ],
  // Rank ladder: title, RP needed to reach it.
  ranks: [
    { title: 'Street Rat', rp: 0 },
    { title: 'Wheelman', rp: 100 },
    { title: 'Hustler', rp: 300 },
    { title: 'Made', rp: 600 },
    { title: 'King of Solmar', rp: 1000 },
  ],
  missionPay: [150, 200, 250, 300, 250, 350, 400, 600, 400, 450, 500, 1000],
  missionRP: [40, 50, 60, 80, 60, 80, 90, 120, 90, 100, 110, 200],
  farePay: 25,
  packagePay: 50,
  packageBonus: 500,
  jumpPay: 100,
  repairCost: 80,
  // Districts by block quadrant.
  districts: {
    downtown: { roof: 0xc96f3f, name: 'Downtown' },
    beach: { roof: 0xe8b4b8, name: 'Beach District' },
    market: { roof: 0x9c4a2f, name: 'Market Quarter' },
    hills: { roof: 0x5a6b7d, name: 'Hills' },
    marina: { roof: 0x3f7d8c, name: 'Marina' },
  },
  // Named spots (x, z) on the map.
  spots: {
    garage: [-37, -112],
    bank: [37, -37],
    hospital: [-112, 37],
    hideout: [112, 112],
    marina: [168, 0],
    police: [-112, -112],
    pier: [0, 232],
    plaza: [0, 6],
    boardwalk: [0, 168],
    docks: [172, 62],
    bridge: [182, 0],
    hills: [0, -150],
    market: [-112, -37],
    beach: [-60, 185],
  },
};
