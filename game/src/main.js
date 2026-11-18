// PAPER DRIFT — boot, the frame loop and the screens. One job: own the
// canvas, the state machine (title, playing, upgrade, paused, over,
// victory) and the ?shot= scenes; the rules live in world.js, the pixels in
// render.js. The loop runs a fixed 1/60 s step with an accumulator, so the
// game feels the same on any display and never jumps a frame.
import { STEP, WORLD } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World, EVENT_GAME_OVER, EVENT_VICTORY } from './world.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY, draw } from './render.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'paper-drift-best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Best score is a nicety; never break the game.
  }
}

function fitCanvas(canvas) {
  const scale = Math.min(window.innerWidth / WORLD.width, window.innerHeight / WORLD.height);
  canvas.style.width = `${Math.floor(WORLD.width * scale)}px`;
  canvas.style.height = `${Math.floor(WORLD.height * scale)}px`;
}

function main() {
  const canvas = document.getElementById('game');
  const status = document.getElementById('status');
  const params = new URLSearchParams(window.location.search);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.width * dpr;
  canvas.height = WORLD.height * dpr;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  const ctx = canvas.getContext('2d');
  const input = new Input(canvas);
  const sound = new SoundBank();
  const world = new World(1);
  world.sound = sound;
  window.__paperWorld = world;
  let best = loadBest();
  let screen = SCREEN_TITLE;

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function startGame() {
    sound.unlock();
    sound.startMusic();
    world.reset((Math.random() * 1e9) | 0);
    world.best = best;
    world.startWave(1);
    screen = SCREEN_PLAY;
    setStatus('Playing. WASD to fly, mouse to aim, hold Space or click to breathe fire, Shift to dash.');
  }

  function toTitle() {
    world.reset(1);
    screen = SCREEN_TITLE;
    setStatus('PAPER DRIFT title screen. Press Enter or click to start.');
  }

  // Screenshot scenes: stage a deterministic frame, paint it once, stop.
  const shot = params.get('shot');
  if (shot) {
    const seed = Number(params.get('seed') || 1) || 1;
    const staged = stageShot(shot, world, seed);
    world.best = best;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, world, staged.screen, best);
    setStatus(`PAPER DRIFT screenshot scene: ${shot}.`);
    window.__shotReady = true;
    return;
  }

  setStatus('PAPER DRIFT title screen. Press Enter or click to start.');
  let last = performance.now();
  let acc = 0;

  function stepInput(pressed) {
    const rect = canvas.getBoundingClientRect();
    const move = input.moveVector();
    return {
      moveX: move.x,
      moveY: move.y,
      aimX: (input.mouseX / rect.width) * WORLD.width,
      aimY: (input.mouseY / rect.height) * WORLD.height,
      mouseMoved: input.mouseMoved,
      mouseWorld: { x: (input.mouseX / rect.width) * WORLD.width, y: (input.mouseY / rect.height) * WORLD.height },
      firing: input.mouseDown || input.held(' '),
      dashPressed: pressed.has('shift'),
    };
  }

  /** Upgrade card hit areas, mirroring render.js's layout. */
  function upgradeCardAt(mx, my) {
    const cards = world.upgradeChoices;
    if (!cards.length) return -1;
    const cw = 250;
    const ch = 190;
    const gap = 36;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = (WORLD.width - total) / 2;
    const y = 260;
    const rect = canvas.getBoundingClientRect();
    const wx = (mx / rect.width) * WORLD.width;
    const wy = (my / rect.height) * WORLD.height;
    for (let i = 0; i < cards.length; i += 1) {
      const x = x0 + i * (cw + gap);
      if (wx >= x && wx <= x + cw && wy >= y && wy <= y + ch) return i;
    }
    return -1;
  }

  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 0.001;
    const pressed = input.takePressed();
    if (pressed.has('m')) {
      sound.unlock();
      sound.toggleMute();
    }

    if (screen === SCREEN_TITLE) {
      world.time += dt;
      if (pressed.has('enter') || pressed.has('click') || pressed.has(' ')) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (pressed.has('p') || pressed.has('escape')) {
        screen = SCREEN_PAUSE;
        setStatus('Paused. Press P to resume.');
      } else {
        const snap = stepInput(pressed);
        acc += dt;
        let n = 0;
        let events = 0;
        while (acc >= STEP && n < 4) {
          events = world.step(STEP, snap);
          acc -= STEP;
          n += 1;
          if (events) break;
        }
        if (n === 4) acc = 0;
        sound.musicTick(dt, true);
        if (world.score > best) {
          best = world.score;
          saveBest(best);
        }
        if (world.intermission) {
          screen = SCREEN_UPGRADE;
          setStatus('Wave cleared. Choose an upgrade: press 1, 2 or 3, or click a card.');
        } else if (events & EVENT_GAME_OVER || world.over) {
          screen = SCREEN_OVER;
          setStatus(`The dragon fell. Score ${world.score}. Press R to try again.`);
        } else if (events & EVENT_VICTORY || world.victory) {
          screen = SCREEN_VICTORY;
          setStatus(`Victory! Score ${world.score}. Press R to play again, C for endless mode.`);
        }
      }
    } else if (screen === SCREEN_UPGRADE) {
      world.time += dt;
      let pick = -1;
      if (pressed.has('1')) pick = 0;
      else if (pressed.has('2')) pick = 1;
      else if (pressed.has('3')) pick = 2;
      else if (pressed.has('click')) pick = upgradeCardAt(input.mouseX, input.mouseY);
      if (pick >= 0 && pick < world.upgradeChoices.length) {
        world.applyUpgrade(world.upgradeChoices[pick].id);
        screen = SCREEN_PLAY;
        setStatus('Playing.');
      }
    } else if (screen === SCREEN_PAUSE) {
      if (pressed.has('p') || pressed.has('escape') || pressed.has('click')) {
        screen = SCREEN_PLAY;
        setStatus('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      world.time += dt;
      if (pressed.has('r') || pressed.has('enter') || pressed.has('click')) startGame();
      if (pressed.has('t') || pressed.has('escape')) toTitle();
    } else if (screen === SCREEN_VICTORY) {
      world.time += dt;
      if (pressed.has('r') || pressed.has('enter')) startGame();
      if (pressed.has('c')) {
        world.endless = true;
        world.victory = false;
        world.intermission = false;
        world.startWave(world.wave + 1);
        screen = SCREEN_PLAY;
        setStatus('Endless mode. Good luck.');
      }
      if (pressed.has('t') || pressed.has('escape')) toTitle();
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, world, screen, best);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
