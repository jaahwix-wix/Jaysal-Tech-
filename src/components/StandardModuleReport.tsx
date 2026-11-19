import React from 'react';
import { JOURNEY_STAGES, type ModuleKey, type UserProfile } from '../types/hub';
import { getModuleExportMetadata, type HubDatasetSnapshot } from '../lib/exportUtils';
import { PrintFooter, PrintLetterhead } from './PrintHeaderFooter';

interface Props {
  moduleKey: ModuleKey;
  user: UserProfile;
  effectiveRole: string;
  data: HubDatasetSnapshot;
}

export const StandardModuleReportDocument: React.FC<Props> = ({
  moduleKey,
  user,
  effectiveRole,
  data,
}) => {
  const meta = getModuleExportMetadata(moduleKey, data);
  const docRef = `JTH-${moduleKey.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '')}`;

  return (
    <div className="text-slate-900 bg-white">
      <PrintLetterhead
        alwaysVisible
        documentTitle={meta.title}
        facilityName={user.facilityName || 'Network Wide (All Facilities)'}
        preparedBy={user.displayName}
        preparedRole={effectiveRole}
        documentRef={docRef}
      />

      <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between text-[10px] text-slate-700">
        <span>
          <strong>Dataset Scope:</strong> Complete Module Register ({meta.recordSummary})
        </span>
        <span className="font-mono">
          Format: A4 Standard · Total Records: {meta.totalCount}
        </span>
      </div>

      {/* 1. EXECUTIVE OVERVIEW */}
      {moduleKey === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3 text-[10px] print-avoid-break">
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Registered Hospitals</div>
              <div className="text-base font-bold font-mono">{data.facilities.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Registered Patients</div>
              <div className="text-base font-bold font-mono">{data.patients.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Clinical Encounters</div>
              <div className="text-base font-bold font-mono">{data.encounters.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Public Health Alerts</div>
              <div className="text-base font-bold font-mono text-amber-700">{data.alerts.length}</div>
            </div>
          </div>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Screening-to-Care Loop Cascade Summary ({data.screenings.length} Total Screenings)
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2.5 font-semibold">Stage</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Patient Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {JOURNEY_STAGES.map((stage) => (
                  <tr key={stage}>
                    <td className="py-1.5 px-2.5 font-medium">{stage}</td>
                    <td className="py-1.5 px-2.5 text-right font-mono">
                      {data.screenings.filter((s) => s.journeyStage === stage).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Connected Healthcare Network ({data.facilities.length} Facilities)
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2.5 font-semibold">Code</th>
                  <th className="py-1.5 px-2.5 font-semibold">Facility Name</th>
                  <th className="py-1.5 px-2.5 font-semibold">District</th>
                  <th className="py-1.5 px-2.5 font-semibold">Type</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Beds</th>
                  <th className="py-1.5 px-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.facilities.map((f) => (
                  <tr key={f.id}>
                    <td className="py-1.5 px-2.5 font-mono">{f.code}</td>
                    <td className="py-1.5 px-2.5 font-medium">{f.name}</td>
                    <td className="py-1.5 px-2.5">{f.district}</td>
                    <td className="py-1.5 px-2.5">{f.type}</td>
                    <td className="py-1.5 px-2.5 text-right font-mono">{f.bedCapacity}</td>
                    <td className="py-1.5 px-2.5">{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              3. Active Early-Warning Signals ({data.alerts.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2.5 font-semibold">Ref #</th>
                  <th className="py-1.5 px-2.5 font-semibold">Condition &amp; District</th>
                  <th className="py-1.5 px-2.5 font-semibold text-right">Reported / Baseline</th>
                  <th className="py-1.5 px-2.5 font-semibold">Severity</th>
                  <th className="py-1.5 px-2.5 font-semibold">Verification Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5 px-2.5 font-mono">{a.referenceNumber}</td>
                    <td className="py-1.5 px-2.5 font-medium">{a.condition} ({a.district})</td>
                    <td className="py-1.5 px-2.5 text-right font-mono">{a.reportedCases} / {a.baselineCases}</td>
                    <td className="py-1.5 px-2.5 font-semibold">{a.severity}</td>
                    <td className="py-1.5 px-2.5">{a.verificationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 2. POPULATION HEALTH EARLY WARNING */}
      {moduleKey === 'population-health' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3 text-[10px] print-avoid-break">
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Total Alerts</div>
              <div className="text-base font-bold font-mono">{data.alerts.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Critical / High</div>
              <div className="text-base font-bold font-mono text-red-700">
                {data.alerts.filter((a) => a.severity === 'Critical' || a.severity === 'High').length}
              </div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Pending Verification</div>
              <div className="text-base font-bold font-mono text-amber-700">
                {data.alerts.filter((a) => a.verificationStatus === 'Pending Verification' || a.verificationStatus === 'Under Investigation').length}
              </div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Surveillance Logs</div>
              <div className="text-base font-bold font-mono">{data.surveillance.length}</div>
            </div>
          </div>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Public Health &amp; Workforce Early-Warning Alerts ({data.alerts.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Ref #</th>
                  <th className="py-1.5 px-2 font-semibold">Condition &amp; Location</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Cases / Base</th>
                  <th className="py-1.5 px-2 font-semibold">Severity / Status</th>
                  <th className="py-1.5 px-2 font-semibold">Trigger &amp; Recommended Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-1.5 px-2 font-mono">{a.referenceNumber}</td>
                    <td className="py-1.5 px-2 font-medium">{a.condition} — {a.district}</td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      {a.reportedCases} / {a.baselineCases}
                    </td>
                    <td className="py-1.5 px-2">
                      <strong>{a.severity}</strong><br />
                      {a.verificationStatus}
                    </td>
                    <td className="py-1.5 px-2">
                      <div>{a.triggerRule}</div>
                      <div className="text-teal-800 mt-0.5">Action: {a.recommendedResponse}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. De-Identified Facility Surveillance &amp; Workforce Logs ({data.surveillance.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Period</th>
                  <th className="py-1.5 px-2 font-semibold">District &amp; Facility</th>
                  <th className="py-1.5 px-2 font-semibold">Indicator</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Rep / Base</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Staff Abs.</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.surveillance.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 px-2 font-mono">{s.periodType} {s.periodLabel}</td>
                    <td className="py-1.5 px-2">{s.district} · {s.facilityName || s.facilityId}</td>
                    <td className="py-1.5 px-2 font-medium">{s.condition}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{s.reportedCases} / {s.baselineCases}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{(s.workforceAbsenteeismPct ?? 0).toFixed(1)}%</td>
                    <td className="py-1.5 px-2 text-right font-mono">{(s.screeningCoveragePct ?? 0).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 3. SCREENING-TO-CARE LOOP */}
      {moduleKey === 'screening-loop' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-3 text-[10px] print-avoid-break">
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Total Screened</div>
              <div className="text-base font-bold font-mono">{data.screenings.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Abnormal Results</div>
              <div className="text-base font-bold font-mono text-amber-700">
                {data.screenings.filter((s) => s.resultClassification === 'Abnormal').length}
              </div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Follow-Up Tasks</div>
              <div className="text-base font-bold font-mono">{data.followUpTasks.length}</div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Active Campaigns</div>
              <div className="text-base font-bold font-mono">{data.campaigns.length}</div>
            </div>
          </div>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Screening-to-Care Patient Journey Register ({data.screenings.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                  <th className="py-1.5 px-2 font-semibold">District</th>
                  <th className="py-1.5 px-2 font-semibold">Screening Type</th>
                  <th className="py-1.5 px-2 font-semibold">Result / Risk</th>
                  <th className="py-1.5 px-2 font-semibold">Journey Stage</th>
                  <th className="py-1.5 px-2 font-semibold">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.screenings.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1.5 px-2 font-medium">{s.patientName} <span className="font-mono text-slate-500">({s.patientUid || ''})</span></td>
                    <td className="py-1.5 px-2">{s.district}</td>
                    <td className="py-1.5 px-2">{s.screeningType}</td>
                    <td className="py-1.5 px-2">{s.resultClassification} · {s.riskLevel}</td>
                    <td className="py-1.5 px-2 font-medium">{s.journeyStage}</td>
                    <td className="py-1.5 px-2">{s.followUpCompleted ? 'Yes' : 'Open'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Follow-Up Tasks &amp; Escalations ({data.followUpTasks.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Patient</th>
                  <th className="py-1.5 px-2 font-semibold">Task</th>
                  <th className="py-1.5 px-2 font-semibold">Priority</th>
                  <th className="py-1.5 px-2 font-semibold">Due Date</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.followUpTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 px-2 font-medium">{t.patientName}</td>
                    <td className="py-1.5 px-2">{t.taskTitle}</td>
                    <td className="py-1.5 px-2">{t.priority}</td>
                    <td className="py-1.5 px-2 font-mono">{t.dueDate}</td>
                    <td className="py-1.5 px-2 font-semibold">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              3. Screening Campaigns ({data.campaigns.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Campaign Title</th>
                  <th className="py-1.5 px-2 font-semibold">District</th>
                  <th className="py-1.5 px-2 font-semibold">Condition</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Screened / Target</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 px-2 font-medium">{c.title}</td>
                    <td className="py-1.5 px-2">{c.district}</td>
                    <td className="py-1.5 px-2">{c.targetCondition}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{c.screenedCount} / {c.targetCount}</td>
                    <td className="py-1.5 px-2">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 4. PATIENT REGISTRY (ALL PATIENTS) */}
      {moduleKey === 'patients' && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
            Complete Patient Registry ({data.patients.length} Total Patients)
          </h3>
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Hub UID</th>
                <th className="py-1.5 px-2 font-semibold">Full Name</th>
                <th className="py-1.5 px-2 font-semibold">DOB / Sex / Blood</th>
                <th className="py-1.5 px-2 font-semibold">District &amp; Facility</th>
                <th className="py-1.5 px-2 font-semibold">Phone &amp; Emergency</th>
                <th className="py-1.5 px-2 font-semibold">Allergies / Chronic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.patients.map((p) => (
                <tr key={p.id}>
                  <td className="py-1.5 px-2 font-mono font-semibold text-teal-800">{p.patientUid}</td>
                  <td className="py-1.5 px-2 font-medium">{p.fullName}</td>
                  <td className="py-1.5 px-2 font-mono">{p.dateOfBirth} · {p.gender} · {p.bloodGroup || '—'}</td>
                  <td className="py-1.5 px-2">{p.district} · {p.facilityName || p.facilityId}</td>
                  <td className="py-1.5 px-2 font-mono">
                    {p.phone || '—'}<br />
                    <span className="font-sans text-slate-500">{p.emergencyContactName || ''}</span>
                  </td>
                  <td className="py-1.5 px-2">
                    {p.allergies || 'None'} · {p.chronicConditions || 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 5. CLINICAL & ENCOUNTERS */}
      {moduleKey === 'clinical' && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
            Complete Clinical Encounters &amp; Ward Register ({data.encounters.length})
          </h3>
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                <th className="py-1.5 px-2 font-semibold">Type / Dept</th>
                <th className="py-1.5 px-2 font-semibold">Clinician</th>
                <th className="py-1.5 px-2 font-semibold">Complaint &amp; Vitals</th>
                <th className="py-1.5 px-2 font-semibold">Diagnosis &amp; Plan</th>
                <th className="py-1.5 px-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.encounters.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 px-2 font-medium">{e.patientName}<br /><span className="font-mono text-slate-500">{e.patientUid || ''}</span></td>
                  <td className="py-1.5 px-2">{e.encounterType}<br />{e.department}{e.wardBed ? ` (${e.wardBed})` : ''}</td>
                  <td className="py-1.5 px-2">{e.clinicianName}</td>
                  <td className="py-1.5 px-2">
                    <div>{e.chiefComplaint}</div>
                    {e.vitalSigns && <div className="font-mono text-[9px] text-slate-600">{e.vitalSigns}</div>}
                  </td>
                  <td className="py-1.5 px-2">
                    <div>{e.diagnosis || 'Pending'}</div>
                    {e.dischargeSummary && <div className="text-emerald-800">Discharge: {e.dischargeSummary}</div>}
                  </td>
                  <td className="py-1.5 px-2 font-semibold">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 6. LABORATORY */}
      {moduleKey === 'laboratory' && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
            Complete Clinical Laboratory Diagnostics Register ({data.labOrders.length})
          </h3>
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Sample Code</th>
                <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                <th className="py-1.5 px-2 font-semibold">Test Requested</th>
                <th className="py-1.5 px-2 font-semibold">Result</th>
                <th className="py-1.5 px-2 font-semibold">Reference Range</th>
                <th className="py-1.5 px-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.labOrders.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 px-2 font-mono">{l.sampleCode}</td>
                  <td className="py-1.5 px-2 font-medium">{l.patientName} ({l.patientUid || ''})</td>
                  <td className="py-1.5 px-2">{l.testName}</td>
                  <td className={`py-1.5 px-2 ${l.abnormalFlag ? 'text-red-700 font-bold' : ''}`}>
                    {l.resultValue || 'Pending'} {l.abnormalFlag ? '(ABNORMAL)' : ''}
                  </td>
                  <td className="py-1.5 px-2">{l.referenceRange || 'Standard'}</td>
                  <td className="py-1.5 px-2 font-semibold">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 7. PHARMACY */}
      {moduleKey === 'pharmacy' && (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Medicine Inventory &amp; Expiry Status ({data.medicines.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Medicine Name</th>
                  <th className="py-1.5 px-2 font-semibold">Batch #</th>
                  <th className="py-1.5 px-2 font-semibold">Expiry Date</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Stock Qty</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Reorder Level</th>
                  <th className="py-1.5 px-2 font-semibold">Stock Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.medicines.map((m) => (
                  <tr key={m.id}>
                    <td className="py-1.5 px-2 font-medium">{m.name}</td>
                    <td className="py-1.5 px-2 font-mono">{m.batchNumber}</td>
                    <td className="py-1.5 px-2 font-mono">{m.expiryDate}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{m.stockQuantity} {m.unit}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{m.reorderLevel}</td>
                    <td className={`py-1.5 px-2 font-semibold ${m.stockQuantity <= m.reorderLevel ? 'text-red-700' : 'text-emerald-700'}`}>
                      {m.stockQuantity <= m.reorderLevel ? 'REORDER REQUIRED' : 'Adequate'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Prescription Dispensing Register ({data.prescriptions.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Patient</th>
                  <th className="py-1.5 px-2 font-semibold">Medicine</th>
                  <th className="py-1.5 px-2 font-semibold">Dosage &amp; Frequency</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Qty</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.prescriptions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 px-2 font-medium">{r.patientName}</td>
                    <td className="py-1.5 px-2">{r.medicineName}</td>
                    <td className="py-1.5 px-2">{r.dosage} · {r.frequency}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{r.quantity}</td>
                    <td className="py-1.5 px-2 font-semibold">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 8. BLOOD BANK */}
      {moduleKey === 'blood-bank' && (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Blood Unit Inventory &amp; Cross-Matching ({data.bloodUnits.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Unit Code</th>
                  <th className="py-1.5 px-2 font-semibold">Group</th>
                  <th className="py-1.5 px-2 font-semibold">Component</th>
                  <th className="py-1.5 px-2 font-semibold">Expiry Date</th>
                  <th className="py-1.5 px-2 font-semibold">Cross-Matched Patient</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.bloodUnits.map((u) => (
                  <tr key={u.id}>
                    <td className="py-1.5 px-2 font-mono">{u.unitCode}</td>
                    <td className="py-1.5 px-2 font-bold">{u.bloodGroup}</td>
                    <td className="py-1.5 px-2">{u.componentType}</td>
                    <td className="py-1.5 px-2 font-mono">{u.expiryDate}</td>
                    <td className="py-1.5 px-2">{u.crossMatchPatientName || '—'}</td>
                    <td className="py-1.5 px-2 font-semibold">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Voluntary Blood Donor Registry ({data.bloodDonors.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Donor Name</th>
                  <th className="py-1.5 px-2 font-semibold">Group</th>
                  <th className="py-1.5 px-2 font-semibold">District</th>
                  <th className="py-1.5 px-2 font-semibold">Phone</th>
                  <th className="py-1.5 px-2 font-semibold">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.bloodDonors.map((d) => (
                  <tr key={d.id}>
                    <td className="py-1.5 px-2 font-medium">{d.donorName}</td>
                    <td className="py-1.5 px-2 font-bold">{d.bloodGroup}</td>
                    <td className="py-1.5 px-2">{d.district}</td>
                    <td className="py-1.5 px-2 font-mono">{d.phone || '—'}</td>
                    <td className="py-1.5 px-2 font-semibold">{d.eligibilityStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 9. INSURANCE & CLAIMS */}
      {moduleKey === 'insurance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-[10px] print-avoid-break">
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Total Billed Claims</div>
              <div className="text-base font-bold font-mono">
                SLE {data.claims.reduce((sum, c) => sum + c.amountSLL, 0).toLocaleString()}
              </div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Reimbursed / Paid</div>
              <div className="text-base font-bold font-mono text-emerald-700">
                SLE {data.claims.filter((c) => c.status === 'Paid').reduce((sum, c) => sum + c.amountSLL, 0).toLocaleString()}
              </div>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5">
              <div className="text-slate-500">Total Claims Count</div>
              <div className="text-base font-bold font-mono">{data.claims.length}</div>
            </div>
          </div>

          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                <th className="py-1.5 px-2 font-semibold">Insurer / Policy</th>
                <th className="py-1.5 px-2 font-semibold">Service Description</th>
                <th className="py-1.5 px-2 font-semibold text-right">Amount (SLE)</th>
                <th className="py-1.5 px-2 font-semibold">Status &amp; Payment Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.claims.map((c) => (
                <tr key={c.id}>
                  <td className="py-1.5 px-2 font-medium">{c.patientName} ({c.patientUid || ''})</td>
                  <td className="py-1.5 px-2">{c.providerName} · {c.policyNumber || '—'}</td>
                  <td className="py-1.5 px-2">{c.serviceDescription}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{c.amountSLL.toLocaleString()}</td>
                  <td className="py-1.5 px-2 font-semibold">{c.status} {c.paymentReference ? `(${c.paymentReference})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 10. TELEMEDICINE */}
      {moduleKey === 'telemedicine' && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
            Telemedicine Consultation Schedule &amp; Records ({data.telemedicine.length})
          </h3>
          <table className="w-full text-left text-[10px] border border-slate-300">
            <thead className="bg-slate-100 border-b border-slate-300">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Date &amp; Time</th>
                <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                <th className="py-1.5 px-2 font-semibold">Consulting Doctor</th>
                <th className="py-1.5 px-2 font-semibold">Specialty</th>
                <th className="py-1.5 px-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.telemedicine.map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 px-2 font-mono">{t.scheduledDate} {t.scheduledTime}</td>
                  <td className="py-1.5 px-2 font-medium">{t.patientName} ({t.patientUid || ''})</td>
                  <td className="py-1.5 px-2">{t.doctorName}</td>
                  <td className="py-1.5 px-2">{t.specialty || 'Virtual Consult'}</td>
                  <td className="py-1.5 px-2 font-semibold">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 11. NHIE & ANALYTICS */}
      {moduleKey === 'nhie-analytics' && (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Cross-District Epidemiological &amp; Screening Coverage Summary
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">District</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Reported Cases</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Baseline Cases</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Avg Screening Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(
                  data.surveillance.reduce<Record<string, { cases: number; base: number; cov: number; count: number }>>(
                    (acc, rec) => {
                      if (!acc[rec.district]) acc[rec.district] = { cases: 0, base: 0, cov: 0, count: 0 };
                      acc[rec.district].cases += rec.reportedCases;
                      acc[rec.district].base += rec.baselineCases;
                      acc[rec.district].cov += rec.screeningCoveragePct || 0;
                      acc[rec.district].count += 1;
                      return acc;
                    },
                    {}
                  )
                ).map(([dist, st]) => (
                  <tr key={dist}>
                    <td className="py-1.5 px-2 font-medium">{dist}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{st.cases}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{st.base}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{Math.round(st.cov / Math.max(1, st.count))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Authorized Inter-Facility NHIE Referrals ({data.referrals.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Patient &amp; UID</th>
                  <th className="py-1.5 px-2 font-semibold">Origin → Destination</th>
                  <th className="py-1.5 px-2 font-semibold">Specialty &amp; Urgency</th>
                  <th className="py-1.5 px-2 font-semibold">Clinical Reason</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 px-2 font-medium">{r.patientName} ({r.patientUid || ''})</td>
                    <td className="py-1.5 px-2">{r.fromFacilityName || r.fromFacilityId} → {r.toFacilityName || r.toFacilityId}</td>
                    <td className="py-1.5 px-2">{r.specialty} · {r.urgency}</td>
                    <td className="py-1.5 px-2">{r.reason}</td>
                    <td className="py-1.5 px-2 font-semibold">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* 12. CENTRAL ADMIN & GOVERNANCE */}
      {moduleKey === 'admin-docs' && (
        <div className="space-y-5">
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              1. Registered Healthcare Facilities ({data.facilities.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Code</th>
                  <th className="py-1.5 px-2 font-semibold">Facility Name</th>
                  <th className="py-1.5 px-2 font-semibold">District</th>
                  <th className="py-1.5 px-2 font-semibold text-right">Beds</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.facilities.map((f) => (
                  <tr key={f.id}>
                    <td className="py-1.5 px-2 font-mono">{f.code}</td>
                    <td className="py-1.5 px-2 font-medium">{f.name}</td>
                    <td className="py-1.5 px-2">{f.district}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{f.bedCapacity}</td>
                    <td className="py-1.5 px-2 font-semibold">{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Authorized Staff &amp; RBAC Directory ({data.staffUsers.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Name</th>
                  <th className="py-1.5 px-2 font-semibold">Email</th>
                  <th className="py-1.5 px-2 font-semibold">Role</th>
                  <th className="py-1.5 px-2 font-semibold">Facility</th>
                  <th className="py-1.5 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.staffUsers.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-1.5 px-2 font-medium">{u.displayName}</td>
                    <td className="py-1.5 px-2 font-mono">{u.email}</td>
                    <td className="py-1.5 px-2">{u.role}</td>
                    <td className="py-1.5 px-2">{u.facilityName || u.facilityId}</td>
                    <td className="py-1.5 px-2 font-semibold">{u.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              3. Governance Audit Trail ({data.auditLogs.length})
            </h3>
            <table className="w-full text-left text-[10px] border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="py-1.5 px-2 font-semibold">Timestamp</th>
                  <th className="py-1.5 px-2 font-semibold">Actor</th>
                  <th className="py-1.5 px-2 font-semibold">Action</th>
                  <th className="py-1.5 px-2 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.auditLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-1.5 px-2 font-mono whitespace-nowrap">{l.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="py-1.5 px-2">{l.actorEmail} ({l.actorRole})</td>
                    <td className="py-1.5 px-2 font-mono">{l.action}</td>
                    <td className="py-1.5 px-2">{l.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      <PrintFooter alwaysVisible preparedBy={user.displayName} preparedRole={effectiveRole} />
    </div>
  );
};
