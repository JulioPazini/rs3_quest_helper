import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerService } from '../src/features/player/playerService.js';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
};

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  async json() {
    return body;
  },
});

const createFetchByEndpoint = ({
  questPayload,
  profilePayload,
  failAll = false,
  nonOk = false,
}) => {
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    if (failAll) throw new Error('network failed');
    if (nonOk) return jsonResponse({}, false, 500);
    const decoded = decodeURIComponent(String(url || ''));
    if (decoded.includes('/runemetrics/quests?user=')) {
      return jsonResponse(questPayload);
    }
    if (decoded.includes('/runemetrics/profile/profile?user=')) {
      return jsonResponse(profilePayload);
    }
    return jsonResponse({});
  };
  return { fetchImpl, getCalls: () => calls };
};

test('player service handles empty input', async () => {
  const service = createPlayerService({
    fetchImpl: async () => jsonResponse({}),
  });
  const result = await service.loadPlayerData('  ');
  assert.equal(result.kind, 'empty');
});

test('player service loads from network, saves cache and reuses cache', async () => {
  const storage = createMemoryStorage();
  const { fetchImpl, getCalls } = createFetchByEndpoint({
    questPayload: { quests: [{ title: 'The Feud', status: 'COMPLETED', userEligible: true }] },
    profilePayload: { skillvalues: [{ id: 0, level: 60 }] },
  });

  let nowValue = 1000;
  const service = createPlayerService({
    storage,
    fetchImpl,
    now: () => nowValue,
  });

  const first = await service.loadPlayerData('Lotharx');
  assert.equal(first.kind, 'success');
  assert.equal(first.fromCache, false);
  assert.equal(first.questFilter.has('the feud'), true);
  assert.equal(first.skills.attack, 60);
  assert.ok(storage.getItem('playerDataCacheV1'));

  const callsAfterFirst = getCalls();
  nowValue = 1200;
  const second = await service.loadPlayerData('Lotharx');
  assert.equal(second.kind, 'success');
  assert.equal(second.fromCache, true);
  assert.equal(getCalls(), callsAfterFirst, 'expected no network on cache hit');
});

test('player service allows PROFILE_PRIVATE from profile payload', async () => {
  const { fetchImpl } = createFetchByEndpoint({
    questPayload: { quests: [{ title: 'The Feud', status: 'STARTED' }] },
    profilePayload: { error: 'Private profile' },
  });
  const service = createPlayerService({ fetchImpl });
  const result = await service.loadPlayerData('Lotharx');
  assert.equal(result.kind, 'success');
  assert.equal(result.questMeta['the feud'].status, 'STARTED');
});

test('player service returns API errors and malformed payload errors', async () => {
  const privateQuestFetch = createFetchByEndpoint({
    questPayload: { error: 'Private profile' },
    profilePayload: {},
  }).fetchImpl;
  const privateService = createPlayerService({ fetchImpl: privateQuestFetch });
  const privateResult = await privateService.loadPlayerData('Lotharx');
  assert.equal(privateResult.kind, 'error');
  assert.equal(privateResult.code, 'PROFILE_PRIVATE');

  const malformedFetch = createFetchByEndpoint({
    questPayload: { somethingElse: true },
    profilePayload: {},
  }).fetchImpl;
  const malformedService = createPlayerService({ fetchImpl: malformedFetch });
  const malformedResult = await malformedService.loadPlayerData('Lotharx');
  assert.equal(malformedResult.kind, 'error');
  assert.equal(malformedResult.code, 'GENERIC_API_ERROR');
});

test('player service handles network failures', async () => {
  const { fetchImpl } = createFetchByEndpoint({ failAll: true });
  const service = createPlayerService({
    fetchImpl,
    fetchTimeoutMs: 1,
  });
  const result = await service.loadPlayerData('Lotharx');
  assert.equal(result.kind, 'error');
  assert.equal(result.code, 'NETWORK_ERROR');
});

test('player service ignores storage read/write failures', async () => {
  const badStorage = {
    getItem() {
      throw new Error('read failed');
    },
    setItem() {
      throw new Error('write failed');
    },
  };
  const { fetchImpl } = createFetchByEndpoint({
    questPayload: { quests: [{ title: 'Cooks Assistant', status: 'COMPLETED' }] },
    profilePayload: {},
  });
  const service = createPlayerService({
    storage: badStorage,
    fetchImpl,
  });
  const result = await service.loadPlayerData('Lotharx');
  assert.equal(result.kind, 'success');
});
