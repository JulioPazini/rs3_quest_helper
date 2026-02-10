import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCheckedIndices,
  applyCheckedIndices,
  saveProgress,
  loadProgress,
  loadUiPreferences,
  saveUiPreferences,
} from '../src/features/progress/progressService.js';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
};

test('checked indices helpers are inverse operations for step items', () => {
  const items = [
    { type: 'title', checked: false },
    { type: 'step', checked: true },
    { type: 'step', checked: false },
  ];
  const indices = getCheckedIndices(items);
  assert.deepEqual(indices, [1]);
  applyCheckedIndices(items, [2]);
  assert.equal(items[1].checked, false);
  assert.equal(items[2].checked, true);
});

test('saveProgress/loadProgress persist quest payload', () => {
  const storage = createMemoryStorage();
  const questKey = 'questProgress:test';
  const items = [
    { type: 'step', checked: true },
    { type: 'step', checked: false },
  ];
  saveProgress({
    storage,
    questKey,
    items,
    overviewChecks: { a: true },
  });
  const loaded = loadProgress({ storage, questKey });
  assert.deepEqual(loaded.checkedIndices, [0]);
  assert.deepEqual(loaded.overviewChecks, { a: true });
});

test('saveUiPreferences/loadUiPreferences roundtrip', () => {
  const storage = createMemoryStorage();
  saveUiPreferences({
    storage,
    key: 'prefs',
    showAllSteps: false,
    hideCompleted: true,
  });
  const loaded = loadUiPreferences({ storage, key: 'prefs' });
  assert.equal(loaded.showAllSteps, false);
  assert.equal(loaded.hideCompleted, true);
});
