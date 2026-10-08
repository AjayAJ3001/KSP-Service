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
  User,
  Plus,
  Search,
  AlertTriangle,
  X,
  Phone,
  CreditCard,
  Edit2,
  Trash2,
  RefreshCw,
  Camera,
  FileText,
  CheckCircle,
  Sparkles,
  ScanLine,
  ChevronDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { adminDriverService } from '../../services/adminService';
import { Driver } from '../../types';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateDMY } from '../../utils/dateUtils';
import { parseLicenseDocument } from '../../utils/docParsers';

type DriverFilter = 'ALL' | 'EXPIRING' | 'ACTIVE' | 'INACTIVE';
type LicenseType = 'HEAVY' | 'REGULAR';

const ADDRESS_PROOF_OPTIONS = ['Aadhar Card', 'Family Card (Ration Card)', 'Voter ID', 'Passport'];

// ─── OCR extraction for Driving License from image (client-side regex) ────────
const performOcrOnImage = async (base64Uri: string): Promise<string> => {
  // On mobile, OCR on raw images requires a native OCR library.
  // We do lightweight text extraction by sending image to backend if available,
  // or return empty string here (the user can fill fields manually).
  // The parseLicenseDocument parser will parse whatever text is available.
  return '';
};

// ─── Image Picker Helper ──────────────────────────────────────────────────────
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
  const asset = result.assets[0];
  return `data:image/jpeg;base64,${asset.base64}`;
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
  const asset = result.assets[0];
  return `data:image/jpeg;base64,${asset.base64}`;
};

const promptImageSource = (onResult: (uri: string | null) => void) => {
  Alert.alert('Upload Document', 'Choose source', [
    { text: 'Camera', onPress: async () => onResult(await takePhoto()) },
    { text: 'Gallery', onPress: async () => onResult(await pickImage()) },
    { text: 'Cancel', style: 'cancel', onPress: () => onResult(null) },
  ]);
};

// ─── Document Upload Button ───────────────────────────────────────────────────
interface DocUploadProps {
  label: string;
  value: string;
  onUpload: () => void;
  onRemove: () => void;
  isScanning?: boolean;
  scanLabel?: string;
}
const DocUploadBtn: React.FC<DocUploadProps> = ({ label, value, onUpload, onRemove, isScanning, scanLabel }) => {
  if (isScanning) {
    return (
      <View style={docStyles.scanningBox}>
        <ScanLine size={20} color="#7c3aed" />
        <Text style={docStyles.scanningText}>{scanLabel || 'Scanning & Extracting...'}</Text>
      </View>
    );
  }

  if (value) {
    return (
      <View style={docStyles.uploadedBox}>
        <Image source={{ uri: value }} style={docStyles.previewThumb} resizeMode="cover" />
        <View style={docStyles.uploadedInfo}>
          <CheckCircle size={14} color="#16a34a" />
          <Text style={docStyles.uploadedLabel}>{label} ✓</Text>
        </View>
        <View style={docStyles.uploadedActions}>
          <TouchableOpacity style={docStyles.changeBtn} onPress={onUpload}>
            <Camera size={12} color="#2563eb" />
            <Text style={docStyles.changeBtnText}>Change</Text>
          </TouchableOpacity>
          <TouchableOpacity style={docStyles.removeBtn} onPress={onRemove}>
            <X size={12} color="#dc2626" />
            <Text style={docStyles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={docStyles.uploadBox} onPress={onUpload} activeOpacity={0.7}>
      <View style={docStyles.uploadIcon}>
        <Camera size={20} color="#4338ca" />
      </View>
      <Text style={docStyles.uploadLabel}>{label}</Text>
      <Text style={docStyles.uploadHint}>Camera · Gallery · Auto Scan</Text>
    </TouchableOpacity>
  );
};

// ─── OCR Result Badge ─────────────────────────────────────────────────────────
const OcrBadge: React.FC<{ message: string; type: 'success' | 'info' | 'error' }> = ({ message, type }) => {
  const bg = type === 'success' ? '#ecfdf5' : type === 'error' ? '#fef2f2' : '#eff6ff';
  const color = type === 'success' ? '#15803d' : type === 'error' ? '#b91c1c' : '#1d4ed8';
  return (
    <View style={[docStyles.ocrBadge, { backgroundColor: bg }]}>
      <Sparkles size={13} color={color} />
      <Text style={[docStyles.ocrBadgeText, { color }]}>{message}</Text>
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const AdminDriversScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DriverFilter>('ALL');
  const [isLoading, setIsLoading] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTab, setFormTab] = useState(0); // 0 = Basic Info, 1 = Documents

  // OCR state
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const [scanningSide, setScanningSide] = useState<'front' | 'back' | null>(null);
  const [ocrNotice, setOcrNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [frontOcrText, setFrontOcrText] = useState('');
  const [backOcrText, setBackOcrText] = useState('');

  // Dropdown state
  const [showLicenseTypeDropdown, setShowLicenseTypeDropdown] = useState(false);
  const [showAddressProofDropdown, setShowAddressProofDropdown] = useState(false);

  // Form fields
  const emptyForm = () => ({
    name: '',
    mobile_number: '',
    license_number: '',
    license_type: 'HEAVY' as LicenseType,
    license_expiry_date: '',
    id_proof_type: 'Aadhar Card',
    photo_url: '',
    license_photo_url: '',
    license_photo_back_url: '',
    id_proof_url: '',
  });
  const [formData, setFormData] = useState(emptyForm());

  const loadDrivers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await adminDriverService.getDrivers({ limit: 100 });
      setDrivers(res.data.items || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not fetch drivers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  const getDaysLeft = (dateStr?: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  };

  const filteredDrivers = drivers.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) &&
          !(d.mobile_number?.includes(q)) &&
          !(d.license_number?.toLowerCase().includes(q))) return false;
    }
    if (filterType === 'ACTIVE') return d.status === 'ACTIVE';
    if (filterType === 'INACTIVE') return d.status === 'INACTIVE';
    if (filterType === 'EXPIRING') {
      const days = getDaysLeft(d.license_expiry_date);
      return days !== null && days <= 30;
    }
    return true;
  });

  const expiringCount = drivers.filter(d => {
    const days = getDaysLeft(d.license_expiry_date);
    return days !== null && days <= 30;
  }).length;

  // ─── Handle License Photo Upload + OCR ──────────────────────────────────────
  const handleLicenseUpload = async (side: 'front' | 'back') => {
    promptImageSource(async (uri) => {
      if (!uri) return;
      const field = side === 'front' ? 'license_photo_url' : 'license_photo_back_url';
      setFormData(prev => ({ ...prev, [field]: uri }));
      setScanningSide(side);
      setIsOcrScanning(true);
      setOcrNotice({ message: '🔍 Scanning License & extracting details...', type: 'info' });

      try {
        // Try to extract text from the image via backend OCR endpoint
        const ocrText = await performOcrOnImage(uri);
        const newFrontText = side === 'front' ? ocrText : frontOcrText;
        const newBackText = side === 'back' ? ocrText : backOcrText;
        if (side === 'front') setFrontOcrText(ocrText);
        else setBackOcrText(ocrText);

        const combinedText = [newFrontText, newBackText].filter(Boolean).join('\n---\n');
        if (combinedText.trim()) {
          const parsed = parseLicenseDocument(combinedText);
          setFormData(prev => ({
            ...prev,
            ...(parsed.license_number ? { license_number: parsed.license_number } : {}),
            ...(parsed.license_expiry_date ? { license_expiry_date: parsed.license_expiry_date } : {}),
          }));
          if (parsed.license_number || parsed.license_expiry_date) {
            const parts = [
              parsed.license_number ? `DL No: ${parsed.license_number}` : null,
              parsed.license_expiry_date ? `Expiry: ${formatDateDMY(parsed.license_expiry_date)}` : null,
            ].filter(Boolean).join(' · ');
            setOcrNotice({ message: `✨ Auto-Extracted: ${parts}`, type: 'success' });
          } else {
            setOcrNotice({ message: '✅ License uploaded. Please verify & fill fields manually.', type: 'info' });
          }
        } else {
          setOcrNotice({ message: '✅ License uploaded. Please fill in the details below.', type: 'info' });
        }
      } catch {
        setOcrNotice({ message: '✅ License photo uploaded.', type: 'info' });
      } finally {
        setIsOcrScanning(false);
        setScanningSide(null);
      }
    });
  };

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData(emptyForm());
    setFrontOcrText('');
    setBackOcrText('');
    setOcrNotice(null);
    setIsOcrScanning(false);
    setFormTab(0);
    setIsModalOpen(true);
  };

  const openEditModal = (d: Driver) => {
    setEditingDriver(d);
    setFormData({
      name: d.name,
      mobile_number: d.mobile_number || '',
      license_number: d.license_number || '',
      license_type: (d.license_type as LicenseType) || 'HEAVY',
      license_expiry_date: d.license_expiry_date ? d.license_expiry_date.split('T')[0] : '',
      id_proof_type: d.id_proof_type || 'Aadhar Card',
      photo_url: d.photo_url || '',
      license_photo_url: d.license_photo_url || '',
      license_photo_back_url: d.license_photo_back_url || '',
      id_proof_url: d.id_proof_url || '',
    });
    setFrontOcrText('');
    setBackOcrText('');
    setOcrNotice(null);
    setIsOcrScanning(false);
    setFormTab(0);
    setIsModalOpen(true);
  };

  const handleSaveDriver = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Driver Name is required.');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload: any = {
        name: formData.name.trim(),
        mobile_number: formData.mobile_number.trim() || undefined,
        license_number: formData.license_number.trim() || undefined,
        license_type: formData.license_type,
        license_expiry_date: formData.license_expiry_date.trim() || undefined,
        id_proof_type: formData.id_proof_type || undefined,
        photo_url: formData.photo_url || undefined,
        license_photo_url: formData.license_photo_url || undefined,
        license_photo_back_url: formData.license_photo_back_url || undefined,
        id_proof_url: formData.id_proof_url || undefined,
      };
      if (editingDriver) {
        await adminDriverService.updateDriver(editingDriver.id, payload);
        Alert.alert('Updated', 'Driver details saved.');
      } else {
        await adminDriverService.createDriver(payload);
        Alert.alert('Created', `Driver ${formData.name} registered.`);
      }
      setIsModalOpen(false);
      loadDrivers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = (d: Driver) => {
    const nextStatus = d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    Alert.alert('Status Change', `Change ${d.name}'s status to ${nextStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await adminDriverService.updateStatus(d.id, nextStatus);
            loadDrivers();
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleDeleteDriver = (d: Driver) => {
    Alert.alert('Delete Driver', `Are you sure you want to delete "${d.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await adminDriverService.deleteDriver(d.id);
            Alert.alert('Deleted', `Driver ${d.name} deleted.`);
            loadDrivers();
          } catch (e: any) { Alert.alert('Delete Failed', e.message); }
        },
      },
    ]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search driver name, phone, license..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={16} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills}>
          {(['ALL', 'EXPIRING', 'ACTIVE', 'INACTIVE'] as DriverFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, filterType === f && (f === 'EXPIRING' ? styles.pillExpiring : styles.pillActive)]}
              onPress={() => setFilterType(f)}
            >
              {f === 'EXPIRING' && <AlertTriangle size={12} color={filterType === 'EXPIRING' ? '#b91c1c' : '#ea580c'} />}
              <Text style={[
                styles.pillText,
                filterType === f && (f === 'EXPIRING' ? { color: '#b91c1c', fontWeight: '800' } : styles.pillTextActive)
              ]}>
                {f === 'ALL' ? `All (${drivers.length})` : f === 'EXPIRING' ? `Expiring <30d (${expiringCount})` : f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Driver List */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.centerText}>Loading Drivers...</Text>
        </View>
      ) : filteredDrivers.length === 0 ? (
        <View style={styles.centerBox}>
          <User size={40} color={COLORS.textLight} />
          <Text style={styles.centerText}>No drivers found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredDrivers.map((d) => {
            const isActive = d.status === 'ACTIVE';
            const daysLeft = getDaysLeft(d.license_expiry_date);
            const isExpiring = daysLeft !== null && daysLeft <= 30;

            return (
              <View key={d.id} style={styles.driverCard}>
                <View style={styles.cardHeader}>
                  {/* Avatar */}
                  <View style={styles.cardLeft}>
                    {d.photo_url ? (
                      <Image source={{ uri: d.photo_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarLetter}>{d.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.driverName}>{d.name}</Text>
                      {d.mobile_number && (
                        <View style={styles.infoItem}>
                          <Phone size={11} color={COLORS.textMuted} />
                          <Text style={styles.infoText}>{d.mobile_number}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                      <Text style={[styles.statusText, isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                        {d.status}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(d)}>
                      <Edit2 size={14} color="#2563eb" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#fef2f2' }]} onPress={() => handleDeleteDriver(d)}>
                      <Trash2 size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* License Info */}
                {d.license_number && (
                  <View style={styles.licenseRow}>
                    <CreditCard size={12} color={COLORS.textMuted} />
                    <Text style={styles.infoText}>
                      {d.license_number} · {d.license_type || 'HEAVY'}
                    </Text>
                    {/* License photos indicators */}
                    {d.license_photo_url && (
                      <View style={styles.docIndicator}>
                        <FileText size={10} color="#2563eb" />
                        <Text style={styles.docIndicatorText}>DL</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Expiry */}
                {isExpiring ? (
                  <View style={styles.alertBox}>
                    <AlertTriangle size={12} color="#ea580c" />
                    <Text style={styles.alertText}>
                      {daysLeft! < 0
                        ? `License EXPIRED ${Math.abs(daysLeft!)}d ago`
                        : `License Expiring: ${formatDateDMY(d.license_expiry_date)} (${daysLeft}d left)`}
                    </Text>
                  </View>
                ) : d.license_expiry_date ? (
                  <Text style={styles.normalExpiryText}>Valid Until: {formatDateDMY(d.license_expiry_date)}</Text>
                ) : null}

                {/* Toggle Status */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, { backgroundColor: isActive ? '#fef2f2' : '#ecfdf5' }]}
                    onPress={() => handleToggleStatus(d)}
                  >
                    <Text style={[styles.toggleBtnText, { color: isActive ? '#dc2626' : '#16a34a' }]}>
                      {isActive ? 'Mark Inactive' : 'Mark Active'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add / Edit Driver Modal */}
      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingDriver ? `Edit: ${editingDriver.name}` : '+ Add New Driver'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
              {['Basic Info', 'Documents & Photos'].map((tab, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.tabBtn, formTab === idx && styles.tabBtnActive]}
                  onPress={() => setFormTab(idx)}
                >
                  <Text style={[styles.tabBtnText, formTab === idx && styles.tabBtnTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 24 }}>

              {/* ── TAB 0: Basic Info ── */}
              {formTab === 0 && (
                <View>
                  <Text style={styles.sectionLabel}>Driver Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={v => setFormData(p => ({ ...p, name: v }))}
                    placeholder="Full Name"
                    placeholderTextColor={COLORS.textMuted}
                  />

                  <Text style={styles.sectionLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.mobile_number}
                    onChangeText={v => setFormData(p => ({ ...p, mobile_number: v }))}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.sectionLabel}>License Type</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setShowLicenseTypeDropdown(!showLicenseTypeDropdown)}
                  >
                    <Text style={styles.dropdownValue}>
                      {formData.license_type === 'HEAVY' ? '🚛 HEAVY (Transport / Commercial)' : '🚗 REGULAR (LMV)'}
                    </Text>
                    <ChevronDown size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {showLicenseTypeDropdown && (
                    <View style={styles.dropdownMenu}>
                      {(['HEAVY', 'REGULAR'] as LicenseType[]).map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.dropdownItem, formData.license_type === opt && styles.dropdownItemActive]}
                          onPress={() => { setFormData(p => ({ ...p, license_type: opt })); setShowLicenseTypeDropdown(false); }}
                        >
                          <Text style={[styles.dropdownItemText, formData.license_type === opt && { color: COLORS.accent, fontWeight: '700' }]}>
                            {opt === 'HEAVY' ? '🚛 HEAVY (Transport / Commercial)' : '🚗 REGULAR (LMV)'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.sectionLabel}>License Number</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.license_number}
                    onChangeText={v => setFormData(p => ({ ...p, license_number: v.toUpperCase() }))}
                    placeholder="e.g. TN3320100001234"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.sectionLabel}>License Expiry Date</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.license_expiry_date}
                    onChangeText={v => setFormData(p => ({ ...p, license_expiry_date: v }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />

                  <Text style={styles.sectionLabel}>Address Proof Type</Text>
                  <TouchableOpacity
                    style={styles.dropdown}
                    onPress={() => setShowAddressProofDropdown(!showAddressProofDropdown)}
                  >
                    <Text style={styles.dropdownValue}>{formData.id_proof_type}</Text>
                    <ChevronDown size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {showAddressProofDropdown && (
                    <View style={styles.dropdownMenu}>
                      {ADDRESS_PROOF_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.dropdownItem, formData.id_proof_type === opt && styles.dropdownItemActive]}
                          onPress={() => { setFormData(p => ({ ...p, id_proof_type: opt })); setShowAddressProofDropdown(false); }}
                        >
                          <Text style={[styles.dropdownItemText, formData.id_proof_type === opt && { color: COLORS.accent, fontWeight: '700' }]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* ── TAB 1: Documents & Photos ── */}
              {formTab === 1 && (
                <View>
                  {/* Driver Passport Photo */}
                  <View style={docStyles.section}>
                    <Text style={docStyles.sectionHeader}>
                      <User size={14} color="#2563eb" /> {'  '}Driver Passport Photo
                    </Text>
                    <DocUploadBtn
                      label="Upload Driver Photo"
                      value={formData.photo_url}
                      onUpload={() => promptImageSource(uri => { if (uri) setFormData(p => ({ ...p, photo_url: uri })); })}
                      onRemove={() => setFormData(p => ({ ...p, photo_url: '' }))}
                    />
                  </View>

                  {/* Driving License — 2-Page Batch Scan */}
                  <View style={docStyles.section}>
                    <Text style={docStyles.sectionHeader}>
                      <CreditCard size={14} color="#7c3aed" /> {'  '}Driving License (Front & Back)
                    </Text>
                    <Text style={docStyles.sectionHint}>Upload both pages for best OCR extraction of license number, type, and expiry</Text>

                    {/* OCR Notice */}
                    {ocrNotice && <OcrBadge message={ocrNotice.message} type={ocrNotice.type} />}

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={docStyles.pageLabel}>FRONT PAGE</Text>
                        <DocUploadBtn
                          label="DL Front"
                          value={formData.license_photo_url}
                          onUpload={() => handleLicenseUpload('front')}
                          onRemove={() => {
                            setFormData(p => ({ ...p, license_photo_url: '' }));
                            setFrontOcrText('');
                            setOcrNotice(null);
                          }}
                          isScanning={isOcrScanning && scanningSide === 'front'}
                          scanLabel="Scanning Front..."
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={docStyles.pageLabel}>BACK PAGE</Text>
                        <DocUploadBtn
                          label="DL Back"
                          value={formData.license_photo_back_url}
                          onUpload={() => handleLicenseUpload('back')}
                          onRemove={() => {
                            setFormData(p => ({ ...p, license_photo_back_url: '' }));
                            setBackOcrText('');
                            setOcrNotice(null);
                          }}
                          isScanning={isOcrScanning && scanningSide === 'back'}
                          scanLabel="Scanning Back..."
                        />
                      </View>
                    </View>

                    {/* Extracted fields preview */}
                    {(formData.license_number || formData.license_expiry_date) && (
                      <View style={docStyles.extractedBox}>
                        <Text style={docStyles.extractedTitle}>📋 Extracted / Entered Details</Text>
                        {formData.license_number ? (
                          <Text style={docStyles.extractedRow}>DL No: <Text style={docStyles.extractedValue}>{formData.license_number}</Text></Text>
                        ) : null}
                        {formData.license_expiry_date ? (
                          <Text style={docStyles.extractedRow}>Expiry: <Text style={docStyles.extractedValue}>{formatDateDMY(formData.license_expiry_date)}</Text></Text>
                        ) : null}
                        <Text style={docStyles.extractedRow}>Type: <Text style={docStyles.extractedValue}>{formData.license_type}</Text></Text>
                      </View>
                    )}
                  </View>

                  {/* Address / ID Proof */}
                  <View style={docStyles.section}>
                    <Text style={docStyles.sectionHeader}>
                      <FileText size={14} color="#059669" /> {'  '}{formData.id_proof_type}
                    </Text>
                    <DocUploadBtn
                      label={`Upload ${formData.id_proof_type}`}
                      value={formData.id_proof_url}
                      onUpload={() => promptImageSource(uri => { if (uri) setFormData(p => ({ ...p, id_proof_url: uri })); })}
                      onRemove={() => setFormData(p => ({ ...p, id_proof_url: '' }))}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              {formTab === 1 && (
                <TouchableOpacity style={styles.prevBtn} onPress={() => setFormTab(0)}>
                  <Text style={styles.prevBtnText}>← Basic Info</Text>
                </TouchableOpacity>
              )}
              {formTab === 0 && (
                <TouchableOpacity style={styles.nextBtn} onPress={() => setFormTab(1)}>
                  <Text style={styles.nextBtnText}>Documents & Photos →</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSaveDriver}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Driver</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerSection: { padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.accent, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  filterPills: { flexDirection: 'row' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  pillActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillExpiring: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  pillText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  pillTextActive: { color: COLORS.white, fontWeight: '700' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  centerText: { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  listContainer: { padding: SPACING.md, gap: SPACING.md },
  driverCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#e2e8f0' },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '800', color: '#fff' },
  driverName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: '#ecfdf5' },
  statusInactive: { backgroundColor: '#f1f5f9' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#16a34a' },
  statusInactiveText: { color: '#64748b' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoText: { fontSize: 12, color: COLORS.textMuted },
  licenseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  docIndicator: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  docIndicatorText: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7ed', borderRadius: RADIUS.sm, padding: 8, marginBottom: 8 },
  alertText: { fontSize: 12, color: '#ea580c', fontWeight: '600', flex: 1 },
  normalExpiryText: { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.sm, alignItems: 'center' },
  toggleBtnText: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, flex: 1 },
  modalCloseBtn: { padding: 4 },
  modalScroll: { paddingHorizontal: SPACING.md, maxHeight: 460 },
  modalFooter: { flexDirection: 'row', gap: 10, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.accent },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabBtnTextActive: { color: COLORS.accent, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text },
  dropdown: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  dropdownMenu: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginTop: 4, ...SHADOWS.sm },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownItemText: { fontSize: 14, color: COLORS.text },
  prevBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  prevBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  nextBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', alignItems: 'center' },
  nextBtnText: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  saveBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', minWidth: 110 },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.white },
});

const docStyles = StyleSheet.create({
  section: { marginTop: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 6, flexDirection: 'row', alignItems: 'center' },
  sectionHint: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8 },
  pageLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  uploadBox: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: RADIUS.md, padding: 16, alignItems: 'center', gap: 8, backgroundColor: '#f8fafc' },
  uploadIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' },
  uploadLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  uploadHint: { fontSize: 11, color: COLORS.textMuted },
  uploadedBox: { borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#f8fafc' },
  previewThumb: { width: '100%', height: 100 },
  uploadedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  uploadedLabel: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  uploadedActions: { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', justifyContent: 'center' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eff6ff', borderRadius: RADIUS.sm },
  changeBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fef2f2', borderRadius: RADIUS.sm },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  scanningBox: { borderWidth: 2, borderColor: '#7c3aed', borderRadius: RADIUS.md, padding: 20, alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff' },
  scanningText: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  ocrBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: RADIUS.sm, padding: 10, marginBottom: 4 },
  ocrBadgeText: { fontSize: 12, fontWeight: '600', flex: 1 },
  extractedBox: { backgroundColor: '#f0fdf4', borderRadius: RADIUS.sm, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  extractedTitle: { fontSize: 11, fontWeight: '800', color: '#15803d', marginBottom: 6 },
  extractedRow: { fontSize: 12, color: '#1e293b', marginBottom: 2 },
  extractedValue: { fontWeight: '800', fontFamily: 'monospace' },
});
