import React, { useEffect, useState } from 'react';
import { Plus, Search, UserCheck, AlertTriangle, Edit3, Stethoscope } from 'lucide-react';
import {
  SIERRA_LEONE_DISTRICTS,
  clampStr,
  makeSafeId,
  type Encounter,
  type Facility,
  type InsuranceClaim,
  type LabOrder,
  type Patient,
  type Prescription,
  type Referral,
  type ScreeningRecord,
  type UserProfile,
} from '../../types/hub';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { PatientProfileDrawer } from '../PatientProfileDrawer';

interface Props {
  mode: 'patients' | 'clinical';
  user: UserProfile;
  facilities: Facility[];
  patients: Patient[];
  encounters: Encounter[];
  labs: LabOrder[];
  prescriptions: Prescription[];
  screenings: ScreeningRecord[];
  referrals: Referral[];
  claims: InsuranceClaim[];
  focusedPatientId?: string | null;
  onClearFocusedPatient?: () => void;
  canEditPatients: boolean;
  canEditEncounters: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export const PatientsClinicalModule: React.FC<Props> = ({
  mode,
  user,
  facilities,
  patients,
  encounters,
  labs,
  prescriptions,
  screenings,
  referrals,
  claims,
  focusedPatientId,
  onClearFocusedPatient,
  canEditPatients,
  canEditEncounters,
  onLogAudit,
  onToast,
}) => {
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatForm, setShowPatForm] = useState(false);
  const [editingPat, setEditingPat] = useState<Patient | null>(null);

  // Patient form fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [district, setDistrict] = useState<string>('Western Area Urban');
  const [chiefdom, setChiefdom] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('None documented');
  const [chronic, setChronic] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [facId, setFacId] = useState(facilities[0]?.id || user.facilityId);

  // Encounter form fields
  const [showEncForm, setShowEncForm] = useState(false);
  const [encPatId, setEncPatId] = useState(patients[0]?.id || '');
  const [encType, setEncType] = useState<Encounter['encounterType']>('Outpatient');
  const [encDept, setEncDept] = useState('Outpatient');
  const [encComplaint, setEncComplaint] = useState('');
  const [encVitals, setEncVitals] = useState('');
  const [encNursing, setEncNursing] = useState('');
  const [encDiagnosis, setEncDiagnosis] = useState('');
  const [encPlan, setEncPlan] = useState('');
  const [encWardBed, setEncWardBed] = useState('');
  const [editingEnc, setEditingEnc] = useState<Encounter | null>(null);
  const [encStatus, setEncStatus] = useState<Encounter['status']>('In Consultation');
  const [encDischarge, setEncDischarge] = useState('');

  const effectiveFacId = facId || facilities[0]?.id || user.facilityId;
  const effectiveEncPatId = encPatId || patients[0]?.id || '';

  useEffect(() => {
    if (!focusedPatientId) return;
    const found = patients.find((p) => p.id === focusedPatientId);
    if (found) {
      setSelectedPatient(found);
    }
  }, [focusedPatientId, patients]);

  // Duplicate patient detection
  const duplicateMatches = patients.filter((p) => {
    if (editingPat && p.id === editingPat.id) return false;
    const nameMatch = fullName.trim().length > 3 && p.fullName.toLowerCase() === fullName.trim().toLowerCase() && p.dateOfBirth === dob;
    const phoneMatch = phone.trim().length > 5 && p.phone === phone.trim();
    return nameMatch || phoneMatch;
  });

  const openNewPatient = () => {
    setEditingPat(null);
    setFullName('');
    setDob('');
    setGender('Female');
    setDistrict('Western Area Urban');
    setChiefdom('');
    setPhone('');
    setEmergencyName('');
    setEmergencyPhone('');
    setBloodGroup('O+');
    setAllergies('None documented');
    setChronic('');
    setInsuranceProvider('');
    setInsuranceNumber('');
    setFacId(facilities[0]?.id || user.facilityId);
    setShowPatForm(true);
  };

  const openEditPatient = (p: Patient) => {
    setEditingPat(p);
    setFullName(p.fullName);
    setDob(p.dateOfBirth);
    setGender(p.gender);
    setDistrict(p.district);
    setChiefdom(p.chiefdom || '');
    setPhone(p.phone || '');
    setEmergencyName(p.emergencyContactName || '');
    setEmergencyPhone(p.emergencyContactPhone || '');
    setBloodGroup(p.bloodGroup || 'O+');
    setAllergies(p.allergies || '');
    setChronic(p.chronicConditions || '');
    setInsuranceProvider(p.insuranceProvider || '');
    setInsuranceNumber(p.insuranceNumber || '');
    setFacId(p.facilityId);
    setShowPatForm(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const targetFacId = effectiveFacId || user.facilityId;
      const fac = facilities.find((f) => f.id === targetFacId);

      if (editingPat) {
        await safeUpdateDoc('patients', editingPat.id, {
          fullName: clampStr(fullName, 160),
          dateOfBirth: clampStr(dob, 20),
          gender,
          district: clampStr(district, 80),
          chiefdom: clampStr(chiefdom, 100),
          phone: clampStr(phone, 40),
          emergencyContactName: clampStr(emergencyName, 140),
          emergencyContactPhone: clampStr(emergencyPhone, 40),
          bloodGroup: clampStr(bloodGroup, 10),
          allergies: clampStr(allergies, 300),
          chronicConditions: clampStr(chronic, 300),
          insuranceProvider: clampStr(insuranceProvider, 120),
          insuranceNumber: clampStr(insuranceNumber, 80),
          updatedAt: now,
        });
        await onLogAudit('UPDATE_PATIENT', 'Patient', editingPat.id, `Updated record for ${editingPat.patientUid}`);
        onToast(`Patient ${editingPat.patientUid} updated.`);
      } else {
        const id = makeSafeId('pat');
        const uid = `JTH-SL-${new Date().getFullYear()}-${String(Math.floor(100000 + Math.random() * 899999))}`;
        const newPat: Patient = {
          id,
          patientUid: uid,
          facilityId: targetFacId,
          facilityName: clampStr(fac?.name || user.facilityName || 'Hub Facility', 160),
          fullName: clampStr(fullName, 160),
          dateOfBirth: clampStr(dob, 20),
          gender,
          district: clampStr(district, 80),
          chiefdom: clampStr(chiefdom, 100),
          phone: clampStr(phone, 40),
          emergencyContactName: clampStr(emergencyName, 140),
          emergencyContactPhone: clampStr(emergencyPhone, 40),
          bloodGroup: clampStr(bloodGroup, 10),
          allergies: clampStr(allergies, 300),
          chronicConditions: clampStr(chronic, 300),
          insuranceProvider: clampStr(insuranceProvider, 120),
          insuranceNumber: clampStr(insuranceNumber, 80),
          isSynthetic: false,
          authorizedUids: [user.uid],
          createdByUid: user.uid,
          createdAt: now,
          updatedAt: now,
        };
        await safeSetDoc('patients', id, newPat as unknown as Record<string, unknown>);
        await onLogAudit('CREATE_PATIENT', 'Patient', id, `Registered patient ${uid}`);
        onToast(`Patient registered with Unique Hub ID ${uid}.`);
      }
      setShowPatForm(false);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save patient record.');
    }
  };

  const handleSaveEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      if (editingEnc) {
        await safeUpdateDoc('encounters', editingEnc.id, {
          encounterType: encType,
          department: clampStr(encDept, 100),
          chiefComplaint: clampStr(encComplaint, 400),
          vitalSigns: clampStr(encVitals, 300),
          nursingNotes: clampStr(encNursing, 600),
          diagnosis: clampStr(encDiagnosis, 300),
          treatmentPlan: clampStr(encPlan, 600),
          dischargeSummary: clampStr(encDischarge, 600),
          status: encStatus,
          wardBed: clampStr(encWardBed, 60),
          updatedAt: now,
        });
        await onLogAudit('UPDATE_ENCOUNTER', 'Encounter', editingEnc.id, `Updated encounter status to ${encStatus}`);
        setEditingEnc(null);
        setShowEncForm(false);
        onToast('Clinical encounter updated.');
        return;
      }

      const pat = patients.find((p) => p.id === effectiveEncPatId);
      if (!pat) {
        onToast('Register or select a valid patient first.');
        return;
      }

      const id = makeSafeId('enc');
      const encDoc: Encounter = {
        id,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName,
        encounterType: encType,
        department: clampStr(encDept, 100),
        clinicianName: clampStr(user.displayName || user.email, 140),
        chiefComplaint: clampStr(encComplaint, 400),
        vitalSigns: clampStr(encVitals, 300),
        nursingNotes: clampStr(encNursing, 600),
        diagnosis: clampStr(encDiagnosis, 300),
        treatmentPlan: clampStr(encPlan, 600),
        dischargeSummary: clampStr(encDischarge, 600),
        status: encStatus,
        wardBed: clampStr(encWardBed, 60),
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('encounters', id, encDoc as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_ENCOUNTER', 'Encounter', id, `Logged ${encType} encounter for ${pat.patientUid}`);
      setShowEncForm(false);
      setEncComplaint('');
      setEncVitals('');
      setEncDiagnosis('');
      setEncPlan('');
      onToast('Clinical encounter saved to database.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save clinical encounter.');
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (districtFilter !== 'All' && p.district !== districtFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.patientUid.toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const pagedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);

  const filteredEncounters = encounters.filter((e) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.patientName.toLowerCase().includes(q) ||
        (e.patientUid || '').toLowerCase().includes(q) ||
        (e.diagnosis || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {mode === 'patients' ? (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patient Registry & Unified Records</h2>
              <p className="text-xs text-slate-600 mt-1">
                Standardized patient UIDs with facility isolation, live duplicate detection, and unified longitudinal clinical profiles.
              </p>
            </div>
            {canEditPatients && (
              <button
                type="button"
                onClick={openNewPatient}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Register New Patient
              </button>
            )}
          </div>

          {showPatForm && (
            <form onSubmit={handleSavePatient} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingPat ? `Edit Patient · ${editingPat.patientUid}` : 'New Patient Registration'}
                </h3>
                <button type="button" onClick={() => setShowPatForm(false)} className="text-xs text-slate-500">Close</button>
              </div>

              {duplicateMatches.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Potential Duplicate Patient Detected:</strong> Matches existing record{' '}
                    {duplicateMatches.map((d) => `${d.fullName} (${d.patientUid})`).join(', ')}. Verify before creating a duplicate ID.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input type="date" required value={dob} onChange={(e) => setDob(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value as 'Female' | 'Male' | 'Other')} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Facility</label>
                  <select value={effectiveFacId} disabled={Boolean(editingPat)} onChange={(e) => setFacId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    {facilities.length === 0 && <option value={user.facilityId}>{user.facilityName || user.facilityId}</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
                  <select value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    {SIERRA_LEONE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Chiefdom / Ward</label>
                  <input type="text" value={chiefdom} onChange={(e) => setChiefdom(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+232 ..." className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Contact</label>
                  <input type="text" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Phone</label>
                  <input type="text" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Allergies</label>
                  <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Chronic Conditions</label>
                  <input type="text" value={chronic} onChange={(e) => setChronic(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Insurance Provider</label>
                  <input type="text" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Policy / Scheme Number</label>
                  <input type="text" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPatForm(false)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800">
                  {editingPat ? 'Save Record Updates' : 'Register Patient'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, Hub UID, or phone..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-72"
                />
              </div>
              <select value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="All">All Districts</option>
                {SIERRA_LEONE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Hub Patient UID</th>
                    <th className="py-2.5 px-4 font-semibold">Full Name</th>
                    <th className="py-2.5 px-4 font-semibold">Demographics</th>
                    <th className="py-2.5 px-4 font-semibold">District & Facility</th>
                    <th className="py-2.5 px-4 font-semibold">Medical Alerts</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPatients.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-slate-500">No patients found.</td></tr>
                  ) : (
                    pagedPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-semibold text-teal-800">{p.patientUid}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{p.fullName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{p.phone || 'No phone'}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 tabular-nums">{p.gender} · DOB {p.dateOfBirth} · {p.bloodGroup || '—'}</td>
                        <td className="py-2.5 px-4">
                          <div className="text-slate-800">{p.district}</div>
                          <div className="text-[11px] text-slate-500">{p.facilityName || p.facilityId}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">
                          {p.allergies && p.allergies !== 'None documented' ? `Allergy: ${p.allergies}` : p.chronicConditions || 'Nominal'}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedPatient(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-300 rounded-md hover:bg-slate-100"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Unified Profile
                          </button>
                          {canEditPatients && (
                            <button
                              type="button"
                              onClick={() => openEditPatient(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Showing {pagedPatients.length} of {filteredPatients.length} patients</span>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2.5 py-1 border border-slate-300 rounded disabled:opacity-40">Prev</button>
                <span className="font-mono tabular-nums">Page {page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-2.5 py-1 border border-slate-300 rounded disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Clinical & Consultation Management</h2>
              <p className="text-xs text-slate-600 mt-1">
                Outpatient triage, inpatient ward admissions, nursing observations, vital signs, diagnoses, treatment plans, and discharge summaries.
              </p>
            </div>
            {canEditEncounters && (
              <button
                type="button"
                onClick={() => {
                  setEditingEnc(null);
                  setEncPatId(patients[0]?.id || '');
                  setEncComplaint('');
                  setEncVitals('');
                  setEncNursing('');
                  setEncDiagnosis('');
                  setEncPlan('');
                  setEncDischarge('');
                  setEncStatus('In Consultation');
                  setShowEncForm(!showEncForm);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                New Clinical Encounter
              </button>
            )}
          </div>

          {showEncForm && (
            <form onSubmit={handleSaveEncounter} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingEnc ? `Update Encounter · ${editingEnc.patientName}` : 'Record Outpatient / Inpatient Encounter'}
                </h3>
                <button type="button" onClick={() => setShowEncForm(false)} className="text-xs text-slate-500">Close</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {!editingEnc && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
                    <select required value={effectiveEncPatId} onChange={(e) => setEncPatId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                      {patients.length === 0 && <option value="">No patients registered</option>}
                      {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Encounter Type</label>
                  <select value={encType} onChange={(e) => setEncType(e.target.value as Encounter['encounterType'])} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="Outpatient">Outpatient</option>
                    <option value="Inpatient">Inpatient</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Maternal">Maternal</option>
                    <option value="Follow-Up">Follow-Up</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                  <input type="text" required value={encDept} onChange={(e) => setEncDept(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select value={encStatus} onChange={(e) => setEncStatus(e.target.value as Encounter['status'])} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="Triage">Triage</option>
                    <option value="In Consultation">In Consultation</option>
                    <option value="Admitted">Admitted</option>
                    <option value="Completed">Completed</option>
                    <option value="Discharged">Discharged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ward / OPD Room / Bed</label>
                  <input type="text" value={encWardBed} onChange={(e) => setEncWardBed(e.target.value)} placeholder="e.g., Ward B - Bed 4" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Chief Complaint & History</label>
                  <input type="text" required value={encComplaint} onChange={(e) => setEncComplaint(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Vital Signs (BP, HR, Temp, SpO2)</label>
                  <input type="text" value={encVitals} onChange={(e) => setEncVitals(e.target.value)} placeholder="BP 130/84 mmHg, HR 78 bpm, Temp 37.1 C, SpO2 98%" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nursing Observations</label>
                  <textarea rows={2} value={encNursing} onChange={(e) => setEncNursing(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Diagnosis</label>
                  <input type="text" value={encDiagnosis} onChange={(e) => setEncDiagnosis(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Treatment Plan</label>
                  <textarea rows={2} value={encPlan} onChange={(e) => setEncPlan(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Discharge Summary (if Discharged)</label>
                  <textarea rows={2} value={encDischarge} onChange={(e) => setEncDischarge(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEncForm(false)} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800">
                  Save Clinical Encounter
                </button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search encounters by patient or diagnosis..."
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-72"
              />
              <span className="text-xs text-slate-500 font-mono tabular-nums">{filteredEncounters.length} encounters</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredEncounters.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No encounters recorded yet.</div>
              ) : (
                filteredEncounters.map((enc) => (
                  <div key={enc.id} className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-slate-50/60">
                    <div className="space-y-1.5 max-w-3xl text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-semibold text-teal-800">{enc.patientUid}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-slate-900">{enc.patientName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700">{enc.encounterType} ({enc.department})</span>
                        <span aria-hidden="true">·</span>
                        <span className={enc.status === 'Admitted' ? 'text-amber-700 font-semibold' : 'text-slate-800 font-medium'}>
                          {enc.status} {enc.wardBed ? `(${enc.wardBed})` : ''}
                        </span>
                      </div>
                      <div className="text-slate-700"><strong>Complaint:</strong> {enc.chiefComplaint}</div>
                      {enc.vitalSigns && <div className="font-mono text-slate-600">Vitals: {enc.vitalSigns}</div>}
                      {enc.diagnosis && <div className="text-slate-900"><strong>Diagnosis:</strong> {enc.diagnosis}</div>}
                      {enc.treatmentPlan && <div className="text-slate-600"><strong>Plan:</strong> {enc.treatmentPlan}</div>}
                      {enc.dischargeSummary && <div className="text-emerald-800"><strong>Discharge Summary:</strong> {enc.dischargeSummary}</div>}
                    </div>
                    {canEditEncounters && enc.status !== 'Discharged' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEnc(enc);
                          setEncType(enc.encounterType);
                          setEncDept(enc.department);
                          setEncComplaint(enc.chiefComplaint);
                          setEncVitals(enc.vitalSigns || '');
                          setEncNursing(enc.nursingNotes || '');
                          setEncDiagnosis(enc.diagnosis || '');
                          setEncPlan(enc.treatmentPlan || '');
                          setEncDischarge(enc.dischargeSummary || '');
                          setEncStatus(enc.status);
                          setEncWardBed(enc.wardBed || '');
                          setShowEncForm(true);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        Update / Discharge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {selectedPatient && (
        <PatientProfileDrawer
          patient={selectedPatient}
          encounters={encounters}
          labs={labs}
          prescriptions={prescriptions}
          screenings={screenings}
          referrals={referrals}
          claims={claims}
          onClose={() => {
            setSelectedPatient(null);
            onClearFocusedPatient?.();
          }}
        />
      )}
    </div>
  );
};
