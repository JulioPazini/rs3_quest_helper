import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSeriesKey,
  normalizeLengthKey,
  getLengthRank,
  normalizeCombatKey,
  getCombatRank,
  normalizeMembershipKey,
  normalizeProgressKey,
  getProgressRank,
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

test('normalize keys provide expected fallbacks', () => {
  assert.equal(normalizeLengthKey(''), 'Unknown length');
  assert.equal(normalizeCombatKey(''), 'No combat info');
  assert.equal(normalizeProgressKey(''), 'NOT STARTED');
  assert.equal(normalizeProgressKey('in_progress'), 'IN PROGRESS');
});

test('getLengthRank handles formatting variants and unknowns', () => {
  assert.equal(getLengthRank('Short-Medium'), 1);
  assert.equal(getLengthRank('Very very long'), 7);
  assert.equal(getLengthRank('Something else'), 999);
});

test('getCombatRank covers ranges and fallbacks', () => {
  assert.equal(getCombatRank('NPC combat level 1'), 2);
  assert.equal(getCombatRank('NPC combat level 2'), 3);
  assert.equal(getCombatRank('NPC combat level 5'), 4);
  assert.equal(getCombatRank('NPC combat level 8'), 5);
  assert.equal(getCombatRank('NPC combat level 180'), 999);
  assert.equal(getCombatRank('NPC combat level ???'), 999);
});

test('progress rank ordering and fallback', () => {
  assert.equal(getProgressRank('started'), 0);
  assert.equal(getProgressRank('not-started'), 1);
  assert.equal(getProgressRank('completed'), 2);
});
