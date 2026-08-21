import { normalizePersonTag } from '../events/person-tags.js';

export function normalizePeople(people, { normalizeSingleColor }) {
  if (!Array.isArray(people)) return [];

  const seenTags = new Set();
  return people
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const tag = normalizePersonTag(entry.tag);
      if (!tag || seenTags.has(tag)) return null;
      const color = normalizeSingleColor(entry.color);
      if (!color) return null;
      seenTags.add(tag);
      return {
        tag,
        color,
        name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : tag,
        person_entity: typeof entry.person_entity === 'string' && entry.person_entity.trim() ? entry.person_entity.trim() : null
      };
    })
    .filter(Boolean);
}
