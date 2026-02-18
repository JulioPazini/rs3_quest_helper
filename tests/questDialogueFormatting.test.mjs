import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  extractQuickGuide,
  formatStepHtml,
  formatStepText,
} from '../src/features/quests/questParser.js';

const setDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
};

test('formatStepText/formatStepHtml place chat icon inside chat-option parentheses', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const samples = [
    ['Talk ( 1)', 'Talk (🗨️ 1)'],
    ['Talk ( 2•1)', 'Talk (🗨️ 2•1)'],
    ['Talk ( 2•2•1)', 'Talk (🗨️ 2•2•1)'],
    ['Talk ( 1•✓•~)', 'Talk (🗨️ 1•✓•~)'],
    ['Talk ( 2•~•1)', 'Talk (🗨️ 2•~•1)'],
    ['Talk ( 2•2•~•1•~)', 'Talk (🗨️ 2•2•~•1•~)'],
    ['Talk ( ✓•~)', 'Talk (🗨️ ✓•~)'],
    ['Talk ( ~)', 'Talk (🗨️ ~)'],
    ['Talk ( ~•~•~)', 'Talk (🗨️ ~•~•~)'],
  ];

  samples.forEach(([input, expected]) => {
    assert.equal(formatStepText(input), expected);
    assert.equal(formatStepHtml(input, input), expected);
  });
});

test('extractQuickGuide formats chat markers in step, substep and sub-substep', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Dialogue Section</h2>
        <div class="lighttable checklist">
          <ul>
            <li>
              Step ( 2•1)
              <ul>
                <li>
                  Substep ( ~)
                  <ul>
                    <li>Deep ( ✓•~)</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const step = items.find((item) => item.type === 'step');

  assert.ok(step, 'expected step item');
  assert.match(step.text, /\(🗨️ 2•1\)/);
  assert.ok(Array.isArray(step.substeps) && step.substeps.length === 1);
  assert.match(step.substeps[0].text, /\(🗨️ ~\)/);
  assert.ok(Array.isArray(step.substeps[0].substeps) && step.substeps[0].substeps.length === 1);
  assert.match(step.substeps[0].substeps[0].text, /\(🗨️ ✓•~\)/);
});

test('formatStepHtml injects icon for chat-options split across nested spans', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html =
    'Use item <span class="chat-options">(<i title="Chat options"></i> <span class="chat-options-underline">2</span>•<span class="chat-options-underline">1</span>)</span>';
  const text = 'Use item ( 2•1)';
  const out = formatStepHtml(html, text);

  assert.match(out, /\(🗨️ 2•1\)/);
});
