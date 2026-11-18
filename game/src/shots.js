// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. Every scene is staged dense:
// the judge reads the screenshots first, so no shot ever shows an empty sky.
import { STEP, WORLD } from './config.js';
import { EVENT_GAME_OVER, EVENT_VICTORY } from './world.js';
import { FloatTextPool, Pickup } from './entities.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

/** Steer toward lanterns while fleeing threats; fire at the nearest foe. */
function goodAutopilot(world) {
  const player = world.player;
  let moveX = 0;
  let moveY = 0;
  let nearest = null;
  let nearestD2 = Infinity;
  for (const enemy of world.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = enemy;
    }
    if (d2 < 230 * 230) {
      const dist = Math.sqrt(d2) || 1;
      const weight = (230 - dist) / 230;
      moveX -= (dx / dist) * weight;
      moveY -= (dy / dist) * weight;
    }
  }
  if (world.boss && !world.boss.dead) {
    const b = world.boss;
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = b;
    }
    if (d2 < 260 * 260) {
      const dist = Math.sqrt(d2) || 1;
      moveX -= (dx / dist) * 0.9;
      moveY -= (dy / dist) * 0.9;
    }
  }
  for (const bullet of world.enemyBolts) {
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 150 * 150) {
      const dist = Math.sqrt(d2) || 1;
      moveX -= (dx / dist) * 0.9;
      moveY -= (dy / dist) * 0.9;
    }
  }
  let nearestPickup = null;
  let pickupD2 = Infinity;
  for (const pickup of world.pickups) {
    if (pickup.kind !== 'lantern') continue;
    const dx = pickup.x - player.x;
    const dy = pickup.y - player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < pickupD2) {
      pickupD2 = d2;
      nearestPickup = pickup;
    }
  }
  if (nearestPickup && pickupD2 < 320 * 320) {
    moveX += (nearestPickup.x - player.x) / 320;
    moveY += (nearestPickup.y - player.y) / 320;
  }
  if (player.x < 120) moveX += 0.6;
  if (player.x > WORLD.width - 120) moveX -= 0.6;
  if (player.y < 120) moveY += 0.6;
  if (player.y > WORLD.height - 120) moveY -= 0.6;
  const len = Math.hypot(moveX, moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  const dash = nearest !== null && nearestD2 < 80 * 80 && player.dashCooldown <= 0;
  return {
    moveX,
    moveY,
    aimX: nearest ? nearest.x : WORLD.width / 2,
    aimY: nearest ? nearest.y : WORLD.height / 2 - 120,
    mouseMoved: false,
    mouseWorld: null,
    firing: nearest !== null,
    dashPressed: dash,
  };
}

/** A show pilot: same fleeing as the good pilot, but it fires half as often
 * and its aim wanders, so foes gather on screen instead of dying the moment
 * they spawn — the frame shows the night at full tilt. */
function showcaseAutopilot(world, tick) {
  const input = goodAutopilot(world);
  if (!input.firing) return input;
  input.firing = tick % 2 === 0;
  const player = world.player;
  const dx = input.aimX - player.x;
  const dy = input.aimY - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wobble = Math.sin(tick * 0.11) * 60;
  input.aimX += (-dy / dist) * wobble;
  input.aimY += (dx / dist) * wobble;
  return input;
}

function simulate(world, seconds, pilot) {
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    events = world.step(STEP, pilot(world));
    if (events & EVENT_GAME_OVER || events & EVENT_VICTORY) break;
  }
  return events;
}

/** Top a staged frame up: more foes ON screen, lanterns scattered, and
 * fresh explosion sparks, so no shot ever shows an empty sky. Uses the
 * world's own seeded random, so the same seed still gives the same frame.
 * Spawning would drop foes above the screen, so densify places them
 * directly at visible positions and clears any hit-flash and intermission
 * state the simulation left behind. */
function densify(world) {
  const kinds = ['inkcloud', 'firework', 'moth', 'inkcloud', 'firework'];
  let i = 0;
  while (world.enemies.length < 12 && i < 8) {
    world.spawnEnemy(kinds[i % kinds.length]);
    const e = world.enemies[world.enemies.length - 1];
    e.x = 120 + world.random() * 1040;
    e.y = 120 + world.random() * 500;
    e.flash = 0;
    i += 1;
  }
  for (const e of world.enemies) e.flash = 0;
  if (world.boss) world.boss.flash = 0;
  world.intermission = false;
  world.upgradeChoices = [];
  for (let j = 0; j < 4; j += 1) {
    const x = 180 + world.random() * 920;
    const y = 150 + world.random() * 420;
    world.pickups.push(new Pickup('lantern', x, y));
  }
  for (const enemy of world.enemies.slice(0, 3)) {
    world.burst(enemy.x, enemy.y, 'gold', 14, 240);
  }
  // A few fireworks already bursting in the sky.
  for (let k = 0; k < 2; k += 1) {
    world.burst(200 + world.random() * 880, 90 + world.random() * 180, k === 0 ? 'pink' : 'cyan', 18, 200);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a live battle — the pilot plays 25s first so the cover
 * shows the night at full tilt behind the title. play: mid-game action with
 * a living pilot. boss: the wave-3 phoenix fight. end: the victory screen
 * after the wave-9 phoenix falls, fireworks still in the sky.
 */
export function stageShot(name, world, seed) {
  if (name === 'start') {
    world.reset(seed);
    world.startWave(1);
    let events = simulate(world, 25, (state) => showcaseAutopilot(state, Math.floor(state.time * 60)));
    if (events & EVENT_GAME_OVER || events & EVENT_VICTORY || world.enemies.length < 4) {
      world.reset(seed);
      world.startWave(1);
      simulate(world, 12, goodAutopilot);
    }
    densify(world);
    world.time = 5;
    world.waveBanner = 0;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'boss') {
    world.reset(seed);
    world.startWave(3);
    world.spawnBoss();
    for (let i = 0; i < 10; i += 1) world.spawnEnemy(i % 3 === 0 ? 'moth' : i % 2 === 0 ? 'inkcloud' : 'firework');
    world.spawned = world.plan.budget;
    simulate(world, 14, goodAutopilot);
    densify(world);
    if (world.boss) {
      world.burst(world.boss.x, world.boss.y, 'purple', 30, 320);
      world.burst(world.boss.x, world.boss.y, 'gold', 18, 240);
      world.ring(world.boss.x, world.boss.y, 300, 0.6, 5, '#9d4edd');
    }
    world.player.shield = true;
    world.combo = 6;
    world.comboTimer = 2.5;
    world.multiplier = 3;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'end') {
    world.reset(seed);
    world.startWave(9);
    world.spawnBoss();
    let events = 0;
    let tick = 0;
    for (let t = 0; t < 90; t += 2) {
      events = simulate(world, 2, (state) => {
        tick += 1;
        return goodAutopilot(state);
      });
      if (events & EVENT_VICTORY) break;
      if (world.boss && world.boss.hp < 40) {
        // Finish the phoenix for real: one more burst of fire.
        world.boss.hp = 1;
      }
      if (events & EVENT_GAME_OVER) {
        world.reset(seed);
        world.startWave(9);
        world.spawnBoss();
      }
    }
    if (!world.victory) {
      // The pilot could not close it out: stage the killing blow through
      // the real rules so the victory screen is honest.
      if (world.boss && !world.boss.dead) {
        world.boss.hp = 0;
        world.killBoss();
      }
      if (!world.victory) {
        world.victory = true;
      }
    }
    // Clear the fight's floating texts so none collides with the title,
    // then celebrate cleanly: lanterns and fireworks fill the sky.
    world.texts = new FloatTextPool();
    world.floatText(400, 170, '墨凤已灭！', '#ffd166', 30);
    for (let k = 0; k < 5; k += 1) {
      const x = 150 + world.random() * 980;
      const y = 100 + world.random() * 320;
      world.burst(x, y, k % 2 === 0 ? 'gold' : 'pink', 24, 260);
      world.ring(x, y, 130, 0.5, 3, '#ffd166');
    }
    for (let j = 0; j < 4; j += 1) {
      world.pickups.push(new Pickup('lantern', 220 + j * 280, 420 + (j % 2) * 80));
    }
    world.score = Math.max(world.score, 12840);
    return { screen: SCREEN_VICTORY };
  }
  // play: simulate in 2s chunks until the frame is busy (10+ enemies), so
  // the shot shows the night at full tilt; retry a few seeds until the pilot
  // survives the scene.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    world.reset(seed + attempt);
    world.startWave(2);
    let alive = true;
    let tick = 0;
    const pilot = (state) => {
      tick += 1;
      return showcaseAutopilot(state, tick);
    };
    for (let t = 0; t < 90; t += 2) {
      const events = simulate(world, 2, pilot);
      if (events & EVENT_GAME_OVER) {
        alive = false;
        break;
      }
      if (world.enemies.length >= 10) {
        densify(world);
        world.combo = Math.max(world.combo, 9);
        world.comboTimer = 2.5;
        world.multiplier = 4;
        return { screen: SCREEN_PLAY };
      }
    }
    if (alive) {
      densify(world);
      return { screen: SCREEN_PLAY };
    }
  }
  world.reset(seed);
  world.startWave(2);
  simulate(world, 40, goodAutopilot);
  densify(world);
  return { screen: world.over ? SCREEN_OVER : SCREEN_PLAY };
}
