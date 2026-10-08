import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use local worker bundled by Vite (solves Cross-Origin Worker SecurityError)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const isPdfFile = (fileOrUrl?: string | File | null): boolean => {
  if (!fileOrUrl) return false;
  if (typeof fileOrUrl === 'string') {
    const clean = fileOrUrl.toLowerCase();
    return (
      clean.startsWith('data:application/pdf') ||
      clean.includes('.pdf') ||
      fileOrUrl.includes('JVBERi0') || // base64 magic bytes for "%PDF-"
      fileOrUrl.startsWith('%PDF-')
    );
  }
  return (
    fileOrUrl.type === 'application/pdf' ||
    fileOrUrl.name.toLowerCase().endsWith('.pdf')
  );
};

export const isDocxFile = (fileOrUrl?: string | File | null): boolean => {
  if (!fileOrUrl) return false;
  if (typeof fileOrUrl === 'string') {
    return fileOrUrl.includes('officedocument.wordprocessingml') || fileOrUrl.toLowerCase().endsWith('.docx');
  }
  return (
    fileOrUrl.type.includes('officedocument.wordprocessingml') ||
    fileOrUrl.name.toLowerCase().endsWith('.docx')
  );
};

/**
 * Universal text extractor from File or Data URL / Base64.
 * Seamlessly handles:
 *  1. Scanned PDFs (renders pages to high-res white canvas + Tesseract OCR)
 *  2. Digital PDFs (extracts structured lines + fallback OCR)
 *  3. Images (JPEG, PNG, WebP via Tesseract OCR)
 */
export const extractTextFromFileOrData = async (fileOrData: File | string): Promise<string> => {
  try {
    const isPdf = isPdfFile(fileOrData);

    if (isPdf) {
      try {
        let uint8Data: Uint8Array;
        if (typeof fileOrData === 'string') {
          const base64Part = fileOrData.includes(',') ? fileOrData.split(',')[1] : fileOrData;
          const binaryStr = atob(base64Part);
          uint8Data = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            uint8Data[i] = binaryStr.charCodeAt(i);
          }
        } else {
          const arrayBuffer = await fileOrData.arrayBuffer();
          uint8Data = new Uint8Array(arrayBuffer);
        }

        const loadingTask = pdfjsLib.getDocument({
          data: uint8Data,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@6.3.289/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 3); // Extract up to first 3 pages

        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);

          // 1. Digital Text Extraction (preserving line layout)
          let digitalPageText = '';
          try {
            const textContent = await page.getTextContent();
            let lastY: number | null = null;
            let currentLine = '';
            const pageLines: string[] = [];

            for (const item of textContent.items) {
              if (!item || typeof item !== 'object' || !('str' in item)) continue;
              const str = (item as any).str || '';
              if (!str) continue;

              const transform = (item as any).transform;
              const currentY = Array.isArray(transform) && transform.length >= 6 ? Math.round(transform[5]) : null;

              // If line height changed significantly, push completed line
              if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
                if (currentLine.trim()) pageLines.push(currentLine.trim());
                currentLine = '';
              }

              currentLine += (currentLine.length > 0 && !currentLine.endsWith(' ') ? ' ' : '') + str;

              if ((item as any).hasEOL) {
                if (currentLine.trim()) pageLines.push(currentLine.trim());
                currentLine = '';
                lastY = null;
              } else {
                lastY = currentY;
              }
            }
            if (currentLine.trim()) pageLines.push(currentLine.trim());
            digitalPageText = pageLines.join('\n').trim();
          } catch (textErr) {
            console.warn(`Digital text extraction error on page ${i}:`, textErr);
          }

          // 2. Optical Character Recognition (OCR) via High-Res Canvas
          // Only run OCR for scanned/image PDFs — digital PDFs already have text extracted above
          let ocrPageText = '';
          const needsOcr = digitalPageText.length < 80 || /scanned|image/i.test(digitalPageText);

          if (needsOcr) {
            try {
              const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharp OCR
              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(viewport.width);
              canvas.height = Math.floor(viewport.height);
              const ctx = canvas.getContext('2d');

              if (ctx) {
                // Crucial: Fill solid white background (transparent PDF rendering breaks OCR)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                // Convert rendered page to crisp PNG data URL
                const pngDataUrl = canvas.toDataURL('image/png');
                const worker = await createWorker('eng');
                const ocrResult = await worker.recognize(pngDataUrl);
                await worker.terminate();

                ocrPageText = (ocrResult.data?.text || '').trim();
              }
            } catch (canvasErr) {
              console.warn(`Canvas render/OCR error on page ${i}:`, canvasErr);
            }
          }

          // Combine digital and OCR text so nothing is missed
          const combined = [digitalPageText, ocrPageText].filter(Boolean).join('\n\n');
          if (combined) {
            fullText += '\n\n' + combined;
          }
        }

        if (fullText.trim().length > 0) {
          return fullText.trim();
        }
      } catch (pdfErr) {
        console.warn('PDF parsing encountered an issue:', pdfErr);
      }
    }

    // Standard Image OCR (JPEG, PNG, WebP)
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(fileOrData);
    await worker.terminate();
    return (text || '').trim();
  } catch (err) {
    console.warn('Text extraction encountered an error:', err);
    return '';
  }
};

export const extractTextFromFile = extractTextFromFileOrData;
