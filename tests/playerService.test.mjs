import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayerService,
  normalizeTitleKey,
  parseSkillValues,
  detectPlayerApiError,
} from '../src/features/player/playerService.js';

test('normalizeTitleKey trims and lowercases consistently', () => {
  assert.equal(normalizeTitleKey('  The   Feud '), 'the feud');
});

test('parseSkillValues maps known skill ids to levels', () => {
  const skills = parseSkillValues({
    skillvalues: [
      { id: 0, level: 10 },
      { id: 28, level: 99 },
      { id: 999, level: 1 },
    ],
  });
  assert.equal(skills.attack, 10);
  assert.equal(skills.necromancy, 99);
  assert.equal(skills.undefined, undefined);
});

test('detectPlayerApiError identifies private and missing profile', () => {
  assert.equal(detectPlayerApiError({ error: 'Private profile' }), 'PROFILE_PRIVATE');
  assert.equal(detectPlayerApiError({ message: 'No profile found' }), 'USER_NOT_FOUND');
  assert.equal(detectPlayerApiError({ error: 'Unexpected error' }), 'GENERIC_API_ERROR');
});

test('createPlayerService returns cached payload when available', async () => {
  const storage = {
    map: new Map(),
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    },
  };
  storage.setItem(
    'playerDataCacheV1',
    JSON.stringify({
      lotharx: {
        ts: 1000,
        questFilter: ['the feud'],
        questMeta: { 'the feud': { status: 'COMPLETED' } },
        skills: { attack: 50 },
      },
    })
  );

  const service = createPlayerService({
    storage,
    fetchImpl: async () => {
      throw new Error('network should not be called for cache hit');
    },
    now: () => 1000,
  });

  const result = await service.loadPlayerData('lotharx');
  assert.equal(result.kind, 'success');
  assert.equal(result.fromCache, true);
  assert.equal(result.questFilter.has('the feud'), true);
  assert.equal(result.questMeta['the feud'].status, 'COMPLETED');
  assert.equal(result.skills.attack, 50);
});
