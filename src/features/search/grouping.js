export const normalizeSeriesKey = (series) => {
  const value = String(series || '').trim();
  return value || 'No series';
};

export const normalizeLengthKey = (length) => {
  const value = String(length || '').trim();
  return value || 'Unknown length';
};

export const getLengthRank = (length) => {
  const key = String(length || '')
    .trim()
    .toLowerCase()
    .replace(/[-\u2013]/g, ' to ')
    .replace(/\s+/g, ' ');
  const order = {
    short: 0,
    'short to medium': 1,
    medium: 2,
    'medium to long': 3,
    long: 4,
    'long to very long': 5,
    'very long': 6,
    'very, very long': 7,
    'very very long': 7,
  };
  return Object.prototype.hasOwnProperty.call(order, key) ? order[key] : 999;
};

export const normalizeCombatKey = (combat) => {
  const value = String(combat || '').trim();
  return value || 'No combat info';
};

export const getCombatRank = (combat) => {
  const raw = String(combat || '')
    .trim()
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');

  if (!raw || raw === 'none') return 0;
  if (raw.includes('scaled')) return 1;
  if (raw.includes('200+')) return 23;

  const match = raw.match(/npc combat level\s+(\d+)/);
  if (!match) return 999;
  const start = Number(match[1]);
  if (Number.isNaN(start)) return 999;
  if (start === 1) return 2;
  if (start >= 2 && start <= 3) return 3;
  if (start >= 4 && start <= 5) return 4;
  if (start >= 6 && start <= 9) return 5;
  if (start >= 10 && start <= 179) return Math.floor(start / 10) + 5;
  if (start >= 200) return 23;
  return 999;
};

export const normalizeMembershipKey = (membership, membersIcon = '') => {
  const value = String(membership || '')
    .trim()
    .toLowerCase();
  if (value === 'free') return 'Free';
  if (value === 'members') return 'Members';
  const icon = String(membersIcon || '').toLowerCase();
  if (icon.includes('f2p') || icon.includes('free')) return 'Free';
  if (icon.includes('p2p') || icon.includes('member')) return 'Members';
  return 'Unknown';
};

export const normalizeProgressKey = (status) => {
  const value = String(status || '')
    .trim()
    .toLowerCase();
  if (value === 'completed' || value === 'complete') return 'COMPLETE';
  if (value === 'started' || value === 'in progress' || value === 'in_progress') {
    return 'IN PROGRESS';
  }
  return 'NOT STARTED';
};

export const getProgressRank = (status) => {
  const normalized = normalizeProgressKey(status);
  const order = {
    'IN PROGRESS': 0,
    'NOT STARTED': 1,
    COMPLETE: 2,
  };
  return Object.prototype.hasOwnProperty.call(order, normalized) ? order[normalized] : 999;
};
