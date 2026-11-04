import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
  X,
  Copy,
  ScanLine,
  ShieldAlert,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export type NoticeKind = 'upload' | 'loading' | 'success' | 'error' | 'warning';

type NoticeAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export type AppNoticeModalProps = {
  visible: boolean;
  kind: NoticeKind;
  title: string;
  message: string;
  detail?: string;
  actions?: NoticeAction[];
  onClose?: () => void;
};

const KIND_META: Record<NoticeKind, { bg: string; ring: string; tag: string; tagBg: string; tagColor: string }> = {
  upload: { bg: '#eff6ff', ring: '#bfdbfe', tag: 'UPLOAD BILL', tagBg: '#dbeafe', tagColor: '#1d4ed8' },
  loading: { bg: '#f5f3ff', ring: '#ddd6fe', tag: 'READING BILL', tagBg: '#ede9fe', tagColor: '#6d28d9' },
  success: { bg: '#ecfdf5', ring: '#a7f3d0', tag: 'WEIGHT CAPTURED', tagBg: '#d1fae5', tagColor: '#047857' },
  error: { bg: '#fef2f2', ring: '#fecaca', tag: 'ACTION REQUIRED', tagBg: '#fee2e2', tagColor: '#b91c1c' },
  warning: { bg: '#fffbeb', ring: '#fde68a', tag: 'PLEASE CHECK', tagBg: '#fef3c7', tagColor: '#b45309' },
};

export const AppNoticeModal: React.FC<AppNoticeModalProps> = ({
  visible,
  kind,
  title,
  message,
  detail,
  actions = [],
  onClose,
}) => {
  if (!visible) return null;
  const meta = KIND_META[kind];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {onClose && kind !== 'loading' ? (
            <TouchableOpacity style={styles.closeHit} onPress={onClose} hitSlop={12}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.iconWrap, { backgroundColor: meta.bg, borderColor: meta.ring }]}>
            {kind === 'loading' ? (
              <ActivityIndicator size="large" color="#6d28d9" />
            ) : kind === 'success' ? (
              <CheckCircle2 size={32} color="#047857" />
            ) : kind === 'upload' ? (
              <ScanLine size={32} color="#1d4ed8" />
            ) : kind === 'warning' ? (
              <AlertTriangle size={32} color="#d97706" />
            ) : title.toLowerCase().includes('duplicate') ? (
              <Copy size={32} color="#b91c1c" />
            ) : (
              <ShieldAlert size={32} color="#dc2626" />
            )}
          </View>

          <View style={[styles.tag, { backgroundColor: meta.tagBg }]}>
            <Text style={[styles.tagText, { color: meta.tagColor }]}>{meta.tag}</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}

          {actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action) => {
                const variant = action.variant || 'primary';
                return (
                  <TouchableOpacity
                    key={action.label}
                    style={[
                      styles.btn,
                      variant === 'primary' && styles.btnPrimary,
                      variant === 'secondary' && styles.btnSecondary,
                      variant === 'danger' && styles.btnDanger,
                      variant === 'ghost' && styles.btnGhost,
                    ]}
                    onPress={action.onPress}
                    activeOpacity={0.85}
                  >
                    {kind === 'upload' && action.label === 'Camera' ? (
                      <Camera size={16} color={COLORS.white} />
                    ) : null}
                    {kind === 'upload' && action.label === 'Gallery' ? (
                      <ImageIcon size={16} color={COLORS.primary} />
                    ) : null}
                    <Text
                      style={[
                        styles.btnText,
                        variant === 'secondary' && { color: COLORS.primary },
                        variant === 'ghost' && { color: COLORS.textMuted },
                      ]}
                    >
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    position: 'relative',
    ...SHADOWS.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  tag: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  detail: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: 18,
    gap: 8,
  },
  btn: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnSecondary: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  btnDanger: {
    backgroundColor: COLORS.dangerDark,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  closeHit: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
});
