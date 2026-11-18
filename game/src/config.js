// PAPER DRIFT — tuning, palette and wave plan. One job: every number the
// game balances on, in one place, so the loop can be tuned without touching
// logic. The feel targets: snappy acceleration, hard-hitting fire, and
// effects that stay bright without ever dragging the frame rate.
export const WORLD = { width: 1280, height: 800 };

export const PALETTE = {
  skyTop: '#070a1e',
  skyMid: '#141238',
  skyLow: '#2a1650',
  moon: '#f7e8b0',
  moonGlow: '#ffe9a8',
  star: '#e8ecff',
  mountainFar: '#1b1740',
  mountainNear: '#120e2e',
  temple: '#0c0924',
  dragonRed: '#e63946',
  dragonDark: '#b01e28',
  dragonGold: '#ffd166',
  dragonBelly: '#ffedb0',
  flameCore: '#fff3b0',
  flameMid: '#ffb703',
  flameEdge: '#fb8500',
  lantern: '#ffd166',
  lanternGlow: '#ffca3a',
  lanternRed: '#ef476f',
  ink: '#2b2152',
  inkRim: '#7b5cff',
  inkMoth: '#9d4edd',
  fireworkPink: '#ff5d8f',
  fireworkCyan: '#4cc9f0',
  fireworkGreen: '#80ed99',
  fireworkGold: '#ffd60a',
  text: '#f8f1de',
  textDim: '#b8b0d8',
  gold: '#ffd166',
  danger: '#ff5964',
  hudPanel: 'rgba(10, 8, 32, 0.62)',
  heart: '#ef476f',
};

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 430,
  damping: 3.2,
  lives: 3,
  maxLives: 5,
  fireInterval: 0.13,
  boltSpeed: 820,
  boltDamage: 1,
  boltRadius: 7,
  recoil: 46,
  dashSpeed: 980,
  dashTime: 0.18,
  dashCooldown: 1.6,
  invulnerableTime: 1.6,
  fireSpread: 0.09,
};

export const COMBO = {
  windowSeconds: 2.5,
  perMultiplier: 3,
  maxMultiplier: 8,
};

export const WAVES_TO_WIN = 9;
export const BOSS_WAVES = [3, 6, 9];

// Enemy kinds: hp, speed, radius, score, behaviour.
export const ENEMIES = {
  inkcloud: { hp: 3, speed: 95, radius: 24, score: 50 },
  firework: { hp: 1, speed: 265, radius: 13, score: 80 },
  moth: { hp: 2, speed: 150, radius: 15, score: 100 },
  boss: { hp: 150, speed: 62, radius: 72, score: 3000 },
};

// What each wave throws at the player. budget: total enemies; mix: share of
// each kind (inkcloud fills the rest); boss: a phoenix joins mid-wave.
export function wavePlan(wave) {
  const budget = 6 + wave * 4;
  const plan = { budget, boss: BOSS_WAVES.includes(wave), mix: { inkcloud: 1 } };
  if (wave >= 2) plan.mix = { inkcloud: 0.55, firework: 0.45 };
  if (wave >= 3) plan.mix = { inkcloud: 0.4, firework: 0.35, moth: 0.25 };
  if (wave >= 5) plan.mix = { inkcloud: 0.35, firework: 0.35, moth: 0.3 };
  if (wave >= 7) plan.mix = { inkcloud: 0.3, firework: 0.4, moth: 0.3 };
  return plan;
}

export const PICKUP_DROP_CHANCE = 0.13;
export const PICKUP_WEIGHTS = [
  ['lantern', 0.55],
  ['ingot', 0.12],
  ['cracker', 0.18],
  ['heart', 0.15],
];

// Upgrade cards offered between waves. id, name, flavour, apply().
export const UPGRADES = [
  { id: 'blaze', name: '烈焰吐息', desc: '火焰速度 +35%', color: '#fb8500' },
  { id: 'twin', name: '双龙吐珠', desc: '每次多发 1 枚火珠', color: '#ffd166' },
  { id: 'gale', name: '疾风龙鳞', desc: '飞行速度 +18%', color: '#4cc9f0' },
  { id: 'scales', name: '金甲龙鳞', desc: '生命上限 +1，并恢复 1', color: '#80ed99' },
  { id: 'magnet', name: '聚宝灯笼', desc: '灯笼自动飞向你', color: '#ffca3a' },
  { id: 'ward', name: '护体金光', desc: '每波获得一次免伤护盾', color: '#c77dff' },
];

export const STEP = 1 / 60;
export const MAX_PARTICLES = 520;
export const MAX_RINGS = 24;
export const MAX_TEXTS = 24;
