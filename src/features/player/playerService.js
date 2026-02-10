const DEFAULT_PLAYER_CACHE_KEY = 'playerDataCacheV1';
const DEFAULT_PLAYER_CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PLAYER_FETCH_TIMEOUT_MS = 3500;

export const normalizeTitleKey = (title) =>
  String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const SKILL_INDEX_TO_NAME = [
  'attack',
  'defence',
  'strength',
  'constitution',
  'ranged',
  'prayer',
  'magic',
  'cooking',
  'woodcutting',
  'fletching',
  'fishing',
  'firemaking',
  'crafting',
  'smithing',
  'mining',
  'herblore',
  'agility',
  'thieving',
  'slayer',
  'farming',
  'runecrafting',
  'hunter',
  'construction',
  'summoning',
  'dungeoneering',
  'divination',
  'invention',
  'archaeology',
  'necromancy',
];

export const parseSkillValues = (payload) => {
  const list = payload?.skillvalues;
  if (!Array.isArray(list)) return {};
  const skills = {};
  list.forEach((entry) => {
    const idx = Number(entry?.id);
    const skillName = SKILL_INDEX_TO_NAME[idx];
    if (!skillName) return;
    const levelValue = Number(entry?.level);
    if (!Number.isFinite(levelValue)) return;
    skills[skillName] = levelValue;
  });
  return skills;
};

export const detectPlayerApiError = (payload) => {
  const raw = String(payload?.error || payload?.message || '').toLowerCase();
  if (!raw) return '';
  if (raw.includes('private')) return 'PROFILE_PRIVATE';
  if (raw.includes('no profile') || raw.includes('not found')) return 'USER_NOT_FOUND';
  return 'GENERIC_API_ERROR';
};

const createMemoryStorage = () => {
  const memory = new Map();
  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      memory.set(key, String(value));
    },
  };
};

export const createPlayerService = (config = {}) => {
  const {
    cacheKey = DEFAULT_PLAYER_CACHE_KEY,
    cacheTtlMs = DEFAULT_PLAYER_CACHE_TTL_MS,
    fetchTimeoutMs = DEFAULT_PLAYER_FETCH_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    storage = globalThis.localStorage || createMemoryStorage(),
    now = () => Date.now(),
  } = config;

  const fetchJsonWithTimeout = async (url, timeoutMs) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const fetchJsonWithCorsFallback = async (url) => {
    const attempts = [`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`];
    let lastError = null;
    for (const candidate of attempts) {
      try {
        return await fetchJsonWithTimeout(candidate, fetchTimeoutMs);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Failed to fetch player data');
  };

  const getCache = () => {
    try {
      const raw = storage.getItem(cacheKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  };

  const setCache = (cache) => {
    try {
      storage.setItem(cacheKey, JSON.stringify(cache || {}));
    } catch (_err) {
      // ignore storage errors
    }
  };

  const readCacheEntry = (usernameKey) => {
    const cache = getCache();
    const entry = cache[usernameKey];
    if (!entry || !entry.ts) return null;
    if (now() - entry.ts > cacheTtlMs) return null;
    return entry;
  };

  const saveCacheEntry = (usernameKey, payload) => {
    const cache = getCache();
    cache[usernameKey] = { ...(payload || {}), ts: now() };
    setCache(cache);
  };

  const loadPlayerData = async (playerName) => {
    const username = String(playerName || '').trim();
    const usernameKey = username.toLowerCase();

    if (!username) {
      return { kind: 'empty' };
    }

    const cached = readCacheEntry(usernameKey);
    if (cached) {
      return {
        kind: 'success',
        fromCache: true,
        username,
        ts: cached.ts || now(),
        questFilter: new Set(cached.questFilter || []),
        questMeta: cached.questMeta || {},
        skills: cached.skills || {},
      };
    }

    const questEndpoint =
      'https://apps.runescape.com/runemetrics/quests?user=' + encodeURIComponent(username);
    const profileEndpoint =
      'https://apps.runescape.com/runemetrics/profile/profile?user=' + encodeURIComponent(username);

    try {
      const [questPayload, profilePayload] = await Promise.all([
        fetchJsonWithCorsFallback(questEndpoint),
        fetchJsonWithCorsFallback(profileEndpoint),
      ]);

      const questApiError = detectPlayerApiError(questPayload);
      const profileApiError = detectPlayerApiError(profilePayload);
      if (questApiError || profileApiError) {
        return {
          kind: 'error',
          username,
          code: profileApiError || questApiError,
        };
      }

      const rows = Array.isArray(questPayload) ? questPayload : questPayload?.quests;
      if (!Array.isArray(rows)) {
        if (questPayload && questPayload.error) {
          return { kind: 'error', username, code: 'GENERIC_API_ERROR' };
        }
        return { kind: 'error', username, code: 'GENERIC_API_ERROR' };
      }

      const nextFilter = new Set();
      const nextMeta = {};
      rows.forEach((quest) => {
        const title = String(quest?.title || '').trim();
        if (!title) return;
        const key = normalizeTitleKey(title);
        nextFilter.add(key);
        nextMeta[key] = {
          status: String(quest?.status || ''),
          userEligible: quest?.userEligible,
        };
      });

      const result = {
        kind: 'success',
        fromCache: false,
        username,
        ts: now(),
        questFilter: nextFilter,
        questMeta: nextMeta,
        skills: parseSkillValues(profilePayload),
      };

      saveCacheEntry(usernameKey, {
        questFilter: Array.from(result.questFilter),
        questMeta: result.questMeta,
        skills: result.skills,
      });

      return result;
    } catch (_err) {
      return { kind: 'error', username, code: 'NETWORK_ERROR' };
    }
  };

  return {
    loadPlayerData,
  };
};
