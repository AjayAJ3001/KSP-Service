/** Parse weighment slips. Trip weight comes from Net / Nett / Net Weight only. */

export type WeighBillParse = {
  net_weight_mt: number | null;
  accepted_weight_mt: number | null;
  goods_weight: number | null;
  weight_source: 'ACCEPTED' | 'NET' | null;
  slip_no: string | null;
  vehicle_no: string | null;
};

type FieldKind = 'gross' | 'tare' | 'net' | 'accepted';

const GROSS_LABEL = /(?:GROSS(?:\s*(?:WEIGHT|WT))?|FIRST\s*(?:WEIGHT|WT)|1ST\s*(?:WEIGHT|WT))/i;
const TARE_LABEL = /(?:TARE(?:\s*(?:WEIGHT|WT))?|SECOND\s*(?:WEIGHT|WT)|2ND\s*(?:WEIGHT|WT))/i;
const NET_STRICT = /NETT?\s*(?:WEIGHT|WT|WGT)/i;
const NET_SHORT = /(?:^|\s)NETT?(?:\s|:|-|$)/i;
const ACCEPTED_LABEL = /ACCEPTED\s*(?:QTY|QUANTITY|WEIGHT|WT)/i;

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

const valueAfterLabel = (lines: string[], label: RegExp, kind: FieldKind) => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(label);
    if (!m || m.index == null) continue;
    const after = line.slice(m.index + m[0].length);
    const unit = nearbyUnit(after) || nearbyUnit(line) || nearbyUnit(lines[i + 1] || '');
    const same = chooseFromRow(kind, numbersFrom(after), unit);
    if (same != null && fieldFits(kind, same) && numbersFrom(after).length <= 2) return same;
    if (same != null && kind === 'net' && fieldFits(kind, same) && numbersFrom(after).length >= 3) return same;

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

export function parseWeighBillText(rawText: string): WeighBillParse {
  const text = normalizeOcr(rawText);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const gross_mt = valueAfterLabel(lines, GROSS_LABEL, 'gross');
  const tare_mt = valueAfterLabel(lines, TARE_LABEL, 'tare');
  let net_weight_mt =
    valueAfterLabel(lines, NET_STRICT, 'net') ||
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

  const accepted_weight_mt = valueAfterLabel(lines, ACCEPTED_LABEL, 'accepted');

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

  const vehicleMatch = text.match(/\b(TN\s*[0-9]{2}\s*[A-Z]{1,3}\s*[0-9]{3,4})\b/);

  return {
    net_weight_mt: plausibleMt(net_weight_mt) ? net_weight_mt : null,
    accepted_weight_mt: plausibleMt(accepted_weight_mt) ? accepted_weight_mt : null,
    goods_weight,
    weight_source,
    slip_no: slipMatch ? String(slipMatch[1]).replace(/\s/g, '') : null,
    vehicle_no: vehicleMatch ? vehicleMatch[1].replace(/\s/g, '') : null,
  };
}
