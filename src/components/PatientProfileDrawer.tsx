import React, { useState } from 'react';
import { X, FileCode, Printer } from 'lucide-react';
import type {
  Encounter,
  InsuranceClaim,
  LabOrder,
  Patient,
  Prescription,
  Referral,
  ScreeningRecord,
} from '../types/hub';
import { buildFhirR4Bundle, triggerPrintReport } from '../lib/exportUtils';

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

  const pEncounters = encounters.filter((e) => e.patientId === patient.id);
  const pLabs = labs.filter((l) => l.patientId === patient.id);
  const pRx = prescriptions.filter((r) => r.patientId === patient.id);
  const pScreenings = screenings.filter((s) => s.patientId === patient.id);
  const pReferrals = referrals.filter((r) => r.patientId === patient.id);
  const pClaims = claims.filter((c) => c.patientId === patient.id);

  const fhirBundle = buildFhirR4Bundle(patient, pEncounters, pLabs, pScreenings, pReferrals);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end">
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerPrintReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
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
  );
};
