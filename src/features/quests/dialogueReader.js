/**
 * dialogueReader.js
 *
 * Alt1 Toolkit service that polls the RS3 screen while a step with NPC dialogue
 * is active, detects when the "SELECT AN OPTION" / "CHOOSE AN OPTION" box is
 * open, and draws a gold outline overlay on the correct option row.
 *
 * Detection strategy: luminance-based (dark header strip → bright parchment body).
 * This avoids hard-coding exact RGB values that vary by monitor/GPU/settings.
 *
 * The entire module is a no-op when running outside Alt1.
 */

console.log('[dialogueReader] module loaded ✓');

const OVERLAY_GROUP = 'dialogue-helper';

// ─── Layout constants ─────────────────────────────────────────────────────────
//
// Resizable client, Interface Scaling 100%.
//   Header   ≈ 22 px dark strip
//   Body     ≈ bright parchment below header
//   Options start 32 px below box top, each row 16 px tall

const MIN_DIALOGUE_WIDTH = 100; // minimum header run length (px)
const MAX_DIALOGUE_WIDTH = 600; // cap — wider runs are not dialogue boxes
const HEADER_HEIGHT = 22; // px — dark header strip height
const OPTION_OFFSET_TOP = 32; // px — from box top to first option's TOP edge
const OPTION_LINE_HEIGHT = 16; // px — height of each option row
const OPTION_X_OFFSET = 25; // px — from box left to option text start

// Luminance thresholds (0-255).
// Header must be dark; body must be notably brighter.
const HEADER_MAX_LUM = 80; // pixels darker than this qualify as "header"
const BODY_MIN_LUM = 120; // pixels brighter than this qualify as "body"

// Overlay colours (ARGB)
const COLOR_HIGHLIGHT = 0xffe8a020; // orange-gold outline — visible on parchment
const COLOR_ARROW = 0xffffcc00; // bright yellow for the ◄ text

// Duration to keep the overlay alive per frame (must exceed poll interval)
const OVERLAY_DURATION_MS = 900;

// ─── Internal state ──────────────────────────────────────────────────────────

let _intervalId = null;
let _dialogueOptions = null; // [{option, text}]
let _requiredOptions = []; // ['1', '✓', '~', '2', ...]
let _debugLogged = false; // one-shot pixel dump flag

// ─── Alt1 guard ──────────────────────────────────────────────────────────────

/** @returns {boolean} */
export function isAlt1Available() {
  return typeof window !== 'undefined' && typeof window.alt1 !== 'undefined';
}

// ─── Pixel helpers ───────────────────────────────────────────────────────────

/**
 * Read a pixel from a raw BGRA ArrayBuffer.
 * alt1.getRegion() returns pixels in BGRA order on Windows.
 */
function readPixel(buf, width, x, y) {
  const i = (y * width + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
}

/**
 * Perceptual luminance (0-255). Works correctly even if BGRA/RGBA byte order
 * is ambiguous for near-neutral colours (header is very dark, body is warm
 * but not saturated, so luminance is reliable either way).
 */
function lum(px) {
  return 0.299 * px.r + 0.587 * px.g + 0.114 * px.b;
}

// ─── Dialogue box detection ──────────────────────────────────────────────────

/**
 * Scan the pixel buffer for the RS3 "SELECT / CHOOSE AN OPTION" dialogue box.
 *
 * Strategy:
 *   1. Walk the buffer in 3-pixel steps looking for a dark-luminance pixel.
 *   2. When found, measure the horizontal run of dark pixels.
 *   3. If the run is [MIN_DIALOGUE_WIDTH, MAX_DIALOGUE_WIDTH] pixels wide,
 *      sample 3 points below the header to verify bright parchment body.
 *   4. Return the box bounding box in buffer-local coordinates.
 *
 * @param {Uint8ClampedArray} buf
 * @param {number} width
 * @param {number} height
 * @returns {{ x:number, y:number, w:number, h:number } | null}
 */
function findDialogueBox(buf, width, height) {
  const STEP = 3;

  for (let y = 10; y < height - HEADER_HEIGHT - 30; y += STEP) {
    for (let x = 10; x < width - MIN_DIALOGUE_WIDTH; x += STEP) {
      if (lum(readPixel(buf, width, x, y)) > HEADER_MAX_LUM) continue;

      // Measure horizontal run of dark pixels
      let runLen = 0;
      for (let dx = 1; x + dx < width; dx++) {
        if (lum(readPixel(buf, width, x + dx, y)) <= HEADER_MAX_LUM) {
          runLen++;
        } else {
          break;
        }
      }
      if (runLen < MIN_DIALOGUE_WIDTH || runLen > MAX_DIALOGUE_WIDTH) continue;

      // Verify bright parchment body at 3 points below the header strip
      const bodyCheckY = y + HEADER_HEIGHT + 4;
      if (bodyCheckY >= height) continue;

      const q1 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.25), bodyCheckY));
      const q2 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.5), bodyCheckY));
      const q3 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.75), bodyCheckY));
      if (q1 < BODY_MIN_LUM || q2 < BODY_MIN_LUM || q3 < BODY_MIN_LUM) continue;

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
 * @param {{ x:number, y:number, w:number, h:number }} box   absolute screen coords
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
    alt1.overLayRect(
      COLOR_HIGHLIGHT,
      optX - 2,
      optTop - 1,
      rectW,
      OPTION_LINE_HEIGHT + 2,
      OVERLAY_DURATION_MS,
      2
    );

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

  // Capture the game screen.
  // Alt1 caps getRegion at 2 500 000 pixels total.
  // RS3 dialogue boxes appear in the lower portion of the screen, so when the
  // full resolution exceeds the cap we scan from the bottom and offset results.
  const MAX_PIXELS = 2_400_000; // leave a small safety margin
  const scanW = alt1.rsWidth || 1920;
  const rsH = alt1.rsHeight || 1080;
  const maxScanH = Math.floor(MAX_PIXELS / scanW);
  const scanH = Math.min(rsH, maxScanH);
  const scanY = Math.max(0, rsH - scanH); // start from bottom if cropped

  let rawBuf;
  try {
    rawBuf = alt1.getRegion(0, scanY, scanW, scanH);
  } catch (e) {
    console.warn('[dialogueReader] getRegion failed:', e);
    return;
  }

  if (!rawBuf) {
    console.warn('[dialogueReader] getRegion returned null — pixel permission may be off');
    clearOverlay();
    return;
  }

  const buf = new Uint8ClampedArray(rawBuf);

  // One-time diagnostic: log pixel samples from the top, middle, and bottom
  // of the scanned area to confirm the buffer is capturing the right region.
  if (!_debugLogged) {
    _debugLogged = true;
    const rows = [
      Math.floor(scanH * 0.1),
      Math.floor(scanH * 0.3),
      Math.floor(scanH * 0.5),
      Math.floor(scanH * 0.7),
    ];
    const xMid = Math.floor(scanW / 2);
    const samples = rows.map((ry) => {
      const px = readPixel(buf, scanW, xMid, ry);
      return {
        screenY: ry + scanY,
        localY: ry,
        r: px.r,
        g: px.g,
        b: px.b,
        lum: Math.round(lum(px)),
      };
    });
    console.log('[dialogueReader] pixel samples (x=mid, screen coords):', samples);
    console.log('[dialogueReader] scan region: y=', scanY, '..', scanY + scanH, 'w=', scanW);
  }

  const localBox = findDialogueBox(buf, scanW, scanH);

  if (!localBox) {
    clearOverlay();
    return;
  }

  // Translate local box coordinates back to absolute RS3 window coordinates
  const box = { ...localBox, y: localBox.y + scanY };

  console.log('[dialogueReader] box found:', box, '— highlighting option', optionNumber);
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
  _debugLogged = false; // reset so next polling session logs one sample

  console.log('[dialogueReader] polling started — required:', requiredOptions);
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
