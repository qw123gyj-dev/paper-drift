// Entities for PAPER DRIFT. One job: the things that live in the world —
// the paper dragon, ink foes, the phoenix boss, fire bolts, pickups — and
// the effects that make them feel alive: a pooled particle system, shockwave
// rings and floating score text. Nothing here draws a frame; render.js does.
//
// Performance rules, enforced here: particles live in one preallocated pool
// (MAX_PARTICLES, never more), rings and texts likewise, and every glow is
// a pre-rendered sprite drawn with 'lighter' — no shadowBlur in the loop.
import { ENEMIES, MAX_PARTICLES, MAX_RINGS, MAX_TEXTS, PLAYER, WORLD } from './config.js';
import { clamp, mulberry32, range } from './random.js';

/** Pre-rendered radial glow sprites, one per colour. drawImage is fast;
 * shadowBlur in the hot loop is not. */
export function makeGlowSprites() {
  const colors = {
    gold: '#ffd166',
    red: '#ff5964',
    orange: '#fb8500',
    pink: '#ff5d8f',
    cyan: '#4cc9f0',
    purple: '#9d4edd',
    green: '#80ed99',
    white: '#fff8e0',
    ink: '#7b5cff',
  };
  const sprites = {};
  for (const [name, color] of Object.entries(colors)) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.85;
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites[name] = c;
  }
  return sprites;
}

/** One fixed pool of particles. spawn() never allocates; when the pool is
 * full the oldest particle is recycled, so a huge explosion costs the same
 * as a small one. */
export class ParticlePool {
  constructor(max = MAX_PARTICLES) {
    this.max = max;
    this.items = [];
    for (let i = 0; i < max; i += 1) {
      this.items.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 4, drag: 0.92, grav: 0, glow: 'gold', spark: false, spin: 0, rot: 0 });
    }
    this.cursor = 0;
  }

  spawn(x, y, vx, vy, life, size, glow, opts = {}) {
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.drag = opts.drag ?? 0.9;
    p.grav = opts.grav ?? 0;
    p.glow = glow;
    p.spark = opts.spark ?? false;
    p.spin = opts.spin ?? 0;
    p.rot = opts.rot ?? 0;
    return p;
  }

  /** A radial burst: bright core sparks plus slower embers. */
  burst(x, y, glow, count, speed, random) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const sp = speed * (0.25 + random() * 0.75);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.35 + random() * 0.5, 3 + random() * 7, glow, {
        drag: 0.88, spark: random() < 0.5, spin: (random() - 0.5) * 12, rot: random() * Math.PI,
      });
    }
  }

  /** A tight spray of fast sparks, for hits and muzzle flashes. */
  sparks(x, y, glow, count, speed, angle, spread, random) {
    for (let i = 0; i < count; i += 1) {
      const a = angle + (random() - 0.5) * spread;
      const sp = speed * (0.5 + random() * 0.5);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.15 + random() * 0.25, 2 + random() * 4, glow, { drag: 0.85, spark: true });
    }
  }

  /** A soft rising ember trail, for lanterns and the dragon's tail. */
  embers(x, y, glow, count, random) {
    for (let i = 0; i < count; i += 1) {
      this.spawn(x + (random() - 0.5) * 14, y + (random() - 0.5) * 14, (random() - 0.5) * 30, -30 - random() * 50, 0.5 + random() * 0.5, 2 + random() * 4, glow, { drag: 0.96, grav: -40 });
    }
  }

  update(dt) {
    for (const p of this.items) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  countAlive() {
    let n = 0;
    for (const p of this.items) if (p.alive) n += 1;
    return n;
  }
}

/** Expanding shockwave rings. Pooled like particles. */
export class RingPool {
  constructor(max = MAX_RINGS) {
    this.max = max;
    this.items = [];
    for (let i = 0; i < max; i += 1) this.items.push({ alive: false, x: 0, y: 0, r: 0, maxR: 100, life: 0, maxLife: 1, width: 4, color: '#ffd166' });
    this.cursor = 0;
  }

  spawn(x, y, maxR, life, width, color) {
    const r = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    r.alive = true;
    r.x = x;
    r.y = y;
    r.r = 6;
    r.maxR = maxR;
    r.life = life;
    r.maxLife = life;
    r.width = width;
    r.color = color;
    return r;
  }

  update(dt) {
    for (const r of this.items) {
      if (!r.alive) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.alive = false;
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      r.r = 6 + (r.maxR - 6) * (1 - Math.pow(1 - t, 3));
    }
  }
}

/** Floating score text. Pooled; rises and fades. */
export class FloatTextPool {
  constructor(max = MAX_TEXTS) {
    this.max = max;
    this.items = [];
    for (let i = 0; i < max; i += 1) this.items.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#ffd166', size: 20 });
    this.cursor = 0;
  }

  spawn(x, y, text, color, size = 20) {
    const t = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    t.alive = true;
    t.x = x;
    t.y = y;
    t.life = 0.9;
    t.maxLife = 0.9;
    t.text = text;
    t.color = color;
    t.size = size;
    return t;
  }

  update(dt) {
    for (const t of this.items) {
      if (!t.alive) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.alive = false;
        continue;
      }
      t.y -= 42 * dt;
    }
  }
}

/** The paper dragon. Velocity-based movement with acceleration and damping,
 * so it feels weighty and fast; a dash that leaves afterimages; a fire
 * breath with recoil; a segmented paper body that trails the head. */
export class Player {
  constructor() {
    this.x = WORLD.width / 2;
    this.y = WORLD.height - 180;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.radius = PLAYER.radius;
    this.lives = PLAYER.lives;
    this.maxLives = PLAYER.maxLives;
    this.alive = true;
    this.fireTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirX = 0;
    this.dashDirY = -1;
    this.invuln = 0;
    this.shield = false;
    this.muzzle = 0;
    this.segments = [];
    this.afterimages = [];
    this.boltCount = 1;
    this.fireRateMul = 1;
    this.speedMul = 1;
    this.magnet = false;
    this.trailTimer = 0;
    for (let i = 0; i < 12; i += 1) this.segments.push({ x: this.x, y: this.y + i * 14 });
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = -Math.PI / 2;
    this.lives = PLAYER.lives;
    this.maxLives = PLAYER.maxLives;
    this.alive = true;
    this.fireTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invuln = 0;
    this.shield = false;
    this.muzzle = 0;
    this.boltCount = 1;
    this.fireRateMul = 1;
    this.speedMul = 1;
    this.magnet = false;
    this.segments = [];
    this.afterimages = [];
    for (let i = 0; i < 12; i += 1) this.segments.push({ x, y: y + i * 14 });
  }

  /** Push the head forward; the body follows the trail it leaves. */
  updateSegments() {
    this.segments.unshift({ x: this.x, y: this.y });
    if (this.segments.length > 14) this.segments.pop();
  }
}

/** One ink foe. kind: inkcloud (slow tank), firework (fast, explodes),
 * moth (sine flight, shoots ink). flash: white hit-flash timer. */
export class Enemy {
  constructor(kind, x, y, random) {
    const def = ENEMIES[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = def.speed * 0.4;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.radius = def.radius;
    this.score = def.score;
    this.t = random() * 10;
    this.seed = random() * Math.PI * 2;
    this.flash = 0;
    this.shootTimer = 1.5 + random() * 2;
    this.dead = false;
    this.wobble = 40 + random() * 60;
  }
}

/** The ink phoenix boss. Swoops across the sky, fans ink feathers, and
 * summons ink clouds. phase: enter -> fight -> dying. */
export class Boss {
  constructor(wave, random) {
    const def = ENEMIES.boss;
    this.x = WORLD.width / 2;
    this.y = -90;
    this.targetY = 150;
    this.vx = 0;
    this.vy = 0;
    this.hp = def.hp + (wave - 3) * 60;
    this.maxHp = this.hp;
    this.radius = def.radius;
    this.score = def.score;
    this.phase = 'enter';
    this.t = 0;
    this.flash = 0;
    this.attackTimer = 2.2;
    this.summonTimer = 7;
    this.swoopTimer = 5;
    this.swooping = false;
    this.dead = false;
    this.wingPhase = random() * Math.PI * 2;
  }
}

/** A fire bolt breathed by the dragon. */
export class Bolt {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = PLAYER.boltRadius;
    this.damage = PLAYER.boltDamage;
    this.life = 1.1;
    this.dead = false;
  }
}

/** An ink feather shot by a moth or the phoenix. */
export class EnemyBolt {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 8;
    this.life = 4;
    this.dead = false;
    this.t = 0;
  }
}

/** A pickup: lantern (score), ingot (life), cracker (screen clear), heart
 * (heal). Bobs and glows; magnet pulls lanterns to the dragon. */
export class Pickup {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.t = 0;
    this.radius = kind === 'lantern' ? 16 : 14;
    this.dead = false;
    this.vx = 0;
    this.vy = 24;
  }
}

export { clamp, mulberry32, range };
