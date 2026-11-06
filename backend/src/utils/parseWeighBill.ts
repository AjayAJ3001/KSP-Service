/** Parse weighment slips. Trip weight comes from Net, Nett Weight, or Accepted Qty. */

export type WeighBillParse = {
  net_weight_mt: number | null;
  accepted_weight_mt: number | null;
  goods_weight: number | null;
  weight_source: 'ACCEPTED' | 'NET' | null;
  slip_no: string | null;
  vehicle_no: string | null;
  heading_name: string | null;
  party_name: string | null;
  unit_name: string | null;
  bill_date: string | null;
};

const NOISE_NAME = /\b(PRIVATE|LIMITED|PVT|LTD|COMPANY|NUTRITION|INDUSTRIES?|HATCHERIES+|FEEDS?|FARM|TRADERS?|AND|COMMISSION|PRODUCTS?|AGRO|ANIMAL|GOVT|APPROVED)\b/gi;

const STATE_CODES = 'AN|AP|AR|AS|BR|CG|CH|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|OR|PB|PY|RJ|SK|TG|TN|TR|TS|UK|UP|WB';

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

const formatIndianPlate = (compact: string) => {
  const m = compact.match(new RegExp(`^(${STATE_CODES})([0-9]{1,2})([A-Z]{1,3})([0-9]{3,4})$`));
  if (!m) return compact;
  return `${m[1]}${m[2]}${m[3]}${m[4]}`;
};

const plateFromToken = (raw: string) => {
  const compact = normalizeVehicleNo(raw);
  if (compact.length < 8 || compact.length > 11) return null;
  const repaired = compact.replace(/^([A-Z]{2})([0-9OIL]{1,2})([A-Z]{1,3})([0-9OILSBZG]{3,4})$/, (_all, st, dist, series, num) => {
    const d = String(dist).replace(/O/g, '0').replace(/[IL]/g, '1');
    const n = String(num)
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/G/g, '6')
      .replace(/B/g, '8');
    return `${st}${d}${series}${n}`;
  });
  if (!new RegExp(`^(${STATE_CODES})[0-9]{1,2}[A-Z]{1,3}[0-9]{3,4}$`).test(repaired)) return null;
  return formatIndianPlate(repaired);
};

export const extractVehicleNumbers = (rawText: string): string[] => {
  const text = String(rawText || '').toUpperCase();
  const found: string[] = [];
  const add = (value?: string | null) => {
    const token = String(value || '');
    let plate = plateFromToken(token);
    if (!plate) {
      const compact = normalizeVehicleNo(token);
      const embedded = compact.match(new RegExp(`(${STATE_CODES})[0-9OIL]{1,2}[A-Z]{1,3}[0-9OILSBZG]{3,4}`));
      if (embedded) plate = plateFromToken(embedded[0]);
    }
    if (plate && !found.includes(plate)) found.push(plate);
  };

  const labelRe =
    /(?:TRUCK|LORRY|VEHICLE|VECHILE|VEHICAL|VAHICLE|VECICLE|REGN?|REGISTRATION)\s*(?:NO|NUMBER|NUM|NO\.|#)?\s*[:.\-]*\s*([A-Z0-9][A-Z0-9\s./-]{6,18})/g;
  let labeled: RegExpExecArray | null;
  while ((labeled = labelRe.exec(text))) add(labeled[1]);

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/(TRUCK|LORRY|VEHICLE|VECHILE|VEHICAL|VAHICLE|வண்டி|REGN?)/i.test(lines[i])) {
      add(lines[i]);
      add(lines[i + 1] || '');
      add(`${lines[i]} ${lines[i + 1] || ''}`);
    }
  }

  const loose = new RegExp(`(${STATE_CODES})\\s*[-./]?\\s*[0-9OIL]{1,2}\\s*[-./]?\\s*[A-Z]{1,3}\\s*[-./]?\\s*[0-9OILSBZG]{3,4}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = loose.exec(text))) add(m[0]);

  const compact = normalizeVehicleNo(text);
  const compactRe = new RegExp(`(${STATE_CODES})[0-9OIL]{1,2}[A-Z]{1,3}[0-9OILSBZG]{3,4}`, 'g');
  while ((m = compactRe.exec(compact))) add(m[0]);

  return found;
};

export const pickVehicleNo = (rawText: string, expectedVehicleNo?: string | null) => {
  const plates = extractVehicleNumbers(rawText);
  const expected = plateFromToken(expectedVehicleNo || '');
  if (expected) {
    if (plates.some((p) => vehicleNosMatch(p, expected))) return expected;
    const compact = foldPlateChars(normalizeVehicleNo(rawText));
    const expectedFold = foldPlateChars(expected);
    const expectedLooks = [expectedFold, expectedFold.replace(/^T/, '7'), expectedFold.replace(/^TN/, 'IN')];
    if (expectedLooks.some((look) => compact.includes(look))) return expected;
  }
  return plates[0] || null;
};

export const normalizeBillName = (value?: string | null) =>
  String(value || '')
    .toUpperCase()
    .replace(NOISE_NAME, ' ')
    .replace(/[^A-Z0-9]+/g, '')
    .trim();

export const expandNameAliases = (value?: string | null): string[] => {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const compact = normalizeBillName(upper);
  const out = new Set<string>([raw, upper]);
  if (compact === 'KNC' || /(^|[^A-Z0-9])KNC([^A-Z0-9]|$)/.test(upper)) {
    out.add('KNC');
    out.add('KRISHI');
    out.add('KRISHI NUTRITION COMPANY');
    out.add('KRISHI NUTRITION COMPANY PRIVATE LIMITED');
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
    out.add('SAKTHI ANIMAL FEEDS');
  }
  return Array.from(out);
};

const basicNameMatch = (a?: string | null, b?: string | null) => {
  const x = normalizeBillName(a);
  const y = normalizeBillName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 3 && y.includes(x)) return true;
  if (y.length >= 3 && x.includes(y)) return true;
  return false;
};

export const namesLooselyMatch = (a?: string | null, b?: string | null) => {
  const left = expandNameAliases(a);
  const right = expandNameAliases(b);
  for (const x of left) {
    for (const y of right) {
      if (basicNameMatch(x, y)) return true;
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
  const hay = normalizeBillName(haystacks.join(' '));
  const needle = normalizeBillName(selected);
  if (needle.length >= 4 && hay.includes(needle)) return true;
  const words = significantNameWords(selected);
  if (words.length && words.every((w) => hay.includes(w))) return true;
  return words.some((w) => w.length >= 5 && hay.includes(w));
};

const SKIP_HEADING = /MATERIAL RECEIPT|WEIGHMENT|WEIGH SLIP|GATE ENTRY|AN ISO|ISO |REGD|PLOT NO|SF NO|CELL|PHONE|CONTACT|SERIAL NO|SLIP NO|DEVELOPED BY/;

const extractHeading = (lines: string[]) => {
  for (const line of lines.slice(0, 12)) {
    const cleaned = cleanNameValue(line.replace(/^[.\-*:]+/, ''));
    if (!cleaned || cleaned.length < 4 || cleaned.length > 80) continue;
    if (SKIP_HEADING.test(cleaned)) continue;
    if (/^[0-9.:\s/-]+$/.test(cleaned)) continue;
    if (/^(DATE|TIME|GROSS|TARE|NET|PARTY|CUSTOMER|VEHICLE|TRUCK|UNIT)/.test(cleaned)) continue;
    return cleaned;
  }
  return null;
};

const cleanNameValue = (raw?: string | null) => {
  const value = String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(MATERIAL|ITEM NAME|BILL NO|DATE|TRUCK NO|VEHICLE NO)$/i, '')
    .replace(/[:.\-]+$/g, '')
    .replace(/\s+\d{1,2}$/g, '')
    .trim();
  if (!value) return null;
  if (/^(NO|NIL|NA|XXX|--)$/i.test(value)) return null;
  return value.slice(0, 80);
};

const STOP_LABEL = String.raw`(?=\s+(?:MATERIAL|BILL|GATE|TRUCK|VEHICLE|PARTY|CUSTOMER|SUPPLIER|UNIT|PLANT|GROSS|TARE|NET|DATE|ITEM|CHARGES|RST|SERIAL|SLIP|ACCEPTED|RECEIVED|REJECTED|IN TIME|OUT TIME)\b|$)`;

const labeledValue = (text: string, label: RegExp) => {
  const m = text.match(label);
  return m ? cleanNameValue(m[1]) : null;
};

type FieldKind = 'gross' | 'tare' | 'net' | 'accepted';

const GROSS_LABEL = /(?:GROSS(?:\s*(?:WEIGHT|WT))?|FIRST\s*(?:WEIGHT|WT)|1ST\s*(?:WEIGHT|WT))/i;
const TARE_LABEL = /(?:TARE(?:\s*(?:WEIGHT|WT))?|SECOND\s*(?:WEIGHT|WT)|2ND\s*(?:WEIGHT|WT))/i;
const NET_STRICT = /NETT?\s*(?:WEIGHT|WT|WGT)/i;
const NET_SHORT = /(?:^|\s)NETT?(?:\s|:|-|$)/i;
const ACCEPTED_LABEL = /ACCEPTED\s*(?:QTY|QUANTITY|WEIGHT|WT)/i;
const BILL_QTY_LABEL = /BILL\s*(?:QTY|QUANTITY)/i;
const RECEIVED_QTY_LABEL = /RECEIVED\s*(?:QTY|QUANTITY)/i;

const toNumber = (raw: string) => {
  const n = parseFloat(String(raw).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const toMt = (value: number, unitHint?: string | null) => {
  const unit = String(unitHint || '').toUpperCase();
  if (/\b(MT|TONNES?|TONS?)\b/.test(unit) && value < 150) return Math.round(value * 1000) / 1000;
  if (/\b(KG|KGS|KILO|KILOGRAMS?)\b/.test(unit)) return Math.round(value) / 1000;
  if (value >= 150) return Math.round(value) / 1000;
  return Math.round(value * 1000) / 1000;
};

const plausibleMt = (mt: number | null): mt is number => mt != null && mt >= 5 && mt <= 55;

const looksLikeDateOrTime = (token: string, around: string) => {
  if (/^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(token)) return true;
  if (/20\d{2}/.test(token)) return true;
  if (/^\d{1,2}:\d{2}/.test(around)) return true;
  return false;
};

const nearbyUnit = (text: string) => {
  const m = String(text).match(/\b(KGS?|KILOGRAMS?|MT|TONNES?|TONS?)\b/i);
  return m ? m[1] : null;
};

const numbersFrom = (text: string) => {
  const out: Array<{ value: number }> = [];
  const re = /[0-9]{1,6}(?:[.,][0-9]{1,3})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (looksLikeDateOrTime(m[0], text.slice(Math.max(0, m.index - 6), m.index + m[0].length + 10))) continue;
    const value = toNumber(m[0]);
    if (value == null) continue;
    out.push({ value });
  }
  return out;
};

const recoverOcrDigits = (text: string) =>
  text.replace(/\b([A-Z0-9]{4,6})\b/g, (tok) => {
    if (!/[0-9]/.test(tok) && !/[OQDIZLSSGBTE]/.test(tok)) return tok;
    const mapped = tok
      .replace(/[OQD]/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/G/g, '6')
      .replace(/T/g, '7')
      .replace(/[BE]/g, '8');
    if (!/^[0-9]+$/.test(mapped)) return tok;
    const n = parseInt(mapped, 10);
    if (n >= 5000 && n <= 49999) return mapped;
    return tok;
  });

const normalizeOcr = (rawText: string) =>
  recoverOcrDigits(
    String(rawText || '')
      .replace(/[|]/g, ' ')
      .replace(/[–—_]/g, '-')
      .replace(/WE[I1L]GHT/gi, 'WEIGHT')
      .replace(/\bWGT\b/gi, 'WT')
      .replace(/\bN\.?\s*W\.?T\.?\b/gi, 'NET WT')
      .replace(/ACCEP[I1L]ED/gi, 'ACCEPTED')
      .replace(/QUANT[I1L]TY/gi, 'QUANTITY')
      .replace(/F[I1]RST/gi, 'FIRST')
      .replace(/SEC[O0]ND/gi, 'SECOND')
      .replace(/GR[O0]SS/gi, 'GROSS')
      .replace(/T[A4]RE/gi, 'TARE')
      .replace(/\[ES\]/gi, 'KGS')
      .replace(/,/g, (ch, offset, str: string) => {
        const prev = str[offset - 1];
        const next = str[offset + 1];
        if (/\d/.test(prev || '') && /\d/.test(next || '')) return '';
        return ' ';
      })
      .replace(/[:=]+/g, ':')
      .replace(/[ \t]+/g, ' ')
      .toUpperCase()
  );

const fieldFits = (kind: FieldKind, mt: number) => {
  if (kind === 'tare') return mt >= 3 && mt <= 16;
  if (kind === 'gross') return mt >= 18 && mt <= 55;
  if (kind === 'net') return mt >= 8 && mt <= 40;
  return plausibleMt(mt);
};

const chooseFromRow = (kind: FieldKind, nums: Array<{ value: number }>, unit: string | null) => {
  if (!nums.length) return null;
  let picked = nums[0];
  if (nums.length >= 3) {
    if (kind === 'gross') picked = nums[0];
    else if (kind === 'tare') picked = nums[1];
    else if (kind === 'net') picked = nums[nums.length - 1];
    else picked = nums[0];
  }
  const mt = toMt(picked.value, unit);
  return plausibleMt(mt) ? mt : null;
};

const qtyImmediatelyAfter = (text: string, label: RegExp, kind: FieldKind) => {
  const re = new RegExp(
    label.source + String.raw`[:\s.\-]*([0-9]{1,6}(?:[.,][0-9]{1,3})?)\s*(KGS?|KILOGRAMS?|MT|TONNES?|TONS?)?`,
    'i'
  );
  const m = String(text || '').match(re);
  if (!m) return null;
  const value = toNumber(m[1]);
  if (value == null) return null;
  const unit = m[2] || (value >= 150 ? 'KG' : 'MT');
  const mt = toMt(value, unit);
  return fieldFits(kind, mt) ? mt : null;
};

const valueAfterLabel = (lines: string[], label: RegExp, kind: FieldKind) => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(label);
    if (!m || m.index == null) continue;
    const after = line.slice(m.index + m[0].length);
    const unit = nearbyUnit(after) || nearbyUnit(line) || nearbyUnit(lines[i + 1] || '');
    const same = qtyImmediatelyAfter(line, label, kind) || chooseFromRow(kind, numbersFrom(after), unit);
    if (same != null && fieldFits(kind, same)) return same;

    const nextLine = lines[i + 1] || '';
    const nextUnit = nearbyUnit(nextLine) || unit;
    if (GROSS_LABEL.test(nextLine) || TARE_LABEL.test(nextLine) || NET_STRICT.test(nextLine) || ACCEPTED_LABEL.test(nextLine)) {
      continue;
    }
    const fromNext = chooseFromRow(kind, numbersFrom(nextLine), nextUnit);
    if (fromNext != null && fieldFits(kind, fromNext)) return fromNext;
  }
  return null;
};

export function parseWeighBillText(
  rawText: string,
  expectedVehicleNo?: string | null,
  expectedPartyName?: string | null,
  expectedUnitName?: string | null,
  knownUnitNames?: string[] | null
): WeighBillParse {
  const text = normalizeOcr(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const gross_mt = valueAfterLabel(lines, GROSS_LABEL, 'gross');
  const tare_mt = valueAfterLabel(lines, TARE_LABEL, 'tare');
  let net_weight_mt =
    qtyImmediatelyAfter(text, NET_STRICT, 'net') ||
    qtyImmediatelyAfter(text, /NETT?\s*WEIGHT/i, 'net') ||
    valueAfterLabel(lines, NET_STRICT, 'net') ||
    valueAfterLabel(lines, /NETT?\s*WEIGHT/i, 'net') ||
    valueAfterLabel(lines, NET_SHORT, 'net');

  if (gross_mt != null && tare_mt != null) {
    const computed = Math.round((gross_mt - tare_mt) * 1000) / 1000;
    if (plausibleMt(computed)) {
      if (net_weight_mt == null) net_weight_mt = computed;
      else if (Math.abs(net_weight_mt - gross_mt) < 0.05 || Math.abs(net_weight_mt - tare_mt) < 0.05) {
        net_weight_mt = computed;
      }
    }
  }

  if (net_weight_mt == null) {
    const kgNums: number[] = [];
    for (const line of lines) {
      if (/ACCEPTED|BILL\s*QTY|RECEIVED\s*QTY|REJECTED/i.test(line) && !/NETT?/i.test(line)) continue;
      if (
        /SLIP|SERIAL|RST|GATE\s*ENTRY|CHARGES|PHONE|CONTACT|CELL|VEHICLE|TRUCK/i.test(line) &&
        !/GROSS|TARE|NET|WEIGHT|\bWT\b/i.test(line)
      ) continue;
      for (const n of numbersFrom(line)) {
        if (n.value >= 8000 && n.value <= 49999) kgNums.push(n.value);
      }
    }
    const unique = Array.from(new Set(kgNums));
    const grossKg = gross_mt != null ? Math.round(gross_mt * 1000) : (unique.length ? Math.max(...unique) : 0);
    const netKg =
      unique.find((n) => n !== grossKg && n >= 15000 && n < grossKg && (grossKg - n) >= 4000 && (grossKg - n) <= 20000) ||
      (unique.length === 1 && unique[0] >= 18000 && unique[0] <= 33000 ? unique[0] : null);
    if (netKg) net_weight_mt = toMt(netKg, 'KG');
  }

  const accepted_weight_mt =
    qtyImmediatelyAfter(text, ACCEPTED_LABEL, 'accepted') ||
    qtyImmediatelyAfter(text, BILL_QTY_LABEL, 'accepted') ||
    qtyImmediatelyAfter(text, RECEIVED_QTY_LABEL, 'accepted') ||
    valueAfterLabel(lines, ACCEPTED_LABEL, 'accepted') ||
    valueAfterLabel(lines, BILL_QTY_LABEL, 'accepted') ||
    valueAfterLabel(lines, RECEIVED_QTY_LABEL, 'accepted');

  const goods_weight = plausibleMt(net_weight_mt)
    ? net_weight_mt
    : (plausibleMt(accepted_weight_mt) ? accepted_weight_mt : null);
  const weight_source = plausibleMt(net_weight_mt)
    ? 'NET'
    : (plausibleMt(accepted_weight_mt) ? 'ACCEPTED' : null);

  const slipMatch =
    text.match(/GATE\s*ENTRY\s*NO[:\s.-]*([0-9]{4,})/) ||
    text.match(/SLIP\s*NO[:\s.-]*([0-9]{3,})/) ||
    text.match(/SERIAL\s*NO[:\s.-]*([0-9]{3,})/) ||
    text.match(/RST\s*NO[:\s.-]*([0-9]{3,})/) ||
    text.match(/SL\.?\s*NO[:\s.-]*([0-9]{3,})/);

  const vehicle_no = pickVehicleNo(`${rawText}\n${text}`, expectedVehicleNo);

  const heading_name = extractHeading(lines);
  const labeledParty =
    labeledValue(text, new RegExp(String.raw`PARTY\s*NAME[:\s.-]+([A-Z0-9 .&/-]{3,80}?)${STOP_LABEL}`)) ||
    labeledValue(text, new RegExp(String.raw`CUSTOMER\s*NAME[:\s.-]+([A-Z0-9 .&/-]{3,80}?)${STOP_LABEL}`)) ||
    labeledValue(text, new RegExp(String.raw`\bPARTY[:\s.-]+([A-Z0-9 .&/-]{3,80}?)${STOP_LABEL}`));
  const labeledSupplier = labeledValue(
    text,
    new RegExp(String.raw`SUPPLIER\s*NAME[:\s.-]+([A-Z0-9 .&/-]{3,80}?)${STOP_LABEL}`)
  );
  const plantLine = labeledValue(
    text,
    new RegExp(String.raw`PLANT\s*(?:ADD(?:RESS)?|UNIT)?[:\s.-]+([A-Z0-9 ,./()-]{8,120}?)${STOP_LABEL}`)
  );
  const nameSources = [heading_name, labeledParty, labeledSupplier, plantLine, text, rawText];
  const knownUnits = [...(knownUnitNames || [])].filter(Boolean).sort((a, b) => b.length - a.length);
  const matchedKnownUnit =
    (expectedUnitName && nameAppearsOnBill(expectedUnitName, nameSources) ? expectedUnitName : null) ||
    knownUnits.find((unit) => nameAppearsOnBill(unit, nameSources)) ||
    null;
  const party_name =
    (labeledParty && /^KNC$/i.test(labeledParty) ? 'KRISHI NUTRITION COMPANY' : labeledParty) ||
    (expectedPartyName && nameAppearsOnBill(expectedPartyName, nameSources) ? expectedPartyName : null) ||
    heading_name ||
    labeledSupplier;
  const unit_name =
    matchedKnownUnit ||
    (heading_name && labeledParty && !namesLooselyMatch(heading_name, labeledParty) ? heading_name : null) ||
    heading_name;

  const dateMatch =
    text.match(/\bDATE[:\s.-]*([0-3]?\d[-./][0-1]?\d[-./](?:20)?\d{2})/) ||
    text.match(/BILL\s*NO[:\s].*?([0-3]?\d[./][0-1]?\d[./](?:20)?\d{2})/) ||
    text.match(/\b([0-3]?\d[./-][0-1]?\d[./-](?:20)?\d{2})\b/);
  let bill_date: string | null = null;
  if (dateMatch) {
    const parts = String(dateMatch[1]).split(/[./-]/);
    if (parts.length === 3) {
      const [d, m, yRaw] = parts;
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      bill_date = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    }
  }

  return {
    net_weight_mt: plausibleMt(net_weight_mt) ? net_weight_mt : null,
    accepted_weight_mt: plausibleMt(accepted_weight_mt) ? accepted_weight_mt : null,
    goods_weight,
    weight_source,
    slip_no: slipMatch ? String(slipMatch[1]).replace(/\s/g, '') : null,
    vehicle_no,
    heading_name,
    party_name,
    unit_name,
    bill_date,
  };
}
