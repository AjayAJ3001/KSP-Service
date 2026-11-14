import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Eye } from 'lucide-react-native';

export const ViewChip: React.FC<{
  onPress: () => void;
  compact?: boolean;
}> = ({ onPress, compact }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    style={[styles.chip, compact && styles.chipCompact]}
  >
    <Eye size={compact ? 13 : 15} color="#1d4ed8" strokeWidth={2.4} />
    <Text style={[styles.label, compact && styles.labelCompact]}>View</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#60a5fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minHeight: 32,
    flexShrink: 0,
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    minHeight: 28,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  labelCompact: {
    fontSize: 11,
  },
});
