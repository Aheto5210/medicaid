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
