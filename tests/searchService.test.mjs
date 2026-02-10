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
