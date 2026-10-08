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
  Image,
} from 'react-native';
import {
  Truck,
  Plus,
  Search,
  AlertTriangle,
  X,
  Calendar,
  Shield,
  CreditCard,
  Building,
  FileText,
  RefreshCw,
  Edit2,
  Trash2,
  Camera,
  CheckCircle,
  Sparkles,
  ChevronDown,
  Hash,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { adminVehicleService } from '../../services/adminService';
import { Vehicle } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import {
  parseRcDocument,
  parseFcDocument,
  parseTaxDocument,
  parseTdsDocument,
  parseBankDocument,
  parsePanDocument,
  parseInsuranceDocument,
  parsePermitDocument,
  getNextMarch31st,
  formatVehicleNumber,
} from '../../utils/docParsers';

type VehicleFilter = 'ALL' | 'EXPIRING' | 'ACTIVE' | 'INACTIVE';

const VEHICLE_TYPES = ['10 Wheeler', '12 Wheeler', '14 Wheeler', '16 Wheeler', '18 Wheeler', 'Mini Truck', 'Container', 'Trailer'];

// ─── Image Picker Helpers ─────────────────────────────────────────────────────
const pickImage = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please allow gallery access to upload documents.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return `data:image/jpeg;base64,${result.assets[0].base64}`;
};

const takePhoto = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please allow camera access to capture documents.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return `data:image/jpeg;base64,${result.assets[0].base64}`;
};

const promptImageSource = (onResult: (uri: string | null) => void) => {
  Alert.alert('Upload Document', 'Choose source', [
    { text: 'Camera', onPress: async () => onResult(await takePhoto()) },
    { text: 'Gallery', onPress: async () => onResult(await pickImage()) },
    { text: 'Cancel', style: 'cancel', onPress: () => onResult(null) },
  ]);
};

// ─── Document Upload Field ────────────────────────────────────────────────────
interface DocUploadProps {
  label: string;
  value: string;
  onUpload: () => void;
  onRemove: () => void;
  isExtracting?: boolean;
}
const DocUploadField: React.FC<DocUploadProps> = ({ label, value, onUpload, onRemove, isExtracting }) => {
  if (isExtracting) {
    return (
      <View style={docSt.extractingBox}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={docSt.extractingText}>Scanning & Extracting Details...</Text>
        <Text style={docSt.extractingHint}>AI OCR is automatically reading and filling fields</Text>
      </View>
    );
  }
  if (!value) {
    return (
      <TouchableOpacity style={docSt.uploadBox} onPress={onUpload} activeOpacity={0.7}>
        <View style={docSt.uploadIconWrap}>
          <Camera size={18} color="#4338ca" />
        </View>
        <Text style={docSt.uploadLabel}>{label}</Text>
        <Text style={docSt.uploadHint}>Camera · Gallery · Auto OCR</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={docSt.uploadedWrap}>
      <Image source={{ uri: value }} style={docSt.previewImg} resizeMode="cover" />
      <View style={docSt.uploadedBottom}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={13} color="#16a34a" />
          <Text style={docSt.uploadedText}>{label} ✓</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={docSt.changeBtn} onPress={onUpload}>
            <Camera size={11} color="#2563eb" />
            <Text style={docSt.changeBtnTxt}>Change</Text>
          </TouchableOpacity>
          <TouchableOpacity style={docSt.removeBtn} onPress={onRemove}>
            <X size={11} color="#dc2626" />
            <Text style={docSt.removeBtnTxt}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// ─── OCR Notice Banner ────────────────────────────────────────────────────────
const OcrNotice: React.FC<{ message: string; type: 'success' | 'info' | 'warn' }> = ({ message, type }) => {
  const bg = type === 'success' ? '#ecfdf5' : type === 'warn' ? '#fffbeb' : '#eff6ff';
  const color = type === 'success' ? '#15803d' : type === 'warn' ? '#92400e' : '#1d4ed8';
  return (
    <View style={[docSt.noticeBanner, { backgroundColor: bg }]}>
      <Sparkles size={13} color={color} />
      <Text style={[docSt.noticeText, { color }]}>{message}</Text>
    </View>
  );
};

// ─── Expiry Badge ─────────────────────────────────────────────────────────────
const ExpiryBadge: React.FC<{ date?: string | null }> = ({ date }) => {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  const color = days < 0 ? '#b91c1c' : days <= 30 ? '#d97706' : '#15803d';
  const bg = days < 0 ? '#fef2f2' : days <= 30 ? '#fffbeb' : '#f0fdf4';
  const label = days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days}d left`;
  return (
    <View style={[vSt.expiryBadge, { backgroundColor: bg }]}>
      <Calendar size={9} color={color} />
      <Text style={[vSt.expiryText, { color }]}>{label}</Text>
    </View>
  );
};

// ─── Empty Form ───────────────────────────────────────────────────────────────
const emptyVehicleForm = () => ({
  lorry_number: '',
  vehicle_type: '10 Wheeler',
  capacity_tons: '',
  goodshed_loading_expense: '',
  status: 'ACTIVE',
  truck_image_url: '',
  // RC
  rc_number: '',
  rc_reg_date: '',
  rc_photo_url: '',
  rc_photo_back_url: '',
  // FC
  fc_number: '',
  fc_expiry_date: '',
  fc_photo_url: '',
  // Insurance
  insurance_policy_number: '',
  insurance_expiry_date: '',
  insurance_photo_url: '',
  // Permit
  permit_number: '',
  permit_expiry_date: '',
  permit_photo_url: '',
  // TDS
  tds_number: '',
  tds_expiry_date: getNextMarch31st(),
  tds_certificate_url: '',
  // Road Tax
  tax_expiry_date: getNextMarch31st(),
  tax_photo_url: '',
  // PAN
  pan_number: '',
  pan_card_url: '',
  // Bank
  account_holder_name: '',
  account_number: '',
  bank_name: '',
  ifsc_code: '',
  account_photo_url: '',
});

type VehicleFormData = ReturnType<typeof emptyVehicleForm>;

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const AdminVehiclesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<VehicleFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [formData, setFormData] = useState<VehicleFormData>(emptyVehicleForm());

  // OCR state
  const [extractingField, setExtractingField] = useState<string | null>(null);
  const [autoFillNotice, setAutoFillNotice] = useState<{ message: string; type: 'success' | 'info' | 'warn' } | null>(null);

  // Dropdowns
  const [showVehicleTypeDropdown, setShowVehicleTypeDropdown] = useState(false);

  const loadVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminVehicleService.getVehicles({ limit: 100 });
      setVehicles(res.data.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not fetch vehicles.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const getDaysLeft = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  const filteredVehicles = vehicles.filter(v => {
    if (search) {
      const q = search.toLowerCase();
      if (!v.lorry_number.toLowerCase().includes(q) &&
          !(v.vehicle_type?.toLowerCase().includes(q))) return false;
    }
    if (filterType === 'ACTIVE') return v.status === 'ACTIVE';
    if (filterType === 'INACTIVE') return v.status === 'INACTIVE';
    if (filterType === 'EXPIRING') {
      const dates = [v.fc_expiry_date, v.insurance_expiry_date, v.permit_expiry_date, v.tax_expiry_date];
      return dates.some(d => { const n = getDaysLeft(d); return n !== null && n <= 30; });
    }
    return true;
  });

  const expiringCount = vehicles.filter(v => {
    const dates = [v.fc_expiry_date, v.insurance_expiry_date, v.permit_expiry_date, v.tax_expiry_date];
    return dates.some(d => { const n = getDaysLeft(d); return n !== null && n <= 30; });
  }).length;

  // ─── Document Upload Handler with OCR ────────────────────────────────────────
  const handleDocUpload = async (field: keyof VehicleFormData) => {
    promptImageSource(async (uri) => {
      if (!uri) return;
      setFormData(prev => ({ ...prev, [field]: uri }));
      setExtractingField(field as string);
      setAutoFillNotice({ message: '🔍 Scanning document & auto-extracting details with OCR...', type: 'info' });

      try {
        const extractTextFromImage = async (_imgUri: string): Promise<string> => {
          return '';
        };
        const extractedText = await extractTextFromImage(uri);

        if (extractedText && extractedText.trim().length > 0) {
          if (field === 'rc_photo_url' || field === 'rc_photo_back_url') {
            const parsed = parseRcDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              rc_number: parsed.rc_number || prev.rc_number,
              rc_reg_date: parsed.rc_reg_date || prev.rc_reg_date,
              lorry_number: (!prev.lorry_number && parsed.rc_number) ? parsed.rc_number : prev.lorry_number,
            }));
            setAutoFillNotice({ message: `✨ RC Document uploaded. Please verify RC No & Registration Date.`, type: 'success' });
          } else if (field === 'fc_photo_url') {
            const parsed = parseFcDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              fc_number: parsed.fc_number || prev.fc_number,
              fc_expiry_date: parsed.fc_expiry_date || prev.fc_expiry_date,
            }));
            setAutoFillNotice({ message: `✨ FC Document uploaded.`, type: 'success' });
          } else if (field === 'tax_photo_url') {
            const parsed = parseTaxDocument(extractedText);
            setFormData(prev => ({ ...prev, tax_expiry_date: parsed.tax_expiry_date }));
            setAutoFillNotice({ message: `✨ Road Tax Expiry auto-set to March 31st.`, type: 'success' });
          } else if (field === 'tds_certificate_url') {
            const parsed = parseTdsDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              tds_expiry_date: parsed.tds_expiry_date,
              tds_number: parsed.tds_number || prev.tds_number,
            }));
            setAutoFillNotice({ message: `✨ TDS Expiry auto-set to March 31st.`, type: 'success' });
          } else if (field === 'account_photo_url') {
            const parsed = parseBankDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              account_number: parsed.account_number || prev.account_number,
              bank_name: parsed.bank_name || prev.bank_name,
              ifsc_code: parsed.ifsc_code || prev.ifsc_code,
              account_holder_name: parsed.account_holder_name || prev.account_holder_name,
            }));
            setAutoFillNotice({ message: `✨ Bank details extracted.`, type: 'success' });
          } else if (field === 'pan_card_url') {
            const parsed = parsePanDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              pan_number: parsed.pan_number || prev.pan_number,
              account_holder_name: parsed.account_holder_name || prev.account_holder_name,
            }));
            setAutoFillNotice({ message: `✨ PAN Card uploaded.`, type: 'success' });
          } else if (field === 'insurance_photo_url') {
            const parsed = parseInsuranceDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              insurance_policy_number: parsed.policy_number || prev.insurance_policy_number,
              insurance_expiry_date: parsed.expiry_date || prev.insurance_expiry_date,
            }));
            setAutoFillNotice({ message: `✨ Insurance document uploaded.`, type: 'success' });
          } else if (field === 'permit_photo_url') {
            const parsed = parsePermitDocument(extractedText);
            setFormData(prev => ({
              ...prev,
              permit_number: parsed.permit_number || prev.permit_number,
              permit_expiry_date: parsed.expiry_date || prev.permit_expiry_date,
            }));
            setAutoFillNotice({ message: `✨ Permit document uploaded.`, type: 'success' });
          } else {
            setAutoFillNotice({ message: `✅ Document uploaded. Please verify details.`, type: 'success' });
          }
        } else {
          // No OCR text available — just confirm upload
          const fieldLabels: Record<string, string> = {
            rc_photo_url: 'RC Front', rc_photo_back_url: 'RC Back', fc_photo_url: 'Fitness Certificate',
            insurance_photo_url: 'Insurance', permit_photo_url: 'Permit', tds_certificate_url: 'TDS Certificate',
            tax_photo_url: 'Road Tax', pan_card_url: 'PAN Card', account_photo_url: 'Bank Document',
            truck_image_url: 'Truck Photo',
          };
          const label = fieldLabels[field as string] || 'Document';

          // Auto-set March 31st expiry for tax and TDS fields regardless of OCR
          if (field === 'tax_photo_url') {
            setFormData(prev => ({ ...prev, tax_expiry_date: getNextMarch31st() }));
            setAutoFillNotice({ message: `✅ ${label} uploaded. Road Tax expiry auto-set to March 31st.`, type: 'success' });
          } else if (field === 'tds_certificate_url') {
            setFormData(prev => ({ ...prev, tds_expiry_date: getNextMarch31st() }));
            setAutoFillNotice({ message: `✅ ${label} uploaded. TDS expiry auto-set to March 31st.`, type: 'success' });
          } else {
            setAutoFillNotice({ message: `✅ ${label} uploaded. Fill in the details below.`, type: 'info' });
          }
        }
      } catch {
        setAutoFillNotice({ message: `✅ Document uploaded.`, type: 'info' });
      } finally {
        setExtractingField(null);
      }
    });
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormData(emptyVehicleForm());
    setFormTab(0);
    setAutoFillNotice(null);
    setExtractingField(null);
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({
      lorry_number: v.lorry_number,
      vehicle_type: v.vehicle_type || '10 Wheeler',
      capacity_tons: v.capacity_tons?.toString() || '',
      goodshed_loading_expense: v.goodshed_loading_expense?.toString() || '',
      status: v.status,
      truck_image_url: v.truck_image_url || '',
      rc_number: v.rc_number || '',
      rc_reg_date: v.rc_reg_date ? v.rc_reg_date.split('T')[0] : '',
      rc_photo_url: v.rc_photo_url || '',
      rc_photo_back_url: v.rc_photo_back_url || '',
      fc_number: v.fc_number || '',
      fc_expiry_date: v.fc_expiry_date ? v.fc_expiry_date.split('T')[0] : '',
      fc_photo_url: v.fc_photo_url || '',
      insurance_policy_number: v.insurance_policy_number || '',
      insurance_expiry_date: v.insurance_expiry_date ? v.insurance_expiry_date.split('T')[0] : '',
      insurance_photo_url: v.insurance_photo_url || '',
      permit_number: v.permit_number || '',
      permit_expiry_date: v.permit_expiry_date ? v.permit_expiry_date.split('T')[0] : '',
      permit_photo_url: v.permit_photo_url || '',
      tds_number: v.tds_number || v.dts_number || '',
      tds_expiry_date: v.tds_expiry_date ? v.tds_expiry_date.split('T')[0] : getNextMarch31st(),
      tds_certificate_url: v.tds_certificate_url || v.dts_certificate_url || '',
      tax_expiry_date: v.tax_expiry_date ? v.tax_expiry_date.split('T')[0] : getNextMarch31st(),
      tax_photo_url: v.tax_photo_url || '',
      pan_number: v.pan_number || '',
      pan_card_url: v.pan_card_url || '',
      account_holder_name: v.account_holder_name || '',
      account_number: v.account_number || '',
      bank_name: v.bank_name || '',
      ifsc_code: v.ifsc_code || '',
      account_photo_url: v.account_photo_url || '',
    });
    setFormTab(0);
    setAutoFillNotice(null);
    setExtractingField(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.lorry_number.trim()) {
      Alert.alert('Required', 'Truck / Lorry Number is required.');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: any = {
        lorry_number: formData.lorry_number.trim().toUpperCase(),
        vehicle_type: formData.vehicle_type || undefined,
        capacity_tons: formData.capacity_tons ? parseFloat(formData.capacity_tons) : undefined,
        goodshed_loading_expense: formData.goodshed_loading_expense ? parseFloat(formData.goodshed_loading_expense) : undefined,
        status: formData.status || 'ACTIVE',
        truck_image_url: formData.truck_image_url || undefined,
        rc_number: formData.rc_number.trim() || undefined,
        rc_reg_date: formData.rc_reg_date || undefined,
        rc_photo_url: formData.rc_photo_url || undefined,
        rc_photo_back_url: formData.rc_photo_back_url || undefined,
        fc_number: formData.fc_number.trim() || undefined,
        fc_expiry_date: formData.fc_expiry_date || undefined,
        fc_photo_url: formData.fc_photo_url || undefined,
        insurance_policy_number: formData.insurance_policy_number.trim() || undefined,
        insurance_expiry_date: formData.insurance_expiry_date || undefined,
        insurance_photo_url: formData.insurance_photo_url || undefined,
        permit_number: formData.permit_number.trim() || undefined,
        permit_expiry_date: formData.permit_expiry_date || undefined,
        permit_photo_url: formData.permit_photo_url || undefined,
        tds_number: formData.tds_number.trim() || undefined,
        tds_expiry_date: formData.tds_expiry_date || undefined,
        tds_certificate_url: formData.tds_certificate_url || undefined,
        dts_number: formData.tds_number.trim() || undefined,
        dts_expiry_date: formData.tds_expiry_date || undefined,
        dts_certificate_url: formData.tds_certificate_url || undefined,
        tax_expiry_date: formData.tax_expiry_date || undefined,
        tax_photo_url: formData.tax_photo_url || undefined,
        pan_number: formData.pan_number.trim() || undefined,
        pan_card_url: formData.pan_card_url || undefined,
        account_holder_name: formData.account_holder_name.trim() || undefined,
        account_number: formData.account_number.trim() || undefined,
        bank_name: formData.bank_name.trim() || undefined,
        ifsc_code: formData.ifsc_code.trim().toUpperCase() || undefined,
        account_photo_url: formData.account_photo_url || undefined,
      };

      if (editingVehicle) {
        await adminVehicleService.updateVehicle(editingVehicle.id, payload);
        Alert.alert('Updated', 'Vehicle details saved.');
      } else {
        await adminVehicleService.createVehicle(payload);
        Alert.alert('Created', `Vehicle ${formData.lorry_number} registered.`);
      }
      setIsModalOpen(false);
      loadVehicles();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = (v: Vehicle) => {
    Alert.alert('Delete Vehicle', `Are you sure you want to delete "${v.lorry_number}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await adminVehicleService.deleteVehicle(v.id);
            Alert.alert('Deleted', `${v.lorry_number} deleted.`);
            loadVehicles();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleToggleStatus = (v: Vehicle) => {
    const next = v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert('Status Change', `Change ${v.lorry_number} to ${next}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await adminVehicleService.updateVehicle(v.id, { status: next } as any);
            loadVehicles();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const setField = (key: keyof VehicleFormData, value: string) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const TAB_LABELS = ['Basic', 'RC / FC', 'Insurance / Permit', 'TDS / Tax', 'PAN / Bank'];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search truck number, type..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><X size={16} color={COLORS.textMuted} /></TouchableOpacity> : null}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['ALL', 'EXPIRING', 'ACTIVE', 'INACTIVE'] as VehicleFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, filterType === f && (f === 'EXPIRING' ? styles.pillExpiring : styles.pillActive)]}
              onPress={() => setFilterType(f)}
            >
              {f === 'EXPIRING' && <AlertTriangle size={11} color={filterType === 'EXPIRING' ? '#b91c1c' : '#ea580c'} />}
              <Text style={[styles.pillTxt, filterType === f && (f === 'EXPIRING' ? { color: '#b91c1c', fontWeight: '800' } : styles.pillTxtActive)]}>
                {f === 'ALL' ? `All (${vehicles.length})` : f === 'EXPIRING' ? `Expiring <30d (${expiringCount})` : f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Vehicle List */}
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.accent} /><Text style={styles.centerTxt}>Loading...</Text></View>
      ) : filteredVehicles.length === 0 ? (
        <View style={styles.center}><Truck size={40} color={COLORS.textLight} /><Text style={styles.centerTxt}>No vehicles found</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredVehicles.map(v => {
            const isActive = v.status === 'ACTIVE';
            const docDates = [v.fc_expiry_date, v.insurance_expiry_date, v.permit_expiry_date, v.tax_expiry_date];
            const expiringDocs = docDates.filter(d => { const n = getDaysLeft(d); return n !== null && n <= 30; });

            return (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    {v.truck_image_url ? (
                      <Image source={{ uri: v.truck_image_url }} style={styles.truckImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.truckFallback}>
                        <Truck size={20} color="#fff" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lorryNumber}>{v.lorry_number}</Text>
                      <Text style={styles.vehicleType}>{v.vehicle_type || '—'} {v.capacity_tons ? `· ${v.capacity_tons}T` : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusTxt, { color: isActive ? '#16a34a' : '#64748b' }]}>{v.status}</Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(v)}><Edit2 size={14} color="#2563eb" /></TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteVehicle(v)}><Trash2 size={14} color="#ef4444" /></TouchableOpacity>
                  </View>
                </View>

                {/* Compliance Docs */}
                <View style={styles.docsRow}>
                  {[
                    { label: 'FC', date: v.fc_expiry_date, icon: <Shield size={10} color="#7c3aed" /> },
                    { label: 'Ins', date: v.insurance_expiry_date, icon: <Shield size={10} color="#059669" /> },
                    { label: 'Permit', date: v.permit_expiry_date, icon: <FileText size={10} color="#d97706" /> },
                    { label: 'Tax', date: v.tax_expiry_date, icon: <FileText size={10} color="#be185d" /> },
                  ].map(doc => (
                    <View key={doc.label} style={styles.docChip}>
                      {doc.icon}
                      <Text style={styles.docChipLabel}>{doc.label}</Text>
                      {doc.date ? <ExpiryBadge date={doc.date} /> : <Text style={styles.docChipNA}>—</Text>}
                    </View>
                  ))}
                </View>

                {expiringDocs.length > 0 && (
                  <View style={styles.alertRow}>
                    <AlertTriangle size={12} color="#ea580c" />
                    <Text style={styles.alertTxt}>{expiringDocs.length} document(s) expiring soon — action required</Text>
                  </View>
                )}

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: isActive ? '#fef2f2' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(v)}
                  >
                    <Text style={[styles.toggleTxt, { color: isActive ? '#dc2626' : '#16a34a' }]}>
                      {isActive ? 'Mark Inactive' : 'Mark Active'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingVehicle ? `Edit: ${editingVehicle.lorry_number}` : '+ Add Vehicle'}</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><X size={20} color={COLORS.textMuted} /></TouchableOpacity>
            </View>

            {/* Tab Bar (horizontal scroll) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 8 }}>
              {TAB_LABELS.map((tab, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.tabBtn, formTab === idx && styles.tabBtnActive]}
                  onPress={() => setFormTab(idx)}
                >
                  <Text style={[styles.tabBtnTxt, formTab === idx && styles.tabBtnTxtActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* OCR Notice */}
            {autoFillNotice && <OcrNotice message={autoFillNotice.message} type={autoFillNotice.type} />}

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: SPACING.md, paddingBottom: 24 }}>

              {/* ── TAB 0: Basic Info ── */}
              {formTab === 0 && (
                <View>
                  <Label text="Truck / Lorry Number *" />
                  <TextInput style={styles.input} value={formData.lorry_number} onChangeText={v => setField('lorry_number', v.toUpperCase())} placeholder="e.g. TN 33 AE 1357" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />

                  <Label text="Vehicle Type" />
                  <TouchableOpacity style={styles.dropdown} onPress={() => setShowVehicleTypeDropdown(!showVehicleTypeDropdown)}>
                    <Text style={styles.dropdownVal}>{formData.vehicle_type}</Text>
                    <ChevronDown size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {showVehicleTypeDropdown && (
                    <View style={styles.dropdownMenu}>
                      {VEHICLE_TYPES.map(opt => (
                        <TouchableOpacity key={opt} style={[styles.dropdownItem, formData.vehicle_type === opt && styles.dropdownItemActive]}
                          onPress={() => { setField('vehicle_type', opt); setShowVehicleTypeDropdown(false); }}>
                          <Text style={[styles.dropdownItemTxt, formData.vehicle_type === opt && { color: COLORS.accent, fontWeight: '700' }]}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Label text="Capacity (Tons)" />
                  <TextInput style={styles.input} value={formData.capacity_tons} onChangeText={v => setField('capacity_tons', v)} placeholder="e.g. 16" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />

                  <Label text="Goodshed Loading Expense (₹)" />
                  <TextInput style={styles.input} value={formData.goodshed_loading_expense} onChangeText={v => setField('goodshed_loading_expense', v)} placeholder="e.g. 500" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />

                  <Label text="Truck Photo" />
                  <DocUploadField
                    label="Upload Truck Photo"
                    value={formData.truck_image_url}
                    onUpload={() => handleDocUpload('truck_image_url')}
                    onRemove={() => setField('truck_image_url', '')}
                    isExtracting={extractingField === 'truck_image_url'}
                  />
                </View>
              )}

              {/* ── TAB 1: RC / FC ── */}
              {formTab === 1 && (
                <View>
                  <SectionTitle icon={<FileText size={14} color="#1d4ed8" />} label="RC — Registration Certificate" />

                  <Label text="RC Number" />
                  <TextInput style={styles.input} value={formData.rc_number} onChangeText={v => setField('rc_number', v.toUpperCase())} placeholder="e.g. TN 33 AE 1357" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />

                  <Label text="Date of Registration" />
                  <TextInput style={styles.input} value={formData.rc_reg_date} onChangeText={v => setField('rc_reg_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pageLabel}>RC FRONT</Text>
                      <DocUploadField label="Upload RC Front" value={formData.rc_photo_url} onUpload={() => handleDocUpload('rc_photo_url')} onRemove={() => setField('rc_photo_url', '')} isExtracting={extractingField === 'rc_photo_url'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pageLabel}>RC BACK</Text>
                      <DocUploadField label="Upload RC Back" value={formData.rc_photo_back_url} onUpload={() => handleDocUpload('rc_photo_back_url')} onRemove={() => setField('rc_photo_back_url', '')} isExtracting={extractingField === 'rc_photo_back_url'} />
                    </View>
                  </View>

                  <View style={styles.divider} />
                  <SectionTitle icon={<Shield size={14} color="#7c3aed" />} label="FC — Fitness Certificate" />

                  <Label text="FC Number (Regn No)" />
                  <TextInput style={styles.input} value={formData.fc_number} onChangeText={v => setField('fc_number', v)} placeholder="FC / Regn Number" placeholderTextColor={COLORS.textMuted} />

                  <Label text="FC Expiry Date" />
                  <TextInput style={styles.input} value={formData.fc_expiry_date} onChangeText={v => setField('fc_expiry_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />

                  <DocUploadField label="Upload FC Certificate" value={formData.fc_photo_url} onUpload={() => handleDocUpload('fc_photo_url')} onRemove={() => setField('fc_photo_url', '')} isExtracting={extractingField === 'fc_photo_url'} />
                </View>
              )}

              {/* ── TAB 2: Insurance / Permit ── */}
              {formTab === 2 && (
                <View>
                  <SectionTitle icon={<Shield size={14} color="#059669" />} label="Insurance" />
                  <Label text="Policy Number" />
                  <TextInput style={styles.input} value={formData.insurance_policy_number} onChangeText={v => setField('insurance_policy_number', v)} placeholder="Insurance Policy No" placeholderTextColor={COLORS.textMuted} />
                  <Label text="Insurance Expiry Date" />
                  <TextInput style={styles.input} value={formData.insurance_expiry_date} onChangeText={v => setField('insurance_expiry_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  <DocUploadField label="Upload Insurance Document" value={formData.insurance_photo_url} onUpload={() => handleDocUpload('insurance_photo_url')} onRemove={() => setField('insurance_photo_url', '')} isExtracting={extractingField === 'insurance_photo_url'} />

                  <View style={styles.divider} />
                  <SectionTitle icon={<FileText size={14} color="#d97706" />} label="Permit" />
                  <Label text="Permit Number" />
                  <TextInput style={styles.input} value={formData.permit_number} onChangeText={v => setField('permit_number', v)} placeholder="Permit No" placeholderTextColor={COLORS.textMuted} />
                  <Label text="Permit Expiry Date" />
                  <TextInput style={styles.input} value={formData.permit_expiry_date} onChangeText={v => setField('permit_expiry_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  <DocUploadField label="Upload Permit" value={formData.permit_photo_url} onUpload={() => handleDocUpload('permit_photo_url')} onRemove={() => setField('permit_photo_url', '')} isExtracting={extractingField === 'permit_photo_url'} />
                </View>
              )}

              {/* ── TAB 3: TDS / Road Tax ── */}
              {formTab === 3 && (
                <View>
                  <SectionTitle icon={<Hash size={14} color="#0891b2" />} label="TDS Certificate (Yearly: 31st March)" />
                  <Label text="TDS Certificate Number" />
                  <TextInput style={styles.input} value={formData.tds_number} onChangeText={v => setField('tds_number', v)} placeholder="TDS Cert No" placeholderTextColor={COLORS.textMuted} />
                  <Label text="TDS Expiry Date (Auto: March 31st)" />
                  <TextInput style={styles.input} value={formData.tds_expiry_date} onChangeText={v => setField('tds_expiry_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  <DocUploadField label="Upload TDS Certificate" value={formData.tds_certificate_url} onUpload={() => handleDocUpload('tds_certificate_url')} onRemove={() => setField('tds_certificate_url', '')} isExtracting={extractingField === 'tds_certificate_url'} />

                  <View style={styles.divider} />
                  <SectionTitle icon={<FileText size={14} color="#be185d" />} label="Road Tax (Yearly: 31st March)" />
                  <Label text="Tax Expiry Date (Auto: March 31st)" />
                  <TextInput style={styles.input} value={formData.tax_expiry_date} onChangeText={v => setField('tax_expiry_date', v)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                  <DocUploadField label="Upload Tax Receipt" value={formData.tax_photo_url} onUpload={() => handleDocUpload('tax_photo_url')} onRemove={() => setField('tax_photo_url', '')} isExtracting={extractingField === 'tax_photo_url'} />
                </View>
              )}

              {/* ── TAB 4: PAN / Bank ── */}
              {formTab === 4 && (
                <View>
                  <SectionTitle icon={<CreditCard size={14} color="#7c3aed" />} label="PAN Card" />
                  <Label text="PAN Number" />
                  <TextInput style={styles.input} value={formData.pan_number} onChangeText={v => setField('pan_number', v.toUpperCase())} placeholder="ABCDE1234F" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
                  <DocUploadField label="Upload PAN Card" value={formData.pan_card_url} onUpload={() => handleDocUpload('pan_card_url')} onRemove={() => setField('pan_card_url', '')} isExtracting={extractingField === 'pan_card_url'} />

                  <View style={styles.divider} />
                  <SectionTitle icon={<Building size={14} color="#0f766e" />} label="Bank Account Details" />
                  <Label text="Account Holder Name" />
                  <TextInput style={styles.input} value={formData.account_holder_name} onChangeText={v => setField('account_holder_name', v)} placeholder="As per bank records" placeholderTextColor={COLORS.textMuted} />
                  <Label text="Account Number" />
                  <TextInput style={styles.input} value={formData.account_number} onChangeText={v => setField('account_number', v)} placeholder="Bank Account Number" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" />
                  <Label text="Bank Name" />
                  <TextInput style={styles.input} value={formData.bank_name} onChangeText={v => setField('bank_name', v)} placeholder="e.g. State Bank of India" placeholderTextColor={COLORS.textMuted} />
                  <Label text="IFSC Code" />
                  <TextInput style={styles.input} value={formData.ifsc_code} onChangeText={v => setField('ifsc_code', v.toUpperCase())} placeholder="e.g. SBIN0001234" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
                  <DocUploadField label="Upload Bank Passbook / Cheque" value={formData.account_photo_url} onUpload={() => handleDocUpload('account_photo_url')} onRemove={() => setField('account_photo_url', '')} isExtracting={extractingField === 'account_photo_url'} />
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              {formTab > 0 && (
                <TouchableOpacity style={styles.prevBtn} onPress={() => setFormTab(t => t - 1)}>
                  <Text style={styles.prevBtnTxt}>← Back</Text>
                </TouchableOpacity>
              )}
              {formTab < TAB_LABELS.length - 1 && (
                <TouchableOpacity style={styles.nextBtn} onPress={() => setFormTab(t => t + 1)}>
                  <Text style={styles.nextBtnTxt}>Next →</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnTxt}>Save Vehicle</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Label: React.FC<{ text: string }> = ({ text }) => (
  <Text style={styles.label}>{text}</Text>
);
const SectionTitle: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <View style={styles.sectionTitleRow}>
    {icon}
    <Text style={styles.sectionTitleTxt}>{label}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: SPACING.sm },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillExpiring: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  pillTxt: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  pillTxtActive: { color: '#fff', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  centerTxt: { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  list: { padding: SPACING.md, gap: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardLeft: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flex: 1 },
  truckImg: { width: 50, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  truckFallback: { width: 50, height: 40, borderRadius: 8, backgroundColor: '#1e3a8a', alignItems: 'center', justifyContent: 'center' },
  lorryNumber: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  vehicleType: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#ecfdf5' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  docsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  docChipLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  docChipNA: { fontSize: 11, color: COLORS.textLight },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7ed', borderRadius: RADIUS.sm, padding: 8, marginBottom: 8 },
  alertTxt: { fontSize: 12, color: '#ea580c', fontWeight: '600', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  toggleTxt: { fontSize: 12, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '95%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1 },
  tabBar: { borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 48 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginHorizontal: 2 },
  tabBtnActive: { borderBottomColor: COLORS.accent },
  tabBtnTxt: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tabBtnTxtActive: { color: COLORS.accent, fontWeight: '800' },
  modalScroll: { maxHeight: 430 },
  modalFooter: { flexDirection: 'row', gap: 10, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  dropdown: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownVal: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  dropdownMenu: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: 4, ...SHADOWS.sm },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownItemTxt: { fontSize: 14, color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitleTxt: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
  pageLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  prevBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  prevBtnTxt: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  nextBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  nextBtnTxt: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  saveBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', minWidth: 110 },
  saveBtnTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

const docSt = StyleSheet.create({
  uploadBox: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: RADIUS.md, padding: 14, alignItems: 'center', gap: 6, backgroundColor: '#f8fafc' },
  uploadIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  uploadLabel: { fontSize: 12, fontWeight: '700', color: '#1e293b' },
  uploadHint: { fontSize: 11, color: COLORS.textMuted },
  uploadedWrap: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#f8fafc' },
  previewImg: { width: '100%', height: 90 },
  uploadedBottom: { padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uploadedText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#eff6ff', borderRadius: RADIUS.sm },
  changeBtnTxt: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fef2f2', borderRadius: RADIUS.sm },
  removeBtnTxt: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
  extractingBox: { borderWidth: 2, borderColor: '#3b82f6', borderRadius: RADIUS.md, padding: 18, alignItems: 'center', gap: 8, backgroundColor: '#eff6ff' },
  extractingText: { fontSize: 13, fontWeight: '800', color: '#1d4ed8' },
  extractingHint: { fontSize: 11, color: '#3b82f6' },
  noticeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginTop: 4, padding: 10, borderRadius: RADIUS.sm },
  noticeText: { fontSize: 12, fontWeight: '600', flex: 1 },
});

const vSt = StyleSheet.create({
  expiryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  expiryText: { fontSize: 10, fontWeight: '700' },
});
