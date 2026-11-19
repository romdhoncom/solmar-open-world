// Keyboard and pointer input for Solmar. Held keys are read every
// frame; one-shot presses (enter a car, pause, confirm) are queued as
// flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. The mouse position is kept in view
// coordinates and the loop turns it into a world aim point.

export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_MUTE = 8;
export const ACTION_RELOAD = 16;
export const ACTION_PUNCH = 32;
export const ACTION_HORN = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let clicked = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(codeOf(event));
    if (codeOf(event) === 'KeyE') actions |= ACTION_ENTER;
    else if (codeOf(event) === 'KeyP' || codeOf(event) === 'Escape') actions |= ACTION_PAUSE;
    else if (codeOf(event) === 'Enter') actions |= ACTION_CONFIRM;
    else if (codeOf(event) === 'KeyM') actions |= ACTION_MUTE;
    else if (codeOf(event) === 'KeyR') actions |= ACTION_RELOAD;
    else if (codeOf(event) === 'KeyF') actions |= ACTION_PUNCH;
    else if (codeOf(event) === 'KeyH') actions |= ACTION_HORN;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(codeOf(event))) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      clicked = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function hasAny(set) {
    for (const code of set) {
      if (keys.has(code)) return true;
    }
    return false;
  }

  return {
    /** -1, 0 or 1 along each axis, from the held movement keys. */
    move() {
      return {
        x: (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0),
        y: (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0),
      };
    },
    running() {
      return hasAny(RUN);
    },
    braking() {
      return hasAny(BRAKE);
    },
    /** The mouse position in canvas CSS pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown;
    },
    /** True once after a mouse press, then cleared. */
    takeClick() {
      const was = clicked;
      clicked = false;
      return was;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
