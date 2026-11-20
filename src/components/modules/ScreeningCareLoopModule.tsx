import React, { useState } from 'react';
import { Plus, GitBranch, AlertCircle, CheckCircle2, Calendar, Edit3 } from 'lucide-react';
import {
  SIERRA_LEONE_DISTRICTS,
  clampStr,
  makeSafeId,
  type Facility,
  type FollowUpTask,
  type JourneyStage,
  type Patient,
  type Referral,
  type ScreeningCampaign,
  type ScreeningRecord,
  type UserProfile,
} from '../../types/hub';
import { safeDeleteDoc, safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { ScreeningJourneyModal } from '../ScreeningJourneyModal';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';

interface Props {
  user: UserProfile;
  facilities: Facility[];
  patients: Patient[];
  campaigns: ScreeningCampaign[];
  screenings: ScreeningRecord[];
  followUpTasks: FollowUpTask[];
  referrals: Referral[];
  canAdminManageRecords?: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
}

const SCREENING_TYPES = [
  'Cardiovascular / BP Screening',
  'Diabetes Fasting Glucose',
  'Malaria Rapid Diagnostic Screening',
  'Maternal Pre-Eclampsia & Anaemia',
  'Respiratory / TB Symptom & SpO2',
  'Cervical / Oncology Screening',
];

export const ScreeningCareLoopModule: React.FC<Props> = ({
  user,
  facilities,
  patients,
  campaigns,
  screenings,
  followUpTasks,
  referrals,
  canAdminManageRecords = false,
  onLogAudit,
  onToast,
}) => {
  const [tab, setTab] = useState<'screenings' | 'tasks' | 'campaigns'>('screenings');
  const [filterRisk, setFilterRisk] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [journeyTarget, setJourneyTarget] = useState<ScreeningRecord | null>(null);

  // Forms
  const [showScrForm, setShowScrForm] = useState(false);
  const [editingScr, setEditingScr] = useState<ScreeningRecord | null>(null);
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '');
  const [screeningType, setScreeningType] = useState(SCREENING_TYPES[0]);
  const [measurementSummary, setMeasurementSummary] = useState('');
  const [resultClass, setResultClass] = useState<'Normal' | 'Abnormal' | 'Indeterminate'>('Abnormal');
  const [riskLevel, setRiskLevel] = useState<'Low' | 'Moderate' | 'High' | 'Critical'>('High');
  const [createReferral, setCreateReferral] = useState(true);
  const [referralToFac, setReferralToFac] = useState(facilities[0]?.id || user.facilityId);
  const [appointmentDate, setAppointmentDate] = useState('');

  // Campaign form
  const [showCampForm, setShowCampForm] = useState(false);
  const [editingCamp, setEditingCamp] = useState<ScreeningCampaign | null>(null);
  const [campTitle, setCampTitle] = useState('');
  const [campDistrict, setCampDistrict] = useState<string>('Western Area Urban');
  const [campCondition, setCampCondition] = useState('Hypertension & Diabetes');
  const [campTarget, setCampTarget] = useState('1000');
  const [campScreened, setCampScreened] = useState('0');
  const [campStatus, setCampStatus] = useState<ScreeningCampaign['status']>('Active');

  // 8 Dedicated Screening-to-Care Metrics
  const totalScreened = screenings.length;
  const normalResults = screenings.filter((s) => s.resultClassification === 'Normal').length;
  const abnormalResults = screenings.filter((s) => s.resultClassification === 'Abnormal').length;
  const requiringReferral = screenings.filter((s) => s.resultClassification === 'Abnormal' && !s.followUpCompleted).length;
  const awaitingAppointment = screenings.filter((s) => !s.appointmentDate && !s.followUpCompleted).length;
  const overdueFollowUps = followUpTasks.filter((t) => t.status === 'Overdue' || t.status === 'Missed').length;
  const completedFollowUps = followUpTasks.filter((t) => t.status === 'Completed').length;
  const unresolvedHighRisk = screenings.filter(
    (s) => (s.riskLevel === 'High' || s.riskLevel === 'Critical') && !s.followUpCompleted
  ).length;

  const filteredScreenings = screenings.filter((s) => {
    if (filterRisk !== 'All' && s.riskLevel !== filterRisk) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.patientName.toLowerCase().includes(q) ||
        (s.patientUid || '').toLowerCase().includes(q) ||
        s.screeningType.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const effectivePatientId = patientId || patients[0]?.id || '';
  const effectiveReferralToFac = referralToFac || facilities[0]?.id || user.facilityId;

  const handleRegisterScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingScr) {
      try {
        await safeUpdateDoc('screenings', editingScr.id, {
          screeningType: clampStr(screeningType, 100),
          measurementSummary: clampStr(measurementSummary, 240),
          resultClassification: resultClass,
          riskLevel,
          appointmentDate: clampStr(appointmentDate, 30),
          updatedAt: new Date().toISOString(),
        });
        await onLogAudit('UPDATE_SCREENING', 'ScreeningRecord', editingScr.id, `Updated screening for ${editingScr.patientName}`);
        setEditingScr(null);
        setShowScrForm(false);
        setMeasurementSummary('');
        setAppointmentDate('');
        onToast('Screening record updated.');
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Unable to update screening record.');
      }
      return;
    }

    const pat = patients.find((p) => p.id === effectivePatientId);
    if (!pat) {
      onToast('Please register or select a patient first.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const scrId = makeSafeId('scr');
      const isAbnormal = resultClass !== 'Normal' || riskLevel === 'High' || riskLevel === 'Critical';

      let generatedReferralId = '';
      if (isAbnormal && createReferral) {
        generatedReferralId = makeSafeId('ref');
        const toFac = facilities.find((f) => f.id === effectiveReferralToFac);
        const refDoc: Referral = {
          id: generatedReferralId,
          patientId: pat.id,
          patientName: pat.fullName,
          patientUid: pat.patientUid,
          fromFacilityId: pat.facilityId,
          fromFacilityName: pat.facilityName || user.facilityName,
          toFacilityId: effectiveReferralToFac || pat.facilityId,
          toFacilityName: toFac?.name || pat.facilityName || user.facilityName,
          specialty: `${screeningType} Follow-Up`,
          urgency: riskLevel === 'Critical' ? 'Emergency' : riskLevel === 'High' ? 'Urgent' : 'Routine',
          reason: clampStr(`Automated screening escalation: ${screeningType} (${resultClass}, ${riskLevel} Risk). ${measurementSummary}`, 400),
          fhirResourceType: 'ServiceRequest',
          exchangeAuthorized: true,
          status: appointmentDate ? 'Appointment Scheduled' : 'Pending',
          appointmentDate,
          isSynthetic: false,
          authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
          createdByUid: user.uid,
          createdAt: now,
          updatedAt: now,
        };
        await safeSetDoc('referrals', generatedReferralId, refDoc as unknown as Record<string, unknown>);
      }

      const stage: JourneyStage = !isAbnormal
        ? 'Follow-up Completed'
        : appointmentDate
          ? 'Appointment Scheduled'
          : generatedReferralId
            ? 'Referred'
            : 'Risk Identified';

      const scrDoc: ScreeningRecord = {
        id: scrId,
        campaignId,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName || user.facilityName,
        district: pat.district,
        screeningType: clampStr(screeningType, 100),
        measurementSummary: clampStr(measurementSummary, 240),
        resultClassification: resultClass,
        riskLevel,
        journeyStage: stage,
        referralId: generatedReferralId,
        appointmentDate,
        treatmentStatus: isAbnormal ? 'Pending Clinical Verification' : 'Routine Clearance',
        clinicianDecision: isAbnormal
          ? 'Abnormal screening flag — requires confirmatory clinical assessment (not a standalone diagnosis).'
          : 'Normal screening recorded.',
        followUpCompleted: !isAbnormal,
        isOverdue: false,
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      await safeSetDoc('screenings', scrId, scrDoc as unknown as Record<string, unknown>);

      // Automatic Follow-Up Task Generation Rule
      if (isAbnormal) {
        const taskId = makeSafeId('fut');
        const due = new Date();
        due.setDate(due.getDate() + (riskLevel === 'Critical' ? 2 : riskLevel === 'High' ? 5 : 10));
        const dueStr = appointmentDate || due.toISOString().slice(0, 10);

        const taskDoc: FollowUpTask = {
          id: taskId,
          screeningId: scrId,
          patientId: pat.id,
          patientName: pat.fullName,
          patientUid: pat.patientUid,
          facilityId: pat.facilityId,
          district: pat.district,
          taskTitle: clampStr(`Follow-up ${screeningType} (${resultClass} · ${riskLevel} Risk)`, 200),
          priority: riskLevel === 'Critical' ? 'Urgent' : riskLevel === 'High' ? 'High' : 'Routine',
          dueDate: dueStr,
          assignedRole: riskLevel === 'Critical' || riskLevel === 'High' ? 'Medical Doctor' : 'Nurse',
          status: appointmentDate ? 'Scheduled' : 'Pending',
          resolutionNotes: 'Auto-generated by Screening-to-Care rule engine.',
          missedCount: 0,
          isSynthetic: false,
          authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
          createdByUid: user.uid,
          createdAt: now,
          updatedAt: now,
        };
        await safeSetDoc('followUpTasks', taskId, taskDoc as unknown as Record<string, unknown>);
      }

      await onLogAudit(
        'REGISTER_SCREENING',
        'ScreeningRecord',
        scrId,
        `Recorded ${screeningType} (${resultClass}) for ${pat.patientUid}. Auto follow-up task: ${isAbnormal ? 'Yes' : 'No'}.`
      );
      setShowScrForm(false);
      setMeasurementSummary('');
      setAppointmentDate('');
      onToast(
        isAbnormal
          ? 'Screening saved. Automatic follow-up task and referral workflow triggered.'
          : 'Normal screening recorded and loop closed.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save screening record.');
    }
  };

  const handleAdvanceJourney = async (
    scr: ScreeningRecord,
    nextStage: JourneyStage,
    apptDate: string,
    txStatus: string,
    decision: string,
    markCompleted: boolean
  ) => {
    try {
      const now = new Date().toISOString();
      await safeUpdateDoc('screenings', scr.id, {
        journeyStage: nextStage,
        appointmentDate: clampStr(apptDate, 30),
        treatmentStatus: clampStr(txStatus, 80),
        clinicianDecision: clampStr(decision, 400),
        followUpCompleted: markCompleted,
        isOverdue: markCompleted ? false : Boolean(scr.isOverdue),
        updatedAt: now,
      });

      const linkedTask = followUpTasks.find((t) => t.screeningId === scr.id);
      if (linkedTask) {
        await safeUpdateDoc('followUpTasks', linkedTask.id, {
          status: markCompleted ? 'Completed' : apptDate ? 'Scheduled' : 'In Progress',
          resolutionNotes: clampStr(decision || txStatus || linkedTask.resolutionNotes, 400),
          updatedAt: now,
        });
      }

      await onLogAudit('ADVANCE_SCREENING_JOURNEY', 'ScreeningRecord', scr.id, `Stage updated to ${nextStage} for ${scr.patientName}.`);
      onToast(`Care journey updated to "${nextStage}" for ${scr.patientName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update screening journey.');
    }
  };

  const handleTaskStatus = async (task: FollowUpTask, status: FollowUpTask['status']) => {
    try {
      const now = new Date().toISOString();
      const missedCount = status === 'Missed' ? (task.missedCount || 0) + 1 : task.missedCount || 0;
      await safeUpdateDoc('followUpTasks', task.id, {
        status,
        missedCount,
        resolutionNotes: clampStr(
          status === 'Completed'
            ? `Closed by ${user.displayName} on ${now.slice(0, 10)}`
            : status === 'Escalated'
              ? `Escalated for urgent outreach by ${user.displayName}`
              : `Updated to ${status}`,
          400
        ),
        updatedAt: now,
      });

      if (status === 'Completed') {
        await safeUpdateDoc('screenings', task.screeningId, {
          journeyStage: 'Follow-up Completed',
          followUpCompleted: true,
          isOverdue: false,
          updatedAt: now,
        });
      }
      await onLogAudit('UPDATE_FOLLOWUP_TASK', 'FollowUpTask', task.id, `Follow-up task marked ${status}.`);
      onToast(`Follow-up task updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update follow-up task.');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      if (editingCamp) {
        await safeUpdateDoc('screeningCampaigns', editingCamp.id, {
          title: clampStr(campTitle, 180),
          district: clampStr(campDistrict, 80),
          targetCondition: clampStr(campCondition, 100),
          targetCount: Math.max(1, Number(campTarget) || 500),
          screenedCount: Math.max(0, Number(campScreened) || 0),
          status: campStatus,
          updatedAt: now,
        });
        await onLogAudit('UPDATE_CAMPAIGN', 'ScreeningCampaign', editingCamp.id, `Updated campaign ${campTitle}`);
        setEditingCamp(null);
        setShowCampForm(false);
        setCampTitle('');
        onToast('Screening campaign updated.');
        return;
      }

      const id = makeSafeId('camp');
      const camp: ScreeningCampaign = {
        id,
        title: clampStr(campTitle, 180),
        district: clampStr(campDistrict, 80),
        facilityId: facilities[0]?.id || user.facilityId,
        facilityName: facilities[0]?.name || user.facilityName,
        targetCondition: clampStr(campCondition, 100),
        targetCount: Math.max(1, Number(campTarget) || 500),
        screenedCount: 0,
        startDate: now.slice(0, 10),
        endDate: '',
        status: 'Active',
        isSynthetic: false,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('screeningCampaigns', id, camp as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_CAMPAIGN', 'ScreeningCampaign', id, `Launched campaign ${camp.title}`);
      setCampTitle('');
      setShowCampForm(false);
      onToast('Screening campaign created.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save screening campaign.');
    }
  };

  const handleDeleteScreening = async (scr: ScreeningRecord) => {
    try {
      await safeDeleteDoc('screenings', scr.id);
      await onLogAudit('DELETE_SCREENING', 'ScreeningRecord', scr.id, `Deleted screening for ${scr.patientName}`);
      onToast(`Screening record for ${scr.patientName} deleted.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete screening.');
    }
  };

  const handleDeleteTask = async (task: FollowUpTask) => {
    try {
      await safeDeleteDoc('followUpTasks', task.id);
      await onLogAudit('DELETE_FOLLOWUP_TASK', 'FollowUpTask', task.id, `Deleted follow-up task for ${task.patientName}`);
      onToast('Follow-up task deleted.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete follow-up task.');
    }
  };

  const handleDeleteCampaign = async (camp: ScreeningCampaign) => {
    try {
      await safeDeleteDoc('screeningCampaigns', camp.id);
      await onLogAudit('DELETE_CAMPAIGN', 'ScreeningCampaign', camp.id, `Deleted campaign ${camp.title}`);
      onToast(`Campaign "${camp.title}" deleted.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete campaign.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Closing the Screening-to-Care Loop</h2>
          <p className="text-xs text-slate-600 mt-1">
            End-to-end patient tracking from initial screening to confirmed care completion. Abnormal results automatically generate follow-up tasks so high-risk patients never fall out of care.
          </p>
        </div>
        <div className="no-print flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingCamp(null);
              setCampTitle('');
              setCampDistrict('Western Area Urban');
              setCampCondition('Hypertension & Diabetes');
              setCampTarget('1000');
              setCampScreened('0');
              setCampStatus('Active');
              setShowCampForm(!showCampForm);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingScr(null);
              setMeasurementSummary('');
              setAppointmentDate('');
              setShowScrForm(!showScrForm);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Patient Screening
          </button>
        </div>
      </div>

      {/* 8 Dedicated Screening-to-Care Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total People Screened', val: totalScreened, tone: 'text-slate-900' },
          { label: 'Normal Screening Results', val: normalResults, tone: 'text-emerald-700' },
          { label: 'Abnormal Screening Results', val: abnormalResults, tone: 'text-amber-700' },
          { label: 'Requiring Referral / Action', val: requiringReferral, tone: 'text-orange-700' },
          { label: 'Awaiting Appointments', val: awaitingAppointment, tone: 'text-slate-900' },
          { label: 'Overdue / Missed Follow-Ups', val: overdueFollowUps, tone: overdueFollowUps > 0 ? 'text-red-700' : 'text-slate-900' },
          { label: 'Completed Follow-Ups', val: completedFollowUps, tone: 'text-emerald-700' },
          { label: 'Unresolved High-Risk Cases', val: unresolvedHighRisk, tone: unresolvedHighRisk > 0 ? 'text-red-700' : 'text-slate-900' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">{m.label}</div>
            <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${m.tone}`}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* New / Edit Screening Form */}
      {showScrForm && (
        <form onSubmit={handleRegisterScreening} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingScr ? `Edit Screening · ${editingScr.patientName}` : 'Record Patient Screening & Auto-Trigger Care Rules'}
            </h3>
            <button type="button" onClick={() => { setShowScrForm(false); setEditingScr(null); }} className="text-xs text-slate-500">Close</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {!editingScr && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
                  <select required value={effectivePatientId} onChange={(e) => setPatientId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    {patients.length === 0 && <option value="">No patients registered</option>}
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Screening Campaign (Optional)</label>
                  <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="">Walk-in / Facility Screening</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Screening Type</label>
              <select value={screeningType} onChange={(e) => setScreeningType(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {SCREENING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Measurement / Observation</label>
              <input type="text" required placeholder="e.g., BP 166/98 mmHg or RDT Positive" value={measurementSummary} onChange={(e) => setMeasurementSummary(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Result Classification</label>
              <select value={resultClass} onChange={(e) => setResultClass(e.target.value as 'Normal' | 'Abnormal' | 'Indeterminate')} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="Normal">Normal</option>
                <option value="Abnormal">Abnormal (Auto Follow-Up)</option>
                <option value="Indeterminate">Indeterminate (Auto Follow-Up)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Risk Level</label>
              <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as 'Low' | 'Moderate' | 'High' | 'Critical')} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {!editingScr && (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={createReferral} onChange={(e) => setCreateReferral(e.target.checked)} className="rounded border-slate-300" />
                  Create facility referral if abnormal/high risk
                </label>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Receiving Facility</label>
                  <select value={effectiveReferralToFac} onChange={(e) => setReferralToFac(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    {facilities.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                    {facilities.length === 0 && <option value={user.facilityId}>{user.facilityName || user.facilityId}</option>}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Follow-Up Appointment Date</label>
              <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowScrForm(false); setEditingScr(null); }} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800">
              {editingScr ? 'Save Screening Updates' : 'Save Screening & Evaluate Follow-Up Rules'}
            </button>
          </div>
        </form>
      )}

      {/* Campaign Form */}
      {showCampForm && (
        <form onSubmit={handleCreateCampaign} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Title</label>
            <input type="text" required placeholder="e.g., Bo District Maternal & Hypertension Outreach" value={campTitle} onChange={(e) => setCampTitle(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
            <select value={campDistrict} onChange={(e) => setCampDistrict(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              {SIERRA_LEONE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Condition</label>
            <input type="text" required value={campCondition} onChange={(e) => setCampCondition(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Target Population</label>
            <input type="number" min={10} required value={campTarget} onChange={(e) => setCampTarget(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
          </div>
          {editingCamp && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Screened Count</label>
                <input type="number" min={0} required value={campScreened} onChange={(e) => setCampScreened(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Status</label>
                <select value={campStatus} onChange={(e) => setCampStatus(e.target.value as ScreeningCampaign['status'])} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                  <option value="Active">Active</option>
                  <option value="Planned">Planned</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </>
          )}
          <div className="sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowCampForm(false); setEditingCamp(null); }} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg">
              {editingCamp ? 'Save Campaign Changes' : 'Launch Campaign'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs + Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {([
              ['screenings', `Patient Journeys (${screenings.length})`],
              ['tasks', `Follow-Up Tasks (${followUpTasks.length})`],
              ['campaigns', `Campaigns (${campaigns.length})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'screenings' && (
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient or UID..."
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg w-48"
              />
              <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                <option value="All">All Risk Levels</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Moderate">Moderate</option>
                <option value="Low">Low</option>
              </select>
            </div>
          )}
        </div>

        {tab === 'screenings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Patient</th>
                  <th className="py-2.5 px-4 font-semibold">Screening & Measurement</th>
                  <th className="py-2.5 px-4 font-semibold">Classification</th>
                  <th className="py-2.5 px-4 font-semibold">Care Journey Stage</th>
                  <th className="py-2.5 px-4 font-semibold">Appointment</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredScreenings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No screening records match this filter.</td>
                  </tr>
                ) : (
                  filteredScreenings.map((scr) => (
                    <tr key={scr.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{scr.patientName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{scr.patientUid} · {scr.district}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-800">{scr.screeningType}</div>
                        <div className="text-slate-500">{scr.measurementSummary || '—'}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`font-semibold ${
                          scr.resultClassification === 'Abnormal' ? 'text-red-700' : 'text-emerald-700'
                        }`}>
                          {scr.resultClassification}
                        </span>
                        <span className="text-slate-400"> · </span>
                        <span className="text-slate-700">{scr.riskLevel}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{scr.journeyStage}</div>
                        {scr.isOverdue && !scr.followUpCompleted && (
                          <span className="text-red-700 font-medium inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Overdue review
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{scr.appointmentDate || 'Unscheduled'}</td>
                      <td className="no-print py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setJourneyTarget(scr)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 whitespace-nowrap"
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                            Track / Update Loop
                          </button>
                          {canAdminManageRecords && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingScr(scr);
                                  setScreeningType(scr.screeningType);
                                  setMeasurementSummary(scr.measurementSummary || '');
                                  setResultClass(scr.resultClassification);
                                  setRiskLevel(scr.riskLevel);
                                  setAppointmentDate(scr.appointmentDate || '');
                                  setShowScrForm(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-100"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <ConfirmDeleteButton compact onConfirm={() => handleDeleteScreening(scr)} title={`Delete screening for ${scr.patientName}`} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="divide-y divide-slate-100">
            {followUpTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No follow-up tasks generated yet.</div>
            ) : (
              followUpTasks.map((task) => (
                <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-semibold ${
                        task.priority === 'Urgent' ? 'text-red-700' : task.priority === 'High' ? 'text-amber-700' : 'text-slate-700'
                      }`}>
                        {task.priority} Priority
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-900">{task.status}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-500 inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Due {task.dueDate}
                      </span>
                      {(task.missedCount || 0) > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-700 font-medium">Missed {task.missedCount}x</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {task.patientName} ({task.patientUid}) — {task.taskTitle}
                    </div>
                    <div className="text-xs text-slate-600">
                      Assigned Role: {task.assignedRole || 'Clinician'} · {task.resolutionNotes}
                    </div>
                  </div>
                  <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
                    {(task.status !== 'Completed' || canAdminManageRecords) && (
                      <>
                        {task.status !== 'Completed' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTaskStatus(task, 'Missed')}
                              className="px-2.5 py-1.5 text-xs font-medium text-amber-800 border border-amber-300 rounded-md hover:bg-amber-50"
                            >
                              Flag Missed
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTaskStatus(task, 'Escalated')}
                              className="px-2.5 py-1.5 text-xs font-medium text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                            >
                              Escalate
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTaskStatus(task, 'Completed')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete Follow-Up
                            </button>
                          </>
                        )}
                        {task.status === 'Completed' && canAdminManageRecords && (
                          <button
                            type="button"
                            onClick={() => handleTaskStatus(task, 'In Progress')}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-100"
                          >
                            Reopen Task
                          </button>
                        )}
                      </>
                    )}
                    {canAdminManageRecords && (
                      <ConfirmDeleteButton compact onConfirm={() => handleDeleteTask(task)} title={`Delete task for ${task.patientName}`} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'campaigns' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Campaign Title</th>
                  <th className="py-2.5 px-4 font-semibold">District</th>
                  <th className="py-2.5 px-4 font-semibold">Target Condition</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Screened / Target</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  {canAdminManageRecords && <th className="no-print py-2.5 px-4 font-semibold text-right">Admin Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((c) => {
                  const pct = Math.min(100, Math.round((c.screenedCount / Math.max(1, c.targetCount)) * 100));
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{c.title}</td>
                      <td className="py-2.5 px-4 text-slate-600">{c.district}</td>
                      <td className="py-2.5 px-4 text-slate-700">{c.targetCondition}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {c.screenedCount.toLocaleString()} / {c.targetCount.toLocaleString()} ({pct}%)
                      </td>
                      <td className="py-2.5 px-4 font-medium text-teal-800">{c.status}</td>
                      {canAdminManageRecords && (
                        <td className="no-print py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCamp(c);
                                setCampTitle(c.title);
                                setCampDistrict(c.district);
                                setCampCondition(c.targetCondition);
                                setCampTarget(String(c.targetCount));
                                setCampScreened(String(c.screenedCount));
                                setCampStatus(c.status);
                                setShowCampForm(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <ConfirmDeleteButton compact onConfirm={() => handleDeleteCampaign(c)} title={`Delete campaign ${c.title}`} />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {journeyTarget && (
        <ScreeningJourneyModal
          screening={journeyTarget}
          onClose={() => setJourneyTarget(null)}
          onAdvanceStage={handleAdvanceJourney}
        />
      )}
    </div>
  );
};
