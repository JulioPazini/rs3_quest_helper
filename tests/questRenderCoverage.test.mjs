import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  createSearchItemRow,
  renderOverview,
  renderSearchResults,
  renderSteps,
} from '../src/features/quests/questRender.js';

const setDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
};

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

test('createSearchItemRow toggles panel and triggers quest load action', () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="results"></div><input id="q" /></body></html>'
  );
  setDomGlobals(dom);

  const resultsDiv = dom.window.document.getElementById('results');
  const input = dom.window.document.getElementById('q');
  let loadedQuest = '';
  let cleared = false;

  const row = createSearchItemRow(
    {
      title: 'The Feud',
      length: 'Short',
      combat: 'None',
      questPoints: 1,
      series: 'Desert',
      membersIcon: '/images/member.png',
      playerStatus: 'COMPLETED',
    },
    {
      resultsDiv,
      input,
      clearSearchResults: () => {
        cleared = true;
      },
      loadQuest: (title) => {
        loadedQuest = title;
      },
    }
  );

  resultsDiv.appendChild(row);
  assert.ok(row.classList.contains('search-item-completed'));

  const header = row.querySelector('.search-item-header');
  header.click();
  assert.equal(header.getAttribute('aria-expanded'), 'true');
  header.click();
  assert.equal(header.getAttribute('aria-expanded'), 'false');

  const action = row.querySelector('.search-item-action');
  action.click();
  assert.equal(cleared, true);
  assert.equal(input.value, 'The Feud');
  assert.equal(loadedQuest, 'The Feud');
});

test('createSearchItemRow supports started and pending statuses', () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="results"></div><input id="q" /></body></html>'
  );
  setDomGlobals(dom);
  const resultsDiv = dom.window.document.getElementById('results');
  const ctx = {
    resultsDiv,
    input: dom.window.document.getElementById('q'),
    clearSearchResults: () => {},
    loadQuest: () => {},
  };

  const started = createSearchItemRow({ title: 'S', playerStatus: 'Started' }, ctx);
  const pending = createSearchItemRow({ title: 'P', playerStatus: 'Not started' }, ctx);
  assert.ok(started.classList.contains('search-item-started'));
  assert.ok(pending.classList.contains('search-item-pending'));
  assert.match(started.querySelector('.search-item-status-icon').className, /started/);
  assert.match(
    pending.querySelector('.search-item-status-icon').getAttribute('title'),
    /Quest status/i
  );
});

test('createSearchItemRow closes previously opened item', () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="results"></div><input id="q" /></body></html>'
  );
  setDomGlobals(dom);
  const resultsDiv = dom.window.document.getElementById('results');
  const ctx = {
    resultsDiv,
    input: dom.window.document.getElementById('q'),
    clearSearchResults: () => {},
    loadQuest: () => {},
  };
  const rowA = createSearchItemRow({ title: 'A' }, ctx);
  const rowB = createSearchItemRow({ title: 'B' }, ctx);
  resultsDiv.appendChild(rowA);
  resultsDiv.appendChild(rowB);
  rowA.querySelector('.search-item-header').click();
  rowB.querySelector('.search-item-header').click();
  assert.equal(rowA.querySelector('.search-item-header').getAttribute('aria-expanded'), 'false');
  assert.equal(rowB.querySelector('.search-item-header').getAttribute('aria-expanded'), 'true');
});

test('renderSearchResults handles empty and grouped batches', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="results"></div></body></html>');
  setDomGlobals(dom);
  const resultsDiv = dom.window.document.getElementById('results');

  const emptyState = { reset: true, visibleResults: 0, lastRenderedSeries: null };
  renderSearchResults({
    resultsDiv,
    getFilteredResults: () => [],
    resultsBatchSize: 10,
    searchState: emptyState,
    createRowContext: {},
    groupMode: 'series',
    ensureSentinel: () => {},
  });
  assert.ok(resultsDiv.classList.contains('hidden'));

  const results = [
    { title: 'A', series: 'Desert' },
    { title: 'B', series: 'Desert' },
    { title: 'C', series: 'Elf' },
  ];
  const state = { reset: true, visibleResults: 0, lastRenderedSeries: null };
  let sentinelCalled = false;
  let afterRenderCalled = false;
  renderSearchResults({
    resultsDiv,
    getFilteredResults: () => results,
    resultsBatchSize: 2,
    searchState: state,
    createRowContext: {
      resultsDiv,
      input: dom.window.document.createElement('input'),
      clearSearchResults: () => {},
      loadQuest: () => {},
    },
    groupMode: 'series',
    ensureSentinel: () => {
      sentinelCalled = true;
    },
    afterRender: () => {
      afterRenderCalled = true;
    },
  });

  assert.equal(sentinelCalled, true);
  assert.equal(afterRenderCalled, true);
  assert.ok(resultsDiv.querySelector('.results-group-title'));
  assert.ok(resultsDiv.querySelectorAll('.search-item').length >= 2);
});

test('renderSearchResults covers membership/progress grouping and non-group mode', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="results"></div></body></html>');
  setDomGlobals(dom);
  const resultsDiv = dom.window.document.getElementById('results');
  const rows = [
    { title: 'A', membership: 'free', playerStatus: 'completed' },
    { title: 'B', membersIcon: 'member_icon', playerStatus: 'in_progress' },
    { title: 'C', membership: '', playerStatus: '' },
  ];
  const state = { reset: true, visibleResults: 0, lastRenderedSeries: null };
  Object.defineProperty(dom.window.document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 10,
  });
  Object.defineProperty(dom.window.document.documentElement, 'clientHeight', {
    configurable: true,
    value: 1000,
  });
  renderSearchResults({
    resultsDiv,
    getFilteredResults: () => rows,
    resultsBatchSize: 1,
    searchState: state,
    createRowContext: {
      resultsDiv,
      input: dom.window.document.createElement('input'),
      clearSearchResults: () => {},
      loadQuest: () => {},
    },
    groupMode: 'membership',
    ensureSentinel: () => {},
  });
  const groupsMembership = Array.from(resultsDiv.querySelectorAll('.results-group-title')).map(
    (n) => n.textContent.trim()
  );
  assert.ok(groupsMembership.includes('Free'));
  assert.ok(groupsMembership.includes('Members'));
  assert.ok(groupsMembership.includes('Unknown'));

  resultsDiv.innerHTML = '';
  state.reset = true;
  state.visibleResults = 0;
  state.lastRenderedSeries = null;
  renderSearchResults({
    resultsDiv,
    getFilteredResults: () => rows,
    resultsBatchSize: 2,
    searchState: state,
    createRowContext: {
      resultsDiv,
      input: dom.window.document.createElement('input'),
      clearSearchResults: () => {},
      loadQuest: () => {},
    },
    groupMode: 'alphabetical',
    ensureSentinel: () => {},
  });
  assert.equal(resultsDiv.querySelectorAll('.results-group-title').length, 0);
});

test('renderSearchResults supports progress/length/combat labels', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="results"></div></body></html>');
  setDomGlobals(dom);
  const resultsDiv = dom.window.document.getElementById('results');
  const baseState = { reset: true, visibleResults: 0, lastRenderedSeries: null };
  const ctx = {
    resultsDiv,
    input: dom.window.document.createElement('input'),
    clearSearchResults: () => {},
    loadQuest: () => {},
  };
  const run = (groupMode, rows) => {
    resultsDiv.innerHTML = '';
    baseState.reset = true;
    baseState.visibleResults = 0;
    baseState.lastRenderedSeries = null;
    renderSearchResults({
      resultsDiv,
      getFilteredResults: () => rows,
      resultsBatchSize: rows.length,
      searchState: baseState,
      createRowContext: ctx,
      groupMode,
      ensureSentinel: () => {},
    });
    return Array.from(resultsDiv.querySelectorAll('.results-group-title')).map((n) =>
      n.textContent.trim()
    );
  };
  const progressGroups = run('progress', [
    { title: 'A', playerStatus: 'complete' },
    { title: 'B', playerStatus: 'started' },
    { title: 'C', playerStatus: 'other' },
  ]);
  assert.ok(progressGroups.includes('COMPLETE'));
  assert.ok(progressGroups.includes('IN PROGRESS'));
  assert.ok(progressGroups.includes('NOT STARTED'));
  const lengthGroups = run('length', [
    { title: 'A', length: '' },
    { title: 'B', length: 'Short' },
  ]);
  assert.ok(lengthGroups.includes('Unknown length'));
  const combatGroups = run('combat', [
    { title: 'A', combat: '' },
    { title: 'B', combat: 'None' },
  ]);
  assert.ok(combatGroups.includes('No combat info'));
});

test('renderOverview renders checklist with toggles and status markers', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="overview"></div></body></html>');
  setDomGlobals(dom);
  const overviewEl = dom.window.document.getElementById('overview');

  const toggled = [];
  renderOverview(
    {
      requirementsQuests: '<ul><li><a href="/w/The_Feud">The Feud</a></li></ul>',
      requirementsSkills: '<ul><li>Attack 50</li></ul>',
      requiredItems: '<ul><li>Item A</li></ul>',
      recommendedItems: '<ul><li>none</li></ul>',
      combat: '<ul><li>Enemy</li></ul>',
      requirementsQuestsIcon: 'https://example.test/icon.png',
    },
    overviewEl,
    {
      onToggle: (key, checked) => toggled.push([key, checked]),
      savedChecks: { 'requiredItems:0': true },
      playerQuestMeta: { 'the feud': { status: 'COMPLETED' } },
      playerSkills: { attack: 60 },
    }
  );

  assert.ok(!overviewEl.classList.contains('hidden'));
  assert.ok(overviewEl.querySelector('.overview-title-icon'));
  assert.ok(overviewEl.querySelector('.quest-status-marker.complete'));
  const checklistBox = overviewEl.querySelector('input.overview-check');
  assert.ok(checklistBox);
  assert.equal(checklistBox.checked, true);
  checklistBox.checked = false;
  checklistBox.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(toggled[0], ['requiredItems:0', false]);
});

test('renderOverview handles null overview and "none" checklist styles', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="overview"></div></body></html>');
  setDomGlobals(dom);
  const overviewEl = dom.window.document.getElementById('overview');

  renderOverview(null, overviewEl);
  assert.ok(overviewEl.classList.contains('hidden'));

  renderOverview(
    {
      requirementsQuests: '<ul><li><a href="/w/Q1">Q1</a></li><li><a href="/w/Q2">Q2</a></li></ul>',
      requirementsSkills: '<ul><li>Attack 50</li><li>Unknown skill ???</li></ul>',
      requiredItems: '<ul><li>none</li></ul>',
      recommendedItems: '<ul><li>none</li></ul>',
    },
    overviewEl,
    {
      playerQuestMeta: {
        q1: { status: 'started' },
        q2: { status: 'blocked' },
      },
      playerSkills: { attack: 10 },
    }
  );
  assert.ok(overviewEl.querySelector('.quest-status-marker.started'));
  assert.ok(overviewEl.querySelector('.quest-status-marker.incomplete'));
  assert.ok(overviewEl.querySelectorAll('.overview-bulleted').length >= 1);
});

test('renderOverview hides when provided object has no usable sections', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="overview"></div></body></html>');
  setDomGlobals(dom);
  const overviewEl = dom.window.document.getElementById('overview');
  renderOverview({ requirementsQuests: '', requiredItems: '' }, overviewEl);
  assert.ok(overviewEl.classList.contains('hidden'));
});

test('renderSteps handles empty items and no-step sections', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);

  const stepsDiv = dom.window.document.getElementById('steps');
  const filterToggle = dom.window.document.createElement('section');
  const navBar = dom.window.document.createElement('section');
  const jumpCurrentButton = dom.window.document.createElement('button');
  const prevStepButton = dom.window.document.createElement('button');
  const nextStepButton = dom.window.document.createElement('button');
  let shown = 0;
  let progress = 0;

  renderSteps({
    items: [],
    stepsDiv,
    showAllSteps: true,
    hideCompletedCheckbox: null,
    filterToggle,
    navBar,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    currentRewardImage: null,
    kartographerLiveData: null,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {
      progress += 1;
    },
    resetQuestButton: null,
    currentItems: [],
    showSearchControls: () => {
      shown += 1;
    },
  });

  assert.equal(stepsDiv.textContent, 'No steps found.');
  assert.ok(filterToggle.classList.contains('hidden'));
  assert.ok(navBar.classList.contains('hidden'));
  assert.ok(jumpCurrentButton.classList.contains('hidden'));
  assert.equal(shown, 1);
  assert.equal(progress, 1);

  const withTitleOnly = [
    {
      type: 'title',
      text: 'Lore',
      level: 3,
      seeAlso: ['see also'],
      sectionTexts: ['<p>Intro</p>'],
      sectionInfoBoxes: ['<div>box</div>'],
      sectionTables: ['<table><tbody><tr><td>t</td></tr></tbody></table>'],
      sectionRefLists: ['<ol><li>ref</li></ol>'],
      sectionImages: [{ src: 'https://example.test/image.png', alt: 'img' }],
      sectionAdvancedMaps: [
        '<div class="advanced-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" style="display:block;width:300px;height:300px;background-image:url(x)"></a></div>',
      ],
    },
  ];
  renderSteps({
    items: withTitleOnly,
    stepsDiv,
    showAllSteps: true,
    hideCompletedCheckbox: null,
    filterToggle,
    navBar,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    currentRewardImage: 'https://example.test/reward.png',
    kartographerLiveData: null,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: withTitleOnly,
    showSearchControls: () => {},
  });
  assert.ok(stepsDiv.querySelector('h4.step-subsection-title'));
  assert.ok(stepsDiv.querySelector('.section-advanced-maps'));
  assert.ok(stepsDiv.querySelector('.reward-image'));
});

test('renderSteps showAllSteps handles notes, hide completed, and auto-scroll', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  let scrolled = 0;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {
    scrolled += 1;
  };

  const stepsDiv = dom.window.document.getElementById('steps');
  const hideCompletedCheckbox = dom.window.document.createElement('input');
  hideCompletedCheckbox.checked = true;
  const jumpCurrentButton = dom.window.document.createElement('button');
  jumpCurrentButton.classList.add('hidden');
  const filterToggle = dom.window.document.createElement('section');
  filterToggle.classList.add('hidden');
  const navBar = dom.window.document.createElement('section');
  navBar.classList.add('hidden');
  const prevStepButton = dom.window.document.createElement('button');
  const nextStepButton = dom.window.document.createElement('button');
  let pending = true;
  let saved = 0;
  let rerendered = 0;
  let progress = 0;

  const items = [
    {
      type: 'title',
      text: 'S1',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: ['<div>ignored by inline note</div>'],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
    { type: 'note', noteType: 'infobox', html: '<div>inline info</div>' },
    { type: 'note', noteType: 'table', html: '<table><tbody><tr><td>A</td></tr></tbody></table>' },
    { type: 'note', noteType: 'reflist', html: '<ol><li>a</li></ol>' },
    { type: 'note', noteType: 'text', html: '<p>txt</p>' },
    { type: 'step', text: 'done', html: 'done', checked: true, substeps: [] },
    {
      type: 'step',
      text: 'active',
      html: 'active',
      checked: false,
      substeps: [{ text: 'sub', checked: false, substeps: [{ text: 'deep', checked: false }] }],
    },
    {
      type: 'title',
      text: 'S2',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
    { type: 'step', text: 'hidden done', html: 'hidden done', checked: true, substeps: [] },
  ];

  renderSteps({
    items,
    stepsDiv,
    showAllSteps: true,
    hideCompletedCheckbox,
    filterToggle,
    navBar,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    currentRewardImage: null,
    kartographerLiveData: null,
    pendingAutoScroll: () => pending,
    setPendingAutoScroll: (value) => {
      pending = value;
    },
    saveProgress: () => {
      saved += 1;
    },
    renderStepsFn: () => {
      rerendered += 1;
    },
    formatStepHtml: (v) => v,
    updateProgress: () => {
      progress += 1;
    },
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });

  assert.ok(!jumpCurrentButton.classList.contains('hidden'));
  assert.ok(!filterToggle.classList.contains('hidden'));
  assert.ok(!navBar.classList.contains('hidden'));
  assert.equal(progress, 1);
  assert.equal(scrolled, 1);
  assert.equal(pending, false);
  assert.equal(stepsDiv.querySelectorAll('.step-section-title').length, 1);
  assert.ok(stepsDiv.querySelector('.section-infoboxes'));
  assert.ok(stepsDiv.querySelector('.section-tables'));
  assert.ok(stepsDiv.querySelector('.section-reflists'));
  assert.ok(stepsDiv.querySelector('.substeps'));

  const currentStep = stepsDiv.querySelector('.step-item.current');
  currentStep.click();
  await wait();
  assert.equal(saved, 1);
  assert.equal(rerendered, 1);
  assert.equal(items[6].checked, true);
});

test('renderSteps single-step mode covers quest complete and reset action', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const navBar = dom.window.document.createElement('section');
  const prevStepButton = dom.window.document.createElement('button');
  const nextStepButton = dom.window.document.createElement('button');
  const jumpCurrentButton = dom.window.document.createElement('button');
  const resetQuestButton = dom.window.document.createElement('button');
  resetQuestButton.textContent = 'Reset';
  let saved = 0;
  let rendered = 0;
  let progressed = 0;

  const completeItems = [
    { type: 'title', text: 'T', level: 2, seeAlso: [] },
    { type: 'step', text: 'A', checked: true },
    { type: 'step', text: 'B', checked: true },
  ];

  renderSteps({
    items: completeItems,
    stepsDiv,
    showAllSteps: false,
    hideCompletedCheckbox: null,
    filterToggle: null,
    navBar,
    prevStepButton,
    nextStepButton,
    jumpCurrentButton,
    currentRewardImage: 'https://example.test/reward.png',
    kartographerLiveData: null,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {
      saved += 1;
    },
    renderStepsFn: () => {
      rendered += 1;
    },
    formatStepHtml: (v) => v,
    updateProgress: () => {
      progressed += 1;
    },
    resetQuestButton,
    currentItems: completeItems,
    showSearchControls: () => {},
  });

  assert.match(stepsDiv.innerHTML, /Quest complete!/);
  assert.ok(navBar.classList.contains('hidden'));
  assert.equal(prevStepButton.disabled, false);
  assert.equal(nextStepButton.disabled, true);
  assert.ok(stepsDiv.querySelector('.reward-image'));
  stepsDiv.querySelector('.reset-wrap button').click();
  assert.equal(saved, 1);
  assert.equal(rendered, 1);
  assert.equal(completeItems[1].checked, false);
  assert.equal(completeItems[2].checked, false);
  assert.equal(progressed, 1);
});

test('renderSteps single-step mode toggles current step and preserves links', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const navBar = dom.window.document.createElement('section');
  let saved = 0;
  let rendered = 0;
  const items = [
    {
      type: 'title',
      text: 'T',
      level: 2,
      seeAlso: ['<a href="https://example.test">see</a>'],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [{ src: 'https://example.test/i.png', alt: 'i', caption: 'cap' }],
      sectionAdvancedMaps: [
        '<div class="advanced-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" style="display:block;width:300px;height:300px;background-image:url(x)"></a></div>',
      ],
    },
    { type: 'note', noteType: 'text', html: '<p>note</p>' },
    {
      type: 'step',
      text: 'Current step',
      html: 'Current <a href="https://example.test">step</a>',
      checked: false,
      substeps: [{ text: 'sub', html: 'sub', checked: false, substeps: [] }],
    },
  ];

  renderSteps({
    items,
    stepsDiv,
    showAllSteps: false,
    hideCompletedCheckbox: null,
    filterToggle: null,
    navBar,
    prevStepButton: dom.window.document.createElement('button'),
    nextStepButton: dom.window.document.createElement('button'),
    jumpCurrentButton: dom.window.document.createElement('button'),
    currentRewardImage: null,
    kartographerLiveData: null,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {
      saved += 1;
    },
    renderStepsFn: () => {
      rendered += 1;
    },
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });

  assert.ok(!navBar.classList.contains('hidden'));
  assert.ok(stepsDiv.querySelector('.section-images'));
  assert.ok(stepsDiv.querySelector('.section-advanced-maps'));
  const stepEl = stepsDiv.querySelector('.step-item.current');
  const link = stepEl.querySelector('a');
  link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await wait();
  assert.equal(saved, 0);
  stepEl.click();
  await wait();
  assert.equal(saved, 1);
  assert.equal(rendered, 1);
});

test('renderSteps handles map overlay edge cases and fallback pin', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');

  const items = [
    {
      type: 'title',
      text: 'Map Edges',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-plane="0" data-overlays='not_json_overlay' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png)"><div class="leaflet-map-pane"></div><img class="leaflet-marker-icon" src="/images/custom_marker.png"></a></div><div class="amap-key"><ul><li>k</li></ul></div></div>`,
      ],
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
    kartographerLiveData: JSON.stringify({}),
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });

  const markers = stepsDiv.querySelectorAll('.leaflet-marker-icon');
  assert.ok(markers.length >= 1);
  const converted = Array.from(markers).find((m) =>
    (m.getAttribute('src') || '').startsWith('data:image/svg+xml')
  );
  assert.ok(converted, 'expected converted marker data uri');

  const itemsFallback = [
    {
      type: 'title',
      text: 'Map Fallback',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-plane="0" data-overlays='overlay_missing' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png)"></a></div><div class="amap-key"><ul><li>k</li></ul></div></div>`,
      ],
    },
  ];
  renderSteps({
    items: itemsFallback,
    stepsDiv,
    showAllSteps: true,
    hideCompletedCheckbox: null,
    filterToggle: null,
    navBar: null,
    prevStepButton: null,
    nextStepButton: null,
    jumpCurrentButton: null,
    currentRewardImage: null,
    kartographerLiveData: JSON.stringify({}),
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: itemsFallback,
    showSearchControls: () => {},
  });
  const fallback = Array.from(stepsDiv.querySelectorAll('.leaflet-marker-icon')).find((m) =>
    (m.getAttribute('aria-label') || '').toLowerCase().includes('map pin')
  );
  assert.ok(fallback, 'expected fallback map pin marker');
});

test('renderSteps showAllSteps click branches for marking and unmarking ranges', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  let saves = 0;
  let rerenders = 0;
  const items = [
    {
      type: 'title',
      text: 'T',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
    { type: 'meta', text: 'skip me' },
    { type: 'step', text: 'S1', html: 'S1', checked: false, substeps: [] },
    { type: 'step', text: 'S2', html: 'S2', checked: false, substeps: [] },
    { type: 'step', text: 'S3', html: 'S3', checked: true, substeps: [] },
  ];
  const render = () =>
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
      saveProgress: () => {
        saves += 1;
      },
      renderStepsFn: () => {
        rerenders += 1;
      },
      formatStepHtml: (v) => v,
      updateProgress: () => {},
      resetQuestButton: null,
      currentItems: items,
      showSearchControls: () => {},
    });

  render();
  const s2 = Array.from(stepsDiv.querySelectorAll('.step-item')).find((n) =>
    n.textContent.includes('S2')
  );
  s2.click();
  await wait();
  assert.equal(items[2].checked, true);
  assert.equal(items[3].checked, true);

  items[2].checked = true;
  items[3].checked = true;
  items[4].checked = true;
  render();
  const completed = stepsDiv.querySelector('.step-item.completed');
  completed.click();
  await wait();
  assert.equal(items[2].checked, false);
  assert.equal(items[3].checked, false);
  assert.equal(items[4].checked, false);
  assert.ok(saves >= 2);
  assert.ok(rerenders >= 2);
});

test('renderSteps renders dot and square-dot markers from live data', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Dot map',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-plane="0" data-overlays='["ov"]' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"><div class="leaflet-map-pane"></div></a></div><div class="amap-key"><ul><li>k</li></ul></div></div>`,
      ],
    },
  ];
  const liveData = {
    ov: [
      {
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [3200, 3200, 0] },
            properties: { shape: 'Dot', fill: '#ff0000', title: 'Dot marker' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [3201, 3201, 0] },
            properties: { shape: 'SquareDot', fill: '#00ff00', name: 'Square marker' },
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
    kartographerLiveData: liveData,
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });
  assert.ok(stepsDiv.querySelector('.leaflet-dot'));
  assert.ok(stepsDiv.querySelector('.leaflet-sqdot'));
});

test('renderSteps handles malformed kartographerLiveData string safely', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Malformed map',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [
        `<div class="advanced-map"><div class="amap-map"><a class="mw-kartographer-map" data-mw-kartographer data-width="300" data-height="300" data-lat="3200" data-lon="3200" data-overlays='["ov"]' style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png);"><div class="leaflet-map-pane"></div></a></div><div class="amap-key"><ul><li>k</li></ul></div></div>`,
      ],
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
    kartographerLiveData: '{broken',
    pendingAutoScroll: () => false,
    setPendingAutoScroll: () => {},
    saveProgress: () => {},
    renderStepsFn: () => {},
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });
  assert.ok(stepsDiv.querySelector('.section-advanced-maps'));
});

test('renderSteps updates substep checkbox state, marks parent step, and persists progress', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  let saves = 0;
  const items = [
    {
      type: 'title',
      text: 'S',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
    {
      type: 'step',
      text: 'Previous',
      html: 'Previous',
      checked: false,
      substeps: [],
    },
    {
      type: 'step',
      text: 'A',
      html: 'A',
      checked: false,
      substeps: [{ text: 'sub', html: 'sub', checked: false, substeps: [] }],
    },
  ];
  let rerenders = 0;
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
    saveProgress: () => {
      saves += 1;
    },
    renderStepsFn: () => {
      rerenders += 1;
    },
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });
  const checkbox = stepsDiv.querySelector('.substep-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(items[2].substeps[0].checked, true);
  assert.equal(items[2].checked, true);
  assert.equal(items[1].checked, true);
  assert.equal(saves, 1);
  assert.equal(rerenders, 1);
});

test('renderSteps does not demote an already completed parent step on partial substep changes', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'S',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [],
      sectionAdvancedMaps: [],
    },
    {
      type: 'step',
      text: 'A',
      html: 'A',
      checked: true,
      substeps: [
        { text: 'sub1', html: 'sub1', checked: false, substeps: [] },
        { text: 'sub2', html: 'sub2', checked: false, substeps: [] },
      ],
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
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });
  const checkbox = stepsDiv.querySelector('.substep-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(items[1].substeps[0].checked, true);
  assert.equal(items[1].checked, true);
});

test('renderSteps single mode shows quest-complete section images and reward image', () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="steps"></div></body></html>');
  setDomGlobals(dom);
  const stepsDiv = dom.window.document.getElementById('steps');
  const items = [
    {
      type: 'title',
      text: 'Quest end',
      level: 2,
      seeAlso: [],
      sectionTexts: [],
      sectionInfoBoxes: [],
      sectionTables: [],
      sectionRefLists: [],
      sectionImages: [{ src: 'https://example.test/i.png', alt: 'i', caption: 'c' }],
      sectionAdvancedMaps: [],
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
    showAllSteps: false,
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
    formatStepHtml: (v) => v,
    updateProgress: () => {},
    resetQuestButton: null,
    currentItems: items,
    showSearchControls: () => {},
  });
  assert.ok(stepsDiv.querySelector('.section-images'));
  assert.ok(stepsDiv.querySelector('.reward-image'));
});
