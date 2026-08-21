import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePersonTag,
  findTaggedPersonKeys,
  matchTaggedPeople,
  getPersonColorForEvent,
  addPersonTagToDescription,
  removePersonTagFromDescription,
  syncPersonTagsInDescription
} from './src/events/person-tags.js';
import { normalizePeople } from './src/people/people-config.js';
import { normalizeSingleColor } from './src/utils/color-utils.js';

const PEOPLE = [
  { tag: 'soraya', color: '#E91E63', name: 'Soraya' },
  { tag: 'jasper', color: '#2196F3', name: 'Jasper' },
  { tag: 'mia', color: '#4CAF50', name: 'Mia' }
];

test('normalizePersonTag strips leading hash, trims, lowercases, and rejects invalid charsets', () => {
  assert.equal(normalizePersonTag('#Soraya '), 'soraya');
  assert.equal(normalizePersonTag('  jasper'), 'jasper');
  assert.equal(normalizePersonTag('so raya'), null);
  assert.equal(normalizePersonTag('so!raya'), null);
  assert.equal(normalizePersonTag(''), null);
  assert.equal(normalizePersonTag(null), null);
});

test('findTaggedPersonKeys matches tags in summary and description independently and dedupes', () => {
  assert.deepEqual(findTaggedPersonKeys({ summary: 'Pickup #soraya' }, PEOPLE), new Set(['soraya']));
  assert.deepEqual(findTaggedPersonKeys({ description: 'Pickup #soraya' }, PEOPLE), new Set(['soraya']));
  assert.deepEqual(findTaggedPersonKeys({ summary: '#soraya', description: '#soraya' }, PEOPLE), new Set(['soraya']));
  assert.deepEqual(findTaggedPersonKeys({ summary: '#soraya #jasper' }, PEOPLE), new Set(['soraya', 'jasper']));
});

test('findTaggedPersonKeys is case-insensitive', () => {
  assert.deepEqual(findTaggedPersonKeys({ description: '#SORAYA' }, PEOPLE), new Set(['soraya']));
  assert.deepEqual(findTaggedPersonKeys({ description: '#Soraya' }, PEOPLE), new Set(['soraya']));
});

test('findTaggedPersonKeys enforces word boundaries and rejects substring collisions', () => {
  assert.deepEqual(findTaggedPersonKeys({ description: '#sorayathon' }, PEOPLE), new Set());
  assert.deepEqual(findTaggedPersonKeys({ description: '#soraya2' }, PEOPLE), new Set());
  assert.deepEqual(findTaggedPersonKeys({ description: 'foo#soraya' }, PEOPLE), new Set());
  assert.deepEqual(findTaggedPersonKeys({ description: 'Pickup #soraya today' }, PEOPLE), new Set(['soraya']));
});

test('findTaggedPersonKeys never matches an unconfigured hashtag', () => {
  assert.deepEqual(findTaggedPersonKeys({ description: '#grocery #vacation' }, PEOPLE), new Set());
});

test('matchTaggedPeople returns matches in config-declared order, not text order', () => {
  const event = { description: '#jasper #soraya' };
  const matches = matchTaggedPeople(event, PEOPLE);
  assert.deepEqual(matches.map((p) => p.tag), ['soraya', 'jasper']);
});

test('getPersonColorForEvent returns the first config-order match, or null when unmatched', () => {
  assert.equal(getPersonColorForEvent({ description: '#jasper #soraya' }, PEOPLE), '#E91E63');
  assert.equal(getPersonColorForEvent({ description: '#jasper' }, PEOPLE), '#2196F3');
  assert.equal(getPersonColorForEvent({ description: 'no tags here' }, PEOPLE), null);
  assert.equal(getPersonColorForEvent(null, PEOPLE), null);
});

test('addPersonTagToDescription appends a tag once and is idempotent', () => {
  const once = addPersonTagToDescription('Pack lunch', 'soraya');
  assert.equal(once, 'Pack lunch\n#soraya');
  assert.equal(addPersonTagToDescription(once, 'soraya'), once);
});

test('removePersonTagFromDescription strips only the targeted tag and leaves unrelated text/hashtags intact', () => {
  assert.equal(removePersonTagFromDescription('Pack lunch\n#soraya', 'soraya'), 'Pack lunch');
  assert.equal(removePersonTagFromDescription('Pack lunch', 'soraya'), 'Pack lunch');
  assert.equal(removePersonTagFromDescription('Buy milk #grocery\n#soraya', 'soraya'), 'Buy milk #grocery');
});

test('removePersonTagFromDescription removing a middle tag preserves single-newline separation', () => {
  const description = 'Errand\n#soraya\n#jasper\n#mia';
  assert.equal(removePersonTagFromDescription(description, 'jasper'), 'Errand\n#soraya\n#mia');
});

test('description tag helpers round-trip cleanly without accumulating whitespace', () => {
  let description = 'Trip to store';
  description = addPersonTagToDescription(description, 'soraya');
  description = addPersonTagToDescription(description, 'jasper');
  description = removePersonTagFromDescription(description, 'jasper');
  description = addPersonTagToDescription(description, 'jasper');
  assert.equal(description, 'Trip to store\n#soraya\n#jasper');

  const cleared = removePersonTagFromDescription(removePersonTagFromDescription(description, 'jasper'), 'soraya');
  assert.equal(cleared, 'Trip to store');
});

test('syncPersonTagsInDescription adds checked tags and removes unchecked tags in one pass', () => {
  const added = syncPersonTagsInDescription('Errand', { peopleConfig: PEOPLE, checkedTagSet: new Set(['soraya', 'jasper']) });
  assert.equal(added, 'Errand\n#soraya\n#jasper');

  const partiallyUnchecked = syncPersonTagsInDescription(added, { peopleConfig: PEOPLE, checkedTagSet: new Set(['jasper']) });
  assert.equal(partiallyUnchecked, 'Errand\n#jasper');

  const untouched = syncPersonTagsInDescription(partiallyUnchecked, { peopleConfig: PEOPLE, checkedTagSet: new Set(['jasper']) });
  assert.equal(untouched, partiallyUnchecked);
});

test('normalizePeople drops entries with no usable tag or color, and dedupes by tag (first wins)', () => {
  const result = normalizePeople([
    { tag: 'soraya', color: '#e91e63', name: 'Soraya' },
    { tag: '', color: '#000000', name: 'No tag' },
    { tag: 'jasper', color: '', name: 'No color' },
    { tag: '#Soraya', color: '#123456', name: 'Duplicate tag' }
  ], { normalizeSingleColor });

  assert.deepEqual(result, [
    { tag: 'soraya', color: '#e91e63', name: 'Soraya', person_entity: null }
  ]);
});

test('normalizePeople preserves person_entity and falls back name to tag', () => {
  const result = normalizePeople([
    { tag: 'jasper', color: '#2196f3', person_entity: 'person.jasper' }
  ], { normalizeSingleColor });

  assert.deepEqual(result, [
    { tag: 'jasper', color: '#2196f3', name: 'jasper', person_entity: 'person.jasper' }
  ]);
});
