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

test('extractQuickGuide keeps mw-kartographer-map inside tables instead of sectionAdvancedMaps', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Table Map Section</h2>
        <table class="wikitable">
          <tbody>
            <tr>
              <td>
                <div class="mw-kartographer-container">
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
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const titleItem = items.find(
    (item) => item.type === 'title' && item.text === 'Table Map Section'
  );

  assert.ok(titleItem, 'expected title item');
  assert.ok(Array.isArray(titleItem.sectionAdvancedMaps));
  assert.equal(titleItem.sectionAdvancedMaps.length, 0);
  assert.ok(Array.isArray(titleItem.sectionTables));
  assert.equal(titleItem.sectionTables.length, 1);
  assert.match(titleItem.sectionTables[0], /mw-kartographer-map/);
});

test('extractQuickGuide keeps mw-kartographer-link inside tables when preserving table maps', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Table Link Map Section</h2>
        <table class="wikitable">
          <tbody>
            <tr>
              <td>
                <a
                  class="mw-kartographer-link mw-kartographer-container mw-kartographer-interactive"
                  data-mw-kartographer="maplink"
                  data-width="300"
                  data-height="300"
                  data-lat="3200"
                  data-lon="3200"
                  data-plane="0"
                  style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"
                ></a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const titleItem = items.find(
    (item) => item.type === 'title' && item.text === 'Table Link Map Section'
  );

  assert.ok(titleItem, 'expected title item');
  assert.equal(titleItem.sectionAdvancedMaps.length, 0);
  assert.equal(titleItem.sectionTables.length, 1);
  assert.match(titleItem.sectionTables[0], /mw-kartographer-link/);
});

test('extractQuickGuide ignores nested chat option tables', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Chat Table Section</h2>
        <table class="wikitable lighttable">
          <tbody>
            <tr>
              <th>Clue details</th>
            </tr>
            <tr>
              <td>
                <span class="chat-options">
                  <table><tbody><tr><td><b>3</b></td><td> Wave.</td></tr></tbody></table>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const titleItem = items.find(
    (item) => item.type === 'title' && item.text === 'Chat Table Section'
  );

  assert.ok(titleItem, 'expected title item');
  assert.equal(titleItem.sectionTables.length, 1, 'expected only outer table');
  assert.doesNotMatch(titleItem.sectionTables[0], /<b>3<\/b><\/td><td> Wave\./);
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

test('renderSteps preserves table kartographer map elements', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);

  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Table Map',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [
        '<table><tbody><tr><td><a class="mw-kartographer-link mw-kartographer-container mw-kartographer-interactive" data-mw-kartographer="maplink" data-width="300" data-height="300" style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"></a></td></tr></tbody></table>',
      ],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
  ];

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
    kartographerLiveData: null,
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

  const tableMap = stepsDiv.querySelector('.section-table-card .mw-kartographer-container');
  assert.ok(tableMap, 'expected kartographer map inside rendered table');
});

test('renderSteps appends section map block at the end of section content', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);

  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Map Section',
      level: 2,
      seeAlso: ['See also item'],
      sectionTexts: ['<p>Section intro</p>'],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer="maplink" data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-plane="0" data-overlays='["sample_overlay"]' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"></a></div><div class="amap-key"><ul><li>Key</li></ul></div></div>`,
      ],
    },
    { type: 'step', text: 'Do the thing', html: 'Do the thing', checked: false, substeps: [] },
  ];

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
    kartographerLiveData: null,
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

  assert.equal(
    stepsDiv.lastElementChild?.className,
    'section-advanced-maps',
    'expected map wrapper as final section block'
  );
});

test('renderSteps keeps section map before quest complete step and reward image', () => {
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
    {
      type: 'step',
      text: 'Quest complete!',
      html: 'Quest complete!',
      checked: false,
      substeps: [],
    },
  ];

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
    currentRewardImage: 'https://example.test/reward.png',
    kartographerLiveData: null,
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

  const mapWrap = stepsDiv.querySelector('.section-advanced-maps');
  const questCompleteStep = stepsDiv.querySelector('.step-item');
  const rewardImage = stepsDiv.querySelector('.reward-image');

  assert.ok(mapWrap, 'expected map wrapper');
  assert.ok(questCompleteStep, 'expected quest complete step');
  assert.ok(rewardImage, 'expected reward image');
  assert.ok(
    Boolean(
      mapWrap.compareDocumentPosition(questCompleteStep) &
      dom.window.Node.DOCUMENT_POSITION_FOLLOWING
    ),
    'expected map wrapper before quest complete step'
  );
  assert.ok(
    Boolean(
      mapWrap.compareDocumentPosition(rewardImage) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING
    ),
    'expected map wrapper before reward image'
  );
});
