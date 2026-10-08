import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import {
  Sliders,
  Plus,
  Trash2,
  X,
  MapPin,
  Sparkles,
  Layers,
  Scale,
  CreditCard,
  DollarSign,
  UserCheck,
  Building,
} from 'lucide-react-native';
import {
  adminUnitService,
  adminRouteService,
  adminFreightRateService,
  adminCleaningExpenseRateService,
  adminUnloadingRateService,
  adminDriverBataRateService,
  adminOtherExpenseLimitService,
  adminOwnerService,
  adminPartyService,
} from '../../services/adminService';
import {
  Unit,
  Route,
  FreightRate,
  CleaningExpenseRate,
  UnloadingRate,
  DriverBataRate,
  OtherExpenseLimit,
  Owner,
  Party,
} from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type MasterTab = 'UNITS' | 'ROUTES' | 'CLEANING' | 'UNLOADING' | 'BATA' | 'LIMITS' | 'OWNERS';

export const AdminMastersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<MasterTab>('UNITS');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [units, setUnits] = useState<Unit[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cleaningRates, setCleaningRates] = useState<CleaningExpenseRate[]>([]);
  const [unloadingRates, setUnloadingRates] = useState<UnloadingRate[]>([]);
  const [bataRates, setBataRates] = useState<DriverBataRate[]>([]);
  const [limits, setLimits] = useState<OtherExpenseLimit[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  // Add Modals
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

  const [isAddCleaningOpen, setIsAddCleaningOpen] = useState(false);
  const [cleaningUnitName, setCleaningUnitName] = useState('');
  const [cleaningCharge, setCleaningCharge] = useState('');

  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeRate, setRouteRate] = useState('');

  const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');

  const [isAddBataOpen, setIsAddBataOpen] = useState(false);
  const [bataPercentage, setBataPercentage] = useState('');
  const [bataMultiplier, setBataMultiplier] = useState('');

  const [isAddLimitOpen, setIsAddLimitOpen] = useState(false);
  const [maxAmount, setMaxAmount] = useState('');
  const [limitDesc, setLimitDesc] = useState('');

  const loadActiveTabData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'UNITS') {
        const res = await adminUnitService.getUnits();
        setUnits(res.data || []);
      } else if (activeTab === 'ROUTES') {
        const res = await adminRouteService.getRoutes({ limit: 100 });
        setRoutes(res.data.items || []);
      } else if (activeTab === 'CLEANING') {
        const res = await adminCleaningExpenseRateService.getCleaningExpenseRates();
        setCleaningRates(res.data || []);
      } else if (activeTab === 'UNLOADING') {
        const res = await adminUnloadingRateService.getUnloadingRates();
        setUnloadingRates(res.data || []);
      } else if (activeTab === 'BATA') {
        const res = await adminDriverBataRateService.getDriverBataRates();
        setBataRates(res.data || []);
      } else if (activeTab === 'LIMITS') {
        const res = await adminOtherExpenseLimitService.getOtherExpenseLimits();
        setLimits(res.data || []);
      } else if (activeTab === 'OWNERS') {
        const res = await adminOwnerService.getOwners({ limit: 100 });
        setOwners(res.data.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load tab data', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Actions
  const handleCreateUnit = async () => {
    if (!newUnitName.trim()) return Alert.alert('Required', 'Unit name is required');
    try {
      await adminUnitService.createUnit({ name: newUnitName.trim(), abbreviation: newUnitAbbr.trim() || undefined });
      setIsAddUnitOpen(false);
      setNewUnitName('');
      setNewUnitAbbr('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDeleteUnit = (id: number) => {
    Alert.alert('Delete', 'Delete this unit?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminUnitService.deleteUnit(id);
            loadActiveTabData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleCreateCleaning = async () => {
    if (!cleaningUnitName.trim() || !cleaningCharge) return Alert.alert('Required', 'All fields required');
    try {
      await adminCleaningExpenseRateService.createCleaningExpenseRate({
        unit_name: cleaningUnitName.trim(),
        cleaning_charge: parseFloat(cleaningCharge) || 0,
      });
      setIsAddCleaningOpen(false);
      setCleaningUnitName('');
      setCleaningCharge('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCreateRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) return Alert.alert('Required', 'From and To locations are required');
    try {
      await adminRouteService.createRoute({
        from_location: routeFrom.trim(),
        to_location: routeTo.trim(),
        rate_per_unit: parseFloat(routeRate) || undefined,
      });
      setIsAddRouteOpen(false);
      setRouteFrom('');
      setRouteTo('');
      setRouteRate('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCreateOwner = async () => {
    if (!ownerName.trim()) return Alert.alert('Required', 'Owner name required');
    try {
      await adminOwnerService.createOwner({ name: ownerName.trim(), mobile_number: ownerMobile.trim() || undefined });
      setIsAddOwnerOpen(false);
      setOwnerName('');
      setOwnerMobile('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCreateBata = async () => {
    if (!bataPercentage || !bataMultiplier) return Alert.alert('Required', 'Percentage and Multiplier required');
    try {
      await adminDriverBataRateService.createDriverBataRate({
        rate_percentage: parseFloat(bataPercentage) || 0,
        rate_multiplier: parseFloat(bataMultiplier) || 0,
      });
      setIsAddBataOpen(false);
      setBataPercentage('');
      setBataMultiplier('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCreateLimit = async () => {
    if (!maxAmount) return Alert.alert('Required', 'Max Amount required');
    try {
      await adminOtherExpenseLimitService.createOtherExpenseLimit({
        max_amount: parseFloat(maxAmount) || 0,
        description: limitDesc.trim() || undefined,
      });
      setIsAddLimitOpen(false);
      setMaxAmount('');
      setLimitDesc('');
      loadActiveTabData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        {[
          { id: 'UNITS', label: 'Units Master', icon: Scale },
          { id: 'ROUTES', label: 'Routes & Rates', icon: MapPin },
          { id: 'CLEANING', label: 'Cleaning Charges', icon: Sparkles },
          { id: 'UNLOADING', label: 'Unloading Rates', icon: Layers },
          { id: 'BATA', label: 'Driver Bata %', icon: DollarSign },
          { id: 'LIMITS', label: 'Expense Limits', icon: Sliders },
          { id: 'OWNERS', label: 'Owners', icon: UserCheck },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.id as MasterTab)}
            >
              <Icon size={14} color={isActive ? COLORS.primaryDark : COLORS.textMuted} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content Area */}
      <View style={styles.contentHeader}>
        <Text style={styles.sectionTitle}>
          {activeTab === 'UNITS' && `Units (${units.length})`}
          {activeTab === 'ROUTES' && `Routes & Rates (${routes.length})`}
          {activeTab === 'CLEANING' && `Cleaning Charges (${cleaningRates.length})`}
          {activeTab === 'UNLOADING' && `Unloading Rates (${unloadingRates.length})`}
          {activeTab === 'BATA' && `Driver Bata Rates (${bataRates.length})`}
          {activeTab === 'LIMITS' && `Expense Limits (${limits.length})`}
          {activeTab === 'OWNERS' && `Owners (${owners.length})`}
        </Text>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            if (activeTab === 'UNITS') setIsAddUnitOpen(true);
            else if (activeTab === 'ROUTES') setIsAddRouteOpen(true);
            else if (activeTab === 'CLEANING') setIsAddCleaningOpen(true);
            else if (activeTab === 'OWNERS') setIsAddOwnerOpen(true);
            else if (activeTab === 'BATA') setIsAddBataOpen(true);
            else if (activeTab === 'LIMITS') setIsAddLimitOpen(true);
          }}
        >
          <Plus size={16} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Master Records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {/* UNITS */}
          {activeTab === 'UNITS' &&
            units.map((u) => (
              <View key={u.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>{u.name}</Text>
                  {u.abbreviation ? (
                    <Text style={styles.itemSub}>Abbr: {u.abbreviation}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteUnit(u.id)}>
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}

          {/* ROUTES */}
          {activeTab === 'ROUTES' &&
            routes.map((r) => (
              <View key={r.id} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{r.from_location} → {r.to_location}</Text>
                  {r.party_name ? <Text style={styles.itemSub}>Party: {r.party_name}</Text> : null}
                  {r.rate_per_unit ? (
                    <Text style={[styles.itemSub, { color: '#047857', fontWeight: '700' }]}>
                      Rate: ₹{r.rate_per_unit}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}

          {/* CLEANING */}
          {activeTab === 'CLEANING' &&
            cleaningRates.map((c) => (
              <View key={c.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>{c.unit_name}</Text>
                  <Text style={[styles.itemSub, { color: '#047857', fontWeight: '800' }]}>
                    Charge: ₹{c.cleaning_charge}
                  </Text>
                </View>
              </View>
            ))}

          {/* UNLOADING */}
          {activeTab === 'UNLOADING' &&
            unloadingRates.map((ul) => (
              <View key={ul.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>{ul.party_name || `Party #${ul.party_id}`}</Text>
                  <Text style={styles.itemSub}>
                    {ul.unit_name} • ₹{ul.rate_per_ton} / ton
                  </Text>
                </View>
              </View>
            ))}

          {/* BATA */}
          {activeTab === 'BATA' &&
            bataRates.map((b) => (
              <View key={b.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>
                    {b.rate_percentage}% (Multiplier: {b.rate_multiplier})
                  </Text>
                  <Text style={styles.itemSub}>
                    {b.party_name ? `Party: ${b.party_name}` : 'Default General Rate'}
                  </Text>
                </View>
              </View>
            ))}

          {/* LIMITS */}
          {activeTab === 'LIMITS' &&
            limits.map((l) => (
              <View key={l.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>Max Limit: ₹{l.max_amount}</Text>
                  {l.description ? <Text style={styles.itemSub}>{l.description}</Text> : null}
                </View>
              </View>
            ))}

          {/* OWNERS */}
          {activeTab === 'OWNERS' &&
            owners.map((o) => (
              <View key={o.id} style={styles.itemCard}>
                <View>
                  <Text style={styles.itemTitle}>{o.name}</Text>
                  {o.mobile_number ? (
                    <Text style={styles.itemSub}>Phone: {o.mobile_number}</Text>
                  ) : null}
                </View>
              </View>
            ))}
        </ScrollView>
      )}

      {/* Add Unit Modal */}
      <Modal visible={isAddUnitOpen} transparent animationType="slide" onRequestClose={() => setIsAddUnitOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Unit Master</Text>
              <TouchableOpacity onPress={() => setIsAddUnitOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Unit Name (e.g. Metric Ton)</Text>
            <TextInput style={styles.input} value={newUnitName} onChangeText={setNewUnitName} placeholder="Metric Ton" />
            <Text style={styles.label}>Abbreviation (e.g. MT)</Text>
            <TextInput style={styles.input} value={newUnitAbbr} onChangeText={setNewUnitAbbr} placeholder="MT" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddUnitOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateUnit}><Text style={styles.submitText}>Save Unit</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Route Modal */}
      <Modal visible={isAddRouteOpen} transparent animationType="slide" onRequestClose={() => setIsAddRouteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Route</Text>
              <TouchableOpacity onPress={() => setIsAddRouteOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>From Location *</Text>
            <TextInput style={styles.input} value={routeFrom} onChangeText={setRouteFrom} placeholder="e.g. Salem" />
            <Text style={styles.label}>To Location *</Text>
            <TextInput style={styles.input} value={routeTo} onChangeText={setRouteTo} placeholder="e.g. Chennai" />
            <Text style={styles.label}>Standard Rate Per Unit (₹)</Text>
            <TextInput style={styles.input} value={routeRate} onChangeText={setRouteRate} placeholder="0.00" keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddRouteOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateRoute}><Text style={styles.submitText}>Save Route</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Cleaning Modal */}
      <Modal visible={isAddCleaningOpen} transparent animationType="slide" onRequestClose={() => setIsAddCleaningOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Cleaning Rate</Text>
              <TouchableOpacity onPress={() => setIsAddCleaningOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Unit / Commodity Name</Text>
            <TextInput style={styles.input} value={cleaningUnitName} onChangeText={setCleaningUnitName} placeholder="e.g. Cement Tanker" />
            <Text style={styles.label}>Cleaning Charge (₹)</Text>
            <TextInput style={styles.input} value={cleaningCharge} onChangeText={setCleaningCharge} placeholder="250" keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddCleaningOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateCleaning}><Text style={styles.submitText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Owner Modal */}
      <Modal visible={isAddOwnerOpen} transparent animationType="slide" onRequestClose={() => setIsAddOwnerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Vehicle Owner</Text>
              <TouchableOpacity onPress={() => setIsAddOwnerOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Owner Full Name</Text>
            <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="e.g. K. Periasamy" />
            <Text style={styles.label}>Mobile Phone Number</Text>
            <TextInput style={styles.input} value={ownerMobile} onChangeText={setOwnerMobile} placeholder="9876543210" keyboardType="phone-pad" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddOwnerOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateOwner}><Text style={styles.submitText}>Save Owner</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Driver Bata Modal */}
      <Modal visible={isAddBataOpen} transparent animationType="slide" onRequestClose={() => setIsAddBataOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Driver Bata Rate</Text>
              <TouchableOpacity onPress={() => setIsAddBataOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Rate Percentage (%)</Text>
            <TextInput style={styles.input} value={bataPercentage} onChangeText={setBataPercentage} placeholder="e.g. 5" keyboardType="numeric" />
            <Text style={styles.label}>Rate Multiplier</Text>
            <TextInput style={styles.input} value={bataMultiplier} onChangeText={setBataMultiplier} placeholder="e.g. 0.05" keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddBataOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateBata}><Text style={styles.submitText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Expense Limit Modal */}
      <Modal visible={isAddLimitOpen} transparent animationType="slide" onRequestClose={() => setIsAddLimitOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense Limit</Text>
              <TouchableOpacity onPress={() => setIsAddLimitOpen(false)}><X size={20} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Max Allowed Amount (₹)</Text>
            <TextInput style={styles.input} value={maxAmount} onChangeText={setMaxAmount} placeholder="e.g. 500" keyboardType="numeric" />
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={limitDesc} onChangeText={setLimitDesc} placeholder="Description..." />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddLimitOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateLimit}><Text style={styles.submitText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabScroll: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    maxHeight: 50,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
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
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    padding: SPACING.md,
    gap: 8,
    paddingBottom: 40,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
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
    marginBottom: SPACING.sm,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  submitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  submitText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
});
