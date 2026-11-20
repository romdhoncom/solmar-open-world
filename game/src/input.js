// Solmar 3D — keyboard and mouse state.
// Written fresh in this session for the v5 rebuild (prose spec only).
// Tracks which keys are down, mouse movement deltas for the camera,
// and click events. Pointer lock is requested on the canvas when the
// game starts; the menu buttons work without it.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last frame (edge-triggered)
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let clicked = false;
  let locked = false;

  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onMouseMove = (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  };
  const onMouseDown = (e) => {
    if (e.button === 0) { mouseDown = true; clicked = true; }
  };
  const onMouseUp = (e) => {
    if (e.button === 0) mouseDown = false;
  };
  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('click', () => {
    if (!locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (err) { /* pointer lock unavailable */ }
    }
  });

  return {
    get locked() { return locked; },
    down(code) { return keys.has(code); },
    wasPressed(code) { return pressed.has(code); },
    get mouseDown() { return mouseDown; },
    get clicked() { return clicked; },
    consumeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    endFrame() {
      pressed.clear();
      clicked = false;
    },
  };
}
