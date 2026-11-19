import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileCode, FileSpreadsheet, Printer, X } from 'lucide-react';
import type {
  Encounter,
  InsuranceClaim,
  LabOrder,
  Patient,
  Prescription,
  Referral,
  ScreeningRecord,
} from '../types/hub';
import {
  buildFhirR4Bundle,
  downloadHtmlReport,
  exportToCsv,
  triggerPrintReport,
} from '../lib/exportUtils';
import { PrintFooter, PrintLetterhead } from './PrintHeaderFooter';

interface Props {
  patient: Patient;
  encounters: Encounter[];
  labs: LabOrder[];
  prescriptions: Prescription[];
  screenings: ScreeningRecord[];
  referrals: Referral[];
  claims: InsuranceClaim[];
  onClose: () => void;
}

export const PatientProfileDrawer: React.FC<Props> = ({
  patient,
  encounters,
  labs,
  prescriptions,
  screenings,
  referrals,
  claims,
  onClose,
}) => {
  const [tab, setTab] = useState<'summary' | 'clinical' | 'diagnostics' | 'fhir'>('summary');
  const dossierRef = useRef<HTMLDivElement | null>(null);

  const pEncounters = encounters.filter((e) => e.patientId === patient.id);
  const pLabs = labs.filter((l) => l.patientId === patient.id);
  const pRx = prescriptions.filter((r) => r.patientId === patient.id);
  const pScreenings = screenings.filter((s) => s.patientId === patient.id);
  const pReferrals = referrals.filter((r) => r.patientId === patient.id);
  const pClaims = claims.filter((c) => c.patientId === patient.id);

  const fhirBundle = buildFhirR4Bundle(patient, pEncounters, pLabs, pScreenings, pReferrals);

  useEffect(() => {
    document.body.classList.add('printing-patient-dossier');
    return () => {
      document.body.classList.remove('printing-patient-dossier');
    };
  }, []);

  const dossierPortal = createPortal(
    <div ref={dossierRef} className="patient-dossier-print-portal text-slate-900 bg-white">
      <PrintLetterhead
        alwaysVisible
        documentTitle="Comprehensive Patient Clinical Dossier"
        facilityName={patient.facilityName || patient.facilityId}
        preparedBy="Attending Clinical Hub"
        preparedRole="Authorized Facility Record"
        documentRef={patient.patientUid}
        classification={
          patient.isSynthetic
            ? 'SYNTHETIC DEMONSTRATION RECORD · NON-CLINICAL'
            : 'CONFIDENTIAL PATIENT MEDICAL RECORD'
        }
      />

      {/* Section 1: Patient Identification & Demographics */}
      <section className="mb-5 print-avoid-break">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          1. Patient Identification &amp; Demographics
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-slate-300 rounded-lg p-3 text-[11px]">
          <div>
            <span className="text-slate-500">Full Name:</span>{' '}
            <strong className="text-slate-900">{patient.fullName}</strong>
          </div>
          <div>
            <span className="text-slate-500">Patient UID:</span>{' '}
            <strong className="font-mono text-slate-900">{patient.patientUid}</strong>
          </div>
          <div>
            <span className="text-slate-500">Date of Birth / Gender:</span>{' '}
            <strong className="text-slate-900">{patient.dateOfBirth} · {patient.gender}</strong>
          </div>
          <div>
            <span className="text-slate-500">Blood Group:</span>{' '}
            <strong className="text-slate-900">{patient.bloodGroup || 'Unknown'}</strong>
          </div>
          <div>
            <span className="text-slate-500">District / Chiefdom:</span>{' '}
            <strong className="text-slate-900">{patient.district}{patient.chiefdom ? ` · ${patient.chiefdom}` : ''}</strong>
          </div>
          <div>
            <span className="text-slate-500">Contact Phone:</span>{' '}
            <strong className="font-mono text-slate-900">{patient.phone || 'Not provided'}</strong>
          </div>
          <div>
            <span className="text-slate-500">Emergency Contact:</span>{' '}
            <strong className="text-slate-900">
              {patient.emergencyContactName || 'N/A'}{patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ''}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Insurance Coverage:</span>{' '}
            <strong className="text-slate-900">
              {patient.insuranceProvider || 'Uninsured / Out-of-Pocket'}{patient.insuranceNumber ? ` · ${patient.insuranceNumber}` : ''}
            </strong>
          </div>
        </div>
      </section>

      {/* Section 2: Clinical Alerts & Chronic Risks */}
      <section className="mb-5 print-avoid-break">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          2. Allergies &amp; Chronic Clinical Risks
        </h3>
        <div className="grid grid-cols-2 gap-4 text-[11px]">
          <div className="border border-red-300 bg-red-50/40 rounded-lg p-3">
            <div className="font-bold text-red-800 text-[10px] uppercase">Documented Allergies</div>
            <div className="text-slate-900 mt-1">{patient.allergies || 'None documented'}</div>
          </div>
          <div className="border border-slate-300 rounded-lg p-3">
            <div className="font-bold text-slate-700 text-[10px] uppercase">Chronic Conditions &amp; Risks</div>
            <div className="text-slate-900 mt-1">{patient.chronicConditions || 'None documented'}</div>
          </div>
        </div>
      </section>

      {/* Section 3: Clinical Encounters & Discharge Summaries */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          3. Clinical Encounters, Vitals &amp; Discharge Summaries ({pEncounters.length})
        </h3>
        {pEncounters.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No clinical encounters recorded.</p>
        ) : (
          <div className="space-y-2.5">
            {pEncounters.map((enc) => (
              <div key={enc.id} className="print-avoid-break border border-slate-300 rounded-lg p-3 text-[11px] space-y-1">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-900">
                    {enc.encounterType} · {enc.department}
                  </span>
                  <span className="font-mono text-slate-700">
                    {enc.status} · Clinician: {enc.clinicianName}
                  </span>
                </div>
                <div><strong>Chief Complaint:</strong> {enc.chiefComplaint}</div>
                {enc.vitalSigns && (
                  <div className="font-mono text-[10px] bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                    <strong>Vitals:</strong> {enc.vitalSigns}
                  </div>
                )}
                {enc.diagnosis && <div><strong>Diagnosis:</strong> {enc.diagnosis}</div>}
                {enc.treatmentPlan && <div><strong>Treatment Plan:</strong> {enc.treatmentPlan}</div>}
                {enc.dischargeSummary && (
                  <div className="bg-emerald-50/50 border border-emerald-200 px-2 py-1 rounded">
                    <strong>Discharge Summary:</strong> {enc.dischargeSummary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Laboratory Results */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          4. Laboratory Diagnostics ({pLabs.length})
        </h3>
        {pLabs.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No laboratory orders recorded.</p>
        ) : (
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 text-slate-800 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2.5 font-semibold">Sample Code</th>
                <th className="py-1.5 px-2.5 font-semibold">Test Name</th>
                <th className="py-1.5 px-2.5 font-semibold">Result</th>
                <th className="py-1.5 px-2.5 font-semibold">Reference Range</th>
                <th className="py-1.5 px-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pLabs.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 px-2.5 font-mono">{l.sampleCode}</td>
                  <td className="py-1.5 px-2.5 font-medium">{l.testName}</td>
                  <td className={`py-1.5 px-2.5 ${l.abnormalFlag ? 'text-red-700 font-bold' : ''}`}>
                    {l.resultValue || 'Pending'} {l.abnormalFlag ? '(ABNORMAL)' : ''}
                  </td>
                  <td className="py-1.5 px-2.5 text-slate-600">{l.referenceRange || 'Standard'}</td>
                  <td className="py-1.5 px-2.5">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Section 5: Medication Prescriptions */}
      <section className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          5. Medication Prescriptions ({pRx.length})
        </h3>
        {pRx.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No prescriptions recorded.</p>
        ) : (
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 text-slate-800 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2.5 font-semibold">Medication</th>
                <th className="py-1.5 px-2.5 font-semibold">Dosage &amp; Frequency</th>
                <th className="py-1.5 px-2.5 font-semibold text-right">Qty</th>
                <th className="py-1.5 px-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pRx.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 px-2.5 font-medium">{r.medicineName}</td>
                  <td className="py-1.5 px-2.5">{r.dosage} · {r.frequency}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{r.quantity}</td>
                  <td className="py-1.5 px-2.5">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Section 6: Screening-to-Care, Referrals & Claims */}
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2.5">
          6. Screening-to-Care ({pScreenings.length}), Referrals ({pReferrals.length}) &amp; Claims ({pClaims.length})
        </h3>
        {pScreenings.length === 0 && pReferrals.length === 0 && pClaims.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No screening, referral, or billing records linked.</p>
        ) : (
          <div className="space-y-2 text-[10px]">
            {pScreenings.map((scr) => (
              <div key={scr.id} className="print-avoid-break border border-slate-300 rounded px-2.5 py-1.5 flex items-center justify-between gap-4">
                <div>
                  <strong>Screening: {scr.screeningType}</strong> · Stage: {scr.journeyStage} · Result: {scr.measurementSummary || 'N/A'}
                  {scr.clinicianDecision ? ` · Decision: ${scr.clinicianDecision}` : ''}
                </div>
                <span className={scr.resultClassification === 'Abnormal' ? 'font-bold text-red-700 shrink-0' : 'font-semibold text-emerald-700 shrink-0'}>
                  {scr.resultClassification} ({scr.riskLevel} Risk)
                </span>
              </div>
            ))}
            {pReferrals.map((r) => (
              <div key={r.id} className="print-avoid-break border border-slate-300 rounded px-2.5 py-1.5 flex items-center justify-between gap-4">
                <div>
                  <strong>Referral ({r.specialty}):</strong> {r.fromFacilityName || r.fromFacilityId} → {r.toFacilityName || r.toFacilityId} · {r.urgency} · {r.reason}
                </div>
                <span className="font-semibold shrink-0">{r.status}</span>
              </div>
            ))}
            {pClaims.map((c) => (
              <div key={c.id} className="print-avoid-break border border-slate-300 rounded px-2.5 py-1.5 flex items-center justify-between gap-4">
                <div>
                  <strong>Claim ({c.providerName}):</strong> {c.serviceDescription}
                </div>
                <span className="font-mono font-semibold shrink-0">
                  SLE {c.amountSLL.toLocaleString()} ({c.status})
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <PrintFooter alwaysVisible preparedBy="Attending Clinical Team" preparedRole={patient.facilityName || patient.facilityId} />
    </div>,
    document.body
  );

  return (
    <>
      {dossierPortal}
      <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex justify-end">
      <div className="bg-white border-l border-slate-200 w-full max-w-3xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-teal-800">{patient.patientUid}</span>
              <span aria-hidden="true">·</span>
              <span>{patient.facilityName || patient.facilityId}</span>
              {patient.isSynthetic && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-medium">Synthetic Demonstration Record</span>
                </>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">{patient.fullName}</h2>
            <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
              <span>DOB: {patient.dateOfBirth}</span>
              <span>Gender: {patient.gender}</span>
              <span>Blood Group: {patient.bloodGroup || 'Unknown'}</span>
              <span>District: {patient.district}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                exportToCsv(`${patient.patientUid}-records.csv`, [
                  {
                    Section: 'Demographics',
                    CodeOrType: patient.patientUid,
                    Summary: `${patient.fullName} · ${patient.gender} · DOB ${patient.dateOfBirth} · Blood ${patient.bloodGroup || 'Unknown'}`,
                    Detail: `${patient.district} · Allergies: ${patient.allergies || 'None'} · Chronic: ${patient.chronicConditions || 'None'}`,
                    Status: patient.facilityName || patient.facilityId,
                  },
                  ...pEncounters.map((e) => ({
                    Section: 'Clinical Encounter',
                    CodeOrType: `${e.encounterType} (${e.department})`,
                    Summary: e.chiefComplaint,
                    Detail: `Diagnosis: ${e.diagnosis || 'Pending'} · Vitals: ${e.vitalSigns || 'N/A'}`,
                    Status: e.status,
                  })),
                  ...pLabs.map((l) => ({
                    Section: 'Laboratory',
                    CodeOrType: l.sampleCode,
                    Summary: l.testName,
                    Detail: `Result: ${l.resultValue || 'Pending'} (Ref: ${l.referenceRange || 'Standard'})`,
                    Status: l.abnormalFlag ? 'ABNORMAL' : l.status,
                  })),
                  ...pRx.map((r) => ({
                    Section: 'Prescription',
                    CodeOrType: r.medicineName,
                    Summary: `${r.dosage || ''} ${r.frequency || ''}`.trim(),
                    Detail: `Qty: ${r.quantity}`,
                    Status: r.status,
                  })),
                  ...pScreenings.map((s) => ({
                    Section: 'Screening',
                    CodeOrType: s.screeningType,
                    Summary: `${s.resultClassification} (${s.riskLevel} Risk)`,
                    Detail: s.measurementSummary || '',
                    Status: s.journeyStage,
                  })),
                ]);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => {
                if (dossierRef.current) {
                  downloadHtmlReport(
                    `${patient.patientUid}-clinical-dossier.html`,
                    `Patient Dossier — ${patient.fullName}`,
                    dossierRef.current.innerHTML
                  );
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={triggerPrintReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Profile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              aria-label="Close patient profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="px-6 py-2.5 border-b border-slate-200 flex items-center gap-2 bg-white overflow-x-auto">
          {([
            ['summary', 'Demographics & History'],
            ['clinical', `Encounters (${pEncounters.length}) & Screenings (${pScreenings.length})`],
            ['diagnostics', `Labs (${pLabs.length}) & Pharmacy (${pRx.length})`],
            ['fhir', 'FHIR R4 Record'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'summary' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4">
                <div>
                  <div className="text-xs text-slate-500">Contact Phone</div>
                  <div className="text-sm font-medium text-slate-900 font-mono mt-0.5">{patient.phone || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Chiefdom / Community</div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">{patient.chiefdom || patient.district}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Emergency Contact</div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">
                    {patient.emergencyContactName || 'N/A'} {patient.emergencyContactPhone ? `· ${patient.emergencyContactPhone}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Insurance Coverage</div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">
                    {patient.insuranceProvider || 'Uninsured / Out-of-Pocket'} {patient.insuranceNumber ? `(${patient.insuranceNumber})` : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-red-700">Documented Allergies</div>
                  <div className="text-sm text-slate-900 mt-1.5">{patient.allergies || 'None documented'}</div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-700">Chronic Conditions & Risks</div>
                  <div className="text-sm text-slate-900 mt-1.5">{patient.chronicConditions || 'None documented'}</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                  Referrals ({pReferrals.length}) & Insurance Claims ({pClaims.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {pReferrals.length === 0 && pClaims.length === 0 && (
                    <div className="p-4 text-xs text-slate-500">No linked referrals or claims recorded yet.</div>
                  )}
                  {pReferrals.map((r) => (
                    <div key={r.id} className="p-4 text-xs flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">Referral: {r.specialty}</div>
                        <div className="text-slate-600 mt-0.5">
                          {r.fromFacilityName || r.fromFacilityId} → {r.toFacilityName || r.toFacilityId} · {r.urgency}
                        </div>
                      </div>
                      <span className="font-medium text-teal-800">{r.status}</span>
                    </div>
                  ))}
                  {pClaims.map((c) => (
                    <div key={c.id} className="p-4 text-xs flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">{c.providerName}</div>
                        <div className="text-slate-600 mt-0.5">{c.serviceDescription}</div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-mono font-semibold text-slate-900">SLE {c.amountSLL.toLocaleString()}</div>
                        <div className="text-slate-500">{c.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'clinical' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Clinical Encounters & Vitals</h3>
                {pEncounters.length === 0 ? (
                  <p className="text-xs text-slate-500">No consultations recorded for this patient.</p>
                ) : (
                  <div className="space-y-3">
                    {pEncounters.map((enc) => (
                      <div key={enc.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">
                            {enc.encounterType} · {enc.department}
                          </span>
                          <span className="font-mono text-slate-500">{enc.status}</span>
                        </div>
                        <div className="text-slate-600">Clinician: {enc.clinicianName}</div>
                        <div className="text-slate-800"><strong>Complaint:</strong> {enc.chiefComplaint}</div>
                        {enc.vitalSigns && <div className="font-mono text-slate-700 bg-slate-50 p-2 rounded">Vitals: {enc.vitalSigns}</div>}
                        {enc.diagnosis && <div className="text-slate-800"><strong>Diagnosis:</strong> {enc.diagnosis}</div>}
                        {enc.treatmentPlan && <div className="text-slate-700"><strong>Plan:</strong> {enc.treatmentPlan}</div>}
                        {enc.dischargeSummary && <div className="text-slate-700"><strong>Discharge Summary:</strong> {enc.dischargeSummary}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Screening-to-Care History</h3>
                {pScreenings.length === 0 ? (
                  <p className="text-xs text-slate-500">No screenings logged for this patient.</p>
                ) : (
                  <div className="space-y-3">
                    {pScreenings.map((scr) => (
                      <div key={scr.id} className="border border-slate-200 rounded-xl p-4 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{scr.screeningType}</span>
                          <span className={scr.resultClassification === 'Abnormal' ? 'text-red-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                            {scr.resultClassification} · {scr.riskLevel} Risk
                          </span>
                        </div>
                        <div className="text-slate-600">Stage: {scr.journeyStage} · Measurement: {scr.measurementSummary || 'N/A'}</div>
                        {scr.clinicianDecision && <div className="text-slate-700">Decision: {scr.clinicianDecision}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'diagnostics' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Laboratory Results</h3>
                {pLabs.length === 0 ? (
                  <p className="text-xs text-slate-500">No laboratory orders recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {pLabs.map((l) => (
                      <div key={l.id} className="p-4 text-xs flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-slate-900">{l.testName}</div>
                          <div className="font-mono text-slate-500 mt-0.5">Sample: {l.sampleCode} · Ref: {l.referenceRange || 'Standard'}</div>
                          <div className="text-slate-800 mt-1">Result: {l.resultValue || 'Pending'}</div>
                        </div>
                        <div className="text-right">
                          <div className={l.abnormalFlag ? 'text-red-700 font-semibold' : 'text-slate-700 font-medium'}>
                            {l.abnormalFlag ? 'Abnormal Flag' : l.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Medication Prescriptions</h3>
                {pRx.length === 0 ? (
                  <p className="text-xs text-slate-500">No prescriptions recorded.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {pRx.map((r) => (
                      <div key={r.id} className="p-4 text-xs flex items-center justify-between gap-4">
                        <div>
                          <div className="font-semibold text-slate-900">{r.medicineName}</div>
                          <div className="text-slate-600 mt-0.5">{r.dosage} · {r.frequency} · Qty: {r.quantity}</div>
                        </div>
                        <span className="font-medium text-teal-800">{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'fhir' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <FileCode className="w-4 h-4 text-teal-700" />
                  HL7 FHIR R4 Interoperability Bundle (Patient + Clinical + Diagnostics + Referrals)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${patient.patientUid}-fhir-r4.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                  Download FHIR JSON
                </button>
              </div>
              <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 p-4 rounded-xl overflow-x-auto max-h-[480px]">
                {JSON.stringify(fhirBundle, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};
