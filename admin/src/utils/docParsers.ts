/**
 * Intelligent Document Parsers for Indian Transport & Fleet Documents
 * Supports: RC, FC, Road Tax, TDS, Bank Passbook/Cheque, PAN Card, Driving License
 */

export interface ParsedRcData {
  rc_number?: string;
  rc_reg_date?: string; // YYYY-MM-DD
  raw_text?: string;
}

export interface ParsedFcData {
  fc_number?: string;
  fc_expiry_date?: string; // YYYY-MM-DD
  raw_text?: string;
}

export interface ParsedTaxData {
  tax_expiry_date: string; // YYYY-MM-DD (Defaults to March 31st)
  vehicle_number?: string;
  raw_text?: string;
}

export interface ParsedTdsData {
  tds_number?: string;
  tds_expiry_date: string; // YYYY-MM-DD (March 31st)
  raw_text?: string;
}

export interface ParsedBankData {
  account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  raw_text?: string;
}

export interface ParsedPanData {
  pan_number?: string;
  account_holder_name?: string;
  raw_text?: string;
}

export interface ParsedLicenseData {
  license_number?: string;
  license_expiry_date?: string; // YYYY-MM-DD
  holder_name?: string;
  raw_text?: string;
}

export interface ParsedInsuranceData {
  policy_number?: string;
  expiry_date?: string; // YYYY-MM-DD
  insurer_name?: string;
  raw_text?: string;
}

export interface ParsedPermitData {
  permit_number?: string;
  expiry_date?: string; // YYYY-MM-DD
  raw_text?: string;
}

// ─── Helper: Get Upcoming March 31st ─────────────────────────────────────────
// User rule: Road Tax and TDS expire March 31st every year
export const getNextMarch31st = (refDate = new Date()): string => {
  const y = refDate.getFullYear();
  // Month 2 is March (0-indexed in JS: 0=Jan, 1=Feb, 2=Mar)
  const march31ThisYear = new Date(y, 2, 31, 23, 59, 59);
  if (refDate.getTime() <= march31ThisYear.getTime()) {
    return `${y}-03-31`;
  }
  return `${y + 1}-03-31`;
};

// ─── Helper: Parse Indian Date to YYYY-MM-DD ─────────────────────────────────
export const parseIndianDate = (text?: string | null): string | null => {
  if (!text) return null;
  const clean = text.trim();

  // YYYY-MM-DD format (e.g. 2010-04-08, 2010/04/08)
  const isoMatch = clean.match(/\b(20\d{2}|19\d{2})\s*[-/.]\s*(0?[1-9]|1[0-2])\s*[-/.]\s*(0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (handles spaces like 08 - 04 - 2010)
  const dmyMatch = clean.match(/\b(0?[1-9]|[12]\d|3[01])\s*[-/.]\s*(0?[1-9]|1[0-2])\s*[-/.]\s*(20\d{2}|19\d{2}|\d{2})\b/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // DD-MMM-YYYY (e.g. 15-Apr-2021, 22-Jan-2024, 05/MAR/2023)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const dMmmYMatch = clean.match(/\b(0?[1-9]|[12]\d|3[01])\s*[-/\s]\s*([A-Za-z]{3,9})\s*[-/\s]\s*(20\d{2}|19\d{2}|\d{2})\b/);
  if (dMmmYMatch) {
    const day = dMmmYMatch[1].padStart(2, '0');
    const mStr = dMmmYMatch[2].toLowerCase().slice(0, 3);
    const month = monthMap[mStr];
    if (month) {
      let year = dMmmYMatch[3];
      if (year.length === 2) {
        year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  return null;
};

// ─── Helper: Format Vehicle Number with standard spacing ─────────────────────
// e.g. "TN33AE1357" -> "TN 33 AE 1357"
export const formatVehicleNumber = (raw: string): string => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = clean.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  }
  return raw.toUpperCase().trim();
};

// Indian state codes
const STATE_CODES = 'AN|AP|AR|AS|BR|CG|CH|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|PB|PY|RJ|SK|TN|TR|TS|UK|UP|WB';

// Indian vehicle registration regex
const VEHICLE_REG_REGEX = new RegExp(`\\b(${STATE_CODES})[ -]?(\\d{1,2})[ -]?([A-Z]{1,3})[ -]?(\\d{4})\\b`, 'i');

// Known IFSC prefix -> Bank Name mapping for 100% bank detection accuracy
const IFSC_BANK_MAP: Record<string, string> = {
  SBIN: 'State Bank of India',
  HDFC: 'HDFC Bank',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  PUNB: 'Punjab National Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India',
  IDIB: 'Indian Bank',
  KKBK: 'Kotak Mahindra Bank',
  INDB: 'IndusInd Bank',
  YESB: 'Yes Bank',
  IBKL: 'IDBI Bank',
  FDRL: 'Federal Bank',
  IOBA: 'Indian Overseas Bank',
  CBIN: 'Central Bank of India',
  UCBA: 'UCO Bank',
  BKID: 'Bank of India',
  KVBL: 'Karur Vysya Bank',
  SIBL: 'South Indian Bank',
  CIUB: 'City Union Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  BDBL: 'Bandhan Bank',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank',
};

const BANK_NAMES_LIST = [
  'State Bank of India', 'State Bank', 'SBI',
  'HDFC Bank', 'HDFC',
  'ICICI Bank', 'ICICI',
  'Axis Bank', 'UTI Bank',
  'Canara Bank',
  'Indian Bank',
  'Bank of Baroda', 'BOB',
  'Punjab National Bank', 'PNB',
  'Union Bank of India', 'Union Bank',
  'Kotak Mahindra Bank', 'Kotak Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDBI Bank',
  'Federal Bank',
  'Indian Overseas Bank', 'IOB',
  'Central Bank of India',
  'UCO Bank',
  'Bank of India',
  'Karur Vysya Bank', 'KVB',
  'South Indian Bank',
  'City Union Bank',
  'Tamilnad Mercantile Bank', 'TMB',
  'Bandhan Bank',
  'Bank of Maharashtra',
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. RC PARSER
// "for RC i upload means automatically get RC no and in there no exipry date need to get date of regn"
// ─────────────────────────────────────────────────────────────────────────────
export const parseRcDocument = (text: string): ParsedRcData => {
  const result: ParsedRcData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. Extract RC / Registration Number
  // Priority 1: explicitly labeled
  const labeledRcMatch = text.match(/(?:REGN(?:\.|\s+)?NO|REGISTRATION(?:\.|\s+)?NO|REG(?:\.|\s+)?NO|VEHICLE(?:\.|\s+)?NO|RC(?:\.|\s+)?NO)[\s:.-]*([A-Z0-9 -]{8,16})/i);
  if (labeledRcMatch) {
    const candidate = labeledRcMatch[1].trim();
    const vm = candidate.match(VEHICLE_REG_REGEX);
    if (vm) {
      result.rc_number = formatVehicleNumber(vm[0]);
    } else {
      const cleanCandidate = candidate.replace(/[^A-Z0-9]/gi, '');
      if (cleanCandidate.length >= 8 && cleanCandidate.length <= 11) {
        result.rc_number = formatVehicleNumber(cleanCandidate);
      }
    }
  }

  // Priority 2: General Vehicle Plate regex in text
  if (!result.rc_number) {
    const generalMatch = text.match(VEHICLE_REG_REGEX);
    if (generalMatch) {
      result.rc_number = formatVehicleNumber(generalMatch[0]);
    }
  }

  // B. Extract Date of Registration (Date of Regn) - NOT expiry date
  // Strategy 1: Direct inline label with flexible separator
  // e.g. "Date of Regn.: 08-04-2010" or "Date of Regn. 08-04-2010"
  const directMatch = text.match(
    /(?:DATE\s+OF\s+REG(?:N|ISTRATION)?|REGN(?:\.|\s+)?DATE|REG(?:\.|\s+)?DATE|DT(?:\.|\s+)?OF\s+REG(?:N|ISTRATION)?|REGISTRATION\s+DATE|REGISTERED\s+ON|REG\s+ON)[^\d\n\r]{0,25}([0-9]{1,2}\s*[-/.]\s*[0-9]{1,2}\s*[-/.]\s*[0-9]{2,4}|[0-9]{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*[0-9]{2,4})/i
  );
  if (directMatch) {
    const d = parseIndianDate(directMatch[1]);
    if (d) {
      result.rc_reg_date = d;
    }
  }

  // Strategy 2: Multi-Column Table / Smart Card Layout
  // Standard Indian Smart Card RC header:
  // Row 1: Regn. Number     Date of Regn.     Regn. Validity
  // Row 2: TN33AQ8851       08-04-2010        AsperFitness
  if (!result.rc_reg_date) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/DATE\s+OF\s+REG|REGN(?:\.|\s+)?DATE|DT(?:\.|\s+)?OF\s+REG/i.test(line)) {
        // Check current line first
        const curLineDate = parseIndianDate(line);
        if (curLineDate) {
          result.rc_reg_date = curLineDate;
          break;
        }
        // Inspect subsequent 1 to 3 lines
        for (let offset = 1; offset <= 3 && (i + offset) < lines.length; offset++) {
          const nextLine = lines[i + offset];
          if (/CARD\s+ISSUE|EXPIR/i.test(nextLine)) continue;
          const d = parseIndianDate(nextLine);
          if (d) {
            result.rc_reg_date = d;
            break;
          }
        }
        if (result.rc_reg_date) break;
      }
    }
  }

  // Strategy 3: On the line containing the Vehicle Registration Plate
  // On Indian RC smart cards, vehicle number and date of regn are printed in the same row
  // e.g. "TN33AQ8851 08-04-2010 AsperFitness"
  if (!result.rc_reg_date) {
    for (const line of lines) {
      if (VEHICLE_REG_REGEX.test(line)) {
        const d = parseIndianDate(line);
        if (d) {
          result.rc_reg_date = d;
          break;
        }
      }
    }
  }

  // Strategy 4: Fallback to any line containing REG / REGISTRATION that has a date
  if (!result.rc_reg_date) {
    for (const line of lines) {
      if (/REG(?:N|ISTRATION)?/i.test(line) && !/EXPIR|VALID/i.test(line)) {
        const d = parseIndianDate(line);
        if (d) {
          result.rc_reg_date = d;
          break;
        }
      }
    }
  }

  // Strategy 5: Filter all dates found in text (exclude Card Issue Date & Expiry dates)
  if (!result.rc_reg_date) {
    for (const line of lines) {
      if (/CARD\s+ISSUE|EXPIR|VALID\s+UPTO|MFG/i.test(line)) continue;
      const matches = line.matchAll(/\b(0?[1-9]|[12]\d|3[01])\s*[-/.]\s*(0?[1-9]|1[0-2])\s*[-/.]\s*(20\d{2}|19\d{2})\b/g);
      for (const m of matches) {
        const d = parseIndianDate(m[0]);
        if (d) {
          result.rc_reg_date = d;
          break;
        }
      }
      if (result.rc_reg_date) break;
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FC PARSER
// "For FC also need to show the regn no automaticALLY"
// ─────────────────────────────────────────────────────────────────────────────
export const parseFcDocument = (text: string): ParsedFcData => {
  const result: ParsedFcData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. Extract Vehicle Regn No / FC No
  const regMatch = text.match(VEHICLE_REG_REGEX);
  if (regMatch) {
    result.fc_number = formatVehicleNumber(regMatch[0]);
  } else {
    const certMatch = text.match(/(?:CERTIFICATE\s*NO|FC\s*NO|FITNESS\s*NO)[\s:.-]*([A-Z0-9/-]{5,20})/i);
    if (certMatch) {
      result.fc_number = certMatch[1].trim().toUpperCase();
    }
  }

  // B. Extract FC Expiry Date / Valid Upto
  // Strategy 1: Direct match
  const expMatch = text.match(
    /(?:VALID\s+UPTO|FITNESS\s+UPTO|FITNESS\s+VALID\s+UPTO|VALIDITY|EXPIR(?:Y|ES)(?:\s+DATE)?|EXP\s+DATE|UP\s*TO)[^\d\n\r]{0,25}([0-9]{1,2}\s*[-/.]\s*[0-9]{1,2}\s*[-/.]\s*[0-9]{2,4}|[0-9]{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*[0-9]{2,4})/i
  );
  if (expMatch) {
    const d = parseIndianDate(expMatch[1]);
    if (d) {
      result.fc_expiry_date = d;
    }
  }

  // Strategy 2: Multi-line / Table inspection
  if (!result.fc_expiry_date) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/VALID\s+UPTO|FITNESS\s+VALID|EXPIR/i.test(line)) {
        const curDate = parseIndianDate(line);
        if (curDate) {
          result.fc_expiry_date = curDate;
          break;
        }
        for (let offset = 1; offset <= 2 && (i + offset) < lines.length; offset++) {
          const d = parseIndianDate(lines[i + offset]);
          if (d) {
            result.fc_expiry_date = d;
            break;
          }
        }
        if (result.fc_expiry_date) break;
      }
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. ROAD TAX PARSER
// "in road tax for all the vechile it exipry march 31st for all the year , before 1 month need notification about the road tax"
// ─────────────────────────────────────────────────────────────────────────────
export const parseTaxDocument = (text: string): ParsedTaxData => {
  // Always auto-set to the upcoming March 31st
  const result: ParsedTaxData = {
    tax_expiry_date: getNextMarch31st(),
    raw_text: text,
  };
  if (!text) return result;

  // Extract vehicle number if on the receipt
  const regMatch = text.match(VEHICLE_REG_REGEX);
  if (regMatch) {
    result.vehicle_number = formatVehicleNumber(regMatch[0]);
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. TDS PARSER (formerly DTS)
// "DTS need to change TDS it also exipry in 31 st march need notification"
// ─────────────────────────────────────────────────────────────────────────────
export const parseTdsDocument = (text: string): ParsedTdsData => {
  // Always auto-set to March 31st
  const result: ParsedTdsData = {
    tds_expiry_date: getNextMarch31st(),
    raw_text: text,
  };
  if (!text) return result;

  // Try extracting TDS certificate number / Acknowledgement Number / TAN
  const certMatch = text.match(
    /(?:CERTIFICATE\s*(?:NO|NUMBER)?|ACK(?:NOWLEDGEMENT)?\s*(?:NO|NUMBER)?|TDS\s*(?:CERTIFICATE|NO)?|TAN)[\s:.-]*([A-Z0-9/-]{6,25})/i
  );
  if (certMatch) {
    result.tds_number = certMatch[1].trim().toUpperCase();
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BANK DOCUMENT PARSER
// "for bank document i submit from that file need to get acc number and bank name and ifsc code"
// ─────────────────────────────────────────────────────────────────────────────
export const parseBankDocument = (text: string): ParsedBankData => {
  const result: ParsedBankData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. IFSC Code
  // Standard format: 4 alphabetic characters, followed by '0', followed by 6 alphanumeric
  const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
  if (ifscMatch) {
    result.ifsc_code = ifscMatch[1].toUpperCase();
    // Auto-detect Bank Name from IFSC prefix (100% reliable)
    const prefix = result.ifsc_code.slice(0, 4);
    if (IFSC_BANK_MAP[prefix]) {
      result.bank_name = IFSC_BANK_MAP[prefix];
    }
  }

  // B. Bank Name (if not resolved via IFSC, search text)
  if (!result.bank_name) {
    for (const b of BANK_NAMES_LIST) {
      const reg = new RegExp(`\\b${b}\\b`, 'i');
      if (reg.test(text)) {
        // Find canonical name
        if (b.toUpperCase() === 'SBI') result.bank_name = 'State Bank of India';
        else if (b.toUpperCase() === 'HDFC') result.bank_name = 'HDFC Bank';
        else if (b.toUpperCase() === 'ICICI') result.bank_name = 'ICICI Bank';
        else if (b.toUpperCase() === 'PNB') result.bank_name = 'Punjab National Bank';
        else if (b.toUpperCase() === 'BOB') result.bank_name = 'Bank of Baroda';
        else if (b.toUpperCase() === 'IOB') result.bank_name = 'Indian Overseas Bank';
        else if (b.toUpperCase() === 'KVB') result.bank_name = 'Karur Vysya Bank';
        else if (b.toUpperCase() === 'TMB') result.bank_name = 'Tamilnad Mercantile Bank';
        else result.bank_name = b;
        break;
      }
    }
  }

  // C. Account Number
  // 1. Check labeled patterns: "A/c No", "Account No", "A/C NUMBER", "Account Number"
  const labeledAccMatch = text.match(
    /(?:A\/C|ACC(?:OUNT)?|ACCT)(?:\.|\s+)?(?:NO|NUM(?:BER)?)?[:\s-]*([0-9]{9,18})\b/i
  );
  if (labeledAccMatch) {
    result.account_number = labeledAccMatch[1].trim();
  } else {
    // 2. Scan for standalone 9-18 digit numbers that are NOT dates or phone numbers
    const digitMatches = text.match(/\b\d{9,18}\b/g);
    if (digitMatches && digitMatches.length > 0) {
      // Pick first match that isn't a 10-digit phone number starting with 6-9
      const candidate = digitMatches.find(d => {
        if (d.length === 10 && /^[6-9]/.test(d)) return false; // Likely mobile number
        return true;
      });
      if (candidate) {
        result.account_number = candidate;
      }
    }
  }

  // D. Account Holder Name
  const nameMatch = text.match(
    /(?:A\/C\s*HOLDER(?:\s*NAME)?|NAME(?:\s*OF\s*HOLDER)?|CUSTOMER\s*NAME|FAVOURING)[:\s-]*([A-Z\s.]{3,35})/i
  );
  if (nameMatch) {
    const n = nameMatch[1].trim();
    if (!/BANK|BRANCH|ACCOUNT|IFSC|RUPEES|ONLY/i.test(n)) {
      result.account_holder_name = n;
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. PAN CARD PARSER
// "pan card i upload in there need to get the name and pan number"
// ─────────────────────────────────────────────────────────────────────────────
export const parsePanDocument = (text: string): ParsedPanData => {
  const result: ParsedPanData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. PAN Number: Exactly 5 uppercase letters, 4 digits, 1 uppercase letter
  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
  if (panMatch) {
    result.pan_number = panMatch[1].toUpperCase();
  }

  // B. Name Extraction
  // Indian PAN cards generally have:
  // "INCOME TAX DEPARTMENT"
  // "GOVT. OF INDIA"
  // [NAME OF HOLDER]
  // [FATHER'S NAME]
  // [DATE OF BIRTH]
  // Or labeled: "Name:" / "Name"
  const labeledNameMatch = text.match(/(?:NAME(?:\s*OF\s*CARD\s*HOLDER)?|NAME)[:\s-]*([A-Z\s.]{3,40})/i);
  if (labeledNameMatch) {
    const candidate = labeledNameMatch[1].trim();
    if (!/INCOME|DEPARTMENT|INDIA|FATHER|PERMANENT|ACCOUNT|NUMBER/i.test(candidate)) {
      result.account_holder_name = candidate;
    }
  }

  if (!result.account_holder_name) {
    // Scan lines after "GOVT. OF INDIA" or "INCOME TAX"
    let passedHeader = false;
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (/INCOME\s+TAX|GOVT\.?\s+OF\s+INDIA/i.test(upper)) {
        passedHeader = true;
        continue;
      }
      if (passedHeader) {
        // Skip common PAN headers/labels
        if (/FATHER|DATE\s+OF\s+BIRTH|DOB|PERMANENT|ACCOUNT|SIGNATURE|CARD|PHOTO/i.test(upper)) {
          continue;
        }
        // Match a name line (2-4 words of letters and spaces, at least 4 chars)
        if (/^[A-Z][A-Z\s.]{3,35}$/.test(upper) && !/\d/.test(upper)) {
          result.account_holder_name = upper.trim();
          break;
        }
      }
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. DRIVING LICENSE PARSER
// Extracts: License Number, Expiry Date, Holder Name
// Indian DL format: state code (2 letters) + RTO code (2 digits) + year (4 digits) + serial (7 digits)
// e.g. TN33 20100001234, DL0620100001234, KA0120200012345
// ─────────────────────────────────────────────────────────────────────────────
export const parseLicenseDocument = (text: string): ParsedLicenseData => {
  const result: ParsedLicenseData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const STATE_CODES_STR = 'AN|AP|AR|AS|BR|CG|CH|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD|MH|ML|MN|MP|MZ|NL|OD|PB|PY|RJ|SK|TN|TR|TS|UK|UP|WB';

  // A. Extract DL / License Number
  // Strategy 1: Labeled — "DL NO", "LICENCE NO", "LICENSE NO", "DL NUMBER"
  const labeledDlMatch = text.match(
    /(?:DL|D\.L|LICENCE|LICENSE|DRIVING\s+LIC(?:ENCE|ENSE)?)(?:\.|\s+)?(?:NO|NUMBER|NUM)?[\s:.-]*([A-Z0-9/ -]{10,25})/i
  );
  if (labeledDlMatch) {
    const candidate = labeledDlMatch[1].trim().replace(/[^A-Z0-9]/gi, '');
    if (candidate.length >= 10 && candidate.length <= 20) {
      result.license_number = candidate.toUpperCase();
    }
  }

  // Strategy 2: Indian DL format regex — e.g. TN3320100001234
  if (!result.license_number) {
    const dlRegex = new RegExp(`\\b(${STATE_CODES_STR})[- ]?(\\d{2})[- ]?(\\d{4})[- ]?(\\d{7})\\b`, 'i');
    const dlMatch = text.match(dlRegex);
    if (dlMatch) {
      result.license_number = `${dlMatch[1].toUpperCase()}${dlMatch[2]}${dlMatch[3]}${dlMatch[4]}`;
    }
  }

  // Strategy 3: Older format — e.g. TN33/2010/0001234 or TN-33-2010-0001234
  if (!result.license_number) {
    const olderDlMatch = text.match(
      new RegExp(`\\b(${STATE_CODES_STR})[- /]?(\\d{2})[- /]?(\\d{4})[- /]?(\\d{5,7})\\b`, 'i')
    );
    if (olderDlMatch) {
      result.license_number = `${olderDlMatch[1].toUpperCase()}${olderDlMatch[2]}${olderDlMatch[3]}${olderDlMatch[4]}`;
    }
  }

  // B. Extract Expiry Date
  // Look for "VALID TILL", "VALID UPTO", "VALIDITY", "NT VALIDITY", "TR VALIDITY", "EXPIRY", "EXP DATE"
  const expiryMatch = text.match(
    /(?:VALID\s*(?:TILL|UPTO|UP\s*TO)|NT\s*(?:VALIDITY|VALID\s+TILL)|TR\s*(?:VALIDITY|VALID\s+TILL)|VALIDITY|EXPIR(?:Y|ES)(?:\s+DATE)?|EXP(?:\.|IRY)?\s+DATE)[^\d\n\r]{0,25}([0-9]{1,2}\s*[-/.]\s*[0-9]{1,2}\s*[-/.]\s*[0-9]{2,4}|[0-9]{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*[0-9]{2,4})/i
  );
  if (expiryMatch) {
    const d = parseIndianDate(expiryMatch[1]);
    if (d) {
      result.license_expiry_date = d;
    }
  }

  // Strategy 2: Multi-line table scan
  if (!result.license_expiry_date) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/VALID\s*(?:TILL|UPTO)|NT\s*VALID|TR\s*VALID|EXPIR/i.test(line)) {
        const curDate = parseIndianDate(line);
        if (curDate) {
          result.license_expiry_date = curDate;
          break;
        }
        for (let offset = 1; offset <= 2 && (i + offset) < lines.length; offset++) {
          const d = parseIndianDate(lines[i + offset]);
          if (d) {
            result.license_expiry_date = d;
            break;
          }
        }
        if (result.license_expiry_date) break;
      }
    }
  }

  // C. Extract Holder Name
  const nameMatch = text.match(
    /(?:NAME(?:\s+OF\s+HOLDER)?|HOLDER\s*NAME|S\/O|D\/O|W\/O)[:\s.-]+([A-Z][A-Z\s.]{2,35})/i
  );
  if (nameMatch) {
    const candidate = nameMatch[1].trim();
    if (!/INDIA|TRANSPORT|MOTOR|VEHICLE|LICENCE|ADDRESS|BLOOD/i.test(candidate)) {
      result.holder_name = candidate;
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. INSURANCE DOCUMENT PARSER
// Extracts: Policy Number, Expiry / Valid Upto Date, Insurer Name
// Covers: Motor Insurance Certificates, Commercial Vehicle Policies
// ─────────────────────────────────────────────────────────────────────────────
const INSURER_NAMES = [
  'New India Assurance', 'New India',
  'National Insurance', 'National',
  'United India Insurance', 'United India',
  'Oriental Insurance', 'Oriental',
  'Bajaj Allianz', 'Bajaj',
  'HDFC ERGO', 'HDFC Ergo',
  'ICICI Lombard', 'ICICI',
  'Reliance General', 'Reliance',
  'Tata AIG', 'Tata AIG General',
  'SBI General', 'SBI',
  'Cholamandalam', 'Chola MS',
  'Royal Sundaram', 'Sundaram',
  'Universal Sompo', 'Sompo',
  'Future Generali', 'Generali',
  'Iffco Tokio', 'IFFCO',
  'Niva Bupa', 'Max Bupa',
];

export const parseInsuranceDocument = (text: string): ParsedInsuranceData => {
  const result: ParsedInsuranceData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. Policy Number
  // Strategy 1: Labeled — "Policy No", "Policy Number", "Cert No"
  const labeledPolicyMatch = text.match(
    /(?:POLICY\s*(?:NO|NUMBER|NUM)|CERTIFICATE\s*(?:NO|NUMBER)|CERT\s*(?:NO|NUMBER)|POLICY\s*ID)[:\s.-]*([A-Z0-9/\-]{6,25})/i
  );
  if (labeledPolicyMatch) {
    const candidate = labeledPolicyMatch[1].trim();
    if (candidate.length >= 6 && candidate.length <= 25) {
      result.policy_number = candidate.toUpperCase();
    }
  }

  // Strategy 2: Common Indian insurance policy number patterns
  // e.g. 3310/12345678/01, INS-2024-001234, P-202400123456
  if (!result.policy_number) {
    const patternMatch = text.match(
      /\b((?:INS|POL|P|CV|MV|PKG|OD|TP)[/-]?[A-Z0-9]{4,20}(?:[/-][A-Z0-9]{1,10})*)\b/i
    );
    if (patternMatch) {
      result.policy_number = patternMatch[1].toUpperCase();
    }
  }

  // Strategy 3: Slash-separated numbers like 3310/12345678/01
  if (!result.policy_number) {
    const slashNumMatch = text.match(/\b(\d{4}\/\d{6,10}(?:\/\d{1,4})?)\b/);
    if (slashNumMatch) {
      result.policy_number = slashNumMatch[1];
    }
  }

  // B. Expiry / Valid Upto Date
  const expMatch = text.match(
    /(?:VALID\s*(?:UPTO|TILL|TO|UP\s*TO)|EXPIR(?:Y|ES)(?:\s+DATE)?|EXP(?:\s+DATE)?|RENEWAL\s+DATE|POLICY\s+EXPIR(?:Y|ES)?|END\s+DATE|RISK\s+END)[^\d\n\r]{0,25}([0-9]{1,2}\s*[-/.]\s*[0-9]{1,2}\s*[-/.]\s*[0-9]{2,4}|[0-9]{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*[0-9]{2,4})/i
  );
  if (expMatch) {
    const d = parseIndianDate(expMatch[1]);
    if (d) result.expiry_date = d;
  }

  // Multi-line table strategy
  if (!result.expiry_date) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/VALID\s*(?:UPTO|TILL|TO)|EXPIR|RENEWAL|RISK\s+END|END\s+DATE/i.test(line)) {
        const curDate = parseIndianDate(line);
        if (curDate) { result.expiry_date = curDate; break; }
        for (let offset = 1; offset <= 2 && (i + offset) < lines.length; offset++) {
          const d = parseIndianDate(lines[i + offset]);
          if (d) { result.expiry_date = d; break; }
        }
        if (result.expiry_date) break;
      }
    }
  }

  // C. Insurer Name
  for (const insurer of INSURER_NAMES) {
    if (new RegExp(`\\b${insurer}\\b`, 'i').test(text)) {
      // Normalise to full canonical name
      const lower = insurer.toLowerCase();
      if (lower.includes('new india')) result.insurer_name = 'New India Assurance';
      else if (lower === 'national') result.insurer_name = 'National Insurance';
      else if (lower === 'united india') result.insurer_name = 'United India Insurance';
      else if (lower === 'oriental') result.insurer_name = 'Oriental Insurance';
      else if (lower === 'bajaj') result.insurer_name = 'Bajaj Allianz';
      else if (lower.includes('hdfc')) result.insurer_name = 'HDFC ERGO';
      else if (lower.includes('icici')) result.insurer_name = 'ICICI Lombard';
      else if (lower.includes('reliance')) result.insurer_name = 'Reliance General';
      else if (lower.includes('tata')) result.insurer_name = 'Tata AIG';
      else if (lower.includes('sbi')) result.insurer_name = 'SBI General';
      else if (lower.includes('chola')) result.insurer_name = 'Cholamandalam MS';
      else result.insurer_name = insurer;
      break;
    }
  }

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. PERMIT DOCUMENT PARSER
// Extracts: Permit Number, Expiry Date
// Covers: National Permit, State Permit, Tourist Permit certificates
// ─────────────────────────────────────────────────────────────────────────────
export const parsePermitDocument = (text: string): ParsedPermitData => {
  const result: ParsedPermitData = { raw_text: text };
  if (!text) return result;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // A. Permit Number
  // Strategy 1: Labeled — "Permit No", "Permit Number"
  const labeledPermitMatch = text.match(
    /(?:PERMIT\s*(?:NO|NUMBER|NUM)|PERMIT\s*ID)[:\s.-]*([A-Z0-9/\-]{5,25})/i
  );
  if (labeledPermitMatch) {
    const candidate = labeledPermitMatch[1].trim();
    if (candidate.length >= 5 && candidate.length <= 25) {
      result.permit_number = candidate.toUpperCase();
    }
  }

  // Strategy 2: Common Indian permit number format e.g. TN/NP/2024/00123, KA-38-NP-0001234
  if (!result.permit_number) {
    const permitPatternMatch = text.match(
      /\b([A-Z]{2}[/-][A-Z0-9]{1,5}[/-][0-9]{4}[/-][0-9]{3,8})\b/i
    );
    if (permitPatternMatch) {
      result.permit_number = permitPatternMatch[1].toUpperCase();
    }
  }

  // Strategy 3: "PERMIT-" or "NP-" prefix numbers
  if (!result.permit_number) {
    const prefixMatch = text.match(/\b(?:PERMIT|NP|SP|TP)[- ](\d{5,15})\b/i);
    if (prefixMatch) {
      result.permit_number = prefixMatch[0].toUpperCase().replace(/\s+/g, '');
    }
  }

  // B. Permit Expiry / Valid Till Date
  const expMatch = text.match(
    /(?:VALID\s*(?:UPTO|TILL|TO|UP\s*TO)|PERMIT\s*VALID(?:\s*TILL)?|PERMIT\s*EXPIR(?:Y|ES)?|EXPIR(?:Y|ES)(?:\s+DATE)?|VALIDITY\s+DATE|EXP(?:\s+DATE)?)[^\d\n\r]{0,25}([0-9]{1,2}\s*[-/.]\s*[0-9]{1,2}\s*[-/.]\s*[0-9]{2,4}|[0-9]{1,2}\s*[-/\s]\s*[A-Za-z]{3,9}\s*[-/\s]\s*[0-9]{2,4})/i
  );
  if (expMatch) {
    const d = parseIndianDate(expMatch[1]);
    if (d) result.expiry_date = d;
  }

  // Multi-line table strategy
  if (!result.expiry_date) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/VALID\s*(?:UPTO|TILL|TO)|PERMIT\s*VALID|EXPIR|VALIDITY/i.test(line)) {
        const curDate = parseIndianDate(line);
        if (curDate) { result.expiry_date = curDate; break; }
        for (let offset = 1; offset <= 2 && (i + offset) < lines.length; offset++) {
          const d = parseIndianDate(lines[i + offset]);
          if (d) { result.expiry_date = d; break; }
        }
        if (result.expiry_date) break;
      }
    }
  }

  return result;
};
