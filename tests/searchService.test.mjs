import test from 'node:test';
import assert from 'node:assert/strict';
import { getFilteredResults } from '../src/features/search/searchService.js';

const normalizeTitleKey = (title) =>
  String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

test('getFilteredResults filters by player quest set and query', () => {
  const questList = [
    { title: 'The Feud', series: 'Desert', length: 'Short', combat: 'None', membership: 'free' },
    {
      title: 'Do No Evil',
      series: 'Desert',
      length: 'Long',
      combat: 'NPC combat level 110-119',
      membership: 'members',
    },
  ];

  const result = getFilteredResults({
    questList,
    playerQuestFilter: new Set(['the feud']),
    playerQuestMeta: { 'the feud': { status: 'COMPLETED', userEligible: true } },
    searchQuery: 'feud',
    selectedSeries: 'alphabetical',
    normalizeTitleKey,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'The Feud');
  assert.equal(result[0].playerStatus, 'COMPLETED');
});

test('getFilteredResults sorts combat mode by rank', () => {
  const questList = [
    { title: 'B', combat: 'NPC combat level 110-119' },
    { title: 'A', combat: 'None' },
  ];

  const result = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta: {},
    searchQuery: '',
    selectedSeries: 'combat',
    normalizeTitleKey,
  });

  assert.equal(result[0].title, 'A');
  assert.equal(result[1].title, 'B');
});

test('getFilteredResults supports all modes and invalid mode fallback', () => {
  const questList = [
    {
      title: 'Q Gamma',
      series: '',
      length: 'Long',
      combat: 'NPC combat level 110-119',
      membership: '',
      membersIcon: '/images/P2P_icon.png',
    },
    {
      title: 'Q Alpha',
      series: 'Alpha',
      length: 'Short',
      combat: 'None',
      membership: 'free',
      membersIcon: '',
    },
    {
      title: 'Q Beta',
      series: 'Alpha',
      length: 'Medium',
      combat: 'NPC combat level scaled',
      membership: 'members',
      membersIcon: '',
    },
  ];
  const playerQuestMeta = {
    'q alpha': { status: 'STARTED', userEligible: true },
    'q beta': { status: 'COMPLETED', userEligible: false },
  };

  const bySeries = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta,
    searchQuery: 'q',
    selectedSeries: 'series',
    normalizeTitleKey,
  });
  assert.equal(bySeries[0].series, 'Alpha');
  assert.equal(bySeries[0].title, 'Q Alpha');

  const byLength = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta,
    searchQuery: '',
    selectedSeries: 'length',
    normalizeTitleKey,
  });
  assert.equal(byLength[0].length, 'Short');

  const byMembership = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta,
    searchQuery: '',
    selectedSeries: 'membership',
    normalizeTitleKey,
  });
  assert.equal(byMembership[0].title, 'Q Alpha');

  const byProgress = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta,
    searchQuery: '',
    selectedSeries: 'progress',
    normalizeTitleKey,
  });
  const statuses = byProgress.map((q) => q.playerStatus || '');
  assert.ok(statuses.includes('STARTED'));
  assert.ok(statuses.includes('COMPLETED'));

  const fallbackMode = getFilteredResults({
    questList,
    playerQuestFilter: null,
    playerQuestMeta,
    searchQuery: '',
    selectedSeries: 'not-a-mode',
    normalizeTitleKey,
  });
  assert.equal(fallbackMode[0].title, 'Q Alpha');
});

test('getFilteredResults applies quest filter and query case handling', () => {
  const questList = [
    { title: 'A quest', series: 'S' },
    { title: 'B Quest', series: 'S' },
  ];
  const result = getFilteredResults({
    questList,
    playerQuestFilter: new Set(['a quest']),
    playerQuestMeta: {},
    searchQuery: 'QUEST',
    selectedSeries: 'alphabetical',
    normalizeTitleKey,
  });
  // searchQuery is expected to be pre-normalized by caller; uppercase should not match
  assert.equal(result.length, 0);
});
