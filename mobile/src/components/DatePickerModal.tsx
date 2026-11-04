import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Convert YYYY-MM-DD → DD-MM-YYYY for display */
export const toDisplayDate = (val: string): string => {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length !== 3) return val;
  if (parts[0].length === 4) {
    // YYYY-MM-DD -> DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return val;
};

/** Convert DD-MM-YYYY → YYYY-MM-DD for API */
export const toIsoDate = (val: string): string => {
  if (!val) return '';
  const parts = val.split('-');
  if (parts.length !== 3) return val;
  if (parts[0].length === 2 && parts[2].length === 4) {
    // DD-MM-YYYY -> YYYY-MM-DD
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return val;
};

interface DatePickerModalProps {
  visible: boolean;
  value: string;           // YYYY-MM-DD or DD-MM-YYYY
  title?: string;
  onConfirm: (isoDate: string) => void;  // returns YYYY-MM-DD
  onClose: () => void;
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  value,
  title = 'Select Date',
  onConfirm,
  onClose,
}) => {
  const today = new Date();

  const parseInitial = (): { y: number; m: number; d: number } => {
    if (value) {
      const iso = toIsoDate(value);
      const [y, m, d] = iso.split('-').map(Number);
      if (y && m && d) return { y, m: m - 1, d };
    }
    return { y: today.getFullYear(), m: today.getMonth(), d: 0 };
  };

  const initial = parseInitial();
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);
  const [selectedDay, setSelectedDay] = useState<number>(initial.d);
  const [selectedMonth, setSelectedMonth] = useState(initial.m);
  const [selectedYear, setSelectedYear] = useState(initial.y);

  // Re-sync when modal opens with a new value
  React.useEffect(() => {
    if (visible) {
      const p = parseInitial();
      setViewYear(p.y);
      setViewMonth(p.m);
      setSelectedDay(p.d);
      setSelectedMonth(p.m);
      setSelectedYear(p.y);
    }
  }, [visible]);

  const cells = buildCalendarDays(viewYear, viewMonth);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }, [viewMonth]);

  const handleSelectDay = (day: number | null) => {
    if (!day) return;
    setSelectedDay(day);
    setSelectedMonth(viewMonth);
    setSelectedYear(viewYear);
  };

  const isSelected = (day: number | null) =>
    day !== null &&
    day === selectedDay &&
    viewMonth === selectedMonth &&
    viewYear === selectedYear;

  const isToday = (day: number | null) =>
    day !== null &&
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const handleConfirm = () => {
    if (!selectedDay) return;
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    onConfirm(`${selectedYear}-${mm}-${dd}`);
  };

  const handleClear = () => {
    setSelectedDay(0);
    onConfirm('');
  };

  const handleToday = () => {
    const t = new Date();
    setSelectedDay(t.getDate());
    setSelectedMonth(t.getMonth());
    setSelectedYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setViewYear(t.getFullYear());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Month Navigation */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <ChevronLeft size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <ChevronRight size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaderRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.cell,
                  isSelected(day) && styles.cellSelected,
                  isToday(day) && !isSelected(day) && styles.cellToday,
                  !day && styles.cellEmpty,
                ]}
                onPress={() => handleSelectDay(day)}
                activeOpacity={day ? 0.7 : 1}
              >
                <Text style={[
                  styles.cellText,
                  isSelected(day) && styles.cellTextSelected,
                  isToday(day) && !isSelected(day) && styles.cellTextToday,
                  !day && { opacity: 0 },
                ]}>
                  {day ?? '·'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected date display */}
          <View style={styles.selectedDisplay}>
            <Text style={styles.selectedLabel}>Selected:</Text>
            <Text style={styles.selectedValue}>
              {selectedDay
                ? `${String(selectedDay).padStart(2, '0')}-${String(selectedMonth + 1).padStart(2, '0')}-${selectedYear}`
                : '—'}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayBtn} onPress={handleToday}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Check size={14} color={COLORS.white} />
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    width: '100%',
    maxWidth: 340,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  navBtn: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CELL_SIZE / 2,
    marginVertical: 1,
  },
  cellEmpty: {
    opacity: 0,
  },
  cellSelected: {
    backgroundColor: COLORS.primary,
  },
  cellToday: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  cellTextSelected: {
    color: COLORS.white,
    fontWeight: '800',
  },
  cellTextToday: {
    color: COLORS.accentDark,
    fontWeight: '800',
  },
  selectedDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  selectedValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: SPACING.sm,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  todayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
});
