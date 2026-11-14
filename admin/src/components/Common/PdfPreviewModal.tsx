import React, { useEffect, useRef } from 'react';
import { Modal } from './Modal';

export const PdfPreviewModal: React.FC<{
  isOpen: boolean;
  title: string;
  html?: string | null;
  loading?: boolean;
  onClose: () => void;
}> = ({ isOpen, title, html, loading, onClose }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen || loading || !html) return;
    const iframe = frameRef.current;
    if (!iframe) return;

    const writeHtml = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return false;
        doc.open();
        doc.write(html);
        doc.close();
        return true;
      } catch {
        return false;
      }
    };

    if (writeHtml()) return undefined;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [isOpen, html, loading]);

  const handlePrint = () => {
    const win = frameRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
      return;
    }
    if (!html) return;
    const w = window.open('', '_blank', 'width=950,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="960px">
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Loading challan...</div>
      ) : html ? (
        <div
          style={{
            height: 'min(78vh, 820px)',
            background: '#e2e8f0',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <iframe
            ref={frameRef}
            title={title}
            src="about:blank"
            style={{ width: '100%', height: '100%', border: 0, background: '#fff' }}
          />
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No challan to display</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={handlePrint} disabled={!html || loading}>
          Print / Save PDF
        </button>
      </div>
    </Modal>
  );
};
