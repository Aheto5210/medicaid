import { HEARD_ABOUT_OPTIONS, OCCUPATION_SUGGESTIONS } from '../constants/options.js';

const OTHER_LABEL = 'Other';
const MAX_ANALYTICS_ITEMS = 8;

function normalizeBucketKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function sortBucketItems(items = []) {
  return [...items].sort((a, b) => {
    const valueDifference = Number(b.value || 0) - Number(a.value || 0);
    if (valueDifference !== 0) return valueDifference;
    return String(a.label || '').localeCompare(String(b.label || ''));
  });
}

function bucketKnownItems(items = [], knownOptions = [], limit = MAX_ANALYTICS_ITEMS) {
  const knownLookup = new Map(knownOptions.map((option) => [normalizeBucketKey(option), option]));
  const counts = new Map(knownOptions.map((option) => [option, 0]));
  let otherCount = 0;

  for (const item of items) {
    const value = Number(item?.value || 0);
    if (value <= 0) continue;

    const normalized = normalizeBucketKey(item?.label);
    if (!normalized || normalized === 'unknown' || normalized === normalizeBucketKey(OTHER_LABEL)) {
      otherCount += value;
      continue;
    }

    const matchedOption = knownLookup.get(normalized);
    if (matchedOption) {
      counts.set(matchedOption, (counts.get(matchedOption) || 0) + value);
      continue;
    }

    otherCount += value;
  }

  const bucketedItems = sortBucketItems(
    [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .filter((item) => item.value > 0)
  );

  if (otherCount > 0) {
    bucketedItems.push({ label: OTHER_LABEL, value: otherCount });
  }

  return sortBucketItems(bucketedItems).slice(0, limit);
}

export function mapCountsFromPeople(people = [], fieldName) {
  const counts = new Map();

  for (const person of people) {
    const label = String(person?.[fieldName] || '').trim() || 'Unknown';
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return [...counts.entries()].map(([label, value]) => ({ label, value }));
}

export function bucketRegistrationSources(items = []) {
  const knownHeardAbout = HEARD_ABOUT_OPTIONS.filter((option) => normalizeBucketKey(option) !== normalizeBucketKey(OTHER_LABEL));
  return bucketKnownItems(items, knownHeardAbout, knownHeardAbout.length + 1);
}

export function bucketOccupations(items = []) {
  return bucketKnownItems(items, OCCUPATION_SUGGESTIONS);
}
