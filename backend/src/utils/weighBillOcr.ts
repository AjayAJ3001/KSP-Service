import crypto from 'crypto';
import { parseWeighBillText } from './parseWeighBill';

const ocrCache = new Map<string, string>();
const OCR_CACHE_LIMIT = 40;

export function decodeBillImage(dataUri: string): Buffer {
  const raw = String(dataUri || '').trim();
  if (!raw) throw new Error('Weighment bill image is required.');
  const base64 = raw.includes(',') ? raw.split(',').pop() || '' : raw;
  const buffer = Buffer.from(base64.replace(/\s/g, ''), 'base64');
  if (buffer.length < 80) throw new Error('Weighment bill image is invalid.');
  return buffer;
}

export function hashBillImage(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

let workerPromise: Promise<any> | null = null;
let workerQueue: Promise<void> = Promise.resolve();

const getWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      let createWorker: any;
      try {
        ({ createWorker } = require('tesseract.js'));
      } catch {
        console.warn('tesseract.js is not installed — weigh bill OCR skipped.');
        return null;
      }
      const worker = await createWorker('eng', 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_ocr_engine_mode: '1',
      });
      return worker;
    })();
  }
  return workerPromise;
};

export const warmupWeighBillOcr = () => {
  void getWorker().catch(() => {});
};

const rememberOcr = (hash: string, text: string) => {
  if (!text) return;
  if (ocrCache.size >= OCR_CACHE_LIMIT) {
    const first = ocrCache.keys().next().value;
    if (first) ocrCache.delete(first);
  }
  ocrCache.set(hash, text);
};

export async function ocrWeighBill(buffer: Buffer): Promise<string> {
  const hash = hashBillImage(buffer);
  const cached = ocrCache.get(hash);
  if (cached) return cached;

  let unlock = () => {};
  const previous = workerQueue;
  workerQueue = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  await previous;
  try {
    const worker = await getWorker();
    if (!worker) return '';
    const first = String((await worker.recognize(buffer)).data?.text || '');
    const parsedFirst = parseWeighBillText(first);
    if (parsedFirst.goods_weight) {
      rememberOcr(hash, first);
      return first;
    }
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    const second = String((await worker.recognize(buffer)).data?.text || '');
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const combined = `${first}\n${second}`.trim();
    rememberOcr(hash, combined);
    return combined;
  } finally {
    unlock();
  }
}
