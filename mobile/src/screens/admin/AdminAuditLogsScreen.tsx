import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import {
  History,
  Smartphone,
  Laptop,
  Globe,
  Tablet,
  Download,
  Search,
  Eye,
  X,
  User as UserIcon,
} from 'lucide-react-native';
import { adminAuditLogService } from '../../services/adminService';
import { AuditLog } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { exportCSV } from '../../utils/exportUtils';
import { formatReadableSummary, getAuditListLabel, getAuditStory, getReadableDetailRows, parseMaybeJson } from '../../utils/readableDetails';

type SourceTab = 'ALL' | 'ADMIN' | 'MOBILE_ADMIN' | 'MOBILE';

const platformMeta = (source?: string) => {
  const s = String(source || 'ADMIN').toUpperCase();
  if (s === 'MOBILE_ADMIN') return { key: 'MOBILE_ADMIN', label: 'Mobile Admin', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' };
  if (s === 'MOBILE') return { key: 'MOBILE', label: 'Mobile App', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
  return { key: 'ADMIN', label: 'Admin Panel', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
};

const formatIST = (dtStr: string) => {
  try {
    return new Date(dtStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dtStr; }
};

/* ─── Animated Log Card ─────────────────────────────────────── */
interface AnimatedLogCardProps {
  log: AuditLog;
  index: number;
  onPress: (log: AuditLog) => void;
}

const AnimatedLogCard: React.FC<AnimatedLogCardProps> = ({ log, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sourcePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 340,
        delay: Math.min(index * 55, 500),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0, friction: 7, tension: 50,
        delay: Math.min(index * 55, 500),
        useNativeDriver: true,
      }),
    ]).start();

    const pLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sourcePulse, { toValue: 1.1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sourcePulse, { toValue: 1.0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pLoop.start();
    return () => pLoop.stop();
  }, []);

  const plat = platformMeta(log.source);
  const SourceIcon = plat.key === 'MOBILE' ? Smartphone : plat.key === 'MOBILE_ADMIN' ? Tablet : Laptop;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable
        style={styles.logCard}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.975, speed: 60, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
        onPress={() => onPress(log)}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <View style={styles.logCardTop}>
            <View style={styles.actionWrap}>
              <View style={[styles.actionBadge, getActionStyle(log.action)]}>
                <Text style={[styles.actionBadgeText, getActionTextStyle(log.action)]}>{log.action}</Text>
              </View>
              <View style={styles.moduleBadge}>
                <Text style={styles.moduleBadgeText}>{log.module}</Text>
              </View>
            </View>
            <Animated.View style={[styles.sourceBadge, { backgroundColor: plat.bg, borderColor: plat.border, transform: [{ scale: sourcePulse }] }]}>
              <SourceIcon size={12} color={plat.color} />
              <Text style={[styles.sourceText, { color: plat.color }]}>{plat.label}</Text>
            </Animated.View>
          </View>
          <View style={styles.logUserInfo}>
            <UserIcon size={14} color={COLORS.textMuted} />
            <Text style={styles.logUserName}>{log.name || log.username || 'System User'}</Text>
            {log.record_id ? <Text style={styles.recordIdText}>Record #{log.record_id}</Text> : null}
          </View>
          <View style={styles.logFooter}>
            <Text style={styles.logTime}>{formatIST(log.created_at)}</Text>
            <View style={styles.detailsBtn}>
              <Eye size={13} color="#2563eb" />
              <Text style={styles.detailsBtnText}>{getAuditListLabel(log.details, log.action)}</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

/* ─── Main Screen ────────────────────────────────────────────── */
export const AdminAuditLogsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<SourceTab>('ALL');
  const [moduleFilter, setModuleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<{ total_all: number; total_admin: number; total_mobile_admin: number; total_mobile: number }>({
    total_all: 0,
    total_admin: 0,
    total_mobile_admin: 0,
    total_mobile: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // ── Animation values ──────────────────────────────────────────
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-12)).current;
  const listKey = useRef(0);
  const listFade = useRef(new Animated.Value(1)).current;
  const searchFocusBorder = useRef(new Animated.Value(0)).current;
  const exportBtnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(headerSlide, { toValue: 0, friction: 7, tension: 45, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      listFade.setValue(0);
      const res = await adminAuditLogService.getAuditLogs({
        page: 1,
        limit: 50,
        source: activeTab === 'ALL' ? undefined : activeTab,
        module: moduleFilter || undefined,
      });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
      if (res.data.counts) {
        setCounts({
          total_all: Number(res.data.counts.total_all) || 0,
          total_admin: Number(res.data.counts.total_admin) || 0,
          total_mobile_admin: Number(res.data.counts.total_mobile_admin) || 0,
          total_mobile: Number(res.data.counts.total_mobile) || 0,
        });
      }
      Animated.timing(listFade, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
      Alert.alert('Audit Log Error', err.message || 'Could not fetch logs.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, moduleFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleExportCSV = async () => {
    Animated.sequence([
      Animated.spring(exportBtnScale, { toValue: 0.92, speed: 60, useNativeDriver: true }),
      Animated.spring(exportBtnScale, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
    ]).start();
    try {
      setIsExporting(true);
      const headers = ['ID', 'Date Time', 'User', 'Action', 'Module', 'Record ID', 'Platform', 'Details'];
      const rows = logs.map((l) => [
        l.id,
        new Date(l.created_at).toLocaleString('en-IN'),
        `${l.name || l.username || 'System'} (#${l.user_id || 'N/A'})`,
        String(l.action || '').replace(/_/g, ' '),
        l.module,
        l.record_id || '',
        platformMeta(l.source).label,
        formatReadableSummary(l.details || l.new_values || l.old_values, 8),
      ]);
      await exportCSV(`KSP_Audit_Logs_${activeTab}_${Date.now()}`, headers, rows);
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const searchBorderColor = searchFocusBorder.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.accent] });
  const searchBorderWidth = searchFocusBorder.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.module && l.module.toLowerCase().includes(q)) ||
      (l.username && l.username.toLowerCase().includes(q)) ||
      (l.name && l.name.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* ── Animated Tab Bar ── */}
      <Animated.View style={[styles.tabBar, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
        {(['ALL', 'ADMIN', 'MOBILE_ADMIN', 'MOBILE'] as SourceTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const Icon = tab === 'ALL' ? Globe : tab === 'ADMIN' ? Laptop : tab === 'MOBILE_ADMIN' ? Tablet : Smartphone;
          const count = tab === 'ALL' ? counts.total_all : tab === 'ADMIN' ? counts.total_admin : tab === 'MOBILE_ADMIN' ? counts.total_mobile_admin : counts.total_mobile;
          const label = tab === 'ALL' ? 'All' : tab === 'ADMIN' ? 'Panel' : tab === 'MOBILE_ADMIN' ? 'Mobile Admin' : 'Mobile';
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Icon size={15} color={isActive ? COLORS.accent : COLORS.textMuted} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label} ({count})</Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* ── Animated Search + Filters ── */}
      <Animated.View style={[styles.filterSection, { opacity: headerFade }]}>
        <Animated.View style={[styles.searchBar, { borderColor: searchBorderColor, borderWidth: searchBorderWidth }]}>
          <Search size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search action, module, user..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => Animated.timing(searchFocusBorder, { toValue: 1, duration: 200, useNativeDriver: false }).start()}
            onBlur={() => Animated.timing(searchFocusBorder, { toValue: 0, duration: 200, useNativeDriver: false }).start()}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {['', 'AUTH', 'TRIPS', 'PAYMENTS', 'EXPENSES', 'SETTLEMENTS', 'VEHICLES', 'DRIVERS', 'USERS'].map((m) => (
            <TouchableOpacity key={m} style={[styles.chip, moduleFilter === m && styles.chipActive]} onPress={() => setModuleFilter(m)} activeOpacity={0.75}>
              <Text style={[styles.chipText, moduleFilter === m && styles.chipTextActive]}>{m === '' ? 'All Modules' : m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Sub-header ── */}
      <View style={styles.subHeader}>
        <Text style={styles.countText}>Showing {filteredLogs.length} audit records</Text>
        <Animated.View style={{ transform: [{ scale: exportBtnScale }] }}>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} disabled={isExporting} activeOpacity={0.85}>
            {isExporting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Download size={14} color={COLORS.white} />
                <Text style={styles.exportBtnText}>Export CSV</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Animated Logs List ── */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Fetching Audit Logs...</Text>
        </View>
      ) : filteredLogs.length === 0 ? (
        <View style={styles.centerBox}>
          <History size={36} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No audit activity logs found</Text>
        </View>
      ) : (
        <Animated.ScrollView style={{ opacity: listFade }} contentContainerStyle={styles.listContainer}>
          {filteredLogs.map((log, i) => (
            <AnimatedLogCard
              key={log.id}
              log={log}
              index={i}
              onPress={setSelectedLog}
            />
          ))}
        </Animated.ScrollView>
      )}

      <Modal visible={selectedLog !== null} animationType="slide" transparent onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalTitle}>{selectedLog ? getAuditListLabel(selectedLog.details, selectedLog.action) : 'Details'}</Text>
                <Text style={styles.modalSub}>{(selectedLog?.action || '').replace(/_/g, ' ')} • {selectedLog?.module}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedLog(null)} style={{ padding: 4 }} activeOpacity={0.7}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {(() => {
                if (!selectedLog) return null;
                const details = selectedLog.details || selectedLog.new_values || selectedLog.old_values;
                const parsed: any = parseMaybeJson(details) || {};
                const story = getAuditStory(details) || formatReadableSummary(details, 8);
                const rows = getReadableDetailRows(details);
                return (
                  <>
                    <View style={styles.storyBox}>
                      <Text style={styles.storyBoxLabel}>What happened</Text>
                      <Text style={styles.storyBoxText}>{story === '—' ? 'No extra details were recorded for this action.' : story}</Text>
                    </View>
                    {(parsed.driver_name || parsed.owner_name || parsed.lorry_number) ? (
                      <View style={styles.peopleGrid}>
                        <View style={[styles.peopleCard, { backgroundColor: '#fff7ed' }]}>
                          <Text style={styles.peopleCardLabel}>Driver</Text>
                          <Text style={styles.peopleCardValue}>{parsed.driver_name || '—'}</Text>
                        </View>
                        <View style={[styles.peopleCard, { backgroundColor: '#f5f3ff' }]}>
                          <Text style={styles.peopleCardLabel}>Owner</Text>
                          <Text style={styles.peopleCardValue}>{parsed.owner_name || '—'}</Text>
                        </View>
                        <View style={[styles.peopleCard, { backgroundColor: '#ecfdf5' }]}>
                          <Text style={styles.peopleCardLabel}>Lorry</Text>
                          <Text style={styles.peopleCardValue}>{parsed.lorry_number || '—'}</Text>
                        </View>
                      </View>
                    ) : null}
                    {rows.map((row, idx) => (
                      <View key={`${row.label}-${idx}`} style={[styles.detailRow, idx % 2 === 1 && styles.detailRowAlt]}>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    ))}
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getActionStyle = (action: string) => {
  if (action?.includes('CREATE') || action?.includes('ADD')) {
    return { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' };
  }
  if (action?.includes('DELETE') || action?.includes('REMOVE')) {
    return { backgroundColor: '#fef2f2', borderColor: '#fca5a5' };
  }
  if (action?.includes('UPDATE') || action?.includes('EDIT') || action?.includes('CHANGE')) {
    return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
  }
  if (action?.includes('LOGIN')) {
    return { backgroundColor: '#fef3c7', borderColor: '#fde68a' };
  }
  return { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' };
};

const getActionTextStyle = (action: string) => {
  if (action?.includes('CREATE') || action?.includes('ADD')) return { color: '#047857' };
  if (action?.includes('DELETE') || action?.includes('REMOVE')) return { color: '#b91c1c' };
  if (action?.includes('UPDATE') || action?.includes('EDIT')) return { color: '#1d4ed8' };
  if (action?.includes('LOGIN')) return { color: '#b45309' };
  return { color: '#475569' };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flexGrow: 1,
    minWidth: '25%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  filterSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    ...SHADOWS.sm,
  },
  exportBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 40,
  },
  logCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  logCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  moduleBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  moduleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sourceAdmin: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  sourceMobile: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '800',
  },
  logUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  logUserName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  recordIdText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginLeft: 6,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    paddingTop: 6,
  },
  peopleLine: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  storyLine: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  inlineDetailRow: {
    marginTop: 6,
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  storyBox: {
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
  },
  storyBoxLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1d4ed8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  storyBoxText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  peopleGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  peopleCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: 8,
  },
  peopleCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  peopleCardValue: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    maxWidth: 180,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  detailRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  detailRowAlt: {
    backgroundColor: '#f8fafc',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
});
