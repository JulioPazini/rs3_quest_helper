import {
  normalizeSeriesKey,
  normalizeLengthKey,
  getLengthRank,
  normalizeCombatKey,
  getCombatRank,
  normalizeMembershipKey,
  normalizeProgressKey,
  getProgressRank,
} from './grouping.js';

export const getFilteredResults = ({
  questList,
  playerQuestFilter,
  playerQuestMeta,
  searchQuery,
  selectedSeries,
  normalizeTitleKey,
}) => {
  let source = (questList || []).slice();
  if (playerQuestFilter && playerQuestFilter.size > 0) {
    source = source.filter((q) => playerQuestFilter.has(normalizeTitleKey(q.title)));
  }

  const filtered = source
    .filter((q) => !searchQuery || q.title.toLowerCase().includes(searchQuery))
    .map((q) => {
      const meta = playerQuestMeta?.[normalizeTitleKey(q.title)] || null;
      if (!meta) return q;
      return {
        ...q,
        playerStatus: meta.status || '',
        playerUserEligible: typeof meta.userEligible === 'boolean' ? meta.userEligible : null,
      };
    });

  const allowedModes = new Set([
    'alphabetical',
    'series',
    'length',
    'combat',
    'membership',
    'progress',
  ]);
  const mode = allowedModes.has(selectedSeries) ? selectedSeries : 'alphabetical';

  if (mode === 'alphabetical') {
    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  const getGroupValue = (item) => {
    if (mode === 'series') return normalizeSeriesKey(item.series);
    if (mode === 'length') return normalizeLengthKey(item.length);
    if (mode === 'combat') return normalizeCombatKey(item.combat);
    if (mode === 'membership') {
      return normalizeMembershipKey(item.membership, item.membersIcon);
    }
    if (mode === 'progress') {
      return normalizeProgressKey(item.playerStatus);
    }
    return '';
  };

  return filtered.sort((a, b) => {
    const aGroup = getGroupValue(a);
    const bGroup = getGroupValue(b);
    if (mode === 'length') {
      const aRank = getLengthRank(aGroup);
      const bRank = getLengthRank(bGroup);
      if (aRank !== bRank) return aRank - bRank;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    } else if (mode === 'combat') {
      const aRank = getCombatRank(aGroup);
      const bRank = getCombatRank(bGroup);
      if (aRank !== bRank) return aRank - bRank;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    } else if (mode === 'progress') {
      const aRank = getProgressRank(a.playerStatus);
      const bRank = getProgressRank(b.playerStatus);
      if (aRank !== bRank) return aRank - bRank;
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
    } else if (aGroup !== bGroup) {
      return aGroup.localeCompare(bGroup);
    }
    return a.title.localeCompare(b.title);
  });
};
