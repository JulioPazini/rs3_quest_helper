import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { translateStepHtmlToPtBr } from '../src/features/quests/questTranslate.js';

const setDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
};

const getQueryParam = (url, name) => {
  const query = String(url || '').split('?')[1] || '';
  const params = new URLSearchParams(query);
  return params.get(name) || '';
};

test('translateStepHtmlToPtBr translates full sentence with link placeholders and restores links', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    const q = getQueryParam(url, 'q');
    const translated =
      q === 'Enter the __AQH_LINK_0__ and speak to __AQH_LINK_1__ inside.'
        ? 'Entre no __AQH_LINK_0__ e fale com __AQH_LINK_1__ dentro.'
        : q;
    return {
      ok: true,
      json: async () => [[[translated]]],
    };
  };

  const html =
    'Enter the <a href="/w/Shifting_Tombs">Shifting Tombs</a> and speak to <a href="/w/Ozan">Ozan</a> inside.';
  const out = await translateStepHtmlToPtBr({ html, targetLang: 'pt-BR' });

  assert.equal(calls.length, 1);
  assert.match(out, /Entre no/);
  assert.match(out, /e fale com/);
  assert.match(out, /<a href="\/w\/Shifting_Tombs">Shifting Tombs<\/a>/);
  assert.match(out, /<a href="\/w\/Ozan">Ozan<\/a>/);
});

test('translateStepHtmlToPtBr keeps per-node fallback for html without links', async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const map = new Map([
    ['Enter', 'Entrar'],
    ['now', 'agora'],
  ]);
  global.fetch = async (url) => {
    const q = getQueryParam(url, 'q');
    const translated = map.get(q) || q;
    return {
      ok: true,
      json: async () => [[[translated]]],
    };
  };

  const html = '<strong>Enter</strong> now';
  const out = await translateStepHtmlToPtBr({ html, targetLang: 'pt-BR' });

  assert.equal(out, '<strong>Entrar</strong> agora');
});
