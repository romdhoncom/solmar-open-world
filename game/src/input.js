// Keyboard and mouse state. The game reads `down(code)` for held keys
// and `pressed(code)` for the single frame a key went down; the main
// loop calls `endFrame()` after each update so a press is seen once.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressedKeys: new Set(),
    mouse: { x: 0, y: 0, down: false },
    down(code) {
      return this.keys.has(code);
    },
    pressed(code) {
      return this.pressedKeys.has(code);
    },
    endFrame() {
      this.pressedKeys.clear();
    },
  };
  window.addEventListener('keydown', (e) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressedKeys.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  canvas.addEventListener('mousemove', (e) => {
    input.mouse.x = e.clientX;
    input.mouse.y = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
