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

type SourceTab = 'ALL' | 'ADMIN' | 'MOBILE';

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

  const isMobile = log.source === 'MOBILE';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable
        style={styles.logCard}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.975, speed: 60, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }).start()}
        onPress={() => { if (log.old_values || log.new_values) onPress(log); }}
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
            <Animated.View style={[styles.sourceBadge, isMobile ? styles.sourceMobile : styles.sourceAdmin, { transform: [{ scale: sourcePulse }] }]}>
              {isMobile ? <Smartphone size={12} color="#047857" /> : <Laptop size={12} color="#1d4ed8" />}
              <Text style={[styles.sourceText, { color: isMobile ? '#047857' : '#1d4ed8' }]}>{log.source || 'ADMIN'}</Text>
            </Animated.View>
          </View>
          <View style={styles.logUserInfo}>
            <UserIcon size={14} color={COLORS.textMuted} />
            <Text style={styles.logUserName}>{log.name || log.username || 'System User'}</Text>
            {log.record_id ? <Text style={styles.recordIdText}>Record #{log.record_id}</Text> : null}
          </View>
          <View style={styles.logFooter}>
            <Text style={styles.logTime}>{formatIST(log.created_at)}</Text>
            {(log.old_values || log.new_values) && (
              <View style={styles.detailsBtn}>
                <Eye size={13} color="#2563eb" />
                <Text style={styles.detailsBtnText}>View Payload</Text>
              </View>
            )}
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
  const [counts, setCounts] = useState<{ total_all: number; total_admin: number; total_mobile: number }>({
    total_all: 0,
    total_admin: 0,
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
  const modalScale = useRef(new Animated.Value(0.88)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
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

  const openModal = (log: AuditLog) => {
    setSelectedLog(log);
    modalScale.setValue(0.88);
    modalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(modalScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalScale, { toValue: 0.88, duration: 180, useNativeDriver: true }),
      Animated.timing(modalOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setSelectedLog(null));
  };

  const handleExportCSV = async () => {
    Animated.sequence([
      Animated.spring(exportBtnScale, { toValue: 0.92, speed: 60, useNativeDriver: true }),
      Animated.spring(exportBtnScale, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
    ]).start();
    try {
      setIsExporting(true);
      const headers = ['ID', 'Date Time', 'User', 'Action', 'Module', 'Record ID', 'Platform Source', 'IP Address'];
      const rows = logs.map((l) => [
        l.id,
        new Date(l.created_at).toLocaleString('en-IN'),
        `${l.name || l.username || 'System'} (#${l.user_id || 'N/A'})`,
        l.action, l.module, l.record_id || '', l.source || 'ADMIN', l.ip_address || '',
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
        {(['ALL', 'ADMIN', 'MOBILE'] as SourceTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const Icon = tab === 'ALL' ? Globe : tab === 'ADMIN' ? Laptop : Smartphone;
          const count = tab === 'ALL' ? counts.total_all : tab === 'ADMIN' ? counts.total_admin : counts.total_mobile;
          const label = tab === 'ALL' ? 'All' : tab === 'ADMIN' ? 'Admin' : 'Mobile';
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
            <AnimatedLogCard key={log.id} log={log} index={i} onPress={openModal} />
          ))}
        </Animated.ScrollView>
      )}

      {/* ── Spring-animated Payload Modal ── */}
      <Modal
        visible={selectedLog !== null}
        animationType="none"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Audit Event Details</Text>
                <Text style={styles.modalSub}>{selectedLog?.action} on {selectedLog?.module}</Text>
              </View>
              <TouchableOpacity onPress={closeModal} style={{ padding: 4 }} activeOpacity={0.7}>
                <X size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {selectedLog?.old_values ? (
                <View style={styles.jsonBox}>
                  <Text style={styles.jsonHeader}>Previous State (Old Values):</Text>
                  <Text style={styles.jsonCode}>
                    {typeof selectedLog.old_values === 'string' ? selectedLog.old_values : JSON.stringify(selectedLog.old_values, null, 2)}
                  </Text>
                </View>
              ) : null}
              {selectedLog?.new_values ? (
                <View style={[styles.jsonBox, { marginTop: 10 }]}>
                  <Text style={[styles.jsonHeader, { color: '#4ade80' }]}>New State (Payload):</Text>
                  <Text style={styles.jsonCode}>
                    {typeof selectedLog.new_values === 'string' ? selectedLog.new_values : JSON.stringify(selectedLog.new_values, null, 2)}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
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
    gap: 10,
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
  logTime: {
    fontSize: 11,
    color: COLORS.textLight,
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
  jsonBox: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.md,
    padding: 10,
  },
  jsonHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f59e0b',
    marginBottom: 4,
  },
  jsonCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#e2e8f0',
  },
});
