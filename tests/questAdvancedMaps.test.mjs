import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractQuickGuide } from '../src/features/quests/questParser.js';
import { renderSteps } from '../src/features/quests/questRender.js';

const setDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
};

test('extractQuickGuide captures sectionAdvancedMaps for heading section', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Section One</h2>
        <div class="advanced-map">
          <div class="amap-map">
            <a
              class="mw-kartographer-map"
              data-mw-kartographer="maplink"
              data-width="300"
              data-height="300"
              data-lat="3200"
              data-lon="3200"
              data-plane="0"
              data-overlays='["sample_overlay"]'
              style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"
            ></a>
          </div>
          <div class="amap-key"><ul><li>Key</li></ul></div>
        </div>
        <div class="lighttable checklist">
          <ul>
            <li>Do first step</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const titleItem = items.find((item) => item.type === 'title' && item.text === 'Section One');

  assert.ok(titleItem, 'expected title item');
  assert.ok(Array.isArray(titleItem.sectionAdvancedMaps));
  assert.equal(titleItem.sectionAdvancedMaps.length, 1);
  assert.match(titleItem.sectionAdvancedMaps[0], /advanced-map/);
  assert.match(titleItem.sectionAdvancedMaps[0], /mw-kartographer-map/);
});

test('renderSteps uses kartographerLiveData to add marker overlay in advanced maps', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);

  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Map Section',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer="maplink" data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-plane="0" data-overlays='["sample_overlay"]' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"></a></div><div class="amap-key"><ul><li>Key</li></ul></div></div>`,
      ],
    },
  ];

  const kartographerLiveData = {
    sample_overlay: [
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [3200, 3200, 0],
            },
            properties: {
              iconWikiLink: '/images/pin_blue.svg',
              iconSize: [26, 31],
              iconAnchor: [13, 31],
              title: 'Quest marker',
            },
          },
        ],
      },
    ],
  };

  renderSteps({
    items,
    stepsDiv,
    showAllSteps: true,
    hideCompletedCheckbox: null,
    filterToggle: null,
    navBar: null,
    prevStepButton: null,
    nextStepButton: null,
    jumpCurrentButton: null,
    currentRewardImage: null,
    kartographerLiveData,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (value) => value,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });

  const marker = stepsDiv.querySelector(
    '.section-advanced-map .leaflet-marker-pane .leaflet-marker-icon'
  );
  assert.ok(marker, 'expected rendered marker icon from live data');
  assert.match(marker.getAttribute('src') || '', /^data:image\/svg\+xml;utf8,/);
  assert.equal(marker.getAttribute('aria-label'), 'Quest marker');
});
