import React from 'react';
import { formatDateDMY } from '../utils/dateUtils';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  ShieldAlert,
  AlertTriangle,
  FileText,
  CheckCircle2,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

export interface ComplianceDoc {
  name: string;
  date: string;
  days: number;
  isExpired: boolean;
}

export interface ComplianceAlertModalProps {
  visible: boolean;
  type?: 'VEHICLE' | 'DRIVER';
  entityName: string;
  documents: ComplianceDoc[];
  notice?: string;
  onProceed: () => void;
  onCancel: () => void;
  proceedText?: string;
  cancelText?: string;
}

export const ComplianceAlertModal: React.FC<ComplianceAlertModalProps> = ({
  visible,
  type = 'VEHICLE',
  entityName,
  documents,
  notice,
  onProceed,
  onCancel,
  proceedText = 'Acknowledge & Proceed',
  cancelText,
}) => {
  if (!visible) return null;

  const hasExpired = documents.some((d) => d.isExpired);
  const defaultCancelText = type === 'VEHICLE' ? 'Choose Another Truck' : 'Choose Another Driver';

  const formatDisplayDate = (dateStr: string) => {
    return formatDateDMY(dateStr);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon & Tag */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                hasExpired ? styles.iconCircleExpired : styles.iconCircleWarning,
              ]}
            >
              <ShieldAlert
                size={30}
                color={hasExpired ? '#dc2626' : '#d97706'}
              />
            </View>

            <View style={styles.headerTextGroup}>
              <View
                style={[
                  styles.statusTag,
                  hasExpired ? styles.statusTagExpired : styles.statusTagWarning,
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    hasExpired ? styles.statusTagTextExpired : styles.statusTagTextWarning,
                  ]}
                >
                  {hasExpired ? 'CRITICAL COMPLIANCE NOTICE' : 'RENEWAL DUE (≤ 30 DAYS)'}
                </Text>
              </View>

              <Text style={styles.title}>
                {hasExpired
                  ? type === 'VEHICLE'
                    ? 'Truck Compliance Expired'
                    : 'Driver License Expired'
                  : type === 'VEHICLE'
                  ? 'Truck Expiry Notice'
                  : 'Driver License Notice'}
              </Text>
            </View>
          </View>

          {/* Vehicle / Driver Badge */}
          <View style={styles.entityRow}>
            {type === 'VEHICLE' ? (
              <View style={styles.numberPlate}>
                <View style={styles.plateIndStripe}>
                  <Text style={styles.plateIndText}>IND</Text>
                </View>
                <Truck size={16} color="#0f172a" style={{ marginHorizontal: 6 }} />
                <Text style={styles.numberPlateText}>{entityName}</Text>
              </View>
            ) : (
              <View style={styles.driverBadge}>
                <User size={16} color={COLORS.primary} />
                <Text style={styles.driverBadgeText}>{entityName}</Text>
              </View>
            )}
            <Text style={styles.entitySummary}>
              {documents.length} document{documents.length === 1 ? '' : 's'} require attention
            </Text>
          </View>

          {/* Document Items List */}
          <ScrollView style={styles.docList} bounces={false}>
            {documents.map((doc, idx) => {
              const formattedDate = formatDisplayDate(doc.date);
              return (
                <View
                  key={idx}
                  style={[
                    styles.docCard,
                    doc.isExpired ? styles.docCardExpired : styles.docCardWarning,
                  ]}
                >
                  <View style={styles.docInfo}>
                    <View style={styles.docNameRow}>
                      <FileText
                        size={15}
                        color={doc.isExpired ? '#dc2626' : '#d97706'}
                      />
                      <Text style={styles.docName}>{doc.name}</Text>
                    </View>

                    <Text style={styles.docExpirySub}>
                      {doc.isExpired
                        ? `Expired on ${formattedDate} (${Math.abs(doc.days)}d ago)`
                        : doc.days === 0
                        ? `Expires Today (${formattedDate})`
                        : `Expires in ${doc.days} days (${formattedDate})`}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pill,
                      doc.isExpired ? styles.pillExpired : styles.pillWarning,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        doc.isExpired ? styles.pillTextExpired : styles.pillTextWarning,
                      ]}
                    >
                      {doc.isExpired ? 'EXPIRED' : `${doc.days}d left`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Notice Box */}
          <View style={styles.noticeBox}>
            <AlertTriangle size={15} color="#b45309" style={{ marginTop: 1 }} />
            <Text style={styles.noticeText}>
              {notice ||
                'Ensure valid renewal before highway dispatch to prevent RTO transit penalties or vehicle detention.'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionGroup}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onProceed}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={18} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>{proceedText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <RefreshCw size={15} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>
                {cancelText || defaultCancelText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleExpired: {
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  iconCircleWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fde68a',
  },
  headerTextGroup: {
    flex: 1,
  },
  statusTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginBottom: 4,
  },
  statusTagExpired: {
    backgroundColor: '#fef2f2',
  },
  statusTagWarning: {
    backgroundColor: '#fffbeb',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusTagTextExpired: {
    color: '#b91c1c',
  },
  statusTagTextWarning: {
    color: '#b45309',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  numberPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    borderRadius: 6,
    paddingRight: 10,
    overflow: 'hidden',
  },
  plateIndStripe: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateIndText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
  },
  numberPlateText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  driverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  driverBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  entitySummary: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  docList: {
    maxHeight: 200,
    marginBottom: SPACING.md,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  docCardExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  docCardWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  docInfo: {
    flex: 1,
    marginRight: 8,
  },
  docNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  docName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  docExpirySub: {
    fontSize: 11.5,
    color: COLORS.textMuted,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pillExpired: {
    backgroundColor: '#fee2e2',
  },
  pillWarning: {
    backgroundColor: '#fef3c7',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pillTextExpired: {
    color: '#dc2626',
  },
  pillTextWarning: {
    color: '#b45309',
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: SPACING.lg,
  },
  noticeText: {
    fontSize: 11.5,
    color: '#475569',
    flex: 1,
    lineHeight: 16,
  },
  actionGroup: {
    flexDirection: 'column',
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    height: 48,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.sm,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
});
