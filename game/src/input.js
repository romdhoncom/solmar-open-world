// Keyboard and mouse state. Pointer lock gives mouse-look; without it the
// mouse still orbits while dragging.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.dragging = false;
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) { /* headless */ }
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas || this.dragging) {
        this.lookDX += e.movementX || 0;
        this.lookDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      this.dragging = false;
      if (e.button === 0) this.mouseDown = false;
    });
  }
  down(code) { return this.keys.has(code); }
  // Consume the accumulated mouse-look delta for this frame.
  consumeLook() {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return r;
  }
  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }
  // For scripted playtests: press and release keys from code.
  press(code) { this.keys.add(code); }
  release(code) { this.keys.delete(code); }
  click() { this.mouseClicked = true; this.mouseDown = true; setTimeout(() => { this.mouseDown = false; }, 60); }
}
