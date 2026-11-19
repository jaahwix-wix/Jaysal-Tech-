import React from 'react';
import { Database, ArrowRight, AlertTriangle } from 'lucide-react';
import { JOURNEY_STAGES } from '../../types/hub';
import type {
  Encounter,
  Facility,
  FollowUpTask,
  LabOrder,
  Medicine,
  ModuleKey,
  Patient,
  PublicHealthAlert,
  Referral,
  ScreeningRecord,
  SurveillanceRecord,
} from '../../types/hub';

interface Props {
  facilities: Facility[];
  patients: Patient[];
  encounters: Encounter[];
  screenings: ScreeningRecord[];
  followUpTasks: FollowUpTask[];
  alerts: PublicHealthAlert[];
  labOrders: LabOrder[];
  medicines: Medicine[];
  referrals: Referral[];
  surveillance: SurveillanceRecord[];
  seeding: boolean;
  pendingApprovalsCount?: number;
  canManageUsers?: boolean;
  onSeedDataset: () => Promise<void>;
  onNavigate: (mod: ModuleKey) => void;
}

export const OverviewDashboard: React.FC<Props> = ({
  facilities,
  patients,
  encounters,
  screenings,
  followUpTasks,
  alerts,
  labOrders,
  medicines,
  referrals,
  surveillance,
  seeding,
  pendingApprovalsCount = 0,
  canManageUsers = false,
  onSeedDataset,
  onNavigate,
}) => {
  const pendingFollowUps = followUpTasks.filter((t) => t.status !== 'Completed').length;
  const highRiskPatients = screenings.filter(
    (s) => (s.riskLevel === 'High' || s.riskLevel === 'Critical') && !s.followUpCompleted
  ).length;
  const activeAlerts = alerts.filter(
    (a) => a.verificationStatus !== 'Resolved' && a.verificationStatus !== 'Dismissed'
  ).length;
  const pendingLabs = labOrders.filter((l) => l.status !== 'Approved').length;
  const stockWarnings = medicines.filter((m) => {
    const isLow = m.stockQuantity <= m.reorderLevel;
    const expDate = new Date(m.expiryDate);
    const soon = new Date();
    soon.setDate(soon.getDate() + 45);
    return isLow || expDate <= soon;
  }).length;
  const pendingReferrals = referrals.filter((r) => r.status !== 'Completed' && r.status !== 'Declined').length;

  const kpis: { label: string; value: number; sub: string; target: ModuleKey; alert?: boolean }[] = [
    { label: 'Registered Hospitals', value: facilities.length, sub: `${facilities.filter((f) => f.status === 'Approved').length} approved`, target: 'admin-docs' },
    { label: 'Registered Patients', value: patients.length, sub: 'Unique hub UIDs', target: 'patients' },
    { label: 'Total Consultations', value: encounters.length, sub: `${encounters.filter((e) => e.status === 'Admitted').length} inpatient`, target: 'clinical' },
    { label: 'Screenings Conducted', value: screenings.length, sub: `${screenings.filter((s) => s.resultClassification === 'Abnormal').length} abnormal`, target: 'screening-loop' },
    { label: 'Pending Follow-Ups', value: pendingFollowUps, sub: `${followUpTasks.filter((t) => t.status === 'Overdue' || t.status === 'Missed').length} overdue`, target: 'screening-loop', alert: pendingFollowUps > 0 },
    { label: 'High-Risk Patients for Review', value: highRiskPatients, sub: 'Unresolved risk flags', target: 'screening-loop', alert: highRiskPatients > 0 },
    { label: 'Active Public Health Alerts', value: activeAlerts, sub: 'Early warning engine', target: 'population-health', alert: activeAlerts > 0 },
    { label: 'Laboratory Requests', value: labOrders.length, sub: `${pendingLabs} awaiting approval`, target: 'laboratory' },
    { label: 'Pharmacy Stock Warnings', value: stockWarnings, sub: 'Low stock or near expiry', target: 'pharmacy', alert: stockWarnings > 0 },
    { label: 'Pending Referrals', value: pendingReferrals, sub: 'Inter-facility NHIE', target: 'nhie-analytics' },
  ];

  // Screening cascade counts
  const stageCounts = JOURNEY_STAGES.map((stage) => ({
    stage,
    count: screenings.filter((s) => s.journeyStage === stage).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.count));

  // Disease totals from surveillance
  const diseaseTotals = surveillance.reduce<Record<string, { reported: number; baseline: number }>>((acc, rec) => {
    if (!acc[rec.condition]) acc[rec.condition] = { reported: 0, baseline: 0 };
    acc[rec.condition].reported += rec.reportedCases;
    acc[rec.condition].baseline += rec.baselineCases;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Pending Staff Approvals Notice for Hospital / Super Administrators */}
      {canManageUsers && pendingApprovalsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-950">
            <span className="font-bold font-mono tabular-nums">{pendingApprovalsCount}</span>{' '}
            registered hospital staff {pendingApprovalsCount === 1 ? 'account is' : 'accounts are'} awaiting Hospital Administration approval before accessing the portal.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('admin-docs')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
          >
            <span>Review Pending Staff</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty/Seed prompt banner when database is fresh */}
      {facilities.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Initialize Sierra Leone Synthetic Demonstration Workspace
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl">
              Your Firestore database is connected and empty. Load the labeled synthetic Sierra Leone dataset across 5 facilities, patients, clinical encounters, screening-to-care loops, and population early-warning indicators, or begin adding records directly.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={onSeedDataset}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Database className="w-4 h-4" />
            {seeding ? 'Seeding Firestore...' : 'Load Synthetic Dataset'}
          </button>
        </div>
      )}

      {/* 10 Core Dashboard Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.target)}
            className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors flex flex-col justify-between"
          >
            <div className="text-xs font-medium text-slate-600 leading-snug">{kpi.label}</div>
            <div className={`text-2xl font-bold tabular-nums mt-2 ${kpi.alert ? 'text-amber-700' : 'text-slate-900'}`}>
              {kpi.value}
            </div>
            <div className="text-xs text-slate-500 mt-1">{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* Innovation Spotlights: Primary + Supporting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Population Health Early Warning Summary */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Population & Workforce Health Early Warning
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reported cases vs. 4-week district baseline across priority indicators
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('population-health')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0"
            >
              Open Early Warning <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {Object.keys(diseaseTotals).length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
              No surveillance aggregates recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(diseaseTotals).map(([cond, vals]) => {
                const pct = vals.baseline > 0 ? ((vals.reported - vals.baseline) / vals.baseline) * 100 : 0;
                const maxVal = Math.max(vals.reported, vals.baseline, 1);
                return (
                  <div key={cond} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{cond}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {vals.reported} cases · baseline {vals.baseline}{' '}
                        <span className={pct >= 35 ? 'text-red-700 font-semibold' : 'text-teal-700'}>
                          ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden flex">
                      <div
                        className={pct >= 35 ? 'bg-red-600 h-full' : 'bg-teal-600 h-full'}
                        style={{ width: `${Math.min(100, (vals.reported / (maxVal * 1.2)) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
              <div className="text-xs font-medium text-slate-700">Recent Active Early Warning Signals</div>
              {alerts.slice(0, 2).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onNavigate('population-health')}
                  className="w-full text-left flex items-start justify-between gap-3 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900">
                        {a.referenceNumber} · {a.condition} ({a.district})
                      </div>
                      <div className="text-slate-600 mt-0.5">{a.triggerRule}</div>
                    </div>
                  </div>
                  <span className="font-medium text-slate-800 whitespace-nowrap">{a.severity}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Screening-to-Care Cascade */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Screening-to-Care Loop Cascade
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Patient progression from registration to completed follow-up
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('screening-loop')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap shrink-0"
            >
              Manage Loop <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {stageCounts.map((item, idx) => (
              <div key={item.stage} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-slate-400 w-5 tabular-nums">0{idx + 1}</span>
                <span className="w-40 truncate text-slate-700 font-medium">{item.stage}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-slate-800"
                    style={{ width: `${(item.count / maxStage) * 100}%` }}
                  />
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900 w-6 text-right">
                  {item.count}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Automated task rule active for abnormal screenings</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {followUpTasks.filter((t) => t.status === 'Completed').length}/{followUpTasks.length} Closed
            </span>
          </div>
        </div>
      </div>

      {/* Registered Network Facilities Summary Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Connected Healthcare Network (Sierra Leone)</h3>
            <p className="text-xs text-slate-500">Aggregated facility readiness and operational capacity</p>
          </div>
          {facilities.length > 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={onSeedDataset}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              {seeding ? 'Refreshing...' : 'Re-sync Synthetic Demo Data'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Facility Code</th>
                <th className="py-2.5 px-4 font-semibold">Hospital / Centre Name</th>
                <th className="py-2.5 px-4 font-semibold">District</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold text-right">Beds</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facilities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No facilities registered yet. Load the synthetic dataset or add a facility in Central Administration.
                  </td>
                </tr>
              ) : (
                facilities.map((fac) => (
                  <tr key={fac.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-700">{fac.code}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{fac.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{fac.district}</td>
                    <td className="py-2.5 px-4 text-slate-600">{fac.type}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">{fac.bedCapacity}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">
                      <span className={fac.status === 'Approved' ? 'text-emerald-700' : fac.status === 'Pending' ? 'text-amber-700' : 'text-red-700'}>
                        {fac.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
