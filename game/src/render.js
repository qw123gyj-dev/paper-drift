// PAPER DRIFT — the pixels. One job: draw everything the player sees —
// the paper-cut night sky, the dragon, ink foes, the phoenix, lanterns —
// and every effect that makes it explode off the screen: glow sprites,
// shockwave rings, hit-flash, screen shake, floating score text. The rules
// live in world.js; this file only paints the state it is handed.
//
// Performance: glow comes from pre-rendered sprites (entities.js) drawn
// with 'lighter'; there is no shadowBlur anywhere in the frame loop.
import { PALETTE, WORLD } from './config.js';
import { makeGlowSprites } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_UPGRADE = 'upgrade';

let sprites = null;
function glow() {
  if (!sprites) sprites = makeGlowSprites();
  return sprites;
}

function drawGlow(ctx, sprite, x, y, size, alpha) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

/** Scalloped paper-cut edge: a circle with a wavy rim, like cut paper. */
function paperDisc(ctx, x, y, r, points, wobble, phase) {
  ctx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2 + phase;
    const rr = r + Math.sin(a * 3 + phase) * wobble;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function paperStar(ctx, x, y, r, points, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawSky(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Twinkling stars, two parallax layers by size.
  for (const s of world.stars) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(world.time * s.sp + s.tw));
    ctx.globalAlpha = a;
    ctx.fillStyle = PALETTE.star;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // The moon, big and pale gold, with a halo.
  const sp = glow();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, sp.white, 1050, 130, 260, 0.35);
  drawGlow(ctx, sp.gold, 1050, 130, 170, 0.5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(1050, 130, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(214, 182, 120, 0.5)';
  ctx.beginPath();
  ctx.arc(1032, 116, 12, 0, Math.PI * 2);
  ctx.arc(1068, 146, 9, 0, Math.PI * 2);
  ctx.arc(1058, 108, 6, 0, Math.PI * 2);
  ctx.fill();

  // Paper-cut mountains and a temple roofline, far and near.
  ctx.fillStyle = PALETTE.mountainFar;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.height);
  ctx.lineTo(0, 640);
  ctx.lineTo(120, 560);
  ctx.lineTo(240, 630);
  ctx.lineTo(380, 540);
  ctx.lineTo(520, 640);
  ctx.lineTo(660, 570);
  ctx.lineTo(820, 650);
  ctx.lineTo(960, 560);
  ctx.lineTo(1120, 640);
  ctx.lineTo(1280, 580);
  ctx.lineTo(1280, WORLD.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.mountainNear;
  ctx.beginPath();
  ctx.moveTo(0, WORLD.height);
  ctx.lineTo(0, 720);
  ctx.lineTo(160, 670);
  ctx.lineTo(340, 730);
  ctx.lineTo(520, 680);
  ctx.lineTo(700, 740);
  ctx.lineTo(900, 690);
  ctx.lineTo(1080, 735);
  ctx.lineTo(1280, 700);
  ctx.lineTo(1280, WORLD.height);
  ctx.closePath();
  ctx.fill();
  // Temple silhouette with upturned eaves.
  ctx.fillStyle = PALETTE.temple;
  ctx.beginPath();
  ctx.moveTo(84, 742);
  ctx.lineTo(84, 700);
  ctx.lineTo(70, 692);
  ctx.lineTo(120, 668);
  ctx.lineTo(170, 692);
  ctx.lineTo(156, 700);
  ctx.lineTo(156, 742);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(96, 742, 48, 10);
}

function drawLanternShape(ctx, x, y, r, color, t) {
  const sway = Math.sin(t * 1.4 + x * 0.01) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.fillStyle = '#8a6d1f';
  ctx.fillRect(-3, -r - 8, 6, 6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.82, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 20, 20, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.45, r * 0.94, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.3, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e63946';
  ctx.fillRect(-2, r + 2, 4, 12);
  ctx.restore();
}

function drawDragon(ctx, world, p, ghost = false, ghostAlpha = 0.3) {
  const sp = glow();
  if (ghost) ctx.globalAlpha = ghostAlpha;
  // Body: paper segments trailing the head, red with gold bellies.
  const segs = p.segments;
  for (let i = segs.length - 1; i >= 1; i -= 1) {
    const s = segs[i];
    const f = 1 - i / segs.length;
    const r = 7 + f * 9;
    ctx.fillStyle = i % 2 === 0 ? PALETTE.dragonRed : PALETTE.dragonDark;
    paperDisc(ctx, s.x, s.y, r, 8, 1.6, i * 0.7);
    ctx.fill();
    ctx.fillStyle = PALETTE.dragonGold;
    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.42, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // Muzzle flash glow while breathing fire.
  if (p.muzzle > 0 && !ghost) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.orange, p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34, 90, 0.9);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Head: paper-cut dragon head with horns, mane and bright eyes.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = PALETTE.dragonRed;
  paperDisc(ctx, 0, 0, 17, 8, 2, 0.4);
  ctx.fill();
  // Horns.
  ctx.fillStyle = PALETTE.dragonGold;
  ctx.beginPath();
  ctx.moveTo(-6, -12);
  ctx.lineTo(-20, -30);
  ctx.lineTo(-2, -16);
  ctx.closePath();
  ctx.moveTo(2, -14);
  ctx.lineTo(-4, -34);
  ctx.lineTo(8, -15);
  ctx.closePath();
  ctx.fill();
  // Mane spikes.
  ctx.fillStyle = PALETTE.dragonGold;
  for (let i = 0; i < 3; i += 1) {
    const my = -8 + i * 8;
    ctx.beginPath();
    ctx.moveTo(-10, my);
    ctx.lineTo(-24, my - 4);
    ctx.lineTo(-10, my + 4);
    ctx.closePath();
    ctx.fill();
  }
  // Snout and jaw.
  ctx.fillStyle = PALETTE.dragonDark;
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(30, -4);
  ctx.lineTo(30, 6);
  ctx.lineTo(10, 9);
  ctx.closePath();
  ctx.fill();
  // Eyes: bright, always looking where it flies.
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.arc(6, -7, 4.4, 0, Math.PI * 2);
  ctx.arc(6, 7, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1030';
  ctx.beginPath();
  ctx.arc(8, -7, 2.2, 0, Math.PI * 2);
  ctx.arc(8, 7, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Whiskers.
  ctx.strokeStyle = PALETTE.dragonGold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(26, -4);
  ctx.quadraticCurveTo(40, -12, 48, -6);
  ctx.moveTo(26, 5);
  ctx.quadraticCurveTo(40, 12, 48, 7);
  ctx.stroke();
  ctx.restore();
  if (ghost) ctx.globalAlpha = 1;
  // Shield ring.
  if (p.shield && !ghost) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.purple, p.x, p.y, 110, 0.5 + 0.2 * Math.sin(world.time * 5));
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(199, 125, 255, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemy(ctx, world, e) {
  const sp = glow();
  const flash = e.flash > 0;
  if (e.kind === 'inkcloud') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.ink, e.x, e.y, e.radius * 5, 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = flash ? '#ffffff' : PALETTE.ink;
    paperDisc(ctx, e.x, e.y, e.radius, 9, 5, e.seed);
    ctx.fill();
    paperDisc(ctx, e.x - e.radius * 0.55, e.y + 6, e.radius * 0.6, 8, 4, e.seed + 1);
    ctx.fill();
    paperDisc(ctx, e.x + e.radius * 0.55, e.y + 6, e.radius * 0.6, 8, 4, e.seed + 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.inkRim;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    // Angry ink eyes.
    ctx.fillStyle = '#c77dff';
    ctx.beginPath();
    ctx.arc(e.x - 8, e.y - 4, 3.4, 0, Math.PI * 2);
    ctx.arc(e.x + 8, e.y - 4, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(e.x - 8, e.y - 4, 1.6, 0, Math.PI * 2);
    ctx.arc(e.x + 8, e.y - 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'firework') {
    const a = Math.atan2(e.vy, e.vx);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.pink, e.x, e.y, 70, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(a);
    ctx.fillStyle = flash ? '#ffffff' : '#ff8fab';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (e.kind === 'moth') {
    const flap = Math.sin(e.t * 14) * 0.7;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.purple, e.x, e.y, 64, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = flash ? '#ffffff' : '#7b2fbe';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * flap * 0.5);
      ctx.beginPath();
      ctx.ellipse(side * 12, -6, 14, 8, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = flash ? '#ffffff' : '#3c096c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(-3, -4, 2, 0, Math.PI * 2);
    ctx.arc(3, -4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBoss(ctx, world, b) {
  const sp = glow();
  const flash = b.flash > 0;
  const flap = Math.sin(b.wingPhase) * 0.45;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, sp.purple, b.x, b.y, 340, 0.6);
  drawGlow(ctx, sp.gold, b.x, b.y, 200, 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(b.x, b.y);
  // Tail feathers streaming behind.
  ctx.strokeStyle = flash ? '#ffffff' : '#9d4edd';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-40, i * 10);
    ctx.quadraticCurveTo(-110, i * 22 + Math.sin(b.t * 2 + i) * 14, -170 - Math.abs(i) * 10, i * 30 + Math.sin(b.t * 2 + i) * 20);
    ctx.stroke();
  }
  // Wings: layered paper feathers, flapping.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * flap);
    ctx.fillStyle = flash ? '#ffffff' : '#6d28a8';
    paperDisc(ctx, side * 8, -52, 46, 8, 6, 0.2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#9d4edd';
    paperDisc(ctx, side * 26, -34, 34, 8, 5, 0.9);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#c77dff';
    paperDisc(ctx, side * 40, -16, 22, 7, 4, 1.6);
    ctx.fill();
    ctx.restore();
  }
  // Body: ink phoenix torso with gold rim.
  ctx.fillStyle = flash ? '#ffffff' : '#241a4d';
  paperDisc(ctx, 0, 0, 62, 10, 7, 0.3);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();
  // Head and crest.
  ctx.fillStyle = flash ? '#ffffff' : '#2e1a5e';
  paperDisc(ctx, 34, -30, 26, 8, 4, 0.5);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(28, -52);
  ctx.lineTo(20, -78);
  ctx.lineTo(38, -54);
  ctx.closePath();
  ctx.moveTo(40, -52);
  ctx.lineTo(44, -80);
  ctx.lineTo(52, -52);
  ctx.closePath();
  ctx.fill();
  // Beak.
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(54, -36);
  ctx.lineTo(78, -26);
  ctx.lineTo(54, -18);
  ctx.closePath();
  ctx.fill();
  // Burning eyes.
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(40, -36, 6, 0, Math.PI * 2);
  ctx.arc(40, -18, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff2e63';
  ctx.beginPath();
  ctx.arc(42, -36, 3, 0, Math.PI * 2);
  ctx.arc(42, -18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Boss HP bar, below the HUD panels so it never collides with them.
  const w = 420;
  const x = (WORLD.width - w) / 2;
  const y = 88;
  ctx.fillStyle = 'rgba(8, 6, 24, 0.7)';
  ctx.fillRect(x - 6, y - 6, w + 12, 26);
  ctx.fillStyle = '#3c096c';
  ctx.fillRect(x, y, w, 14);
  ctx.fillStyle = '#c77dff';
  ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 14);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('墨凤 · INK PHOENIX', WORLD.width / 2, y + 36);
}

function drawPickup(ctx, world, pk) {
  const sp = glow();
  const bob = Math.sin(pk.t * 3) * 4;
  const y = pk.y + bob;
  if (pk.kind === 'lantern') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.gold, pk.x, y, 90, 0.75 + 0.2 * Math.sin(pk.t * 4));
    ctx.globalCompositeOperation = 'source-over';
    drawLanternShape(ctx, pk.x, y, 15, PALETTE.lanternRed, pk.t);
  } else if (pk.kind === 'ingot') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.gold, pk.x, y, 70, 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(pk.x - 14, y + 8);
    ctx.quadraticCurveTo(pk.x - 14, y - 10, pk.x, y - 10);
    ctx.quadraticCurveTo(pk.x + 14, y - 10, pk.x + 14, y + 8);
    ctx.quadraticCurveTo(pk.x, y + 2, pk.x - 14, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pk.kind === 'cracker') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.red, pk.x, y, 80, 0.7 + 0.3 * Math.sin(pk.t * 6));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e63946';
    ctx.fillRect(pk.x - 7, y - 12, 14, 24);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(pk.x - 7, y - 4, 14, 4);
    ctx.fillRect(pk.x - 7, y + 5, 14, 4);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pk.x, y - 12);
    ctx.quadraticCurveTo(pk.x + 8, y - 22, pk.x + 2, y - 26);
    ctx.stroke();
  } else if (pk.kind === 'heart') {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, sp.pink, pk.x, y, 70, 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PALETTE.heart;
    paperStar(ctx, pk.x, y, 13, 5, 0.45);
    ctx.fill();
  }
}

function drawBolt(ctx, b) {
  const sp = glow();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, sp.orange, b.x, b.y, 44, 0.9);
  drawGlow(ctx, sp.gold, b.x, b.y, 22, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = PALETTE.flameCore;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyBolt(ctx, b) {
  const sp = glow();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, sp.ink, b.x, b.y, 44, 0.7);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.atan2(b.vy, b.vx));
  ctx.fillStyle = '#3c096c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c77dff';
  ctx.beginPath();
  ctx.arc(6, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, world) {
  const sp = glow();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles.items) {
    if (!p.alive) continue;
    const a = p.life / p.maxLife;
    if (p.spark) {
      ctx.strokeStyle = p.glow === 'white' ? `rgba(255,248,224,${a})` : `rgba(255,209,102,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else {
      const size = p.size * (0.6 + a * 0.9) * 3.2;
      drawGlow(ctx, sp[p.glow] || sp.gold, p.x, p.y, size, a * 0.9);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawRings(ctx, world) {
  ctx.globalCompositeOperation = 'lighter';
  for (const r of world.rings.items) {
    if (!r.alive) continue;
    const a = r.life / r.maxLife;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(1, r.width * a);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawTexts(ctx, world) {
  ctx.textAlign = 'center';
  for (const t of world.texts.items) {
    if (!t.alive) continue;
    const a = Math.min(1, (t.life / t.maxLife) * 1.6);
    ctx.globalAlpha = a;
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10, 6, 30, 0.85)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world, best) {
  const p = world.player;
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(14, 12, 300, 64);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`${world.score}`, 28, 42);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`最佳 ${Math.max(best, world.score)}`, 28, 62);
  // Lives as paper hearts.
  for (let i = 0; i < p.maxLives; i += 1) {
    const x = 330 + i * 30;
    const y = 34;
    ctx.fillStyle = i < p.lives ? PALETTE.heart : 'rgba(239, 71, 111, 0.25)';
    paperStar(ctx, x, y, 11, 5, 0.45);
    ctx.fill();
  }
  // Dash cooldown pip.
  ctx.fillStyle = 'rgba(76, 201, 240, 0.25)';
  ctx.fillRect(330, 56, 120, 6);
  ctx.fillStyle = '#4cc9f0';
  ctx.fillRect(330, 56, 120 * (1 - p.dashCooldown / 1.6), 6);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('SHIFT 疾行', 456, 63);

  // Wave + lantern count, right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(WORLD.width - 214, 12, 200, 64);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`第 ${Math.max(1, world.wave)} / 9 波`, WORLD.width - 28, 40);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(world.intermission ? '选择强化' : `${world.enemies.length} 敌 · 灯笼连击 x${world.multiplier}`, WORLD.width - 28, 62);
  // Combo badge.
  if (world.combo >= 3) {
    const pulse = 1 + 0.12 * Math.sin(world.time * 10);
    ctx.save();
    ctx.translate(WORLD.width - 120, 108);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`x${world.multiplier}`, 0, -2);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`${world.combo} 连击`, 0, 16);
    ctx.restore();
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 6, 26, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawTitle(ctx, world, best) {
  ctx.fillStyle = 'rgba(7, 8, 26, 0.45)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dragonGold;
  ctx.font = 'bold 92px "Noto Serif SC", serif, system-ui, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(120, 20, 20, 0.9)';
  ctx.strokeText('纸龙夜游', WORLD.width / 2, 250);
  ctx.fillText('纸龙夜游', WORLD.width / 2, 250);
  ctx.fillStyle = '#ff8fa3';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('P A P E R   D R I F T', WORLD.width / 2, 300);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('剪一尾纸龙，穿过墨夜，点亮万盏灯笼，斩落墨凤。', WORLD.width / 2, 352);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('WASD / 方向键飞行 · 鼠标瞄准 · 按住空格或点击吐火 · SHIFT 疾行 · M 静音', WORLD.width / 2, 392);
  ctx.fillText('撑过 9 波，击败 3 只墨凤，即可胜利。每波之间三选一强化。', WORLD.width / 2, 420);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('按 Enter 或点击开始', WORLD.width / 2, 486);
  ctx.globalAlpha = 1;
  if (best > 0) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`最佳分数 ${best}`, WORLD.width / 2, 528);
  }
}

function drawUpgrade(ctx, world) {
  ctx.fillStyle = 'rgba(7, 8, 26, 0.55)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(`第 ${world.wave} 波已过`, WORLD.width / 2, 150);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('选一项强化，继续夜游（按 1 / 2 / 3 或点击）', WORLD.width / 2, 192);
  const cards = world.upgradeChoices;
  const cw = 250;
  const ch = 190;
  const gap = 36;
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = (WORLD.width - total) / 2;
  const y = 260;
  cards.forEach((card, i) => {
    panel(ctx, x, y, cw, ch);
    ctx.fillStyle = card.color;
    paperStar(ctx, x + cw / 2, y + 52, 30, 5, 0.45);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(card.name, x + cw / 2, y + 116);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(card.desc, x + cw / 2, y + 148);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, x + cw / 2, y + 176);
    x += cw + gap;
  });
}

function drawOver(ctx, world, best) {
  ctx.fillStyle = 'rgba(20, 4, 12, 0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5964';
  ctx.font = 'bold 72px "Noto Serif SC", serif, system-ui, sans-serif';
  ctx.fillText('龙坠墨海', WORLD.width / 2, 280);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(`分数 ${world.score} · 最佳 ${Math.max(best, world.score)} · 到达第 ${world.wave} 波`, WORLD.width / 2, 340);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('灯笼未灭，纸龙可再剪一尾。', WORLD.width / 2, 380);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('按 R 再来一次 · 按 T 回标题', WORLD.width / 2, 448);
  ctx.globalAlpha = 1;
}

function drawVictory(ctx, world, best) {
  ctx.fillStyle = 'rgba(7, 8, 26, 0.5)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dragonGold;
  ctx.font = 'bold 76px "Noto Serif SC", serif, system-ui, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(120, 20, 20, 0.9)';
  ctx.strokeText('灯火通明', WORLD.width / 2, 270);
  ctx.fillText('灯火通明', WORLD.width / 2, 270);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText(`九波已过，三凤皆斩。分数 ${world.score} · 最佳 ${Math.max(best, world.score)}`, WORLD.width / 2, 336);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('墨夜退去，万盏灯笼照亮归途。', WORLD.width / 2, 376);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('按 R 再玩一次 · 按 C 无尽模式', WORLD.width / 2, 444);
  ctx.globalAlpha = 1;
}

function drawPause(ctx, world) {
  ctx.fillStyle = 'rgba(7, 8, 26, 0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('暂停', WORLD.width / 2, 380);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('按 P 继续', WORLD.width / 2, 428);
}

export function draw(ctx, world, screen, best) {
  ctx.save();
  // Screen shake: trauma squared, so small hits tremble and big hits jolt.
  const trauma = world.trauma || 0;
  if (trauma > 0.001) {
    const mag = trauma * trauma * 16;
    const ox = (Math.sin(world.time * 91.7) + Math.sin(world.time * 47.3)) * 0.5 * mag;
    const oy = (Math.cos(world.time * 83.1) + Math.sin(world.time * 59.7)) * 0.5 * mag;
    ctx.translate(ox, oy);
  }
  drawSky(ctx, world);
  for (const pk of world.pickups) drawPickup(ctx, world, pk);
  for (const e of world.enemies) drawEnemy(ctx, world, e);
  if (world.boss && !world.boss.dead) drawBoss(ctx, world, world.boss);
  for (const b of world.bolts) drawBolt(ctx, b);
  for (const b of world.enemyBolts) drawEnemyBolt(ctx, b);
  const p = world.player;
  if (p.alive) {
    for (const a of p.afterimages) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, a.life / 0.22) * 0.35;
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = '#4cc9f0';
      paperDisc(ctx, 0, 0, 16, 8, 2, 0.4);
      ctx.fill();
      ctx.restore();
    }
    const blink = p.invuln > 0 && Math.floor(world.time * 14) % 2 === 0;
    if (!blink) drawDragon(ctx, world, p);
  }
  drawParticles(ctx, world);
  drawRings(ctx, world);
  drawTexts(ctx, world);
  ctx.restore();

  // HUD stays steady while the world shakes.
  if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE) drawHud(ctx, world, best);

  // Banners.
  if (world.waveBanner > 0 && screen === SCREEN_PLAY) {
    const a = Math.min(1, world.waveBanner);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10, 6, 30, 0.85)';
    ctx.strokeText(`第 ${world.wave} 波`, WORLD.width / 2, 330);
    ctx.fillText(`第 ${world.wave} 波`, WORLD.width / 2, 330);
    ctx.globalAlpha = 1;
  }
  if (world.bossWarn > 0) {
    const a = Math.min(1, world.bossWarn);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c77dff';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10, 6, 30, 0.85)';
    ctx.strokeText('墨凤来袭！', WORLD.width / 2, 240);
    ctx.fillText('墨凤来袭！', WORLD.width / 2, 240);
    ctx.globalAlpha = 1;
  }

  // Hurt vignette.
  if (world.hurtFlash > 0) {
    const g = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.35, WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.75);
    g.addColorStop(0, 'rgba(255, 40, 60, 0)');
    g.addColorStop(1, `rgba(255, 40, 60, ${world.hurtFlash * 0.55})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  if (screen === SCREEN_TITLE) drawTitle(ctx, world, best);
  else if (screen === SCREEN_UPGRADE) drawUpgrade(ctx, world);
  else if (screen === SCREEN_OVER) drawOver(ctx, world, best);
  else if (screen === SCREEN_VICTORY) drawVictory(ctx, world, best);
  else if (screen === SCREEN_PAUSE) drawPause(ctx, world);
}
