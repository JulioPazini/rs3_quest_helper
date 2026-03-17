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
  assert.deepEqual(loaded.stepProgress, { checkedSteps: 1, totalSteps: 2 });
  assert.deepEqual(loaded.overviewChecks, { a: true });
});

test('saveUiPreferences/loadUiPreferences roundtrip', () => {
  const storage = createMemoryStorage();
  saveUiPreferences({
    storage,
    key: 'prefs',
    showAllSteps: false,
    hideCompleted: true,
    sequentialStepChecking: false,
    autoTranslateSteps: true,
    theme: 'midnight',
    stepFontSize: 'large',
    confirmResetQuestProgress: false,
    sectionImagesInModal: false,
  });
  const loaded = loadUiPreferences({ storage, key: 'prefs' });
  assert.equal(loaded.showAllSteps, false);
  assert.equal(loaded.hideCompleted, true);
  assert.equal(loaded.sequentialStepChecking, false);
  assert.equal(loaded.autoTranslateSteps, true);
  assert.equal(loaded.theme, 'midnight');
  assert.equal(loaded.stepFontSize, 'large');
  assert.equal(loaded.confirmResetQuestProgress, false);
  assert.equal(loaded.sectionImagesInModal, false);
});

test('progress service handles null inputs, missing keys and storage/json failures', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('read error');
    },
    setItem() {
      throw new Error('write error');
    },
  };

  assert.deepEqual(getCheckedIndices(null), []);
  const items = [{ type: 'step', checked: false }];
  applyCheckedIndices(items, null);
  assert.equal(items[0].checked, false);

  // no questKey should do nothing and return null on load
  saveProgress({
    storage: throwingStorage,
    questKey: '',
    items,
    overviewChecks: null,
  });
  assert.equal(loadProgress({ storage: throwingStorage, questKey: '' }), null);

  // storage failures are ignored and return null/defaults
  saveProgress({
    storage: throwingStorage,
    questKey: 'k',
    items,
    overviewChecks: null,
  });
  assert.equal(loadProgress({ storage: throwingStorage, questKey: 'k' }), null);

  const malformedStorage = {
    getItem() {
      return '{bad json';
    },
    setItem() {},
  };
  assert.equal(loadProgress({ storage: malformedStorage, questKey: 'k' }), null);
});

test('loadUiPreferences applies defaults for missing/invalid values', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadUiPreferences({ storage, key: 'missing' }), {
    showAllSteps: true,
    hideCompleted: false,
    sequentialStepChecking: true,
    autoTranslateSteps: false,
    selectedSeries: 'alphabetical',
    theme: 'classic',
    stepFontSize: 'medium',
    confirmResetQuestProgress: true,
    sectionImagesInModal: true,
  });

  storage.setItem(
    'prefsPartial',
    JSON.stringify({
      showAllSteps: 'yes',
      hideCompleted: true,
      sequentialStepChecking: false,
      autoTranslateSteps: 'x',
      selectedSeries: 'unknown',
      theme: 'pink',
      stepFontSize: 'tiny',
      confirmResetQuestProgress: 'no',
      sectionImagesInModal: 'no',
    })
  );
  assert.deepEqual(loadUiPreferences({ storage, key: 'prefsPartial' }), {
    showAllSteps: true,
    hideCompleted: true,
    sequentialStepChecking: false,
    autoTranslateSteps: false,
    selectedSeries: 'alphabetical',
    theme: 'classic',
    stepFontSize: 'medium',
    confirmResetQuestProgress: true,
    sectionImagesInModal: true,
  });

  storage.setItem(
    'prefsPartial2',
    JSON.stringify({
      showAllSteps: false,
      hideCompleted: 'no',
      sequentialStepChecking: 'no',
      autoTranslateSteps: true,
      selectedSeries: 'length',
      theme: 'ocean',
      stepFontSize: 'small',
      confirmResetQuestProgress: false,
      sectionImagesInModal: false,
    })
  );
  assert.deepEqual(loadUiPreferences({ storage, key: 'prefsPartial2' }), {
    showAllSteps: false,
    hideCompleted: false,
    sequentialStepChecking: true,
    autoTranslateSteps: true,
    selectedSeries: 'length',
    theme: 'ocean',
    stepFontSize: 'small',
    confirmResetQuestProgress: false,
    sectionImagesInModal: false,
  });

  const badStorage = {
    getItem() {
      return '{broken';
    },
    setItem() {},
  };
  assert.deepEqual(loadUiPreferences({ storage: badStorage, key: 'x' }), {
    showAllSteps: true,
    hideCompleted: false,
    sequentialStepChecking: true,
    autoTranslateSteps: false,
    selectedSeries: 'alphabetical',
    theme: 'classic',
    stepFontSize: 'medium',
    confirmResetQuestProgress: true,
    sectionImagesInModal: true,
  });
});
