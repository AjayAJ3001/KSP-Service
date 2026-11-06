const NOISE_NAME = /\b(PRIVATE|LIMITED|PVT|LTD|COMPANY|NUTRITION|INDUSTRIES?|HATCHERIES+|FEEDS?|FARM|TRADERS?|AND|COMMISSION|PRODUCTS?|AGRO|ANIMAL|GOVT|APPROVED)\b/gi;

export const normalizeVehicleNo = (value?: string | null) =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const foldPlateChars = (value: string) =>
  String(value || '')
    .toUpperCase()
    .replace(/[OQD]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/G/g, '6')
    .replace(/[BE]/g, '8');

export const vehicleNosMatch = (a?: string | null, b?: string | null) => {
  const x = normalizeVehicleNo(a);
  const y = normalizeVehicleNo(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return foldPlateChars(x) === foldPlateChars(y);
};

const expandNameAliases = (value?: string | null): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const compact = upper.replace(NOISE_NAME, ' ').replace(/[^A-Z0-9]+/g, '');
  const out = new Set<string>([raw, upper]);
  if (compact === 'KNC' || /(^|[^A-Z0-9])KNC([^A-Z0-9]|$)/.test(upper)) {
    out.add('KNC');
    out.add('KRISHI');
    out.add('KRISHI NUTRITION COMPANY');
  }
  if (compact.includes('KRISHI')) {
    out.add('KNC');
    out.add('KRISHI');
    out.add('KRISHI NUTRITION COMPANY');
  }
  if (compact.includes('SAKTH')) {
    out.add('SAKTHE');
    out.add('SAKTHI');
    out.add('SAKTHE ANIMAL FEEDS');
  }
  return Array.from(out);
};

export const namesLooselyMatch = (a?: string | null, b?: string | null) => {
  const clean = (s?: string | null) =>
    String(s || '')
      .toUpperCase()
      .replace(NOISE_NAME, ' ')
      .replace(/[^A-Z0-9]+/g, '')
      .trim();
  const basic = (xRaw?: string | null, yRaw?: string | null) => {
    const x = clean(xRaw);
    const y = clean(yRaw);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.length >= 3 && y.includes(x)) return true;
    if (y.length >= 3 && x.includes(y)) return true;
    return false;
  };
  for (const x of expandNameAliases(a)) {
    for (const y of expandNameAliases(b)) {
      if (basic(x, y)) return true;
    }
  }
  return false;
};

const significantNameWords = (value?: string | null) =>
  String(value || '')
    .toUpperCase()
    .replace(NOISE_NAME, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);

export const nameAppearsOnBill = (selected?: string | null, sources: Array<string | null | undefined> = []) => {
  if (!selected) return false;
  const haystacks = sources.filter(Boolean).map((s) => String(s));
  if (!haystacks.length) return false;
  if (haystacks.some((h) => namesLooselyMatch(h, selected))) return true;
  const hay = String(haystacks.join(' '))
    .toUpperCase()
    .replace(NOISE_NAME, ' ')
    .replace(/[^A-Z0-9]+/g, '');
  const needle = String(selected)
    .toUpperCase()
    .replace(NOISE_NAME, ' ')
    .replace(/[^A-Z0-9]+/g, '');
  if (needle.length >= 4 && hay.includes(needle)) return true;
  const words = significantNameWords(selected);
  if (words.length && words.every((w) => hay.includes(w))) return true;
  return words.some((w) => w.length >= 5 && hay.includes(w));
};

export const billMatchesTrip = (opts: {
  selectedTruck?: string | null;
  selectedParty?: string | null;
  selectedUnit?: string | null;
  billTruck?: string | null;
  billParty?: string | null;
  billUnit?: string | null;
  billHeading?: string | null;
  billOcr?: string | null;
}) => {
  const selectedTruck = normalizeVehicleNo(opts.selectedTruck);
  const billTruck = normalizeVehicleNo(opts.billTruck);
  if (!billTruck) {
    return { ok: false, title: 'Truck Not Found On Bill', message: 'Could not read the truck / vehicle number from the uploaded bill. Capture Truck No or Vehicle No clearly and try again.' };
  }
  if (!selectedTruck) {
    return { ok: false, title: 'Select Truck First', message: 'Select the truck number first, then upload the weighment bill.' };
  }
  if (!vehicleNosMatch(selectedTruck, billTruck)) {
    return {
      ok: false,
      title: 'Truck Number Mismatch',
      message: `Selected truck ${opts.selectedTruck} does not match the bill truck / vehicle no ${opts.billTruck}. Trip entry cannot start.`,
    };
  }

  const selectedParty = opts.selectedParty || '';
  const selectedUnit = opts.selectedUnit || '';
  if (!selectedParty || !selectedUnit) {
    return { ok: false, title: 'Select Party And Unit', message: 'Select party and unit first, then upload the weighment bill so names can be checked.' };
  }

  const sources = [opts.billParty, opts.billUnit, opts.billHeading, opts.billOcr];
  const partyOk = nameAppearsOnBill(selectedParty, sources);
  const unitOk = nameAppearsOnBill(selectedUnit, sources);
  if (!partyOk && !unitOk) {
    return {
      ok: false,
      title: 'Party And Unit Mismatch',
      message: `Bill party (${opts.billParty || opts.billHeading || 'not found'}) and unit (${opts.billUnit || opts.billHeading || 'not found'}) do not match selected party (${selectedParty}) and unit (${selectedUnit}). Trip entry cannot start.`,
    };
  }
  if (!partyOk) {
    return {
      ok: false,
      title: 'Party Name Mismatch',
      message: `Party on the bill (${opts.billParty || opts.billHeading || 'not found'}) does not match selected party (${selectedParty}). Trip entry cannot start.`,
    };
  }
  if (!unitOk) {
    return {
      ok: false,
      title: 'Unit Name Mismatch',
      message: `Unit / heading on the bill (${opts.billUnit || opts.billHeading || 'not found'}) does not match selected unit (${selectedUnit}). Trip entry cannot start.`,
    };
  }

  return { ok: true, title: '', message: '' };
};
