import crypto from 'crypto';
import { parseWeighBillText } from './parseWeighBill';

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

export async function ocrWeighBill(buffer: Buffer): Promise<string> {
  let createWorker: any;
  try {
    ({ createWorker } = require('tesseract.js'));
  } catch {
    console.warn('tesseract.js is not installed — weigh bill OCR skipped.');
    return '';
  }
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    const first = String((await worker.recognize(buffer)).data?.text || '');
    if (parseWeighBillText(first).goods_weight) return first;
    await worker.setParameters({ tessedit_pageseg_mode: '4' });
    const second = String((await worker.recognize(buffer)).data?.text || '');
    return `${first}\n${second}`.trim();
  } finally {
    await worker.terminate();
  }
}
