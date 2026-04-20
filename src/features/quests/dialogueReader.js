/**
 * dialogueReader.js
 *
 * Alt1 Toolkit service that polls the RS3 screen while a step with NPC dialogue
 * is active, detects when the "SELECT AN OPTION" / "CHOOSE AN OPTION" box is
 * open, and draws a gold outline overlay on the correct option row.
 *
 * Detection strategy: scan for the BRIGHT PARCHMENT BODY first (more distinctive
 * than dark header in the RS3 game world), then verify the dark header strip above.
 *
 * The entire module is a no-op when running outside Alt1.
 */

console.log('[dialogueReader] module loaded ✓');

const OVERLAY_GROUP = 'dialogue-helper';

// ─── Layout constants ─────────────────────────────────────────────────────────
//
// Resizable client, Interface Scaling 100%.
//   Header   ≈ 22 px dark strip at the top
//   Body     ≈ bright parchment, starts ~26 px below box top
//   Options start 32 px below box top, each row 16 px tall

const MIN_BOX_WIDTH = 100; // minimum valid dialogue box width (px)
const MAX_BOX_WIDTH = 500; // maximum valid dialogue box width (px)
const HEADER_HEIGHT = 22; // px — dark header strip height
// Centre of the body section relative to the header top:
const BODY_CENTER_OFFSET = HEADER_HEIGHT + 10; // ≈ 32 px below header top
const OPTION_OFFSET_TOP = 32; // px — from box top to first option's TOP edge
const OPTION_LINE_HEIGHT = 16; // px — height of each option row
const OPTION_X_OFFSET = 25; // px — from box left to option text start

// Luminance thresholds (0-255, perceptual).
const HEADER_MAX_LUM = 80; // dialogue header must be DARKER than this
const BODY_MIN_LUM = 130; // dialogue body (parchment) must be BRIGHTER than this

// Overlay colours (ARGB)
const COLOR_HIGHLIGHT = 0xffe8a020; // orange-gold outline — visible on parchment
const COLOR_ARROW = 0xffffcc00; // bright yellow for the ◄ text

// Duration to keep the overlay alive per frame (must exceed poll interval)
const OVERLAY_DURATION_MS = 900;

// ─── Internal state ──────────────────────────────────────────────────────────

let _intervalId = null;
let _dialogueOptions = null; // [{option, text}]
let _requiredOptions = []; // ['1', '✓', '~', '2', ...]
let _debugLogged = false; // one-shot diagnostic flag

// ─── Alt1 guard ──────────────────────────────────────────────────────────────

/** @returns {boolean} */
export function isAlt1Available() {
  return typeof window !== 'undefined' && typeof window.alt1 !== 'undefined';
}

// ─── Pixel helpers ───────────────────────────────────────────────────────────

function readPixel(buf, width, x, y) {
  const i = (y * width + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
}

/** Perceptual luminance (0-255). Reliable even with BGRA/RGBA ambiguity for neutral hues. */
function lum(px) {
  return 0.299 * px.r + 0.587 * px.g + 0.114 * px.b;
}

// ─── Dialogue box detection ──────────────────────────────────────────────────

/**
 * Scan for the RS3 "SELECT / CHOOSE AN OPTION" dialogue box.
 *
 * Strategy (body-first):
 *   1. Walk the buffer looking for a bright-parchment horizontal run
 *      in the range [MIN_BOX_WIDTH, MAX_BOX_WIDTH] pixels.
 *   2. Verify that a dark header strip exists ABOVE the bright run.
 *   3. Return bounding box in buffer-local coordinates.
 *
 * Scanning body first avoids the problem of dark game-world pixels
 * adjacent to (and merging with) the dialogue box header.
 *
 * @param {Uint8ClampedArray} buf
 * @param {number} width
 * @param {number} height
 * @returns {{ x:number, y:number, w:number, h:number } | null}
 */
function findDialogueBox(buf, width, height) {
  const STEP = 3;

  // Scan starts below where the header would be
  const yStart = BODY_CENTER_OFFSET + 10;

  for (let y = yStart; y < height - 20; y += STEP) {
    for (let x = 10; x < width - MIN_BOX_WIDTH; x += STEP) {
      if (lum(readPixel(buf, width, x, y)) < BODY_MIN_LUM) continue;

      // Measure the horizontal run of bright (parchment) pixels
      let runLen = 0;
      for (let dx = 1; x + dx < width; dx++) {
        if (lum(readPixel(buf, width, x + dx, y)) >= BODY_MIN_LUM) {
          runLen++;
        } else {
          break;
        }
      }
      if (runLen < MIN_BOX_WIDTH || runLen > MAX_BOX_WIDTH) continue;

      // Verify dark header strip ABOVE the bright body area
      const headerY = y - BODY_CENTER_OFFSET;
      if (headerY < 0) continue;

      const h1 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.25), headerY));
      const h2 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.5), headerY));
      const h3 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.75), headerY));
      if (h1 > HEADER_MAX_LUM || h2 > HEADER_MAX_LUM || h3 > HEADER_MAX_LUM) continue;

      // Found! Box top aligns with the header start
      const boxTop = Math.max(0, headerY - 2);
      const optionCount = _dialogueOptions ? _dialogueOptions.length : 3;
      const estimatedH = HEADER_HEIGHT + OPTION_OFFSET_TOP + optionCount * OPTION_LINE_HEIGHT + 14;

      return {
        x,
        y: boxTop,
        w: runLen + 1,
        h: Math.min(estimatedH, height - boxTop),
      };
    }
  }
  return null;
}

// ─── Diagnostic ──────────────────────────────────────────────────────────────

/**
 * One-shot scan that logs bright and dark horizontal runs at two y slices
 * near the top of the scanned region, where the dialogue box header / body
 * would appear. Helps calibrate HEADER_MAX_LUM and BODY_MIN_LUM.
 */
function logDiagnostic(buf, scanW, scanH, scanY) {
  // Scan every 4 pixels along two horizontal lines
  const probeYs = [
    Math.floor(scanH * 0.08), // ~header zone
    Math.floor(scanH * 0.12), // ~body zone
    Math.floor(scanH * 0.18), // a bit lower
  ];

  probeYs.forEach((localY) => {
    const screenY = localY + scanY;
    const darkRuns = [];
    const brightRuns = [];
    let dStart = -1;
    let bStart = -1;

    for (let x = 0; x <= scanW; x += 4) {
      const l = x < scanW ? lum(readPixel(buf, scanW, x, localY)) : NaN;

      // Track dark runs (potential headers)
      if (!isNaN(l) && l <= HEADER_MAX_LUM) {
        if (dStart < 0) dStart = x;
      } else {
        if (dStart >= 0) {
          const len = x - dStart;
          if (len >= 40) darkRuns.push(`x${dStart}+${len}`);
          dStart = -1;
        }
      }

      // Track bright runs (potential bodies)
      if (!isNaN(l) && l >= BODY_MIN_LUM) {
        if (bStart < 0) bStart = x;
      } else {
        if (bStart >= 0) {
          const len = x - bStart;
          if (len >= 40) brightRuns.push(`x${bStart}+${len}`);
          bStart = -1;
        }
      }
    }

    console.log(
      `[dialogueReader] screenY=${screenY} | dark(lum≤${HEADER_MAX_LUM}):`,
      darkRuns.join(' ') || 'none',
      `| bright(lum≥${BODY_MIN_LUM}):`,
      brightRuns.join(' ') || 'none'
    );
  });
}

// ─── Overlay drawing ─────────────────────────────────────────────────────────

function clearOverlay() {
  if (!isAlt1Available()) return;
  try {
    alt1.overLaySetGroup(OVERLAY_GROUP);
    alt1.overLayClearGroup(OVERLAY_GROUP);
    alt1.overLayRefreshGroup(OVERLAY_GROUP);
  } catch (_) {}
}

/**
 * Draw the highlight around `optionNumber` (1-based) in the detected box.
 * @param {{ x:number, y:number, w:number, h:number }} box  absolute RS3 window coords
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

    alt1.overLayRect(
      COLOR_HIGHLIGHT,
      optX - 2,
      optTop - 1,
      rectW,
      OPTION_LINE_HEIGHT + 2,
      OVERLAY_DURATION_MS,
      2
    );
    alt1.overLayText('◄', COLOR_ARROW, 11, optX - 18, optTop + 1, OVERLAY_DURATION_MS);
    alt1.overLayRefreshGroup(OVERLAY_GROUP);
  } catch (_) {}
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

function poll() {
  if (!isAlt1Available()) return;
  if (!_dialogueOptions?.length || !_requiredOptions?.length) return;

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

  // Alt1 caps getRegion at 2 500 000 pixels.
  // Scan the bottom portion of the screen (dialogue boxes always appear there).
  const MAX_PIXELS = 2_400_000;
  const scanW = alt1.rsWidth || 1920;
  const rsH = alt1.rsHeight || 1080;
  const maxScanH = Math.floor(MAX_PIXELS / scanW);
  const scanH = Math.min(rsH, maxScanH);
  const scanY = Math.max(0, rsH - scanH);

  let rawBuf;
  try {
    rawBuf = alt1.getRegion(0, scanY, scanW, scanH);
  } catch (e) {
    console.warn('[dialogueReader] getRegion failed:', e);
    return;
  }
  if (!rawBuf) {
    console.warn('[dialogueReader] getRegion returned null');
    clearOverlay();
    return;
  }

  const buf = new Uint8ClampedArray(rawBuf);

  // One-shot diagnostic to help calibrate the detector
  if (!_debugLogged) {
    _debugLogged = true;
    console.log(
      `[dialogueReader] scan region: y=${scanY}..${scanY + scanH}, w=${scanW}, h=${scanH}`
    );
    logDiagnostic(buf, scanW, scanH, scanY);
  }

  const localBox = findDialogueBox(buf, scanW, scanH);

  if (!localBox) {
    clearOverlay();
    return;
  }

  // Translate local y back to absolute RS3 window coordinates
  const box = { ...localBox, y: localBox.y + scanY };
  console.log('[dialogueReader] box found:', box, '— option', optionNumber);
  drawHighlight(box, optionNumber);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start polling RS3 for the "SELECT AN OPTION" box.
 * @param {Array<{option:string, text:string}>} dialogueOptions
 * @param {string[]} requiredOptions  e.g. ['1', '✓', '~', '2']
 */
export function startDialoguePolling(dialogueOptions, requiredOptions) {
  if (!isAlt1Available()) return;

  stopDialoguePolling();

  _dialogueOptions = dialogueOptions;
  _requiredOptions = requiredOptions;
  _debugLogged = false;

  console.log('[dialogueReader] polling started — required:', requiredOptions);
  poll();
  _intervalId = setInterval(poll, 600);
}

/**
 * Stop polling and clear the overlay.
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
