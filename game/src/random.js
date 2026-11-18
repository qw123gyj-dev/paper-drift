// Seeded randomness for PAPER DRIFT. One job: every random choice in the
// game flows from one mulberry32 stream, so a fixed seed replays the same
// game — the screenshot scenes depend on it.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(random, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function pickOne(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
