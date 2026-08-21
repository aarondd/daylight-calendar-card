const TAG_CHARSET_PATTERN = /^[A-Za-z0-9_]+$/;

export function normalizePersonTag(rawTag) {
  if (typeof rawTag !== 'string') return null;
  const stripped = rawTag.trim().replace(/^#/, '').trim();
  if (!stripped || !TAG_CHARSET_PATTERN.test(stripped)) return null;
  return stripped.toLowerCase();
}

const tagRegexCache = new Map();

function getTagRegex(normalizedTag) {
  let regex = tagRegexCache.get(normalizedTag);
  if (!regex) {
    regex = new RegExp(`(?<![\\w#])#${normalizedTag}(?![\\w#])`, 'i');
    tagRegexCache.set(normalizedTag, regex);
  }
  return regex;
}

export function findTaggedPersonKeys(event, peopleConfig) {
  const people = Array.isArray(peopleConfig) ? peopleConfig : [];
  if (!event || people.length === 0) return new Set();

  const haystacks = [event.summary, event.description].filter((value) => typeof value === 'string');
  const found = new Set();
  people.forEach((person) => {
    const tag = person?.tag;
    if (!tag || found.has(tag)) return;
    const regex = getTagRegex(tag);
    if (haystacks.some((text) => regex.test(text))) found.add(tag);
  });
  return found;
}

export function matchTaggedPeople(event, peopleConfig) {
  const people = Array.isArray(peopleConfig) ? peopleConfig : [];
  const foundTags = findTaggedPersonKeys(event, people);
  if (foundTags.size === 0) return [];
  return people.filter((person) => foundTags.has(person?.tag));
}

export function getPersonColorForEvent(event, peopleConfig) {
  const matches = matchTaggedPeople(event, peopleConfig);
  return matches[0]?.color ?? null;
}

export function addPersonTagToDescription(description, tag) {
  const normalizedTag = normalizePersonTag(tag);
  if (!normalizedTag) return description || '';
  const base = typeof description === 'string' ? description : '';
  if (getTagRegex(normalizedTag).test(base)) return base;
  const trimmed = base.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n#${normalizedTag}` : `#${normalizedTag}`;
}

export function removePersonTagFromDescription(description, tag) {
  const normalizedTag = normalizePersonTag(tag);
  const base = typeof description === 'string' ? description : '';
  if (!normalizedTag) return base;
  const ownLineRegex = new RegExp(`(?:^|\\n)[ \\t]*(?<![\\w#])#${normalizedTag}(?![\\w#])[ \\t]*(?=\\n|$)`, 'gi');
  const inlineRegex = new RegExp(`[ \\t]*(?<![\\w#])#${normalizedTag}(?![\\w#])[ \\t]*`, 'gi');
  return base
    .replace(ownLineRegex, '')
    .replace(inlineRegex, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

export function syncPersonTagsInDescription(description, { peopleConfig, checkedTagSet }) {
  const people = Array.isArray(peopleConfig) ? peopleConfig : [];
  const checked = checkedTagSet instanceof Set ? checkedTagSet : new Set(checkedTagSet || []);
  let next = typeof description === 'string' ? description : '';
  people.forEach((person) => {
    const tag = person?.tag;
    if (!tag) return;
    next = checked.has(tag) ? addPersonTagToDescription(next, tag) : removePersonTagFromDescription(next, tag);
  });
  return next;
}
