import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckSquare,
  Database,
  Edit3,
  Search,
  ShieldAlert,
  Square,
  Trash2,
} from 'lucide-react';
import {
  JOURNEY_STAGES,
  SIERRA_LEONE_DISTRICTS,
  USER_ROLES,
  clampStr,
  type Facility,
  type UserProfile,
} from '../../types/hub';
import type { HubDatasetSnapshot } from '../../lib/exportUtils';
import { safeBatchDelete, safeBatchUpdate } from '../../lib/firebase';
import type { HighImpactActionRequest } from '../ReauthActionModal';

export type GlobalCollectionKey =
  | 'facilities'
  | 'users'
  | 'patients'
  | 'encounters'
  | 'labOrders'
  | 'medicines'
  | 'prescriptions'
  | 'bloodDonors'
  | 'bloodInventory'
  | 'screeningCampaigns'
  | 'screenings'
  | 'followUpTasks'
  | 'referrals'
  | 'insuranceClaims'
  | 'telemedicineAppointments'
  | 'surveillanceRecords'
  | 'publicHealthAlerts';

interface NormalizedRecord {
  id: string;
  primary: string;
  secondary: string;
  facilityId: string;
  facilityLabel: string;
  statusLabel: string;
  updatedAt: string;
  protectedFromDelete?: boolean;
  protectedReason?: string;
}

interface CollectionConfig {
  key: GlobalCollectionKey;
  label: string;
  category: 'Infrastructure & Staff' | 'Clinical & Diagnostics' | 'Care Loop & NHIE' | 'Population Health';
}

const COLLECTION_CONFIGS: CollectionConfig[] = [
  { key: 'facilities', label: 'Hospitals & Facilities', category: 'Infrastructure & Staff' },
  { key: 'users', label: 'Staff & Admin Accounts', category: 'Infrastructure & Staff' },
  { key: 'patients', label: 'Patient Registry', category: 'Clinical & Diagnostics' },
  { key: 'encounters', label: 'Clinical Encounters', category: 'Clinical & Diagnostics' },
  { key: 'labOrders', label: 'Laboratory Orders', category: 'Clinical & Diagnostics' },
  { key: 'medicines', label: 'Pharmacy Inventory', category: 'Clinical & Diagnostics' },
  { key: 'prescriptions', label: 'Prescriptions', category: 'Clinical & Diagnostics' },
  { key: 'bloodDonors', label: 'Blood Donors', category: 'Clinical & Diagnostics' },
  { key: 'bloodInventory', label: 'Blood Bank Units', category: 'Clinical & Diagnostics' },
  { key: 'screeningCampaigns', label: 'Screening Campaigns', category: 'Care Loop & NHIE' },
  { key: 'screenings', label: 'Screening Records', category: 'Care Loop & NHIE' },
  { key: 'followUpTasks', label: 'Follow-Up Tasks', category: 'Care Loop & NHIE' },
  { key: 'referrals', label: 'NHIE Referrals', category: 'Care Loop & NHIE' },
  { key: 'insuranceClaims', label: 'Insurance Claims', category: 'Care Loop & NHIE' },
  { key: 'telemedicineAppointments', label: 'Telemedicine Consults', category: 'Care Loop & NHIE' },
  { key: 'surveillanceRecords', label: 'Surveillance Logs', category: 'Population Health' },
  { key: 'publicHealthAlerts', label: 'Public Health Alerts', category: 'Population Health' },
];

interface Props {
  currentUser: UserProfile;
  facilities: Facility[];
  hubData: HubDatasetSnapshot;
  onRequireReauth: (req: HighImpactActionRequest) => void;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export const GlobalRecordsPanel: React.FC<Props> = ({
  currentUser,
  facilities,
  hubData,
  onRequireReauth,
  onLogAudit,
  onToast,
}) => {
  const [activeCollection, setActiveCollection] = useState<GlobalCollectionKey>('patients');
  const [facilityFilter, setFacilityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkModify, setShowBulkModify] = useState(false);

  // Generic Bulk Modify fields (scoped per collection)
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkSecondaryField, setBulkSecondaryField] = useState('');
  const [bulkDistrict, setBulkDistrict] = useState('');
  const [bulkTargetFacilityId, setBulkTargetFacilityId] = useState('');
  const [bulkBooleanFlag, setBulkBooleanFlag] = useState<'' | 'true' | 'false'>('');

  const facilityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    facilities.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [facilities]);

  const resolveFacLabel = (facilityId?: string, facilityName?: string) => {
    if (facilityName) return facilityName;
    if (facilityId && facilityNameMap.has(facilityId)) return facilityNameMap.get(facilityId)!;
    return facilityId || 'Network Wide';
  };

  const getRowsForCollection = (key: GlobalCollectionKey): NormalizedRecord[] => {
    switch (key) {
      case 'facilities':
        return hubData.facilities.map((f) => ({
          id: f.id,
          primary: `${f.name} (${f.code})`,
          secondary: `${f.type} · ${f.district} · ${f.bedCapacity} beds`,
          facilityId: f.id,
          facilityLabel: f.name,
          statusLabel: f.status,
          updatedAt: f.updatedAt,
        }));
      case 'users':
        return hubData.staffUsers.map((u) => ({
          id: u.uid,
          primary: `${u.displayName} (${u.email})`,
          secondary: `${u.role}${u.department ? ` · ${u.department}` : ''}`,
          facilityId: u.facilityId,
          facilityLabel: resolveFacLabel(u.facilityId, u.facilityName),
          statusLabel: u.status,
          updatedAt: u.updatedAt,
          protectedFromDelete: u.uid === currentUser.uid || u.email === 'jaahwix@gmail.com',
          protectedReason:
            u.uid === currentUser.uid
              ? 'Active session'
              : u.email === 'jaahwix@gmail.com'
                ? 'Bootstrapped Super Admin'
                : undefined,
        }));
      case 'patients':
        return hubData.patients.map((p) => ({
          id: p.id,
          primary: `${p.fullName} · ${p.patientUid}`,
          secondary: `${p.gender} · DOB ${p.dateOfBirth} · ${p.district} · ${p.insuranceProvider || 'No Insurance'}`,
          facilityId: p.facilityId,
          facilityLabel: resolveFacLabel(p.facilityId, p.facilityName),
          statusLabel: p.bloodGroup || 'Registered',
          updatedAt: p.updatedAt,
        }));
      case 'encounters':
        return hubData.encounters.map((e) => ({
          id: e.id,
          primary: `${e.patientName} · ${e.encounterType}`,
          secondary: `${e.department} · ${e.clinicianName} · ${e.chiefComplaint}`,
          facilityId: e.facilityId,
          facilityLabel: resolveFacLabel(e.facilityId, e.facilityName),
          statusLabel: e.status,
          updatedAt: e.updatedAt,
        }));
      case 'labOrders':
        return hubData.labOrders.map((l) => ({
          id: l.id,
          primary: `${l.testName} · ${l.patientName}`,
          secondary: `Sample ${l.sampleCode}${l.resultValue ? ` · Result: ${l.resultValue}` : ''}`,
          facilityId: l.facilityId,
          facilityLabel: resolveFacLabel(l.facilityId, l.facilityName),
          statusLabel: `${l.status}${l.abnormalFlag ? ' (Abnormal)' : ''}`,
          updatedAt: l.updatedAt,
        }));
      case 'medicines':
        return hubData.medicines.map((m) => ({
          id: m.id,
          primary: `${m.name} (${m.batchNumber})`,
          secondary: `${m.category || 'General'} · Stock: ${m.stockQuantity} ${m.unit} · Reorder @ ${m.reorderLevel}`,
          facilityId: m.facilityId,
          facilityLabel: resolveFacLabel(m.facilityId, m.facilityName),
          statusLabel: m.stockQuantity <= m.reorderLevel ? 'Low Stock' : 'In Stock',
          updatedAt: m.updatedAt,
        }));
      case 'prescriptions':
        return hubData.prescriptions.map((rx) => ({
          id: rx.id,
          primary: `${rx.medicineName} · ${rx.patientName}`,
          secondary: `Qty ${rx.quantity}${rx.dosage ? ` · ${rx.dosage}` : ''}`,
          facilityId: rx.facilityId,
          facilityLabel: resolveFacLabel(rx.facilityId, rx.facilityName),
          statusLabel: rx.status,
          updatedAt: rx.updatedAt,
        }));
      case 'bloodDonors':
        return hubData.bloodDonors.map((d) => ({
          id: d.id,
          primary: `${d.donorName} (${d.bloodGroup})`,
          secondary: `${d.district}${d.phone ? ` · ${d.phone}` : ''}`,
          facilityId: d.facilityId,
          facilityLabel: resolveFacLabel(d.facilityId, d.facilityName),
          statusLabel: d.eligibilityStatus,
          updatedAt: d.updatedAt,
        }));
      case 'bloodInventory':
        return hubData.bloodUnits.map((b) => ({
          id: b.id,
          primary: `${b.unitCode} · ${b.bloodGroup} (${b.componentType})`,
          secondary: `Expires ${b.expiryDate}${b.crossMatchPatientName ? ` · Match: ${b.crossMatchPatientName}` : ''}`,
          facilityId: b.facilityId,
          facilityLabel: resolveFacLabel(b.facilityId, b.facilityName),
          statusLabel: b.status,
          updatedAt: b.updatedAt,
        }));
      case 'screeningCampaigns':
        return hubData.campaigns.map((c) => ({
          id: c.id,
          primary: c.title,
          secondary: `${c.targetCondition} · ${c.district} · ${c.screenedCount}/${c.targetCount} screened`,
          facilityId: c.facilityId,
          facilityLabel: resolveFacLabel(c.facilityId, c.facilityName),
          statusLabel: c.status,
          updatedAt: c.updatedAt,
        }));
      case 'screenings':
        return hubData.screenings.map((s) => ({
          id: s.id,
          primary: `${s.patientName} · ${s.screeningType}`,
          secondary: `${s.district} · ${s.resultClassification} · Risk: ${s.riskLevel}`,
          facilityId: s.facilityId,
          facilityLabel: resolveFacLabel(s.facilityId, s.facilityName),
          statusLabel: s.journeyStage,
          updatedAt: s.updatedAt,
        }));
      case 'followUpTasks':
        return hubData.followUpTasks.map((t) => ({
          id: t.id,
          primary: `${t.taskTitle} · ${t.patientName}`,
          secondary: `Priority: ${t.priority} · Due ${t.dueDate}`,
          facilityId: t.facilityId,
          facilityLabel: resolveFacLabel(t.facilityId),
          statusLabel: t.status,
          updatedAt: t.updatedAt,
        }));
      case 'referrals':
        return hubData.referrals.map((r) => ({
          id: r.id,
          primary: `${r.patientName} · ${r.specialty}`,
          secondary: `${resolveFacLabel(r.fromFacilityId, r.fromFacilityName)} -> ${resolveFacLabel(r.toFacilityId, r.toFacilityName)} · ${r.urgency}`,
          facilityId: r.fromFacilityId,
          facilityLabel: resolveFacLabel(r.fromFacilityId, r.fromFacilityName),
          statusLabel: r.status,
          updatedAt: r.updatedAt,
        }));
      case 'insuranceClaims':
        return hubData.claims.map((c) => ({
          id: c.id,
          primary: `${c.patientName} · ${c.providerName}`,
          secondary: `${c.serviceDescription} · SLL ${c.amountSLL.toLocaleString()}`,
          facilityId: c.facilityId,
          facilityLabel: resolveFacLabel(c.facilityId, c.facilityName),
          statusLabel: c.status,
          updatedAt: c.updatedAt,
        }));
      case 'telemedicineAppointments':
        return hubData.telemedicine.map((t) => ({
          id: t.id,
          primary: `${t.patientName} · ${t.doctorName}`,
          secondary: `${t.specialty || 'Telemedicine'} · ${t.scheduledDate} ${t.scheduledTime}`,
          facilityId: t.facilityId,
          facilityLabel: resolveFacLabel(t.facilityId, t.facilityName),
          statusLabel: t.status,
          updatedAt: t.updatedAt,
        }));
      case 'surveillanceRecords':
        return hubData.surveillance.map((s) => ({
          id: s.id,
          primary: `${s.condition} · ${s.district}`,
          secondary: `${s.periodType} ${s.periodLabel} · ${s.reportedCases} cases (baseline ${s.baselineCases})`,
          facilityId: s.facilityId,
          facilityLabel: resolveFacLabel(s.facilityId, s.facilityName),
          statusLabel: `${s.reportedCases} cases`,
          updatedAt: s.updatedAt,
        }));
      case 'publicHealthAlerts':
        return hubData.alerts.map((a) => ({
          id: a.id,
          primary: `${a.referenceNumber} · ${a.condition}`,
          secondary: `${a.district} · Severity: ${a.severity} · ${a.reportedCases} cases`,
          facilityId: a.reportingFacilities?.[0] || '',
          facilityLabel: a.reportingFacilities?.join(', ') || `${a.district} Network`,
          statusLabel: a.verificationStatus,
          updatedAt: a.updatedAt,
        }));
    }
  };

  const collectionCounts = useMemo(() => {
    const counts: Record<GlobalCollectionKey, number> = {
      facilities: hubData.facilities.length,
      users: hubData.staffUsers.length,
      patients: hubData.patients.length,
      encounters: hubData.encounters.length,
      labOrders: hubData.labOrders.length,
      medicines: hubData.medicines.length,
      prescriptions: hubData.prescriptions.length,
      bloodDonors: hubData.bloodDonors.length,
      bloodInventory: hubData.bloodUnits.length,
      screeningCampaigns: hubData.campaigns.length,
      screenings: hubData.screenings.length,
      followUpTasks: hubData.followUpTasks.length,
      referrals: hubData.referrals.length,
      insuranceClaims: hubData.claims.length,
      telemedicineAppointments: hubData.telemedicine.length,
      surveillanceRecords: hubData.surveillance.length,
      publicHealthAlerts: hubData.alerts.length,
    };
    return counts;
  }, [hubData]);

  const rows = useMemo(() => {
    const all = getRowsForCollection(activeCollection);
    const q = searchQuery.trim().toLowerCase();
    return all.filter((row) => {
      if (facilityFilter !== 'ALL' && row.facilityId !== facilityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.id.toLowerCase().includes(q) ||
        row.primary.toLowerCase().includes(q) ||
        row.secondary.toLowerCase().includes(q) ||
        row.facilityLabel.toLowerCase().includes(q) ||
        row.statusLabel.toLowerCase().includes(q)
      );
    });
  }, [activeCollection, facilityFilter, searchQuery, hubData, facilities, currentUser.uid]);

  const selectedRecords = useMemo(
    () => rows.filter((r) => selectedIds.includes(r.id)),
    [rows, selectedIds]
  );

  const selectedFacilitySummary = useMemo(() => {
    const names = Array.from(new Set(selectedRecords.map((r) => r.facilityLabel))).filter(Boolean);
    if (names.length === 0) return 'Platform Wide';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more hospitals`;
  }, [selectedRecords]);

  const activeConfig = COLLECTION_CONFIGS.find((c) => c.key === activeCollection)!;

  const resetBulkModifyFields = () => {
    setBulkStatus('');
    setBulkSecondaryField('');
    setBulkDistrict('');
    setBulkTargetFacilityId('');
    setBulkBooleanFlag('');
  };

  const handleCollectionChange = (key: GlobalCollectionKey) => {
    setActiveCollection(key);
    setSelectedIds([]);
    setShowBulkModify(false);
    resetBulkModifyFields();
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  };

  const buildBulkModifyUpdates = (): {
    updates: { id: string; data: Record<string, unknown> }[];
    summary: string;
    skippedCount: number;
  } => {
    const now = new Date().toISOString();
    const updates: { id: string; data: Record<string, unknown> }[] = [];
    const changeDescriptions: string[] = [];
    let skippedCount = 0;

    if (bulkStatus) changeDescriptions.push(`status -> ${bulkStatus}`);
    if (bulkSecondaryField) changeDescriptions.push(`attribute -> ${bulkSecondaryField}`);
    if (bulkDistrict) changeDescriptions.push(`district -> ${bulkDistrict}`);
    if (bulkTargetFacilityId) {
      const fName = facilityNameMap.get(bulkTargetFacilityId) || bulkTargetFacilityId;
      changeDescriptions.push(`facility -> ${fName}`);
    }
    if (bulkBooleanFlag) changeDescriptions.push(`flag -> ${bulkBooleanFlag}`);

    for (const rec of selectedRecords) {
      if (activeCollection === 'users' && rec.protectedFromDelete && (bulkStatus === 'Suspended' || bulkSecondaryField)) {
        skippedCount++;
        continue;
      }

      const patch: Record<string, unknown> = { updatedAt: now };

      switch (activeCollection) {
        case 'facilities':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkDistrict) patch.district = bulkDistrict;
          if (bulkSecondaryField) patch.type = clampStr(bulkSecondaryField, 60);
          break;
        case 'users':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.role = bulkSecondaryField;
          if (bulkTargetFacilityId) {
            patch.facilityId = bulkTargetFacilityId;
            patch.facilityName = clampStr(facilityNameMap.get(bulkTargetFacilityId) || bulkTargetFacilityId, 160);
          }
          break;
        case 'patients':
          if (bulkDistrict) patch.district = bulkDistrict;
          if (bulkStatus) patch.bloodGroup = clampStr(bulkStatus, 10);
          if (bulkSecondaryField) patch.insuranceProvider = clampStr(bulkSecondaryField, 120);
          break;
        case 'encounters':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.department = clampStr(bulkSecondaryField, 100);
          break;
        case 'screeningCampaigns':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkDistrict) patch.district = bulkDistrict;
          break;
        case 'screenings':
          if (bulkStatus) patch.journeyStage = bulkStatus;
          if (bulkSecondaryField) patch.riskLevel = bulkSecondaryField;
          if (bulkBooleanFlag) patch.followUpCompleted = bulkBooleanFlag === 'true';
          break;
        case 'followUpTasks':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.priority = bulkSecondaryField;
          break;
        case 'referrals':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.urgency = bulkSecondaryField;
          if (bulkBooleanFlag) patch.exchangeAuthorized = bulkBooleanFlag === 'true';
          break;
        case 'labOrders':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkBooleanFlag) patch.abnormalFlag = bulkBooleanFlag === 'true';
          break;
        case 'medicines':
          if (bulkSecondaryField) patch.category = clampStr(bulkSecondaryField, 80);
          if (bulkStatus && !Number.isNaN(Number(bulkStatus))) {
            patch.reorderLevel = Math.max(0, Math.min(1000000, Number(bulkStatus)));
          }
          break;
        case 'prescriptions':
          if (bulkStatus) patch.status = bulkStatus;
          break;
        case 'bloodDonors':
          if (bulkStatus) patch.eligibilityStatus = bulkStatus;
          if (bulkDistrict) patch.district = bulkDistrict;
          break;
        case 'bloodInventory':
          if (bulkStatus) patch.status = bulkStatus;
          break;
        case 'insuranceClaims':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.providerName = clampStr(bulkSecondaryField, 120);
          break;
        case 'telemedicineAppointments':
          if (bulkStatus) patch.status = bulkStatus;
          if (bulkSecondaryField) patch.specialty = clampStr(bulkSecondaryField, 100);
          break;
        case 'surveillanceRecords':
          if (bulkDistrict) patch.district = bulkDistrict;
          if (bulkStatus) patch.periodType = bulkStatus;
          break;
        case 'publicHealthAlerts':
          if (bulkStatus) patch.verificationStatus = bulkStatus;
          if (bulkSecondaryField) patch.severity = bulkSecondaryField;
          break;
      }

      if (Object.keys(patch).length > 1) {
        updates.push({ id: rec.id, data: patch });
      }
    }

    return {
      updates,
      summary: changeDescriptions.join(', ') || 'Updated timestamp',
      skippedCount,
    };
  };

  const handleRequestBulkModify = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecords.length === 0) return;

    const { updates, summary, skippedCount } = buildBulkModifyUpdates();
    if (updates.length === 0) {
      onToast('Select at least one field value to modify across the selected records.');
      return;
    }

    onRequireReauth({
      title: `Confirm Global Bulk Modify (${activeConfig.label})`,
      actionType: 'BULK_MODIFY',
      collectionLabel: activeConfig.label,
      recordCount: updates.length,
      facilitySummary: selectedFacilitySummary,
      detailsSummary: `Apply [${summary}] to ${updates.length} ${activeConfig.label} record(s).${
        skippedCount > 0 ? ` (${skippedCount} protected Super Admin account(s) excluded.)` : ''
      }`,
      onExecute: async () => {
        await safeBatchUpdate(activeCollection, updates);
        await onLogAudit(
          'GLOBAL_BULK_MODIFY',
          activeCollection,
          `batch_${updates.length}`,
          `Super Admin bulk modified ${updates.length} ${activeCollection} record(s) across ${selectedFacilitySummary}: ${summary}`
        );
        setSelectedIds([]);
        setShowBulkModify(false);
        resetBulkModifyFields();
        onToast(`Bulk modified ${updates.length} ${activeConfig.label} record(s) after re-authentication.`);
      },
    });
  };

  const handleRequestBulkDelete = () => {
    if (selectedRecords.length === 0) return;

    const deletable = selectedRecords.filter((r) => !r.protectedFromDelete);
    const skippedCount = selectedRecords.length - deletable.length;

    if (deletable.length === 0) {
      onToast('Selected records are protected Super Admin / active session accounts and cannot be deleted.');
      return;
    }

    onRequireReauth({
      title: `Confirm Global Bulk Delete (${activeConfig.label})`,
      actionType: 'BULK_DELETE',
      collectionLabel: activeConfig.label,
      recordCount: deletable.length,
      facilitySummary: selectedFacilitySummary,
      detailsSummary: `Permanently delete ${deletable.length} ${activeConfig.label} record(s) from Firestore across ${selectedFacilitySummary}. This action cannot be undone.${
        skippedCount > 0 ? ` (${skippedCount} protected account(s) excluded.)` : ''
      }`,
      onExecute: async () => {
        await safeBatchDelete(
          activeCollection,
          deletable.map((r) => r.id)
        );
        await onLogAudit(
          'GLOBAL_BULK_DELETE',
          activeCollection,
          `batch_${deletable.length}`,
          `Super Admin bulk deleted ${deletable.length} ${activeCollection} record(s) across ${selectedFacilitySummary}`
        );
        setSelectedIds([]);
        setShowBulkModify(false);
        onToast(`Permanently deleted ${deletable.length} ${activeConfig.label} record(s).`);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-amber-950 uppercase tracking-wide">
              Global Records Management Active · All Platform Facilities
            </div>
            <p className="text-xs text-amber-900 mt-0.5">
              Super Administrator cross-hospital bulk control is enabled across all 17 platform datasets. Every bulk <strong>Modify</strong> or <strong>Delete</strong> action requires fresh Firebase re-authentication and writes an immutable audit log.
            </p>
          </div>
        </div>
        <div className="text-xs font-mono font-semibold text-amber-950 bg-white/80 border border-amber-300 rounded-lg px-3 py-1.5 shrink-0">
          {selectedIds.length} Selected
        </div>
      </div>

      {/* Collection Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Database className="w-4 h-4 text-teal-700" />
            <span>Platform Datasets (Click to Inspect & Bulk Manage)</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Total Records Loaded: <strong className="font-mono text-slate-800">{Object.values(collectionCounts).reduce((a, b) => a + b, 0)}</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {COLLECTION_CONFIGS.map((cfg) => {
            const count = collectionCounts[cfg.key];
            const active = activeCollection === cfg.key;
            return (
              <button
                key={cfg.key}
                type="button"
                onClick={() => handleCollectionChange(cfg.key)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-semibold truncate">{cfg.label}</div>
                <div className={`text-[11px] font-mono mt-0.5 ${active ? 'text-teal-300' : 'text-slate-500'}`}>
                  {count} {count === 1 ? 'record' : 'records'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter + Bulk Action Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter global records by hospital"
              value={facilityFilter}
              onChange={(e) => {
                setFacilityFilter(e.target.value);
                setSelectedIds([]);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="ALL">All Platform Hospitals ({facilities.length} facilities)</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeConfig.label.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
            />
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              {allFilteredSelected ? <CheckSquare className="w-3.5 h-3.5 text-teal-700" /> : <Square className="w-3.5 h-3.5 text-slate-500" />}
              <span>{allFilteredSelected ? 'Deselect All' : `Select All (${rows.length})`}</span>
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setShowBulkModify((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Modify Selected ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleRequestBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>

        {/* Bulk Modify Editor */}
        {showBulkModify && selectedIds.length > 0 && (
          <form
            onSubmit={handleRequestBulkModify}
            className="border border-slate-300 bg-slate-50 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="text-xs font-bold text-slate-900">
                Bulk Modify {selectedIds.length} Selected {activeConfig.label} Record(s)
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModify(false)}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(activeCollection === 'facilities' ||
                activeCollection === 'users' ||
                activeCollection === 'encounters' ||
                activeCollection === 'screeningCampaigns' ||
                activeCollection === 'screenings' ||
                activeCollection === 'followUpTasks' ||
                activeCollection === 'referrals' ||
                activeCollection === 'labOrders' ||
                activeCollection === 'prescriptions' ||
                activeCollection === 'bloodDonors' ||
                activeCollection === 'bloodInventory' ||
                activeCollection === 'insuranceClaims' ||
                activeCollection === 'telemedicineAppointments' ||
                activeCollection === 'surveillanceRecords' ||
                activeCollection === 'publicHealthAlerts') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {activeCollection === 'screenings'
                      ? 'Set Journey Stage'
                      : activeCollection === 'bloodDonors'
                        ? 'Set Eligibility Status'
                        : activeCollection === 'surveillanceRecords'
                          ? 'Set Period Type'
                          : activeCollection === 'publicHealthAlerts'
                            ? 'Set Verification Status'
                            : 'Set Status'}
                  </label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Keep Existing --</option>
                    {activeCollection === 'facilities' &&
                      ['Approved', 'Pending', 'Suspended'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'users' &&
                      ['Active', 'Pending', 'Suspended'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'encounters' &&
                      ['Triage', 'In Consultation', 'Admitted', 'Discharged', 'Completed'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'screeningCampaigns' &&
                      ['Active', 'Planned', 'Completed'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'screenings' &&
                      JOURNEY_STAGES.map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'followUpTasks' &&
                      ['Pending', 'Scheduled', 'In Progress', 'Overdue', 'Missed', 'Completed', 'Escalated'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'referrals' &&
                      ['Pending', 'Accepted', 'Appointment Scheduled', 'Completed', 'Declined'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'labOrders' &&
                      ['Requested', 'Sample Collected', 'Processing', 'Results Entered', 'Approved'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'prescriptions' &&
                      ['Pending', 'Dispensed', 'Cancelled'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'bloodDonors' &&
                      ['Eligible', 'Deferred', 'Temporary Deferral'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'bloodInventory' &&
                      ['Available', 'Cross-Matched', 'Issued', 'Expired', 'Quarantined'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'insuranceClaims' &&
                      ['Draft', 'Submitted', 'Approved', 'Rejected', 'Paid'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'telemedicineAppointments' &&
                      ['Scheduled', 'Ready', 'Completed', 'Cancelled'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'surveillanceRecords' &&
                      ['Daily', 'Weekly', 'Monthly'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'publicHealthAlerts' &&
                      ['Pending Verification', 'Acknowledged', 'Under Investigation', 'Escalated', 'Resolved', 'Dismissed'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}

              {activeCollection === 'patients' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Blood Group</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Keep Existing --</option>
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeCollection === 'medicines' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Reorder Level</label>
                  <input
                    type="number"
                    min={0}
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              )}

              {(activeCollection === 'facilities' ||
                activeCollection === 'patients' ||
                activeCollection === 'screeningCampaigns' ||
                activeCollection === 'bloodDonors' ||
                activeCollection === 'surveillanceRecords') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set District</label>
                  <select
                    value={bulkDistrict}
                    onChange={(e) => setBulkDistrict(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Keep Existing --</option>
                    {SIERRA_LEONE_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeCollection === 'users' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign Role</label>
                    <select
                      value={bulkSecondaryField}
                      onChange={(e) => setBulkSecondaryField(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Keep Existing --</option>
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reassign Hospital</label>
                    <select
                      value={bulkTargetFacilityId}
                      onChange={(e) => setBulkTargetFacilityId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">-- Keep Existing --</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(activeCollection === 'screenings' ||
                activeCollection === 'followUpTasks' ||
                activeCollection === 'referrals' ||
                activeCollection === 'publicHealthAlerts') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {activeCollection === 'screenings'
                      ? 'Set Risk Level'
                      : activeCollection === 'followUpTasks'
                        ? 'Set Priority'
                        : activeCollection === 'referrals'
                          ? 'Set Urgency'
                          : 'Set Severity'}
                  </label>
                  <select
                    value={bulkSecondaryField}
                    onChange={(e) => setBulkSecondaryField(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Keep Existing --</option>
                    {activeCollection === 'screenings' &&
                      ['Low', 'Moderate', 'High', 'Critical'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'followUpTasks' &&
                      ['Routine', 'High', 'Urgent'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'referrals' &&
                      ['Routine', 'Urgent', 'Emergency'].map((v) => <option key={v} value={v}>{v}</option>)}
                    {activeCollection === 'publicHealthAlerts' &&
                      ['Informational', 'Low', 'Moderate', 'High', 'Critical'].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}

              {(activeCollection === 'encounters' ||
                activeCollection === 'patients' ||
                activeCollection === 'medicines' ||
                activeCollection === 'insuranceClaims' ||
                activeCollection === 'telemedicineAppointments' ||
                activeCollection === 'facilities') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {activeCollection === 'facilities'
                      ? 'Set Facility Type'
                      : activeCollection === 'encounters'
                        ? 'Set Department'
                        : activeCollection === 'patients' || activeCollection === 'insuranceClaims'
                          ? 'Set Insurance Provider'
                          : activeCollection === 'medicines'
                            ? 'Set Category'
                            : 'Set Specialty'}
                  </label>
                  <input
                    type="text"
                    value={bulkSecondaryField}
                    onChange={(e) => setBulkSecondaryField(e.target.value)}
                    placeholder="Leave blank to keep existing"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {(activeCollection === 'labOrders' ||
                activeCollection === 'screenings' ||
                activeCollection === 'referrals') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {activeCollection === 'labOrders'
                      ? 'Abnormal Flag'
                      : activeCollection === 'screenings'
                        ? 'Follow-Up Completed'
                        : 'FHIR Exchange Authorized'}
                  </label>
                  <select
                    value={bulkBooleanFlag}
                    onChange={(e) => setBulkBooleanFlag(e.target.value as '' | 'true' | 'false')}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Keep Existing --</option>
                    <option value="true">Yes (True)</option>
                    <option value="false">No (False)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-slate-600">
                Requires Super Admin re-authentication before writing to Firestore.
              </span>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Review & Authenticate Bulk Modify
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Records Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all visible records"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
              </th>
              <th className="py-2.5 px-4 font-semibold">Record & Details</th>
              <th className="py-2.5 px-4 font-semibold">Hospital / Facility</th>
              <th className="py-2.5 px-4 font-semibold">Status</th>
              <th className="py-2.5 px-4 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                  No {activeConfig.label.toLowerCase()} matched the current hospital or search filter.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const checked = selectedIds.includes(r.id);
                return (
                  <tr
                    key={r.id}
                    className={checked ? 'bg-amber-50/50' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.primary}`}
                        checked={checked}
                        onChange={() => toggleSelectRow(r.id)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {r.primary}
                        {r.protectedFromDelete && (
                          <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            Protected ({r.protectedReason})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {r.secondary} · <span className="font-mono">{r.id}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{r.facilityLabel}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.statusLabel}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {r.updatedAt ? r.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
