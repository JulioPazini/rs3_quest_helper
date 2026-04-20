/**
 * dialogueReader.js
 *
 * Alt1 Toolkit service that polls the RS3 screen while a step with NPC dialogue
 * is active, detects when the "SELECT AN OPTION" box is open, and draws a gold
 * outline overlay on the correct option row.
 *
 * Calibrated for: Resizable client, Interface Scaling 100%.
 * The entire module is a no-op when running outside Alt1.
 */

const OVERLAY_GROUP = 'dialogue-helper';

// ─── RS3 "SELECT AN OPTION" dialogue box pixel constants ────────────────────
//
// Measurements taken from screenshot (Resizable, 100% scaling):
//   Box width  ≈ 300px
//   Header     ≈ 22px tall  — very dark brown  RGB(48, 34, 17)
//   Body       ≈ 58px       — warm parchment   RGB(200, 178, 138)
//   Option 1 top edge: 32px below box top
//   Option line height: 16px

const HEADER_BG = { r: 48, g: 34, b: 17 };
const HEADER_TOLERANCE = 30;

const BODY_BG = { r: 200, g: 178, b: 138 };
const BODY_TOLERANCE = 35;

const MIN_DIALOGUE_WIDTH = 180; // minimum run length to accept as a dialogue header
const HEADER_HEIGHT = 22; // px — dark header strip height
const OPTION_OFFSET_TOP = 32; // px — from box top to first option's TOP edge
const OPTION_LINE_HEIGHT = 16; // px — height of each option row
const OPTION_X_OFFSET = 25; // px — from box left to option text start

// Overlay colours (ARGB)
const COLOR_HIGHLIGHT = 0xffe8a020; // orange-gold outline — visible on parchment
const COLOR_ARROW = 0xffffcc00; // bright yellow for the ◄ text

// Duration to keep the overlay alive per frame (must exceed poll interval)
const OVERLAY_DURATION_MS = 900;

// ─── Internal state ──────────────────────────────────────────────────────────

let _intervalId = null;
let _dialogueOptions = null; // [{option, text}]
let _requiredOptions = []; // ['1', '✓', '~', '2', ...]

// ─── Alt1 guard ──────────────────────────────────────────────────────────────

/** @returns {boolean} */
export function isAlt1Available() {
  return typeof window !== 'undefined' && typeof window.alt1 !== 'undefined';
}

// ─── Pixel helpers ───────────────────────────────────────────────────────────

/**
 * Read a pixel from a raw BGRA ArrayBuffer.
 * alt1.getRegion() returns pixels in BGRA order.
 */
function readBGRA(buf, width, x, y) {
  const i = (y * width + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
}

function colorMatch(px, target, tol) {
  return (
    Math.abs(px.r - target.r) <= tol &&
    Math.abs(px.g - target.g) <= tol &&
    Math.abs(px.b - target.b) <= tol
  );
}

// ─── Dialogue box detection ──────────────────────────────────────────────────

/**
 * Scan the pixel buffer for the RS3 "SELECT AN OPTION" dialogue box.
 *
 * Strategy:
 *   1. Walk the buffer in 3-pixel steps looking for the dark header colour.
 *   2. When a sufficiently long horizontal run is found, verify that ~22px
 *      below it there is the warm parchment body colour.
 *   3. Return the box bounding box in game-window coordinates.
 *
 * @param {Uint8ClampedArray} buf    BGRA pixel buffer from alt1.getRegion()
 * @param {number} width             Buffer width in pixels
 * @param {number} height            Buffer height in pixels
 * @returns {{ x:number, y:number, w:number, h:number } | null}
 */
function findDialogueBox(buf, width, height) {
  const STEP = 3;

  for (let y = 10; y < height - HEADER_HEIGHT - 30; y += STEP) {
    for (let x = 10; x < width - MIN_DIALOGUE_WIDTH; x += STEP) {
      const px = readBGRA(buf, width, x, y);
      if (!colorMatch(px, HEADER_BG, HEADER_TOLERANCE)) continue;

      // Measure the run length of the dark header colour
      let runLen = 0;
      for (let dx = 1; x + dx < width; dx++) {
        if (colorMatch(readBGRA(buf, width, x + dx, y), HEADER_BG, HEADER_TOLERANCE)) {
          runLen++;
        } else {
          break;
        }
      }
      if (runLen < MIN_DIALOGUE_WIDTH) continue;

      // Verify parchment body exists below the header strip
      const midX = x + Math.floor(runLen / 2);
      const bodyCheckY = y + HEADER_HEIGHT + 4;
      if (bodyCheckY >= height) continue;

      const bodyPx = readBGRA(buf, width, midX, bodyCheckY);
      if (!colorMatch(bodyPx, BODY_BG, BODY_TOLERANCE)) continue;

      // Estimate box height based on number of options
      const optionCount = _dialogueOptions ? _dialogueOptions.length : 3;
      const estimatedH = HEADER_HEIGHT + OPTION_OFFSET_TOP + optionCount * OPTION_LINE_HEIGHT + 14;

      return {
        x,
        y,
        w: runLen + 1,
        h: Math.min(estimatedH, height - y),
      };
    }
  }
  return null;
}

// ─── Overlay drawing ─────────────────────────────────────────────────────────

function clearOverlay() {
  if (!isAlt1Available()) return;
  try {
    alt1.overLaySetGroup(OVERLAY_GROUP);
    alt1.overLayClearGroup(OVERLAY_GROUP);
    alt1.overLayRefreshGroup(OVERLAY_GROUP);
  } catch (_) {
    // Permission not granted — fail silently
  }
}

/**
 * Draw the highlight around `optionNumber` (1-based) in the detected box.
 * @param {{ x:number, y:number, w:number, h:number }} box
 * @param {number} optionNumber
 */
function drawHighlight(box, optionNumber) {
  if (!isAlt1Available()) return;
  try {
    const optTop = box.y + OPTION_OFFSET_TOP + (optionNumber - 1) * OPTION_LINE_HEIGHT;
    const optX = box.x + OPTION_X_OFFSET;
    const rectW = box.w - OPTION_X_OFFSET - 10;

    alt1.overLaySetGroup(OVERLAY_GROUP);
    alt1.overLayClearGroup(OVERLAY_GROUP);

    // Thick gold outline around the correct option row
    alt1.overLayRect(COLOR_HIGHLIGHT, optX - 2, optTop - 1, rectW, OPTION_LINE_HEIGHT + 2, OVERLAY_DURATION_MS, 2);

    // Arrow ◄ to the left of the option
    alt1.overLayText('◄', COLOR_ARROW, 11, optX - 18, optTop + 1, OVERLAY_DURATION_MS);

    alt1.overLayRefreshGroup(OVERLAY_GROUP);
  } catch (_) {
    // Overlay permission not granted — fail silently
  }
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

function poll() {
  if (!isAlt1Available()) return;
  if (!_dialogueOptions?.length || !_requiredOptions?.length) return;

  // Determine the first numeric option to highlight (skip 'any' markers like ✓/~)
  const target = _requiredOptions.find((r) => /^\d+$/.test(r));
  if (!target) {
    clearOverlay();
    return;
  }
  const optionNumber = parseInt(target, 10);
  if (isNaN(optionNumber) || optionNumber < 1) {
    clearOverlay();
    return;
  }

  // Capture the game screen
  const scanW = alt1.rsWidth || 1920;
  const scanH = alt1.rsHeight || 1080;

  let rawBuf;
  try {
    rawBuf = alt1.getRegion(0, 0, scanW, scanH);
  } catch (_) {
    // Pixel permission not granted — stop polling
    stopDialoguePolling();
    return;
  }

  if (!rawBuf) {
    clearOverlay();
    return;
  }

  const buf = new Uint8ClampedArray(rawBuf);
  const box = findDialogueBox(buf, scanW, scanH);

  if (!box) {
    clearOverlay();
    return;
  }

  drawHighlight(box, optionNumber);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start polling RS3 for the "SELECT AN OPTION" box.
 * Highlights the correct option according to the step's required options.
 *
 * @param {Array<{option:string, text:string}>} dialogueOptions  All options from wiki table
 * @param {string[]} requiredOptions  Options to pick e.g. ['1', '✓', '~', '2']
 */
export function startDialoguePolling(dialogueOptions, requiredOptions) {
  if (!isAlt1Available()) return;

  stopDialoguePolling();

  _dialogueOptions = dialogueOptions;
  _requiredOptions = requiredOptions;

  poll(); // immediate first check
  _intervalId = setInterval(poll, 600);
}

/**
 * Stop polling and clear the overlay.
 * Safe to call even if polling was never started.
 */
export function stopDialoguePolling() {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  _dialogueOptions = null;
  _requiredOptions = [];
  clearOverlay();
}
