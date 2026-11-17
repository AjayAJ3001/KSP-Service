import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Share2, Download, Printer } from 'lucide-react-native';

type Props = {
  onShare: () => void;
  onDownload: () => void;
  onPrint?: () => void;
  loading?: string | null;
  disabled?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

const isShareLoading = (loading?: string | null) =>
  Boolean(loading && /share/i.test(loading));

const isPrintLoading = (loading?: string | null) =>
  Boolean(loading && /(^|_)print|_pr_|pr_/i.test(String(loading)));

const isDownloadLoading = (loading?: string | null) =>
  Boolean(
    loading
    && /download|pdf|challan/i.test(loading)
    && !/share/i.test(loading)
    && !isPrintLoading(loading)
  );

export const PdfExportButtons: React.FC<Props> = ({
  onShare,
  onDownload,
  onPrint,
  loading = null,
  disabled,
  compact,
  style,
}) => {
  const busy = Boolean(loading) || Boolean(disabled);
  const shareBusy = isShareLoading(loading);
  const downloadBusy = isDownloadLoading(loading);
  const printBusy = isPrintLoading(loading);
  const iconSize = compact ? 13 : 15;

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      <TouchableOpacity
        style={[styles.btn, styles.share, compact && styles.btnCompact, shareBusy && { opacity: 0.7 }]}
        onPress={onShare}
        disabled={busy}
        activeOpacity={0.8}
      >
        {shareBusy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Share2 size={iconSize} color="#fff" />
            <Text style={[styles.text, compact && styles.textCompact]}>Share</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.download, compact && styles.btnCompact, downloadBusy && { opacity: 0.7 }]}
        onPress={onDownload}
        disabled={busy}
        activeOpacity={0.8}
      >
        {downloadBusy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Download size={iconSize} color="#fff" />
            <Text style={[styles.text, compact && styles.textCompact]}>Download</Text>
          </>
        )}
      </TouchableOpacity>
      {onPrint ? (
        <TouchableOpacity
          style={[styles.btn, styles.print, compact && styles.btnCompact, printBusy && { opacity: 0.7 }]}
          onPress={onPrint}
          disabled={busy}
          activeOpacity={0.8}
        >
          {printBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Printer size={iconSize} color="#fff" />
              <Text style={[styles.text, compact && styles.textCompact]}>Print</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowCompact: {
    gap: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  btnCompact: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    minHeight: 32,
    gap: 4,
  },
  share: {
    backgroundColor: '#047857',
  },
  download: {
    backgroundColor: '#0f172a',
  },
  print: {
    backgroundColor: '#1d4ed8',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  textCompact: {
    fontSize: 11,
  },
});
