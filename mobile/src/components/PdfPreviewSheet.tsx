import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X, Printer } from 'lucide-react-native';
import * as Print from 'expo-print';
import { COLORS } from '../constants/theme';
import { Settlement, Trip } from '../types';
import { generateDriverStatementHtml, generateSettlementHtml } from '../utils/pdfGenerator';

export const PdfPreviewSheet: React.FC<{
  visible: boolean;
  title: string;
  loading?: boolean;
  html?: string | null;
  data?: any;
  trip?: Trip | null;
  settlement?: Settlement | null;
  onClose: () => void;
}> = ({ visible, title, loading, html, data, trip, settlement, onClose }) => {
  const [printing, setPrinting] = useState(false);
  const previewHtml = useMemo(() => {
    if (html) return html;
    if (trip && settlement) return generateSettlementHtml(trip, settlement);
    if (data) return generateDriverStatementHtml(data);
    return '';
  }, [html, data, trip, settlement]);

  const handlePrint = async () => {
    if (!previewHtml) return;
    try {
      setPrinting(true);
      await Print.printAsync({ html: previewHtml });
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Could not print this document.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {previewHtml && !loading ? (
            <TouchableOpacity
              onPress={handlePrint}
              disabled={printing}
              style={styles.printBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {printing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Printer size={15} color="#fff" />
                  <Text style={styles.printBtnText}>Print</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.hint}>Loading challan...</Text>
          </View>
        ) : previewHtml ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: previewHtml }}
            style={styles.web}
            scalesPageToFit
            nestedScrollEnabled
            javaScriptEnabled
            setSupportMultipleWindows={false}
            showsVerticalScrollIndicator
            androidLayerType="hardware"
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.hint}>No challan to display</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#e2e8f0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0f172a', paddingRight: 12 },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 10,
    minHeight: 34,
  },
  printBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  web: { flex: 1, backgroundColor: '#fff' },
});
