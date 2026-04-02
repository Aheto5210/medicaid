export function splitFullName(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };

  if (trimmed.includes(',')) {
    const [lastName, firstName] = trimmed.split(',').map((part) => part.trim());
    return {
      firstName: firstName || lastName || trimmed,
      lastName: lastName || firstName || trimmed
    };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  };
}

export function splitNameFields(value) {
  const { firstName, lastName } = splitFullName(value);
  return {
    otherNames: firstName,
    surname: lastName
  };
}

export function buildFullName(otherNames = '', surname = '') {
  return [String(otherNames || '').trim(), String(surname || '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function buildPersonDisplayName(person = {}) {
  return buildFullName(
    person.first_name || person.other_names || '',
    person.last_name || ''
  );
}

export function buildNhisDisplayName(record = {}) {
  return buildFullName(record.other_names || '', record.surname || record.last_name || '')
    || String(record.full_name || '').trim();
}
