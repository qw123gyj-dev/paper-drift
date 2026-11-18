// PAPER DRIFT — the rules. One job: everything that decides what happens
// next — waves and the phoenix boss, movement with weight, fire with
// recoil, collisions, combos, upgrades, winning and losing — plus the feel
// systems that make it punch: hit-stop, screen shake, and the effects
// triggers. The pixels live in render.js; the sounds in audio.js.
import { COMBO, ENEMIES, PICKUP_DROP_CHANCE, PICKUP_WEIGHTS, PLAYER, STEP, UPGRADES, WAVES_TO_WIN, WORLD, wavePlan } from './config.js';
import { Boss, Enemy, EnemyBolt, FloatTextPool, ParticlePool, Pickup, RingPool, Bolt, Player } from './entities.js';
import { clamp, mulberry32, pickOne, pickWeighted, range } from './random.js';

export const EVENT_GAME_OVER = 1;
export const EVENT_VICTORY = 2;

export class World {
  constructor(seed = 1) {
    this.particles = new ParticlePool();
    this.rings = new RingPool();
    this.texts = new FloatTextPool();
    this.sound = null;
    this.best = 0;
    this.reset(seed);
  }

  reset(seed) {
    this.random = mulberry32(seed);
    this.seed = seed;
    this.player = new Player();
    this.enemies = [];
    this.bolts = [];
    this.enemyBolts = [];
    this.pickups = [];
    this.boss = null;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.wave = 0;
    this.plan = null;
    this.spawned = 0;
    this.spawnTimer = 0;
    this.lanternTimer = 2;
    this.intermission = false;
    this.upgradeChoices = [];
    this.over = false;
    this.victory = false;
    this.endless = false;
    this.time = 0;
    this.waveBanner = 0;
    this.trauma = 0;
    this.hitStop = 0;
    this.hurtFlash = 0;
    this.bossWarn = 0;
    this.slowmo = 0;
    this.ambientTimer = 0;
    this.stars = [];
    for (let i = 0; i < 90; i += 1) {
      this.stars.push({ x: this.random() * WORLD.width, y: this.random() * WORLD.height * 0.75, r: 0.6 + this.random() * 1.6, tw: this.random() * Math.PI * 2, sp: 0.4 + this.random() * 1.2 });
    }
    this.particles = new ParticlePool();
    this.rings = new RingPool();
    this.texts = new FloatTextPool();
  }

  // ---- effects triggers (render reads these) ----
  addShake(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  addHitStop(t) {
    this.hitStop = Math.max(this.hitStop, t);
  }

  burst(x, y, glow, count, speed) {
    this.particles.burst(x, y, glow, count, speed, this.random);
  }

  ring(x, y, maxR, life, width, color) {
    this.rings.spawn(x, y, maxR, life, width, color);
  }

  floatText(x, y, text, color, size) {
    this.texts.spawn(x, y, text, color, size);
  }

  // ---- waves ----
  startWave(wave) {
    this.wave = wave;
    this.plan = wavePlan(wave);
    this.spawned = 0;
    this.spawnTimer = 0.4;
    this.intermission = false;
    this.upgradeChoices = [];
    this.waveBanner = 2.2;
    this.bossWarn = 0;
    if (this.sound) this.sound.waveHorn();
  }

  spawnEnemy(kind) {
    const r = this.random;
    let x;
    let y;
    if (kind === 'firework') {
      const side = r() < 0.5 ? -30 : WORLD.width + 30;
      x = side;
      y = 60 + r() * 300;
    } else {
      x = 60 + r() * (WORLD.width - 120);
      y = -30 - r() * 60;
    }
    this.enemies.push(new Enemy(kind, x, y, r));
  }

  spawnBoss() {
    this.boss = new Boss(this.wave, this.random);
    this.bossWarn = 2.4;
    this.addShake(0.55);
    this.ring(WORLD.width / 2, 120, 420, 0.8, 6, '#9d4edd');
    this.ring(WORLD.width / 2, 120, 300, 0.6, 4, '#ffd166');
    if (this.sound) this.sound.roar();
  }

  rollUpgrades() {
    const pool = [...UPGRADES];
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const i = Math.floor(this.random() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    this.upgradeChoices = picks;
  }

  applyUpgrade(id) {
    const p = this.player;
    if (id === 'blaze') p.fireRateMul *= 0.65;
    if (id === 'twin') p.boltCount = Math.min(3, p.boltCount + 1);
    if (id === 'gale') p.speedMul *= 1.18;
    if (id === 'scales') {
      p.maxLives = Math.min(6, p.maxLives + 1);
      p.lives = Math.min(p.maxLives, p.lives + 1);
    }
    if (id === 'magnet') p.magnet = true;
    if (id === 'ward') p.shield = true;
    this.burst(p.x, p.y, 'gold', 26, 260);
    this.ring(p.x, p.y, 180, 0.5, 4, '#ffd166');
    if (this.sound) this.sound.upgrade();
    this.intermission = false;
    this.upgradeChoices = [];
    this.startWave(this.wave + 1);
  }

  // ---- scoring ----
  addScore(base, x, y) {
    const gained = base * this.multiplier;
    this.score += gained;
    if (x !== undefined) this.floatText(x, y, `+${gained}`, '#ffd166', this.multiplier >= 4 ? 26 : 19);
    return gained;
  }

  addCombo() {
    this.combo += 1;
    this.comboTimer = COMBO.windowSeconds;
    this.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(this.combo / COMBO.perMultiplier));
  }

  // ---- damage ----
  damageEnemy(enemy, damage, kx, ky) {
    enemy.hp -= damage;
    enemy.flash = 0.09;
    if (kx !== undefined) {
      enemy.x += kx;
      enemy.y += ky;
    }
    this.particles.sparks(enemy.x, enemy.y, 'white', 5, 260, Math.atan2(ky ?? 0, kx ?? 0), Math.PI, this.random);
    if (this.sound) this.sound.hitEnemy();
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    const colors = { inkcloud: 'ink', firework: 'pink', moth: 'purple' };
    const glow = colors[enemy.kind] || 'gold';
    this.burst(enemy.x, enemy.y, glow, enemy.kind === 'inkcloud' ? 30 : 22, 300);
    this.burst(enemy.x, enemy.y, 'gold', 10, 180);
    this.ring(enemy.x, enemy.y, 90, 0.35, 3, glow === 'ink' ? '#7b5cff' : '#ffd166');
    this.addShake(enemy.kind === 'inkcloud' ? 0.22 : 0.16);
    this.addHitStop(0.045);
    this.addCombo();
    this.addScore(enemy.score, enemy.x, enemy.y);
    if (this.sound) this.sound.kill();
    if (this.random() < PICKUP_DROP_CHANCE) {
      const kind = pickWeighted(this.random, PICKUP_WEIGHTS);
      this.pickups.push(new Pickup(kind, enemy.x, enemy.y));
    }
  }

  killBoss() {
    const boss = this.boss;
    if (!boss || boss.dead) return;
    boss.dead = true;
    this.burst(boss.x, boss.y, 'purple', 90, 520);
    this.burst(boss.x, boss.y, 'gold', 60, 420);
    this.burst(boss.x, boss.y, 'pink', 40, 340);
    this.ring(boss.x, boss.y, 560, 0.9, 8, '#ffd166');
    this.ring(boss.x, boss.y, 380, 0.7, 5, '#9d4edd');
    this.addShake(1);
    this.addHitStop(0.14);
    this.slowmo = 0.5;
    this.addScore(boss.score, boss.x, boss.y);
    if (this.sound) this.sound.explodeBig();
    // Chain reaction: every remaining foe bursts at once.
    for (const enemy of this.enemies) {
      if (!enemy.dead) {
        this.burst(enemy.x, enemy.y, 'gold', 16, 300);
        enemy.dead = true;
      }
    }
    this.enemies = [];
    this.enemyBolts = [];
    this.boss = null;
    this.floatText(boss.x, boss.y - 60, '墨凤已灭！', '#ffd166', 30);
    this.waveClear();
  }

  hurtPlayer(fromX, fromY) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || !p.alive) return;
    if (p.shield) {
      p.shield = false;
      this.ring(p.x, p.y, 150, 0.5, 5, '#c77dff');
      this.burst(p.x, p.y, 'purple', 24, 300);
      this.addShake(0.4);
      this.addHitStop(0.05);
      this.floatText(p.x, p.y - 34, '护盾抵挡！', '#c77dff', 20);
      if (this.sound) this.sound.kill();
      return;
    }
    p.lives -= 1;
    p.invuln = PLAYER.invulnerableTime;
    this.combo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.hurtFlash = 0.5;
    this.addShake(0.75);
    this.addHitStop(0.09);
    this.burst(p.x, p.y, 'red', 34, 380);
    this.ring(p.x, p.y, 170, 0.45, 5, '#ff5964');
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx += (dx / len) * 520;
    p.vy += (dy / len) * 520;
    if (this.sound) this.sound.hurt();
    if (p.lives <= 0) {
      p.alive = false;
      this.over = true;
      this.burst(p.x, p.y, 'red', 70, 460);
      this.burst(p.x, p.y, 'gold', 40, 340);
      this.ring(p.x, p.y, 420, 0.8, 7, '#ff5964');
      this.addShake(1);
      this.addHitStop(0.16);
      if (this.sound) this.sound.explodeBig();
    }
  }

  collectPickup(pickup) {
    pickup.dead = true;
    const p = this.player;
    if (pickup.kind === 'lantern') {
      this.addCombo();
      this.addScore(100, pickup.x, pickup.y);
      this.burst(pickup.x, pickup.y, 'gold', 18, 220);
      this.ring(pickup.x, pickup.y, 70, 0.3, 3, '#ffd166');
      if (this.sound) this.sound.pickup(this.combo);
    } else if (pickup.kind === 'ingot') {
      p.lives = Math.min(p.maxLives, p.lives + 1);
      this.floatText(pickup.x, pickup.y, '+1 命', '#80ed99', 22);
      this.burst(pickup.x, pickup.y, 'green', 22, 240);
      if (this.sound) this.sound.upgrade();
    } else if (pickup.kind === 'heart') {
      p.lives = Math.min(p.maxLives, p.lives + 1);
      this.floatText(pickup.x, pickup.y, '+1 命', '#ef476f', 22);
      this.burst(pickup.x, pickup.y, 'red', 22, 240);
      if (this.sound) this.sound.pickup(2);
    } else if (pickup.kind === 'cracker') {
      this.floatText(pickup.x, pickup.y, '爆竹齐鸣！', '#ffca3a', 26);
      this.ring(p.x, p.y, 700, 0.7, 10, '#ffd166');
      this.ring(p.x, p.y, 500, 0.55, 6, '#ff5d8f');
      this.addShake(0.8);
      this.addHitStop(0.08);
      for (const enemy of this.enemies) {
        if (!enemy.dead) this.damageEnemy(enemy, 3, 0, 0);
      }
      if (this.boss) {
        this.boss.hp -= 25;
        this.boss.flash = 0.12;
        this.burst(this.boss.x, this.boss.y, 'purple', 30, 380);
        if (this.boss.hp <= 0) this.killBoss();
      }
      if (this.sound) this.sound.explodeBig();
    }
  }

  waveClear() {
    if (this.wave >= WAVES_TO_WIN && !this.endless) {
      this.victory = true;
      if (this.sound) this.sound.victory();
      return;
    }
    this.rollUpgrades();
    this.intermission = true;
  }

  // ---- per-frame step (fixed 1/60 s from main.js) ----
  step(dt, input) {
    this.time += dt;
    // Hit-stop freezes the fight but the sparks keep flying.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.particles.update(dt);
      this.rings.update(dt);
      this.texts.update(dt);
      return 0;
    }
    const slow = this.slowmo > 0 ? 0.45 : 1;
    if (this.slowmo > 0) this.slowmo -= dt;
    const sdt = dt * slow;

    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.4);
    if (this.waveBanner > 0) this.waveBanner -= dt;
    if (this.bossWarn > 0) this.bossWarn -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }

    this.particles.update(sdt);
    this.rings.update(sdt);
    this.texts.update(sdt);

    // Ambient distant fireworks: pretty, harmless, keeps the sky alive.
    this.ambientTimer -= sdt;
    if (this.ambientTimer <= 0 && !this.over && !this.victory) {
      this.ambientTimer = 1.6 + this.random() * 2.4;
      const x = 80 + this.random() * (WORLD.width - 160);
      const y = 60 + this.random() * 200;
      const glow = pickOne(this.random, ['pink', 'cyan', 'gold', 'green']);
      this.particles.burst(x, y, glow, 14, 150, this.random);
    }

    const p = this.player;
    if (!p.alive) return this.over ? EVENT_GAME_OVER : 0;
    if (this.intermission || this.victory) {
      // The dragon idles and glows during the upgrade pause.
      p.trailTimer -= sdt;
      if (p.trailTimer <= 0) {
        p.trailTimer = 0.09;
        this.particles.embers(p.x, p.y + 10, 'gold', 1, this.random);
      }
      return 0;
    }

    // --- player movement: acceleration + damping = weight and speed ---
    // input is a plain snapshot { moveX, moveY, aimX, aimY, firing,
    // dashPressed, mouseMoved, mouseWorld } built by main.js or shots.js.
    let tx = input.moveX || 0;
    let ty = input.moveY || 0;
    if (tx === 0 && ty === 0 && input.mouseMoved) {
      const rect = input.mouseWorld;
      if (rect) {
        const dx = rect.x - p.x;
        const dy = rect.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 26) {
          tx = dx / d;
          ty = dy / d;
        }
      }
    }
    if (p.dashTimer > 0) {
      p.dashTimer -= sdt;
      p.vx = p.dashDirX * PLAYER.dashSpeed;
      p.vy = p.dashDirY * PLAYER.dashSpeed;
      p.afterimages.unshift({ x: p.x, y: p.y, angle: p.angle, life: 0.22 });
      if (p.afterimages.length > 8) p.afterimages.pop();
    } else {
      p.vx += tx * PLAYER.accel * p.speedMul * sdt;
      p.vy += ty * PLAYER.accel * p.speedMul * sdt;
      const damp = Math.exp(-PLAYER.damping * sdt);
      p.vx *= damp;
      p.vy *= damp;
      const sp = Math.hypot(p.vx, p.vy);
      const max = PLAYER.maxSpeed * p.speedMul;
      if (sp > max) {
        p.vx = (p.vx / sp) * max;
        p.vy = (p.vy / sp) * max;
      }
      if (input.dashPressed && p.dashCooldown <= 0) {
        const dl = Math.hypot(tx, ty);
        if (dl > 0.1) {
          p.dashDirX = tx / dl;
          p.dashDirY = ty / dl;
        } else {
          p.dashDirX = Math.cos(p.angle);
          p.dashDirY = Math.sin(p.angle);
        }
        p.dashTimer = PLAYER.dashTime;
        p.dashCooldown = PLAYER.dashCooldown;
        this.burst(p.x, p.y, 'cyan', 16, 260);
        if (this.sound) this.sound.dash();
      }
    }
    p.dashCooldown = Math.max(0, p.dashCooldown - sdt);
    p.x = clamp(p.x + p.vx * sdt, 24, WORLD.width - 24);
    p.y = clamp(p.y + p.vy * sdt, 24, WORLD.height - 24);
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > 40) p.angle = Math.atan2(p.vy, p.vx);
    p.updateSegments();
    for (const a of p.afterimages) a.life -= sdt;
    p.afterimages = p.afterimages.filter((a) => a.life > 0);
    p.invuln = Math.max(0, p.invuln - sdt);
    p.muzzle = Math.max(0, p.muzzle - sdt);

    // Dragon tail embers while flying fast.
    p.trailTimer -= sdt;
    if (spd > 260 && p.trailTimer <= 0) {
      p.trailTimer = 0.05;
      this.particles.embers(p.x - Math.cos(p.angle) * 30, p.y - Math.sin(p.angle) * 30, 'orange', 1, this.random);
    }

    // --- fire breath: recoil, muzzle flash, sound, all synced ---
    p.fireTimer -= sdt;
    const firing = input.firing;
    if (firing && p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireInterval * p.fireRateMul;
      let ax = input.aimX - p.x;
      let ay = input.aimY - p.y;
      if (!input.mouseMoved || Math.hypot(ax, ay) < 10) {
        let nearest = null;
        let nd = Infinity;
        for (const e of this.enemies) {
          const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (d < nd) {
            nd = d;
            nearest = e;
          }
        }
        if (this.boss && !this.boss.dead) nearest = this.boss;
        if (nearest) {
          ax = nearest.x - p.x;
          ay = nearest.y - p.y;
        } else {
          ax = 0;
          ay = -1;
        }
      }
      const base = Math.atan2(ay, ax);
      const n = p.boltCount;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * 0.22;
        const a = base + off + (this.random() - 0.5) * PLAYER.fireSpread;
        const mx = p.x + Math.cos(base) * 26;
        const my = p.y + Math.sin(base) * 26;
        this.bolts.push(new Bolt(mx, my, Math.cos(a) * PLAYER.boltSpeed, Math.sin(a) * PLAYER.boltSpeed));
      }
      p.muzzle = 0.07;
      p.vx -= Math.cos(base) * PLAYER.recoil;
      p.vy -= Math.sin(base) * PLAYER.recoil;
      this.particles.sparks(p.x + Math.cos(base) * 30, p.y + Math.sin(base) * 30, 'orange', 3, 320, base, 0.7, this.random);
      if (this.sound) this.sound.shoot();
    }

    // --- spawning ---
    if (!this.plan) this.startWave(1);
    if (this.spawned < this.plan.budget) {
      this.spawnTimer -= sdt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.35, 1.15 - this.wave * 0.06);
        const kind = pickWeighted(this.random, Object.entries(this.plan.mix));
        this.spawnEnemy(kind);
        this.spawned += 1;
        if (this.plan.boss && !this.boss && this.spawned >= Math.floor(this.plan.budget * 0.5)) {
          this.spawnBoss();
        }
      }
    }
    this.lanternTimer -= sdt;
    if (this.lanternTimer <= 0) {
      this.lanternTimer = 2.6 + this.random() * 1.6;
      this.pickups.push(new Pickup('lantern', 80 + this.random() * (WORLD.width - 160), -20));
    }

    // --- bolts ---
    for (const b of this.bolts) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      b.life -= sdt;
      if (b.life <= 0 || b.x < -20 || b.x > WORLD.width + 20 || b.y < -20 || b.y > WORLD.height + 20) b.dead = true;
    }
    for (const b of this.enemyBolts) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      b.life -= sdt;
      b.t += sdt;
      if (b.life <= 0 || b.x < -30 || b.x > WORLD.width + 30 || b.y < -30 || b.y > WORLD.height + 30) b.dead = true;
    }

    // --- enemies ---
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += sdt;
      e.flash = Math.max(0, e.flash - sdt);
      if (e.kind === 'inkcloud') {
        e.vy = ENEMIES.inkcloud.speed * 0.45;
        e.x += Math.sin(e.t * 0.9 + e.seed) * 46 * sdt;
        e.y += e.vy * sdt;
      } else if (e.kind === 'firework') {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.vx = Math.cos(a + Math.sin(e.t * 3 + e.seed) * 0.5) * ENEMIES.firework.speed;
        e.vy = Math.sin(a + Math.sin(e.t * 3 + e.seed) * 0.5) * ENEMIES.firework.speed;
        e.x += e.vx * sdt;
        e.y += e.vy * sdt;
      } else if (e.kind === 'moth') {
        e.x += Math.sin(e.t * 1.6 + e.seed) * 130 * sdt;
        e.y += ENEMIES.moth.speed * 0.55 * sdt;
        e.shootTimer -= sdt;
        if (e.shootTimer <= 0 && e.y > 0 && e.y < WORLD.height * 0.7) {
          e.shootTimer = 2.4 + this.random() * 1.4;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          this.enemyBolts.push(new EnemyBolt(e.x, e.y, Math.cos(a) * 240, Math.sin(a) * 240));
          this.particles.sparks(e.x, e.y, 'purple', 4, 160, a, 0.8, this.random);
        }
      }
      if (e.y > WORLD.height + 50 || e.x < -80 || e.x > WORLD.width + 80) {
        if (e.kind === 'firework' || e.kind === 'moth') {
          e.y = -30;
          e.x = 60 + this.random() * (WORLD.width - 120);
        } else {
          e.dead = true;
        }
      }
    }

    // --- boss ---
    if (this.boss && !this.boss.dead) {
      const b = this.boss;
      b.t += sdt;
      b.flash = Math.max(0, b.flash - sdt);
      b.wingPhase += sdt * 7;
      if (b.phase === 'enter') {
        b.y += 130 * sdt;
        if (b.y >= b.targetY) {
          b.y = b.targetY;
          b.phase = 'fight';
          this.ring(b.x, b.y, 300, 0.6, 5, '#9d4edd');
        }
      } else {
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        const desiredX = WORLD.width / 2 + Math.sin(b.t * 0.55) * 380;
        b.x += (desiredX - b.x) * 0.9 * sdt;
        b.y += (150 + Math.sin(b.t * 0.8) * 60 - b.y) * 0.8 * sdt;
        b.attackTimer -= sdt;
        if (b.attackTimer <= 0) {
          b.attackTimer = 1.9 - Math.min(0.7, this.wave * 0.05);
          for (let i = -2; i <= 2; i += 1) {
            const fa = a + i * 0.24;
            this.enemyBolts.push(new EnemyBolt(b.x, b.y + 30, Math.cos(fa) * 300, Math.sin(fa) * 300));
          }
          this.particles.sparks(b.x, b.y + 30, 'purple', 10, 300, a, 1.2, this.random);
          if (this.sound) this.sound.shoot();
        }
        b.summonTimer -= sdt;
        if (b.summonTimer <= 0) {
          b.summonTimer = 8;
          for (let i = 0; i < 2; i += 1) this.spawnEnemy('inkcloud');
          this.floatText(b.x, b.y - 90, '墨云听令！', '#9d4edd', 22);
        }
        b.swoopTimer -= sdt;
        if (b.swoopTimer <= 0) {
          b.swoopTimer = 6.5;
          b.swooping = true;
          this.addShake(0.3);
        }
        if (b.swooping) {
          b.x += Math.cos(a) * 520 * sdt;
          b.y += Math.sin(a) * 520 * sdt;
          this.particles.embers(b.x, b.y, 'purple', 2, this.random);
          if (Math.hypot(p.x - b.x, p.y - b.y) < 120 || b.t % 1 < 0.02) b.swooping = false;
        }
      }
    }

    // --- pickups ---
    for (const pk of this.pickups) {
      if (pk.dead) continue;
      pk.t += sdt;
      pk.y += pk.vy * sdt;
      if (p.magnet && pk.kind === 'lantern') {
        const dx = p.x - pk.x;
        const dy = p.y - pk.y;
        const d = Math.hypot(dx, dy);
        if (d < 280 && d > 1) {
          pk.x += (dx / d) * 420 * sdt;
          pk.y += (dy / d) * 420 * sdt;
        }
      }
      if (pk.y > WORLD.height + 30) pk.dead = true;
    }

    // --- collisions: bolts vs foes (with knockback) ---
    for (const b of this.bolts) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const rr = e.radius + b.radius;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          b.dead = true;
          const kb = 26;
          const ka = Math.atan2(b.vy, b.vx);
          this.damageEnemy(e, b.damage, Math.cos(ka) * kb, Math.sin(ka) * kb);
          break;
        }
      }
      if (!b.dead && this.boss && !this.boss.dead) {
        const bo = this.boss;
        const rr = bo.radius + b.radius;
        if ((bo.x - b.x) ** 2 + (bo.y - b.y) ** 2 < rr * rr) {
          b.dead = true;
          bo.hp -= b.damage;
          bo.flash = 0.08;
          this.particles.sparks(b.x, b.y, 'white', 6, 300, Math.atan2(b.vy, b.vx), Math.PI, this.random);
          if (this.sound) this.sound.hitEnemy();
          if (bo.hp <= 0) this.killBoss();
        }
      }
    }

    // --- collisions: player vs foes, bolts, pickups ---
    for (const e of this.enemies) {
      if (e.dead) continue;
      const rr = e.radius + p.radius - 4;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
        if (e.kind === 'firework') {
          this.burst(e.x, e.y, 'pink', 26, 340);
          e.dead = true;
          this.addScore(e.score, e.x, e.y);
        }
        this.hurtPlayer(e.x, e.y);
        if (e.kind !== 'firework') e.dead = true;
        if (!p.alive) break;
      }
    }
    if (p.alive && this.boss && !this.boss.dead) {
      const bo = this.boss;
      const rr = bo.radius * 0.82 + p.radius - 6;
      if ((bo.x - p.x) ** 2 + (bo.y - p.y) ** 2 < rr * rr) this.hurtPlayer(bo.x, bo.y);
    }
    for (const b of this.enemyBolts) {
      if (b.dead || !p.alive) continue;
      const rr = b.radius + p.radius - 4;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) {
        b.dead = true;
        this.hurtPlayer(b.x, b.y);
      }
    }
    for (const pk of this.pickups) {
      if (pk.dead || !p.alive) continue;
      const rr = pk.radius + p.radius + 6;
      if ((pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 < rr * rr) this.collectPickup(pk);
    }

    // --- cleanup ---
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bolts = this.bolts.filter((b) => !b.dead);
    this.enemyBolts = this.enemyBolts.filter((b) => !b.dead);
    this.pickups = this.pickups.filter((pk) => !pk.dead);

    // --- wave clear ---
    if (this.plan && this.spawned >= this.plan.budget && this.enemies.length === 0 && !this.boss && !this.intermission && !this.victory && p.alive) {
      this.waveClear();
    }

    if (this.victory) return EVENT_VICTORY;
    if (this.over) return EVENT_GAME_OVER;
    return 0;
  }
}
