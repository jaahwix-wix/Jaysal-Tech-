import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  FileText,
  Plus,
  Search,
  Siren,
  X,
} from 'lucide-react';
import {
  clampStr,
  makeSafeId,
  type Encounter,
  type InsuranceClaim,
  type LabOrder,
  type Patient,
  type Prescription,
  type Referral,
  type ScreeningRecord,
  type UserProfile,
} from '../../types/hub';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import {
  getEncounterUrgencyScore,
  isEmergencyOrTriageEncounter,
  parseVitalsString,
} from '../../lib/vitalsUtils';
import { PatientProfileDrawer } from '../PatientProfileDrawer';

interface Props {
  user: UserProfile;
  patients: Patient[];
  encounters: Encounter[];
  screenings: ScreeningRecord[];
  labs: LabOrder[];
  prescriptions: Prescription[];
  referrals: Referral[];
  claims: InsuranceClaim[];
  canEditEncounters: boolean;
  onExitEmergencyMode: () => void;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export const EmergencyDashboard: React.FC<Props> = ({
  user,
  patients,
  encounters,
  screenings,
  labs,
  prescriptions,
  referrals,
  claims,
  canEditEncounters,
  onExitEmergencyMode,
  onLogAudit,
  onToast,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'triage' | 'critical-vitals'>('all');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Rapid Triage Intake Form
  const [showIntake, setShowIntake] = useState(false);
  const [intakePatId, setIntakePatId] = useState(patients[0]?.id || '');
  const [intakeComplaint, setIntakeComplaint] = useState('');
  const [intakeVitals, setIntakeVitals] = useState('');
  const [intakeBed, setIntakeBed] = useState('Emergency Triage Bay 1');
  const [intakeType, setIntakeType] = useState<Encounter['encounterType']>('Emergency');
  const [intakeStatus, setIntakeStatus] = useState<Encounter['status']>('Triage');
  const [savingIntake, setSavingIntake] = useState(false);

  // Quick Vitals & Triage Status Update
  const [editingEncId, setEditingEncId] = useState<string | null>(null);
  const [quickVitals, setQuickVitals] = useState('');
  const [quickStatus, setQuickStatus] = useState<Encounter['status']>('Triage');
  const [quickBed, setQuickBed] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);

  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((p) => map.set(p.id, p));
    return map;
  }, [patients]);

  const enrichedQueue = useMemo(() => {
    return encounters
      .filter((enc) => isEmergencyOrTriageEncounter(enc))
      .map((enc) => {
        const analysis = parseVitalsString(enc.vitalSigns);
        const pat = patientMap.get(enc.patientId);
        const score = getEncounterUrgencyScore(enc);
        return { enc, analysis, pat, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [encounters, patientMap]);

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedQueue.filter(({ enc, analysis }) => {
      if (filterMode === 'triage' && enc.status !== 'Triage') return false;
      if (filterMode === 'critical-vitals' && analysis.overallSeverity !== 'critical') return false;
      if (!q) return true;
      return (
        enc.patientName.toLowerCase().includes(q) ||
        (enc.patientUid || '').toLowerCase().includes(q) ||
        (enc.wardBed || '').toLowerCase().includes(q) ||
        enc.chiefComplaint.toLowerCase().includes(q)
      );
    });
  }, [enrichedQueue, filterMode, search]);

  const criticalScreenings = useMemo(
    () =>
      screenings.filter(
        (s) => s.riskLevel === 'Critical' && !s.followUpCompleted
      ),
    [screenings]
  );

  const activeTriageCount = enrichedQueue.filter((item) => item.enc.status === 'Triage').length;
  const criticalVitalsCount = enrichedQueue.filter(
    (item) => item.analysis.overallSeverity === 'critical'
  ).length;
  const emergencyActiveCount = enrichedQueue.filter(
    (item) => item.enc.encounterType === 'Emergency' || item.enc.status === 'Admitted'
  ).length;

  const handleOpenQuickEdit = (enc: Encounter) => {
    setEditingEncId(enc.id);
    setQuickVitals(enc.vitalSigns || '');
    setQuickStatus(enc.status);
    setQuickBed(enc.wardBed || '');
    setQuickNote(enc.nursingNotes || '');
  };

  const handleSaveQuickUpdate = async (enc: Encounter) => {
    setSavingQuick(true);
    try {
      const now = new Date().toISOString();
      await safeUpdateDoc('encounters', enc.id, {
        vitalSigns: clampStr(quickVitals, 300),
        status: quickStatus,
        wardBed: clampStr(quickBed, 60),
        nursingNotes: clampStr(quickNote, 600),
        updatedAt: now,
      });
      await onLogAudit(
        'EMERGENCY_TRIAGE_UPDATE',
        'Encounter',
        enc.id,
        `Emergency mode update for ${enc.patientName}: status=${quickStatus}`
      );
      setEditingEncId(null);
      onToast(`Updated vitals & triage status for ${enc.patientName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update emergency triage record.');
    } finally {
      setSavingQuick(false);
    }
  };

  const handleRapidIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = intakePatId || patients[0]?.id || '';
    const pat = patients.find((p) => p.id === targetId);
    if (!pat) {
      onToast('Select a registered patient to initiate emergency triage.');
      return;
    }

    setSavingIntake(true);
    try {
      const id = makeSafeId('enc');
      const now = new Date().toISOString();
      const encDoc: Encounter = {
        id,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName || user.facilityName || 'Hub Facility',
        encounterType: intakeType,
        department: 'Emergency & Triage',
        clinicianName: user.displayName,
        chiefComplaint: clampStr(intakeComplaint, 400),
        vitalSigns: clampStr(intakeVitals, 300),
        nursingNotes: 'Logged via Emergency Mode Rapid Triage.',
        diagnosis: '',
        treatmentPlan: '',
        dischargeSummary: '',
        status: intakeStatus,
        wardBed: clampStr(intakeBed, 60),
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('encounters', id, encDoc as unknown as Record<string, unknown>);
      await onLogAudit(
        'RAPID_TRIAGE_INTAKE',
        'Encounter',
        id,
        `Logged emergency triage for ${pat.patientUid} (${intakeStatus})`
      );
      setShowIntake(false);
      setIntakeComplaint('');
      setIntakeVitals('');
      onToast(`Rapid triage logged for ${pat.fullName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to log emergency triage.');
    } finally {
      setSavingIntake(false);
    }
  };

  const openPatientDossierById = (patientId: string) => {
    const found = patientMap.get(patientId);
    if (found) {
      setSelectedPatient(found);
    } else {
      onToast('Full patient dossier is not within your current facility authorization scope.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Focused Emergency Mode Header Strip */}
      <div className="bg-white border border-red-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
            <Siren className="w-4 h-4 shrink-0" />
            <span>EMERGENCY RESPONSE VIEW · CRITICAL VITALS & ACTIVE TRIAGE ONLY</span>
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900">
            {user.facilityName || 'Central Hospital Network'} — Rapid Triage Board
          </h1>
          <p className="text-xs text-slate-600">
            Non-urgent administrative, billing, and analytics panels are hidden for fast clinical response.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canEditEncounters && patients.length > 0 && (
            <button
              type="button"
              onClick={() => setShowIntake((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showIntake ? 'Close Triage Form' : 'Rapid Triage Intake'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onExitEmergencyMode}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>Exit Emergency Mode</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4 Focused Emergency Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-600">Active Triage Queue</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${activeTriageCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {activeTriageCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Patients awaiting clinician review</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-600">Critical Vitals Flagged</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${criticalVitalsCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {criticalVitalsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">SpO2 &lt;92%, Crisis BP, Temp ≥39°C, HR ≥120</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-600">Emergency & Admitted</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1.5 text-slate-900">
            {emergencyActiveCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Active acute & inpatient beds</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-600">Critical Screening Escalations</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${criticalScreenings.length > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {criticalScreenings.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Unresolved critical screening flags</div>
        </div>
      </div>

      {/* Collapsible Rapid Triage Intake Form */}
      {showIntake && (
        <form
          onSubmit={handleRapidIntake}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Rapid Emergency & Triage Intake</h2>
              <p className="text-xs text-slate-500">Immediately place an arriving or deteriorating patient onto the triage board.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowIntake(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
              aria-label="Close triage form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient</label>
              <select
                value={intakePatId || patients[0]?.id || ''}
                onChange={(e) => setIntakePatId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.patientUid})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Encounter Type</label>
              <select
                value={intakeType}
                onChange={(e) => setIntakeType(e.target.value as Encounter['encounterType'])}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Emergency">Emergency</option>
                <option value="Inpatient">Inpatient</option>
                <option value="Maternal">Maternal</option>
                <option value="Outpatient">Outpatient</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Triage Status</label>
              <select
                value={intakeStatus}
                onChange={(e) => setIntakeStatus(e.target.value as Encounter['status'])}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="Triage">Triage</option>
                <option value="In Consultation">In Consultation</option>
                <option value="Admitted">Admitted</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vital Signs (BP, HR, Temp, SpO2, RR)
              </label>
              <input
                type="text"
                required
                value={intakeVitals}
                onChange={(e) => setIntakeVitals(e.target.value)}
                placeholder="e.g., BP 186/114 mmHg, HR 124 bpm, Temp 39.2 C, SpO2 90%, RR 26/min"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Triage Bay / Ward Bed</label>
              <input
                type="text"
                value={intakeBed}
                onChange={(e) => setIntakeBed(e.target.value)}
                placeholder="Emergency Bay 1"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chief Complaint / Acute Presentation</label>
              <input
                type="text"
                required
                value={intakeComplaint}
                onChange={(e) => setIntakeComplaint(e.target.value)}
                placeholder="e.g., Acute respiratory distress and altered mental status"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowIntake(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingIntake}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg disabled:opacity-60"
            >
              {savingIntake ? 'Saving...' : 'Log Triage Patient'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          {([
            ['all', `Priority Queue (${enrichedQueue.length})`],
            ['triage', `Active Triage (${activeTriageCount})`],
            ['critical-vitals', `Critical Vitals (${criticalVitalsCount})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                filterMode === key
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by patient, UID, bed, complaint..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {/* Critical Vitals & Active Triage Patients List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active Triage & Critical Vitals Monitor</h2>
            <p className="text-xs text-slate-500">Ordered automatically by triage urgency and abnormal vital signs</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            Showing {filteredQueue.length} active {filteredQueue.length === 1 ? 'case' : 'cases'}
          </span>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Activity className="w-6 h-6 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">
              No matching active triage or critical vital cases
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Switch filters above or use Rapid Triage Intake to log an urgent arrival immediately.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredQueue.map(({ enc, analysis, pat }) => {
              const isEditing = editingEncId === enc.id;
              const isCriticalRow = analysis.overallSeverity === 'critical' || enc.status === 'Triage';

              return (
                <div
                  key={enc.id}
                  className={`p-5 space-y-3.5 ${isCriticalRow ? 'bg-red-50/25' : 'bg-white'}`}
                >
                  {/* Row 1: Patient Identity + Clinical Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-bold text-slate-900">{enc.patientName}</span>
                        {enc.patientUid && (
                          <span className="font-mono text-xs text-slate-600">{enc.patientUid}</span>
                        )}
                        {pat?.bloodGroup && (
                          <span className="text-xs font-mono font-semibold text-slate-700">
                            · Blood {pat.bloodGroup}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span>{enc.facilityName || enc.facilityId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{enc.department}</span>
                        {enc.wardBed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-800">{enc.wardBed}</span>
                          </>
                        )}
                        {pat?.allergies && pat.allergies.toLowerCase() !== 'none documented' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-red-700">
                              Allergy: {pat.allergies}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                      <span
                        className={`font-semibold ${
                          enc.status === 'Triage'
                            ? 'text-red-700'
                            : enc.status === 'Admitted'
                              ? 'text-amber-700'
                              : 'text-slate-800'
                        }`}
                      >
                        Status: {enc.status}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">|</span>
                      <span className="font-medium text-slate-700">{enc.encounterType}</span>
                    </div>
                  </div>

                  {/* Row 2: Critical Vital Signs Readout */}
                  <div className="space-y-2">
                    {analysis.metrics.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                        {analysis.metrics.map((metric) => (
                          <div
                            key={metric.key}
                            className={`rounded-lg border px-3 py-2 ${
                              metric.severity === 'critical'
                                ? 'border-red-300 bg-red-50 text-red-900'
                                : metric.severity === 'warning'
                                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                                  : 'border-slate-200 bg-slate-50 text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-medium">
                              <span>{metric.label}</span>
                              {metric.severity !== 'normal' && (
                                <span className="font-semibold">
                                  {metric.severity === 'critical' ? 'CRITICAL' : 'ELEVATED'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold font-mono tabular-nums mt-0.5">
                              {metric.value}
                            </div>
                            {metric.note && (
                              <div className="text-[11px] mt-0.5 font-medium truncate">
                                {metric.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        Vitals: {enc.vitalSigns || 'Not yet recorded — record immediately'}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Chief Complaint, Alert Flags & Fast Actions */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                    <div className="text-xs text-slate-700 space-y-0.5">
                      <div>
                        <span className="font-semibold text-slate-900">Presentation:</span>{' '}
                        {enc.chiefComplaint}
                      </div>
                      {enc.diagnosis && (
                        <div>
                          <span className="font-semibold text-slate-900">Working Dx:</span>{' '}
                          {enc.diagnosis}
                        </div>
                      )}
                      <div className="text-slate-500 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>Clinician: {enc.clinicianName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{enc.updatedAt.slice(0, 16).replace('T', ' ')} UTC</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPatientDossierById(enc.patientId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap shrink-0"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Open Dossier</span>
                      </button>
                      {canEditEncounters && (
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingEncId(null) : handleOpenQuickEdit(enc)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{isEditing ? 'Cancel Edit' : 'Update Vitals / Status'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Rapid Update Panel */}
                  {isEditing && (
                    <div className="mt-2 pt-3 border-t border-slate-200 bg-white rounded-lg p-4 space-y-3 border">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Updated Vital Signs
                          </label>
                          <input
                            type="text"
                            value={quickVitals}
                            onChange={(e) => setQuickVitals(e.target.value)}
                            placeholder="BP 145/92 mmHg, HR 96 bpm, Temp 38.1 C, SpO2 97%"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Triage / Care Status
                          </label>
                          <select
                            value={quickStatus}
                            onChange={(e) => setQuickStatus(e.target.value as Encounter['status'])}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                          >
                            <option value="Triage">Triage</option>
                            <option value="In Consultation">In Consultation</option>
                            <option value="Admitted">Admitted</option>
                            <option value="Completed">Completed</option>
                            <option value="Discharged">Discharged</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Bay / Ward Bed
                          </label>
                          <input
                            type="text"
                            value={quickBed}
                            onChange={(e) => setQuickBed(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Rapid Stabilization / Nursing Note
                          </label>
                          <input
                            type="text"
                            value={quickNote}
                            onChange={(e) => setQuickNote(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEncId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingQuick}
                          onClick={() => handleSaveQuickUpdate(enc)}
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60"
                        >
                          {savingQuick ? 'Saving...' : 'Save Triage Update'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Critical Unresolved Screenings Requiring Urgent Clinical Attention */}
      {criticalScreenings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Critical Risk Screenings Awaiting Clinical Intervention
                </h2>
                <p className="text-xs text-slate-500">
                  Screening-to-Care cases flagged Critical without completed follow-up
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Patient</th>
                  <th className="py-2.5 px-4 font-semibold">Screening & Readings</th>
                  <th className="py-2.5 px-4 font-semibold">District / Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Stage</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criticalScreenings.map((scr) => (
                  <tr key={scr.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{scr.patientName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{scr.patientUid}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800">{scr.screeningType}</div>
                      <div className="font-mono text-red-700">{scr.measurementSummary}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {scr.district} · {scr.facilityName || scr.facilityId}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-amber-700">{scr.journeyStage}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openPatientDossierById(scr.patientId)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap"
                      >
                        Open Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </div>
  );
};
