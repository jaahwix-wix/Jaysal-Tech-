import React, { useState } from 'react';
import { Plus, Download, Printer, ArrowLeftRight, FileCode } from 'lucide-react';
import {
  clampStr,
  makeSafeId,
  type Encounter,
  type Facility,
  type InsuranceClaim,
  type LabOrder,
  type Medicine,
  type Patient,
  type Referral,
  type ScreeningRecord,
  type SurveillanceRecord,
  type TelemedicineAppointment,
  type UserProfile,
} from '../../types/hub';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { buildFhirR4Bundle, exportToCsv, triggerPrintReport } from '../../lib/exportUtils';

interface Props {
  mode: 'insurance' | 'telemedicine' | 'nhie-analytics';
  user: UserProfile;
  facilities: Facility[];
  patients: Patient[];
  encounters: Encounter[];
  labs: LabOrder[];
  screenings: ScreeningRecord[];
  medicines: Medicine[];
  surveillance: SurveillanceRecord[];
  claims: InsuranceClaim[];
  telemedicine: TelemedicineAppointment[];
  referrals: Referral[];
  canManageClaims: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
  onOpenPrintPreview?: () => void;
}

export const FinanceTelemedicineNhieModule: React.FC<Props> = ({
  mode,
  user,
  facilities,
  patients,
  encounters,
  labs,
  screenings,
  medicines,
  surveillance,
  claims,
  telemedicine,
  referrals,
  canManageClaims,
  onLogAudit,
  onToast,
  onOpenPrintPreview,
}) => {
  // Claims state
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [clmPatId, setClmPatId] = useState(patients[0]?.id || '');
  const [clmProvider, setClmProvider] = useState('NASSIT National Health Scheme');
  const [clmDesc, setClmDesc] = useState('');
  const [clmAmount, setClmAmount] = useState('850');

  // Telemedicine state
  const [showTelForm, setShowTelForm] = useState(false);
  const [telPatId, setTelPatId] = useState(patients[0]?.id || '');
  const [telDoctor, setTelDoctor] = useState('Dr. Lansana Turay');
  const [telSpecialty, setTelSpecialty] = useState('Internal Medicine');
  const [telDate, setTelDate] = useState('2026-11-24');
  const [telTime, setTelTime] = useState('11:00');
  const [telNotes, setTelNotes] = useState('');

  // NHIE Referral state
  const [showRefForm, setShowRefForm] = useState(false);
  const [refPatId, setRefPatId] = useState(patients[0]?.id || '');
  const [refToFacId, setRefToFacId] = useState(facilities[0]?.id || user.facilityId);
  const [refSpec, setRefSpec] = useState('Cardiology & Internal Medicine');
  const [refUrgency, setRefUrgency] = useState<Referral['urgency']>('Urgent');
  const [refReason, setRefReason] = useState('');
  const [previewFhirPatId, setPreviewFhirPatId] = useState(patients[0]?.id || '');

  const effectiveClmPatId = clmPatId || patients[0]?.id || '';
  const effectiveTelPatId = telPatId || patients[0]?.id || '';
  const effectiveRefPatId = refPatId || patients[0]?.id || '';
  const effectiveRefToFacId = refToFacId || facilities[0]?.id || user.facilityId;
  const effectivePreviewPatId = previewFhirPatId || patients[0]?.id || '';

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === effectiveClmPatId);
    if (!pat) {
      onToast('Please register or select a patient first.');
      return;
    }
    try {
      const id = makeSafeId('clm');
      const now = new Date().toISOString();
      const docData: InsuranceClaim = {
        id,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        providerName: clampStr(clmProvider, 120),
        policyNumber: pat.insuranceNumber || 'SELF-PAY',
        serviceDescription: clampStr(clmDesc, 240),
        amountSLL: Math.max(0, Number(clmAmount) || 0),
        status: 'Submitted',
        paymentReference: '',
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('insuranceClaims', id, docData as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_CLAIM', 'InsuranceClaim', id, `Submitted claim SLE ${docData.amountSLL} for ${pat.patientUid}`);
      setShowClaimForm(false);
      setClmDesc('');
      onToast('Insurance claim submitted.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to submit insurance claim.');
    }
  };

  const handleUpdateClaimStatus = async (claim: InsuranceClaim, status: InsuranceClaim['status']) => {
    try {
      const payRef = status === 'Paid' ? `PAY-${Date.now().toString().slice(-6)}` : claim.paymentReference || '';
      await safeUpdateDoc('insuranceClaims', claim.id, {
        status,
        paymentReference: payRef,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_CLAIM_STATUS', 'InsuranceClaim', claim.id, `Claim status updated to ${status}`);
      onToast(`Claim updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update insurance claim.');
    }
  };

  const handleCreateTelemedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === effectiveTelPatId);
    if (!pat) {
      onToast('Please register or select a patient first.');
      return;
    }
    try {
      const id = makeSafeId('tel');
      const now = new Date().toISOString();
      const appt: TelemedicineAppointment = {
        id,
        facilityId: pat.facilityId,
        facilityName: pat.facilityName,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        doctorName: clampStr(telDoctor, 140),
        specialty: clampStr(telSpecialty, 100),
        scheduledDate: telDate,
        scheduledTime: telTime,
        consultationNotes: clampStr(telNotes, 600),
        integrationEndpointStatus: 'External Video Gateway Ready (Media Provider Required)',
        status: 'Scheduled',
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('telemedicineAppointments', id, appt as unknown as Record<string, unknown>);
      await onLogAudit('SCHEDULE_TELEMEDICINE', 'TelemedicineAppointment', id, `Scheduled virtual consult for ${pat.patientUid}`);
      setShowTelForm(false);
      setTelNotes('');
      onToast('Virtual consultation scheduled.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to schedule telemedicine consultation.');
    }
  };

  const handleTelemedicineStatus = async (appt: TelemedicineAppointment, status: TelemedicineAppointment['status']) => {
    try {
      await safeUpdateDoc('telemedicineAppointments', appt.id, {
        status,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_TELEMEDICINE_STATUS', 'TelemedicineAppointment', appt.id, `Virtual consult marked ${status}`);
      onToast(`Virtual consultation marked ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update consultation status.');
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find((p) => p.id === effectiveRefPatId);
    const toFac = facilities.find((f) => f.id === effectiveRefToFacId);
    if (!pat) {
      onToast('Please register or select a patient first.');
      return;
    }
    try {
      const id = makeSafeId('ref');
      const now = new Date().toISOString();
      const refDoc: Referral = {
        id,
        patientId: pat.id,
        patientName: pat.fullName,
        patientUid: pat.patientUid,
        fromFacilityId: pat.facilityId,
        fromFacilityName: pat.facilityName || user.facilityName,
        toFacilityId: effectiveRefToFacId || pat.facilityId,
        toFacilityName: toFac?.name || 'Receiving Referral Hospital',
        specialty: clampStr(refSpec, 100),
        urgency: refUrgency,
        reason: clampStr(refReason, 400),
        fhirResourceType: 'ServiceRequest',
        exchangeAuthorized: true,
        status: 'Pending',
        appointmentDate: '',
        isSynthetic: false,
        authorizedUids: Array.from(new Set([...(pat.authorizedUids || []), user.uid])).slice(0, 25),
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('referrals', id, refDoc as unknown as Record<string, unknown>);
      await onLogAudit('NHIE_FACILITY_REFERRAL', 'Referral', id, `Exchanged FHIR ServiceRequest referral for ${pat.patientUid} to ${refDoc.toFacilityName}`);
      setShowRefForm(false);
      setRefReason('');
      onToast('Authorized inter-facility referral created.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to create inter-facility referral.');
    }
  };

  const handleUpdateReferralStatus = async (r: Referral, status: Referral['status']) => {
    try {
      const apptDate =
        status === 'Appointment Scheduled' && !r.appointmentDate
          ? new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
          : r.appointmentDate || '';
      await safeUpdateDoc('referrals', r.id, {
        status,
        appointmentDate: apptDate,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_NHIE_REFERRAL', 'Referral', r.id, `Referral for ${r.patientUid} updated to ${status}`);
      onToast(`Referral updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update referral.');
    }
  };

  if (mode === 'insurance') {
    const totalBilled = claims.reduce((sum, c) => sum + c.amountSLL, 0);
    const totalPaid = claims.filter((c) => c.status === 'Paid').reduce((sum, c) => sum + c.amountSLL, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Hospital Billing, Insurance & Claims</h2>
            <p className="text-xs text-slate-600 mt-1">Manage NASSIT, FHCI, and private insurer claims, adjudication, and payment reconciliation.</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportToCsv(
                  'jaysaltech-insurance-claims.csv',
                  claims.map((c) => ({
                    Patient: c.patientName,
                    UID: c.patientUid,
                    Provider: c.providerName,
                    Service: c.serviceDescription,
                    AmountSLE: c.amountSLL,
                    Status: c.status,
                    PaymentRef: c.paymentReference || '',
                  }))
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" /> Export Claims CSV
            </button>
            {canManageClaims && (
              <button type="button" onClick={() => setShowClaimForm(!showClaimForm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
                <Plus className="w-3.5 h-3.5" /> Create Claim
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Total Claims Volume</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">SLE {totalBilled.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Reimbursed / Paid</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">SLE {totalPaid.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Pending Adjudication</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
              {claims.filter((c) => c.status === 'Submitted' || c.status === 'Draft').length} claims
            </div>
          </div>
        </div>

        {showClaimForm && (
          <form onSubmit={handleCreateClaim} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
              <select required value={effectiveClmPatId} onChange={(e) => setClmPatId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {patients.length === 0 && <option value="">No patients registered</option>}
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Insurer / Scheme</label>
              <input type="text" required value={clmProvider} onChange={(e) => setClmProvider(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Service Description</label>
              <input type="text" required value={clmDesc} onChange={(e) => setClmDesc(e.target.value)} placeholder="Consultation + Lab + Rx" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (SLE)</label>
                <input type="number" min={0} required value={clmAmount} onChange={(e) => setClmAmount(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
              </div>
              <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Submit</button>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Patient</th>
                <th className="py-2.5 px-4 font-semibold">Insurer & Policy</th>
                <th className="py-2.5 px-4 font-semibold">Service Line</th>
                <th className="py-2.5 px-4 font-semibold text-right">Amount (SLE)</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="no-print py-2.5 px-4 font-semibold text-right">Adjudication</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{c.patientName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{c.patientUid}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="text-slate-800">{c.providerName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{c.policyNumber || '—'}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{c.serviceDescription}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">{c.amountSLL.toLocaleString()}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{c.status} {c.paymentReference ? `· ${c.paymentReference}` : ''}</td>
                  <td className="no-print py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                    {canManageClaims && c.status === 'Submitted' && (
                      <>
                        <button type="button" onClick={() => handleUpdateClaimStatus(c, 'Approved')} className="px-2 py-1 text-xs bg-teal-50 text-teal-800 border border-teal-200 rounded">Approve</button>
                        <button type="button" onClick={() => handleUpdateClaimStatus(c, 'Rejected')} className="px-2 py-1 text-xs bg-red-50 text-red-800 border border-red-200 rounded">Reject</button>
                      </>
                    )}
                    {canManageClaims && c.status === 'Approved' && (
                      <button type="button" onClick={() => handleUpdateClaimStatus(c, 'Paid')} className="px-2.5 py-1 text-xs bg-emerald-700 text-white rounded">Record Payment</button>
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

  if (mode === 'telemedicine') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Telemedicine Scheduling & Consultation Records</h2>
            <p className="text-xs text-slate-600 mt-1">
              Manage specialist virtual appointments and clinical notes. Live WebRTC video transport requires configuring an external licensed telehealth media gateway.
            </p>
          </div>
          <button type="button" onClick={() => setShowTelForm(!showTelForm)} className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> Schedule Virtual Consult
          </button>
        </div>

        {showTelForm && (
          <form onSubmit={handleCreateTelemedicine} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
              <select required value={effectiveTelPatId} onChange={(e) => setTelPatId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {patients.length === 0 && <option value="">No patients registered</option>}
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Consulting Doctor</label>
              <input type="text" required value={telDoctor} onChange={(e) => setTelDoctor(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Specialty</label>
              <input type="text" value={telSpecialty} onChange={(e) => setTelSpecialty(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input type="date" required value={telDate} onChange={(e) => setTelDate(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
              <input type="time" required value={telTime} onChange={(e) => setTelTime(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Book Slot</button>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {telemedicine.map((t) => (
            <div key={t.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 text-sm">
                  {t.patientName} ({t.patientUid}) · {t.specialty || 'Virtual Consult'}
                </div>
                <div className="text-slate-600">
                  Consultant: {t.doctorName} · Scheduled <span className="font-mono">{t.scheduledDate} {t.scheduledTime}</span>
                </div>
                <div className="text-slate-500">
                  Endpoint: {t.integrationEndpointStatus || 'External Media Integration Point'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="font-medium text-slate-800">{t.status}</span>
                {t.status === 'Scheduled' && (
                  <button
                    type="button"
                    onClick={() => handleTelemedicineStatus(t, 'Ready')}
                    className="no-print px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
                  >
                    Mark Ready
                  </button>
                )}
                {(t.status === 'Scheduled' || t.status === 'Ready') && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTelemedicineStatus(t, 'Cancelled')}
                      className="no-print px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTelemedicineStatus(t, 'Completed')}
                      className="no-print px-3 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
                    >
                      Mark Completed
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // NHIE & Advanced Analytics
  const previewPat = patients.find((p) => p.id === effectivePreviewPatId) || patients[0];
  const fhirPreview = previewPat
    ? buildFhirR4Bundle(
        previewPat,
        encounters.filter((e) => e.patientId === previewPat.id),
        labs.filter((l) => l.patientId === previewPat.id),
        screenings.filter((s) => s.patientId === previewPat.id),
        referrals.filter((r) => r.patientId === previewPat.id)
      )
    : null;

  const districtStats = surveillance.reduce<Record<string, { cases: number; baseline: number; avgCoverage: number; count: number }>>((acc, rec) => {
    if (!acc[rec.district]) acc[rec.district] = { cases: 0, baseline: 0, avgCoverage: 0, count: 0 };
    acc[rec.district].cases += rec.reportedCases;
    acc[rec.district].baseline += rec.baselineCases;
    acc[rec.district].avgCoverage += rec.screeningCoveragePct || 0;
    acc[rec.district].count += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            National Health Information Exchange (NHIE) & Advanced Analytics
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Authorized facility-to-facility referral exchange, HL7 FHIR R4 interoperability mapping, and cross-district hospital analytics. Live external Ministry/DHIS2 endpoints require signed facility certificates before activation.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={() => setShowRefForm(!showRefForm)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
            <ArrowLeftRight className="w-3.5 h-3.5" /> New NHIE Referral
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'jaysaltech-district-analytics.csv',
                Object.entries(districtStats).map(([dist, st]) => ({
                  District: dist,
                  ReportedCases: st.cases,
                  BaselineCases: st.baseline,
                  AvgScreeningCoveragePct: Math.round(st.avgCoverage / Math.max(1, st.count)),
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" /> Export District Analytics
          </button>
          <button type="button" onClick={() => (onOpenPrintPreview ? onOpenPrintPreview() : triggerPrintReport())} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
            <Printer className="w-3.5 h-3.5" /> Print Executive Summary
          </button>
        </div>
      </div>

      {showRefForm && (
        <form onSubmit={handleCreateReferral} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient</label>
            <select required value={effectiveRefPatId} onChange={(e) => setRefPatId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              {patients.length === 0 && <option value="">No patients registered</option>}
              {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Receiving Facility</label>
            <select value={effectiveRefToFacId} onChange={(e) => setRefToFacId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              {facilities.length === 0 && <option value={user.facilityId}>{user.facilityName || user.facilityId}</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Specialty</label>
            <input type="text" required value={refSpec} onChange={(e) => setRefSpec(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Urgency</label>
            <select value={refUrgency} onChange={(e) => setRefUrgency(e.target.value as Referral['urgency'])} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
              <option value="Routine">Routine</option>
              <option value="Urgent">Urgent</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <input type="text" required placeholder="Clinical reason" value={refReason} onChange={(e) => setRefReason(e.target.value)} className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Send</button>
          </div>
        </form>
      )}

      {/* Cross-District Analytics & Operational KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
            Cross-District Epidemiological & Screening Coverage Comparison
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-4 font-semibold">District</th>
                  <th className="py-2 px-4 font-semibold text-right">Reported Cases</th>
                  <th className="py-2 px-4 font-semibold text-right">Baseline</th>
                  <th className="py-2 px-4 font-semibold text-right">Screening Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(districtStats).map(([dist, st]) => (
                  <tr key={dist}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{dist}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">{st.cases}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">{st.baseline}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-teal-800">
                      {Math.round(st.avgCoverage / Math.max(1, st.count))}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
            Authorized Inter-Facility Referrals ({referrals.length})
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {referrals.map((r) => (
              <div key={r.id} className="print-avoid-break p-4 text-xs flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{r.patientName} ({r.patientUid}) · {r.specialty}</div>
                  <div className="text-slate-600 mt-0.5">{r.fromFacilityName} → {r.toFacilityName}</div>
                  <div className="text-slate-500 mt-0.5">{r.reason}</div>
                </div>
                <div className="text-right shrink-0 space-y-1.5">
                  <div className="font-medium text-slate-800">
                    {r.status} {r.appointmentDate ? `· ${r.appointmentDate}` : ''}
                  </div>
                  <div className="no-print flex flex-wrap justify-end gap-1.5">
                    {r.status === 'Pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateReferralStatus(r, 'Declined')}
                          className="px-2 py-1 text-[11px] border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateReferralStatus(r, 'Accepted')}
                          className="px-2 py-1 text-[11px] bg-teal-700 text-white rounded hover:bg-teal-800"
                        >
                          Accept Exchange
                        </button>
                      </>
                    )}
                    {r.status === 'Accepted' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateReferralStatus(r, 'Appointment Scheduled')}
                          className="px-2 py-1 text-[11px] bg-teal-50 text-teal-800 border border-teal-200 rounded hover:bg-teal-100"
                        >
                          Schedule Appt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateReferralStatus(r, 'Completed')}
                          className="px-2 py-1 text-[11px] bg-emerald-700 text-white rounded hover:bg-emerald-800"
                        >
                          Complete
                        </button>
                      </>
                    )}
                    {r.status === 'Appointment Scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateReferralStatus(r, 'Completed')}
                        className="px-2 py-1 text-[11px] bg-emerald-700 text-white rounded hover:bg-emerald-800"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live FHIR R4 Mapping Preview */}
      {fhirPreview && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileCode className="w-4 h-4 text-teal-700" />
              HL7 FHIR R4 Interoperability Payload Builder (Standardized Patient Exchange)
            </div>
            <div className="flex items-center gap-2">
              <select value={previewPat?.id || ''} onChange={(e) => setPreviewFhirPatId(e.target.value)} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.patientUid})</option>)}
              </select>
              <span className="text-xs text-slate-500">
                Low-stock items: <strong className="font-mono">{medicines.filter((m) => m.stockQuantity <= m.reorderLevel).length}</strong>
              </span>
            </div>
          </div>
          <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 p-4 rounded-xl overflow-x-auto max-h-80">
            {JSON.stringify(fhirPreview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
