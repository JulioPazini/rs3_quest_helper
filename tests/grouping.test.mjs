import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSeriesKey,
  getLengthRank,
  getCombatRank,
  normalizeMembershipKey,
} from '../src/features/search/grouping.js';

test('normalizeSeriesKey provides fallback label', () => {
  assert.equal(normalizeSeriesKey(''), 'No series');
  assert.equal(normalizeSeriesKey('Desert'), 'Desert');
});

test('getLengthRank orders known labels', () => {
  assert.ok(getLengthRank('Short') < getLengthRank('Long'));
  assert.equal(getLengthRank('Very, Very Long'), 7);
});

test('getCombatRank handles key buckets', () => {
  assert.equal(getCombatRank('None'), 0);
  assert.equal(getCombatRank('NPC combat level scaled'), 1);
  assert.equal(getCombatRank('NPC combat level 110-119'), 16);
  assert.equal(getCombatRank('NPC combat level 200+'), 23);
});

test('normalizeMembershipKey infers from icon or text', () => {
  assert.equal(normalizeMembershipKey('members', ''), 'Members');
  assert.equal(normalizeMembershipKey('', '/images/thumb/F2P_icon.png'), 'Free');
  assert.equal(normalizeMembershipKey('', '/images/thumb/P2P_icon.png'), 'Members');
});
