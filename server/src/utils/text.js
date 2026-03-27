function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const KNOWN_ACRONYMS = new Set(['NHIS', 'SNNIT', 'ID', 'EWC', 'GPS']);

function capitalizeWordSegment(segment) {
  if (!segment || !/[A-Za-z]/.test(segment)) return segment;

  const upper = segment.toUpperCase();
  if (KNOWN_ACRONYMS.has(upper)) {
    return upper;
  }

  // Keep mixed alphanumeric identifiers unchanged.
  if (/^[A-Z0-9]+$/.test(segment) && /\d/.test(segment)) {
    return segment;
  }

  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

function capitalizeCompoundWord(word) {
  if (!word) return word;

  const separators = /([\-/'().&])/g;
  const separatorToken = /^[-/'().&]$/;
  return word
    .split(separators)
    .map((part) => (separatorToken.test(part) ? part : capitalizeWordSegment(part)))
    .join('');
}

export function titleCaseText(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  return normalized
    .split(' ')
    .map(capitalizeCompoundWord)
    .join(' ');
}

export function lowerCaseText(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized.toLowerCase();
}

export function cleanedText(value) {
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}
