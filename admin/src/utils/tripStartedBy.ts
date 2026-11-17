export const personRoleTag = (role?: string | null): string => {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'Admin';
  if (r === 'OWNER') return 'Owner';
  if (r === 'MANAGER' || r === 'TRANSPORT_USER') return 'Manager';
  return '';
};

export const tripStartedByLabel = (
  name?: string | null,
  role?: string | null
): string => {
  const n = String(name || '').trim();
  if (!n) return '';
  const tag = personRoleTag(role);
  return tag ? `${n} (${tag})` : n;
};
