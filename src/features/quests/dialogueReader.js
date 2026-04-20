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

const MIN_BOX_WIDTH = 100;
const MAX_BOX_WIDTH = 500;
const HEADER_HEIGHT = 22;
const BODY_CENTER_OFFSET = HEADER_HEIGHT + 10; // body center is ~32 px below header top
const OPTION_OFFSET_TOP = 32;
const OPTION_LINE_HEIGHT = 16;
const OPTION_X_OFFSET = 25;

// Luminance thresholds (0-255)
const HEADER_MAX_LUM = 80;
const BODY_MIN_LUM = 120; // lowered from 130 to catch slightly darker parchment

// Overlay colours (ARGB)
const COLOR_HIGHLIGHT = 0xffe8a020;
const COLOR_ARROW = 0xffffcc00;
const OVERLAY_DURATION_MS = 900;

// ─── Internal state ──────────────────────────────────────────────────────────

let _intervalId = null;
let _dialogueOptions = null;
let _requiredOptions = [];
let _debugLogged = false;

// ─── Alt1 guard ──────────────────────────────────────────────────────────────

export function isAlt1Available() {
  return typeof window !== 'undefined' && typeof window.alt1 !== 'undefined';
}

// ─── Pixel helpers ───────────────────────────────────────────────────────────

function readPixel(buf, width, x, y) {
  const i = (y * width + x) * 4;
  return { b: buf[i], g: buf[i + 1], r: buf[i + 2], a: buf[i + 3] };
}

function lum(px) {
  return 0.299 * px.r + 0.587 * px.g + 0.114 * px.b;
}

// ─── Diagnostic ──────────────────────────────────────────────────────────────

/**
 * One-shot scan. Logs:
 *   • buffer byte length (sanity check)
 *   • raw pixel BGRA + luminance at the centre-x for several screen-y values
 *     so we can see exactly what getRegion captured and where the bright/dark
 *     bands really are
 */
function logDiagnostic(buf, scanW, scanH) {
  const expected = scanW * scanH * 4;
  console.log(
    `[dialogueReader] buf byteLen=${buf.byteLength} expected=${expected} match=${buf.byteLength === expected}`
  );
  console.log(`[dialogueReader] scanning from y=0 to y=${scanH}, w=${scanW}`);

  // Sample pixels at the centre x across y positions where dialogue boxes appear
  const cx = Math.floor(scanW / 2);
  const probeYs = [350, 400, 450, 500, 530, 560, 600, 650, 700, 750];

  probeYs.forEach((y) => {
    if (y >= scanH) return;
    const px = readPixel(buf, scanW, cx, y);
    const l = Math.round(lum(px));

    // Count a run of dark pixels starting from centre
    let darkLen = 0;
    for (let x = cx; x < scanW; x++) {
      if (lum(readPixel(buf, scanW, x, y)) <= HEADER_MAX_LUM) darkLen++;
      else break;
    }

    // Count a run of bright pixels starting from centre
    let brightLen = 0;
    for (let x = cx; x < scanW; x++) {
      if (lum(readPixel(buf, scanW, x, y)) >= BODY_MIN_LUM) brightLen++;
      else break;
    }

    console.log(
      `[dialogueReader]  y=${y}: rgb(${px.r},${px.g},${px.b}) lum=${l}` +
        ` | dark_run_from_cx=${darkLen} bright_run_from_cx=${brightLen}`
    );
  });
}

// ─── Dialogue box detection ──────────────────────────────────────────────────

function findDialogueBox(buf, width, height) {
  const STEP = 3;
  const yStart = BODY_CENTER_OFFSET + 10;

  for (let y = yStart; y < height - 20; y += STEP) {
    for (let x = 10; x < width - MIN_BOX_WIDTH; x += STEP) {
      if (lum(readPixel(buf, width, x, y)) < BODY_MIN_LUM) continue;

      // Measure bright run
      let runLen = 0;
      for (let dx = 1; x + dx < width; dx++) {
        if (lum(readPixel(buf, width, x + dx, y)) >= BODY_MIN_LUM) {
          runLen++;
        } else {
          break;
        }
      }
      if (runLen < MIN_BOX_WIDTH || runLen > MAX_BOX_WIDTH) continue;

      // Verify dark header above
      const headerY = y - BODY_CENTER_OFFSET;
      if (headerY < 0) continue;

      const h1 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.25), headerY));
      const h2 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.5), headerY));
      const h3 = lum(readPixel(buf, width, x + Math.floor(runLen * 0.75), headerY));
      if (h1 > HEADER_MAX_LUM || h2 > HEADER_MAX_LUM || h3 > HEADER_MAX_LUM) continue;

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

// ─── Overlay drawing ─────────────────────────────────────────────────────────

function clearOverlay() {
  if (!isAlt1Available()) return;
  try {
    alt1.overLaySetGroup(OVERLAY_GROUP);
    alt1.overLayClearGroup(OVERLAY_GROUP);
    alt1.overLayRefreshGroup(OVERLAY_GROUP);
  } catch (_) {}
}

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

  // Scan from y=0 (top of RS3 window).
  // Alt1 limits getRegion to 2 500 000 pixels; at 2560 wide that is 937 rows —
  // enough to cover y=0-936 which includes any dialogue box.
  const MAX_PIXELS = 2_400_000;
  const scanW = alt1.rsWidth || 1920;
  const rsH = alt1.rsHeight || 1080;
  const scanH = Math.min(rsH, Math.floor(MAX_PIXELS / scanW));

  let rawBuf;
  try {
    rawBuf = alt1.getRegion(0, 0, scanW, scanH);
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

  if (!_debugLogged) {
    _debugLogged = true;
    logDiagnostic(buf, scanW, scanH);
  }

  const box = findDialogueBox(buf, scanW, scanH);

  if (!box) {
    clearOverlay();
    return;
  }

  // scanY = 0, so box coordinates are already absolute RS3 window coordinates
  console.log('[dialogueReader] box found:', box, '— option', optionNumber);
  drawHighlight(box, optionNumber);
}

// ─── Public API ───────────────────────────────────────────────────────────────

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

export function stopDialoguePolling() {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  _dialogueOptions = null;
  _requiredOptions = [];
  clearOverlay();
}
