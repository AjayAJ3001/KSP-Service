import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, RADIUS } from '../constants/theme';

export type DetailRow = { label: string; value?: string | number | null };

export const DetailsSheet: React.FC<{
  visible: boolean;
  title: string;
  rows?: DetailRow[];
  onClose: () => void;
  children?: React.ReactNode;
}> = ({ visible, title, rows, onClose, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {(rows || [])
            .filter((r) => r.value !== undefined && r.value !== null && r.value !== '')
            .map((r) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.label}>{r.label}</Text>
                <Text style={styles.value}>{String(r.value)}</Text>
              </View>
            ))}
          {children}
        </ScrollView>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#0f172a', flex: 1, paddingRight: 12 },
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', flex: 1 },
  value: { fontSize: 13, fontWeight: '800', color: '#0f172a', flex: 1.4, textAlign: 'right' },
  closeBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '800', color: '#334155' },
});
