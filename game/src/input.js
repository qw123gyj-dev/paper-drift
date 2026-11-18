// Keyboard and mouse state for PAPER DRIFT. One job: turn raw DOM events
// into one plain input snapshot the world reads each step — no game logic
// here. The dragon steers toward the mouse when it moves, and WASD/arrows
// always work; both feed the same velocity-based movement.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseMoved = false;
    this.pressed = new Set();
    this.canvas = canvas;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.keys.add(event.key.toLowerCase());
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
      this.mouseMoved = true;
    });
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.mouseDown = true;
      this.pressed.add('click');
    });
    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True while a key is held. */
  held(...keys) {
    return keys.some((key) => this.keys.has(key));
  }

  /** Snapshot the pressed set for this step, then clear it. */
  takePressed() {
    const pressed = this.pressed;
    this.pressed = new Set();
    return pressed;
  }

  /** Movement vector from WASD or arrows, normalised. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held('a', 'arrowleft')) x -= 1;
    if (this.held('d', 'arrowright')) x += 1;
    if (this.held('w', 'arrowup')) y -= 1;
    if (this.held('s', 'arrowdown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
