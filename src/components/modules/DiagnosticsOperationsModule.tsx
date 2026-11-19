import React, { useState } from 'react';
import { Plus, Printer, CheckCircle2, AlertTriangle, PackagePlus } from 'lucide-react';
import {
  SIERRA_LEONE_DISTRICTS,
  clampStr,
  makeSafeId,
  type BloodDonor,
  type BloodUnit,
  type Facility,
  type LabOrder,
  type Medicine,
  type Patient,
  type Prescription,
  type UserProfile,
} from '../../types/hub';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { triggerPrintReport } from '../../lib/exportUtils';

interface Props {
  mode: 'laboratory' | 'pharmacy' | 'blood-bank';
  user: UserProfile;
  facilities: Facility[];
  patients: Patient[];
  labOrders: LabOrder[];
  medicines: Medicine[];
  prescriptions: Prescription[];
  bloodDonors: BloodDonor[];
  bloodUnits: BloodUnit[];
  canApproveLab: boolean;
  canDispensePharmacy: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
  onOpenPrintPreview?: () => void;
}

export const DiagnosticsOperationsModule: React.FC<Props> = ({
  mode,
  user,
  facilities,
  patients,
  labOrders,
  medicines,
  prescriptions,
  bloodDonors,
  bloodUnits,
  canApproveLab,
  canDispensePharmacy,
  onLogAudit,
  onToast,
  onOpenPrintPreview,
}) => {
  // Lab state
  const [showLabForm, setShowLabForm] = useState(false);
  const [labPatientId, setLabPatientId] = useState(patients[0]?.id || '');
  const [testName, setTestName] = useState('Malaria Parasite Film & RDT');
  const [refRange, setRefRange] = useState('Negative');
  const [editingLab, setEditingLab] = useState<LabOrder | null>(null);
  const [labResultVal, setLabResultVal] = useState('');
  const [labAbnormal, setLabAbnormal] = useState(false);

  // Pharmacy state
  const [showMedForm, setShowMedForm] = useState(false);
  const [medName, setMedName] = useState('');
  const [medCategory, setMedCategory] = useState('Antimalarial');
  const [medBatch, setMedBatch] = useState('');
  const [medExpiry, setMedExpiry] = useState('2027-06-30');
  const [medStock, setMedStock] = useState('500');
  const [medReorder, setMedReorder] = useState('100');
  const [medUnit, setMedUnit] = useState('tablets');
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxPatientId, setRxPatientId] = useState(patients[0]?.id || '');
  const [rxMedId, setRxMedId] = useState(medicines[0]?.id || '');
  const [rxDosage, setRxDosage] = useState('1 tablet');
  const [rxFreq, setRxFreq] = useState('Twice daily for 7 days');
  const [rxQty, setRxQty] = useState('14');

  // Blood bank state
  const [showDonorForm, setShowDonorForm] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [donorGroup, setDonorGroup] = useState<BloodDonor['bloodGroup']>('O+');
  const [donorDistrict, setDonorDistrict] = useState<string>('Western Area Urban');
  const [donorPhone, setDonorPhone] = useState('');
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitGroup, setUnitGroup] = useState<BloodUnit['bloodGroup']>('O+');
  const [unitComponent, setUnitComponent] = useState('Packed Red Cells');
  const [unitExpiry, setUnitExpiry] = useState('2026-12-30');
  const [crossMatchUnitId, setCrossMatchUnitId] = useState<string | null>(null);
  const [crossMatchPatId, setCrossMatchPatId] = useState('');

  const effectiveLabPatientId = labPatientId || patients[0]?.id || '';
  const effectiveRxPatientId = rxPatientId || patients[0]?.id || '';
  const effectiveRxMedId = rxMedId || medicines[0]?.id || '';
  const effectiveCrossMatchPatId = crossMatchPatId || patients[0]?.id || '';

  const handleCreateLab = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === effectiveLabPatientId);
    if (!pat) {
      onToast('Please register or select a patient first.');
      return;
    }
    try {
      const now = new Date().toISOString();
      const id = makeSafeId('lab');
      const order: LabOrder = {
        id,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName,
        testName: clampStr(testName, 140),
        sampleCode: `SMP-${Math.floor(10000 + Math.random() * 89999)}`,
        sampleStatus: 'Sample Collected',
        resultValue: '',
        referenceRange: clampStr(refRange, 120),
        abnormalFlag: false,
        status: 'Sample Collected',
        approvedBy: '',
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('labOrders', id, order as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_LAB_ORDER', 'LabOrder', id, `Ordered ${testName} for ${pat.patientUid}`);
      setShowLabForm(false);
      onToast(`Lab request ${order.sampleCode} created.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to create lab request.');
    }
  };

  const handleSaveLabResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLab) return;
    try {
      const now = new Date().toISOString();
      await safeUpdateDoc('labOrders', editingLab.id, {
        resultValue: clampStr(labResultVal, 160),
        abnormalFlag: labAbnormal,
        status: canApproveLab ? 'Approved' : 'Results Entered',
        sampleStatus: 'Analyzed',
        approvedBy: canApproveLab ? clampStr(user.displayName || user.email, 120) : '',
        updatedAt: now,
      });
      await onLogAudit('UPDATE_LAB_RESULT', 'LabOrder', editingLab.id, `Result entered for ${editingLab.sampleCode}; abnormal=${labAbnormal}`);
      setEditingLab(null);
      onToast('Laboratory result recorded.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update laboratory result.');
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = makeSafeId('med');
      const now = new Date().toISOString();
      const fac = facilities[0];
      const docData: Medicine = {
        id,
        facilityId: fac?.id || user.facilityId,
        facilityName: fac?.name || user.facilityName,
        name: clampStr(medName, 160),
        genericName: clampStr(medName, 160),
        category: clampStr(medCategory, 80),
        batchNumber: clampStr(medBatch || `B-${Date.now().toString().slice(-4)}`, 60),
        expiryDate: medExpiry,
        stockQuantity: Math.max(0, Number(medStock) || 0),
        reorderLevel: Math.max(0, Number(medReorder) || 50),
        unitPrice: 25,
        unit: clampStr(medUnit, 30),
        isSynthetic: false,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('medicines', id, docData as unknown as Record<string, unknown>);
      await onLogAudit('ADD_MEDICINE', 'Medicine', id, `Registered ${docData.name} (${docData.stockQuantity} ${docData.unit})`);
      setShowMedForm(false);
      setMedName('');
      onToast('Medicine registered to pharmacy stock.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to register medicine.');
    }
  };

  const handleRestockMedicine = async (med: Medicine, addQty = 50) => {
    try {
      const nextStock = med.stockQuantity + addQty;
      await safeUpdateDoc('medicines', med.id, {
        stockQuantity: nextStock,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('RESTOCK_MEDICINE', 'Medicine', med.id, `Restocked ${med.name} by +${addQty} ${med.unit} (new qty: ${nextStock})`);
      onToast(`Restocked ${med.name} (+${addQty} ${med.unit}).`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to restock medicine.');
    }
  };

  const handleCreateRx = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === effectiveRxPatientId);
    const med = medicines.find((m) => m.id === effectiveRxMedId);
    if (!pat || !med) {
      onToast('Please select a valid patient and medicine.');
      return;
    }
    try {
      const id = makeSafeId('rx');
      const now = new Date().toISOString();
      const rx: Prescription = {
        id,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName,
        medicineId: med.id,
        medicineName: med.name,
        dosage: clampStr(rxDosage, 120),
        frequency: clampStr(rxFreq, 120),
        quantity: Math.max(1, Number(rxQty) || 1),
        prescribedBy: clampStr(user.displayName || user.email, 140),
        status: 'Pending',
        dispensedBy: '',
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('prescriptions', id, rx as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_PRESCRIPTION', 'Prescription', id, `Prescribed ${med.name} x${rx.quantity} for ${pat.patientUid}`);
      setShowRxForm(false);
      onToast('Prescription queued for pharmacy dispensing.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to create prescription.');
    }
  };

  const handleDispenseRx = async (rx: Prescription) => {
    try {
      const med = medicines.find((m) => m.id === rx.medicineId);
      const now = new Date().toISOString();
      if (med) {
        const nextStock = Math.max(0, med.stockQuantity - rx.quantity);
        await safeUpdateDoc('medicines', med.id, { stockQuantity: nextStock, updatedAt: now });
      }
      await safeUpdateDoc('prescriptions', rx.id, {
        status: 'Dispensed',
        dispensedBy: clampStr(user.displayName || user.email, 140),
        updatedAt: now,
      });
      await onLogAudit('DISPENSE_PRESCRIPTION', 'Prescription', rx.id, `Dispensed ${rx.medicineName} x${rx.quantity}`);
      onToast(`Dispensed ${rx.medicineName} and decremented pharmacy inventory.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to dispense prescription.');
    }
  };

  const handleCancelRx = async (rx: Prescription) => {
    try {
      await safeUpdateDoc('prescriptions', rx.id, {
        status: 'Cancelled',
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('CANCEL_PRESCRIPTION', 'Prescription', rx.id, `Cancelled prescription for ${rx.medicineName}`);
      onToast(`Prescription for ${rx.medicineName} cancelled.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to cancel prescription.');
    }
  };

  const handleAddDonor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = makeSafeId('bd');
      const now = new Date().toISOString();
      const donor: BloodDonor = {
        id,
        facilityId: facilities[0]?.id || user.facilityId,
        facilityName: facilities[0]?.name || user.facilityName,
        donorName: clampStr(donorName, 160),
        bloodGroup: donorGroup,
        phone: clampStr(donorPhone, 40),
        district: clampStr(donorDistrict, 80),
        lastDonationDate: now.slice(0, 10),
        eligibilityStatus: 'Eligible',
        unitsDonated: 1,
        isSynthetic: false,
        authorizedUids: [user.uid],
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('bloodDonors', id, donor as unknown as Record<string, unknown>);
      await onLogAudit('REGISTER_BLOOD_DONOR', 'BloodDonor', id, `Registered donor ${donor.donorName} (${donor.bloodGroup})`);
      setShowDonorForm(false);
      setDonorName('');
      onToast('Blood donor registered.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to register blood donor.');
    }
  };

  const handleAddBloodUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = makeSafeId('bu');
      const now = new Date().toISOString();
      const unit: BloodUnit = {
        id,
        facilityId: facilities[0]?.id || user.facilityId,
        facilityName: facilities[0]?.name || user.facilityName,
        unitCode: `SL-BB-${Math.floor(10000 + Math.random() * 89999)}`,
        bloodGroup: unitGroup,
        componentType: clampStr(unitComponent, 60),
        collectionDate: now.slice(0, 10),
        expiryDate: unitExpiry,
        status: 'Available',
        crossMatchPatientName: '',
        isSynthetic: false,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('bloodInventory', id, unit as unknown as Record<string, unknown>);
      await onLogAudit('COLLECT_BLOOD_UNIT', 'BloodUnit', id, `Collected ${unit.unitCode} (${unit.bloodGroup})`);
      setShowUnitForm(false);
      onToast(`Blood unit ${unit.unitCode} added to inventory.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to log blood unit.');
    }
  };

  const handleUpdateBloodUnitStatus = async (unit: BloodUnit, status: BloodUnit['status'], crossMatchNameOverride?: string) => {
    try {
      const crossName =
        status === 'Cross-Matched'
          ? (crossMatchNameOverride || patients[0]?.fullName || 'Matched Inpatient')
          : unit.crossMatchPatientName || '';
      await safeUpdateDoc('bloodInventory', unit.id, {
        status,
        crossMatchPatientName: clampStr(crossName, 160),
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_BLOOD_UNIT', 'BloodUnit', unit.id, `Unit ${unit.unitCode} marked ${status}${crossName ? ` (${crossName})` : ''}`);
      setCrossMatchUnitId(null);
      onToast(`Blood unit ${unit.unitCode} updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update blood unit status.');
    }
  };

  if (mode === 'laboratory') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Laboratory Management & Diagnostics</h2>
            <p className="text-xs text-slate-600 mt-1">Sample collection tracking, reference ranges, automated abnormal flagging, and supervisor approval.</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button type="button" onClick={() => (onOpenPrintPreview ? onOpenPrintPreview() : triggerPrintReport())} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
              <Printer className="w-3.5 h-3.5" /> Print Lab Sheet
            </button>
            <button type="button" onClick={() => setShowLabForm(!showLabForm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
              <Plus className="w-3.5 h-3.5" /> New Lab Request
            </button>
          </div>
        </div>

        {showLabForm && (
          <form onSubmit={handleCreateLab} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
              <select required value={effectiveLabPatientId} onChange={(e) => setLabPatientId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {patients.length === 0 && <option value="">No patients registered</option>}
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Laboratory Test</label>
              <input type="text" required value={testName} onChange={(e) => setTestName(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reference Range</label>
              <input type="text" value={refRange} onChange={(e) => setRefRange(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800">Create Order</button>
          </form>
        )}

        {editingLab && (
          <form onSubmit={handleSaveLabResult} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Enter Result · {editingLab.testName} ({editingLab.sampleCode})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <input type="text" required placeholder="Measured result value" value={labResultVal} onChange={(e) => setLabResultVal(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={labAbnormal} onChange={(e) => setLabAbnormal(e.target.checked)} />
                Flag as Abnormal Result
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingLab(null)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg">
                  {canApproveLab ? 'Save & Approve' : 'Save Result'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Sample Code</th>
                <th className="py-2.5 px-4 font-semibold">Patient</th>
                <th className="py-2.5 px-4 font-semibold">Test Requested</th>
                <th className="py-2.5 px-4 font-semibold">Result & Reference</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="no-print py-2.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {labOrders.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-slate-800">{l.sampleCode}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{l.patientName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{l.patientUid}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-800">{l.testName}</td>
                  <td className="py-2.5 px-4">
                    <div className={l.abnormalFlag ? 'text-red-700 font-semibold' : 'text-slate-800'}>
                      {l.resultValue || 'Awaiting processing'} {l.abnormalFlag ? '(ABNORMAL)' : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">Ref: {l.referenceRange || 'Standard'}</div>
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{l.status}</td>
                  <td className="no-print py-2.5 px-4 text-right">
                    {l.status !== 'Approved' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLab(l);
                          setLabResultVal(l.resultValue || '');
                          setLabAbnormal(l.abnormalFlag);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100"
                      >
                        Enter / Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (mode === 'pharmacy') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pharmacy Stock & Prescription Dispensing</h2>
            <p className="text-xs text-slate-600 mt-1">Medicine inventory, batch expiry alerts, reorder thresholds, and automated stock deduction on dispensing.</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button type="button" onClick={() => setShowRxForm(!showRxForm)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
              <Plus className="w-3.5 h-3.5" /> New Prescription
            </button>
            <button type="button" onClick={() => setShowMedForm(!showMedForm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
              <Plus className="w-3.5 h-3.5" /> Register Medicine
            </button>
          </div>
        </div>

        {showMedForm && (
          <form onSubmit={handleAddMedicine} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Medicine Name & Strength</label>
              <input type="text" required value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="e.g., Amoxicillin 500mg" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input type="text" value={medCategory} onChange={(e) => setMedCategory(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batch #</label>
              <input type="text" value={medBatch} onChange={(e) => setMedBatch(e.target.value)} placeholder="B-2611" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiry Date</label>
              <input type="date" required value={medExpiry} onChange={(e) => setMedExpiry(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Stock Qty ({medUnit})</label>
              <input type="number" min={0} required value={medStock} onChange={(e) => setMedStock(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reorder Level</label>
              <input type="number" min={0} required value={medReorder} onChange={(e) => setMedReorder(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Unit</label>
              <input type="text" required value={medUnit} onChange={(e) => setMedUnit(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Save Stock</button>
          </form>
        )}

        {showRxForm && (
          <form onSubmit={handleCreateRx} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
              <select required value={effectiveRxPatientId} onChange={(e) => setRxPatientId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {patients.length === 0 && <option value="">No patients registered</option>}
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Medicine</label>
              <select required value={effectiveRxMedId} onChange={(e) => setRxMedId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {medicines.length === 0 && <option value="">No medicines in stock</option>}
                {medicines.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stockQuantity} left)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Dosage</label>
              <input type="text" required value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} placeholder="1 tablet" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Frequency</label>
              <input type="text" required value={rxFreq} onChange={(e) => setRxFreq(e.target.value)} placeholder="Twice daily" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Qty</label>
              <input type="number" min={1} required value={rxQty} onChange={(e) => setRxQty(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">Queue Prescription</button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inventory Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
              Medicine Inventory & Expiry Warnings
            </div>
            <div className="divide-y divide-slate-100">
              {medicines.map((m) => {
                const low = m.stockQuantity <= m.reorderLevel;
                return (
                  <div key={m.id} className="p-4 text-xs flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{m.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">Batch {m.batchNumber} · Exp {m.expiryDate}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono tabular-nums">
                        <div className={low ? 'text-red-700 font-bold' : 'text-slate-900 font-semibold'}>
                          {m.stockQuantity} {m.unit}
                        </div>
                        {low && (
                          <div className="text-[11px] text-red-700 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Below reorder ({m.reorderLevel})
                          </div>
                        )}
                      </div>
                      {canDispensePharmacy && (
                        <button
                          type="button"
                          onClick={() => handleRestockMedicine(m, 50)}
                          className="no-print inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50 whitespace-nowrap"
                          title="Add 50 units to inventory"
                        >
                          <PackagePlus className="w-3 h-3" /> +50
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prescriptions Queue */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
              Prescription Dispensing Queue ({prescriptions.length})
            </div>
            <div className="divide-y divide-slate-100">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="p-4 text-xs flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{rx.patientName} · {rx.medicineName}</div>
                    <div className="text-slate-600">{rx.dosage} {rx.frequency} · Qty: <span className="font-mono">{rx.quantity}</span></div>
                  </div>
                  {rx.status === 'Pending' && canDispensePharmacy ? (
                    <>
                      <span className="print-only font-medium text-slate-700">{rx.status}</span>
                      <div className="no-print flex items-center gap-1.5 shrink-0">
                        <button type="button" onClick={() => handleCancelRx(rx)} className="px-2 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50">
                          Cancel
                        </button>
                        <button type="button" onClick={() => handleDispenseRx(rx)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Dispense
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="font-medium text-slate-700">{rx.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Blood Bank
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Blood Bank Management & Transfusion Tracking</h2>
          <p className="text-xs text-slate-600 mt-1">Voluntary donor registry, blood group stock levels, expiry alerts, cross-matching, and safe issue tracking.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button type="button" onClick={() => setShowDonorForm(!showDonorForm)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
            <Plus className="w-3.5 h-3.5" /> Register Donor
          </button>
          <button type="button" onClick={() => setShowUnitForm(!showUnitForm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
            <Plus className="w-3.5 h-3.5" /> Log Collected Unit
          </button>
        </div>
      </div>

      {showDonorForm && (
        <form onSubmit={handleAddDonor} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <input type="text" required placeholder="Donor Full Name" value={donorName} onChange={(e) => setDonorName(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          <select value={donorGroup} onChange={(e) => setDonorGroup(e.target.value as BloodDonor['bloodGroup'])} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={donorDistrict} onChange={(e) => setDonorDistrict(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
            {SIERRA_LEONE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="text" placeholder="Phone" value={donorPhone} onChange={(e) => setDonorPhone(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
          <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Save Donor</button>
        </form>
      )}

      {showUnitForm && (
        <form onSubmit={handleAddBloodUnit} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <select value={unitGroup} onChange={(e) => setUnitGroup(e.target.value as BloodUnit['bloodGroup'])} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <input type="text" required value={unitComponent} onChange={(e) => setUnitComponent(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          <input type="date" required value={unitExpiry} onChange={(e) => setUnitExpiry(e.target.value)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg">Add Unit to Inventory</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
            Blood Unit Inventory & Cross-Matching ({bloodUnits.length})
          </div>
          <div className="divide-y divide-slate-100">
            {bloodUnits.map((u) => (
              <div key={u.id} className="p-4 text-xs space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono font-semibold text-slate-900">{u.unitCode} · Group {u.bloodGroup}</div>
                    <div className="text-slate-600">{u.componentType} · Exp {u.expiryDate} {u.crossMatchPatientName ? `· Cross-matched: ${u.crossMatchPatientName}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium text-slate-800">{u.status}</span>
                    {u.status === 'Available' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCrossMatchUnitId(u.id);
                          setCrossMatchPatId(patients[0]?.id || '');
                        }}
                        className="no-print px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50"
                      >
                        Cross-Match
                      </button>
                    )}
                    {u.status === 'Cross-Matched' && (
                      <button type="button" onClick={() => handleUpdateBloodUnitStatus(u, 'Issued')} className="no-print px-2.5 py-1 bg-teal-700 text-white rounded hover:bg-teal-800">
                        Issue Unit
                      </button>
                    )}
                  </div>
                </div>
                {crossMatchUnitId === u.id && (
                  <div className="no-print flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <select
                      value={effectiveCrossMatchPatId}
                      onChange={(e) => setCrossMatchPatId(e.target.value)}
                      className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                    >
                      {patients.length === 0 && <option value="">Matched Inpatient</option>}
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const chosen = patients.find((p) => p.id === effectiveCrossMatchPatId);
                        handleUpdateBloodUnitStatus(u, 'Cross-Matched', chosen?.fullName || 'Matched Inpatient');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800"
                    >
                      Confirm Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrossMatchUnitId(null)}
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
            Registered Blood Donors ({bloodDonors.length})
          </div>
          <div className="divide-y divide-slate-100">
            {bloodDonors.map((d) => (
              <div key={d.id} className="p-4 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{d.donorName} · Group {d.bloodGroup}</div>
                  <div className="text-slate-600">{d.district} · Last donation: {d.lastDonationDate || 'N/A'}</div>
                </div>
                <span className="font-medium text-emerald-700">{d.eligibilityStatus}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
