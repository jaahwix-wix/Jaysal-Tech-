import React, { useState } from 'react';
import { Download, Printer, Play, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  SIERRA_LEONE_DISTRICTS,
  makeSafeId,
  clampStr,
  type AlertSeverity,
  type Facility,
  type PlatformSettings,
  type PublicHealthAlert,
  type SurveillanceRecord,
  type UserProfile,
  type VerificationStatus,
} from '../../types/hub';
import { SierraLeoneMap } from '../SierraLeoneMap';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { exportToCsv, triggerPrintReport } from '../../lib/exportUtils';

interface Props {
  user: UserProfile;
  facilities: Facility[];
  surveillance: SurveillanceRecord[];
  alerts: PublicHealthAlert[];
  settings: PlatformSettings | null;
  canVerifyAlerts: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
  onOpenPrintPreview?: () => void;
}

const CONDITIONS = [
  'Malaria',
  'Hypertension',
  'Diabetes',
  'Respiratory Infections',
  'Diarrhoeal Diseases',
  'Maternal Health Risks',
  'Lassa Fever / VHF Screening',
];

export const PopulationHealthModule: React.FC<Props> = ({
  user,
  facilities,
  surveillance,
  alerts,
  settings,
  canVerifyAlerts,
  onLogAudit,
  onToast,
  onOpenPrintPreview,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [selectedPeriod, setSelectedPeriod] = useState<'All' | 'Daily' | 'Weekly' | 'Monthly'>('All');
  const [activeTab, setActiveTab] = useState<'alerts' | 'surveillance' | 'workforce'>('alerts');
  const [runningScan, setRunningScan] = useState(false);

  // New surveillance report state
  const [showReportForm, setShowReportForm] = useState(false);
  const [repFacilityId, setRepFacilityId] = useState(facilities[0]?.id || user.facilityId);
  const [repDistrict, setRepDistrict] = useState<string>('Western Area Urban');
  const [repCondition, setRepCondition] = useState<string>('Malaria');
  const [repPeriodType, setRepPeriodType] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [repPeriodLabel, setRepPeriodLabel] = useState('2026-W47');
  const [repCases, setRepCases] = useState('120');
  const [repBaseline, setRepBaseline] = useState('75');
  const [repAbsenteeism, setRepAbsenteeism] = useState('6.5');
  const [repCoverage, setRepCoverage] = useState('70');
  const [repClimate, setRepClimate] = useState('Heavy seasonal rainfall');

  // Alert action modal state
  const [editingAlert, setEditingAlert] = useState<PublicHealthAlert | null>(null);
  const [nextStatus, setNextStatus] = useState<VerificationStatus>('Acknowledged');
  const [assignedOfficer, setAssignedOfficer] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const malariaThresh = settings?.malariaThresholdPct ?? 40;
  const respThresh = settings?.respiratoryThresholdPct ?? 35;
  const diarThresh = settings?.diarrhoealThresholdPct ?? 30;
  const absThresh = settings?.absenteeismThresholdPct ?? 8;
  const covMin = settings?.screeningCoverageMinPct ?? 60;

  const filteredSurveillance = surveillance.filter((s) => {
    if (selectedDistrict !== 'All' && s.district !== selectedDistrict) return false;
    if (selectedPeriod !== 'All' && s.periodType !== selectedPeriod) return false;
    return true;
  });

  const filteredAlerts = alerts.filter((a) => {
    if (selectedDistrict !== 'All' && a.district !== selectedDistrict) return false;
    return true;
  });

  const runThresholdAnomalyScan = async () => {
    setRunningScan(true);
    try {
      const now = new Date().toISOString();
      let generatedCount = 0;

      for (const rec of surveillance) {
        const baseline = rec.baselineCases || 0;
        const pctChange = baseline > 0 ? ((rec.reportedCases - baseline) / baseline) * 100 : 0;
        const abs = rec.workforceAbsenteeismPct ?? 0;
        const cov = rec.screeningCoveragePct ?? 100;

        let threshold = 35;
        if (rec.condition === 'Malaria') threshold = malariaThresh;
        else if (rec.condition === 'Respiratory Infections') threshold = respThresh;
        else if (rec.condition === 'Diarrhoeal Diseases') threshold = diarThresh;

        const isCaseSpike = pctChange >= threshold && rec.reportedCases >= 20;
        const isWorkforceSpike = abs >= absThresh;
        const isCoverageGap = cov < covMin;

        if (!isCaseSpike && !isWorkforceSpike && !isCoverageGap) continue;

        const existingSame = alerts.find(
          (a) =>
            a.district === rec.district &&
            a.condition === rec.condition &&
            a.verificationStatus !== 'Resolved' &&
            a.verificationStatus !== 'Dismissed'
        );
        if (existingSame) continue;

        let severity: AlertSeverity = 'Moderate';
        if (pctChange >= threshold * 2 || (isCaseSpike && isWorkforceSpike)) severity = 'Critical';
        else if (pctChange >= threshold * 1.4 || isCaseSpike) severity = 'High';
        else if (isCoverageGap) severity = 'Low';

        const triggers: string[] = [];
        if (isCaseSpike) triggers.push(`Cases +${pctChange.toFixed(1)}% vs baseline (threshold +${threshold}%)`);
        if (isWorkforceSpike) triggers.push(`Workforce absenteeism ${abs}% (threshold ${absThresh}%)`);
        if (isCoverageGap) triggers.push(`Screening coverage ${cov}% (floor ${covMin}%)`);

        const id = makeSafeId('alt');
        const newAlert: PublicHealthAlert = {
          id,
          referenceNumber: `PHEW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          condition: clampStr(rec.condition, 100),
          district: clampStr(rec.district, 80),
          community: clampStr(rec.facilityName || rec.district, 120),
          reportingFacilities: [clampStr(rec.facilityName || rec.facilityId, 120)],
          reportedCases: rec.reportedCases,
          baselineCases: rec.baselineCases,
          percentageChange: Number(pctChange.toFixed(1)),
          severity,
          verificationStatus: 'Pending Verification',
          triggerRule: clampStr(`${triggers.join(' · ')}. Algorithmic early-warning signal requiring field verification (not a confirmed outbreak).`, 300),
          recommendedResponse: clampStr(`Verify clinical register logs at ${rec.facilityName || rec.district}, check supply buffer, and initiate district health verification.`, 400),
          assignedOfficer: clampStr(user.displayName || user.email, 140),
          resolutionNotes: '',
          isAggregate: true,
          isSynthetic: Boolean(rec.isSynthetic),
          createdByUid: user.uid,
          createdAt: now,
          updatedAt: now,
        };

        await safeSetDoc('publicHealthAlerts', id, newAlert as unknown as Record<string, unknown>);
        generatedCount++;
      }

      await onLogAudit(
        'RUN_EARLY_WARNING_SCAN',
        'PublicHealthAlert',
        'engine',
        `Executed threshold anomaly scan across ${surveillance.length} records; generated ${generatedCount} new alerts.`
      );
      onToast(
        generatedCount > 0
          ? `Anomaly scan complete: ${generatedCount} new early warning alert(s) queued for verification.`
          : 'Anomaly scan complete: all threshold breaches already have active alerts.'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to complete threshold anomaly scan.');
    } finally {
      setRunningScan(false);
    }
  };

  const effectiveRepFacilityId = repFacilityId || facilities[0]?.id || user.facilityId;

  const handleSubmitSurveillance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fac = facilities.find((f) => f.id === effectiveRepFacilityId);
      const id = makeSafeId('srv');
      const now = new Date().toISOString();
      const record: SurveillanceRecord = {
        id,
        facilityId: effectiveRepFacilityId,
        facilityName: clampStr(fac?.name || user.facilityName || 'Hub Facility', 160),
        district: clampStr(repDistrict, 80),
        condition: clampStr(repCondition, 100),
        periodType: repPeriodType,
        periodLabel: clampStr(repPeriodLabel, 40),
        reportedCases: Math.max(0, Number(repCases) || 0),
        baselineCases: Math.max(0, Number(repBaseline) || 0),
        workforceAbsenteeismPct: Math.min(100, Math.max(0, Number(repAbsenteeism) || 0)),
        screeningCoveragePct: Math.min(100, Math.max(0, Number(repCoverage) || 0)),
        climateFactor: clampStr(repClimate, 120),
        isAggregate: true,
        isSynthetic: false,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };

      await safeSetDoc('surveillanceRecords', id, record as unknown as Record<string, unknown>);
      await onLogAudit('CREATE_SURVEILLANCE_REPORT', 'SurveillanceRecord', id, `${record.condition} in ${record.district}: ${record.reportedCases} cases.`);
      setShowReportForm(false);
      onToast('Surveillance aggregate saved. Run Anomaly Scan to evaluate thresholds.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save surveillance report.');
    }
  };

  const handleUpdateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlert) return;
    try {
      const now = new Date().toISOString();
      await safeUpdateDoc('publicHealthAlerts', editingAlert.id, {
        verificationStatus: nextStatus,
        assignedOfficer: clampStr(assignedOfficer || user.displayName, 140),
        resolutionNotes: clampStr(resolutionNotes, 400),
        updatedAt: now,
      });
      await onLogAudit(
        'UPDATE_ALERT_STATUS',
        'PublicHealthAlert',
        editingAlert.id,
        `Alert ${editingAlert.referenceNumber} changed to ${nextStatus}. Reason: ${resolutionNotes}`
      );
      setEditingAlert(null);
      onToast(`Alert ${editingAlert.referenceNumber} updated to ${nextStatus}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update public health alert.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Population & Workforce Health Early Warning Engine
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Explainable threshold-based surveillance across Sierra Leone. Algorithmic alerts highlight statistical deviations requiring public health verification and never constitute automated outbreak confirmation.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowReportForm(!showReportForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Submit Surveillance Report
          </button>
          <button
            type="button"
            disabled={runningScan}
            onClick={runThresholdAnomalyScan}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {runningScan ? 'Evaluating Rules...' : 'Run Threshold Scan'}
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCsv(
                'jaysaltech-surveillance-alerts.csv',
                filteredAlerts.map((a) => ({
                  Reference: a.referenceNumber,
                  Condition: a.condition,
                  District: a.district,
                  ReportedCases: a.reportedCases,
                  BaselineCases: a.baselineCases,
                  PercentChange: a.percentageChange ?? '',
                  Severity: a.severity,
                  Status: a.verificationStatus,
                  TriggerRule: a.triggerRule,
                  RecommendedResponse: a.recommendedResponse,
                  Officer: a.assignedOfficer ?? '',
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => (onOpenPrintPreview ? onOpenPrintPreview() : triggerPrintReport())}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* Surveillance Report Form */}
      {showReportForm && (
        <form onSubmit={handleSubmitSurveillance} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Submit De-Identified Facility Surveillance Aggregate</h3>
            <button type="button" onClick={() => setShowReportForm(false)} className="text-xs text-slate-500 hover:text-slate-800">
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reporting Facility</label>
              <select value={effectiveRepFacilityId} onChange={(e) => setRepFacilityId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
                {facilities.length === 0 && <option value={user.facilityId}>{user.facilityName || user.facilityId}</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
              <select value={repDistrict} onChange={(e) => setRepDistrict(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {SIERRA_LEONE_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Priority Indicator</label>
              <select value={repCondition} onChange={(e) => setRepCondition(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Period</label>
                <select value={repPeriodType} onChange={(e) => setRepPeriodType(e.target.value as 'Daily' | 'Weekly' | 'Monthly')} className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
                <input type="text" required value={repPeriodLabel} onChange={(e) => setRepPeriodLabel(e.target.value)} className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reported Cases</label>
              <input type="number" min={0} required value={repCases} onChange={(e) => setRepCases(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Comparison Baseline Cases</label>
              <input type="number" min={0} required value={repBaseline} onChange={(e) => setRepBaseline(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Workforce Absenteeism (%)</label>
              <input type="number" step="0.1" min={0} max={100} value={repAbsenteeism} onChange={(e) => setRepAbsenteeism(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Screening Coverage (%)</label>
              <input type="number" step="1" min={0} max={100} value={repCoverage} onChange={(e) => setRepCoverage(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">Environmental & Climate Context</label>
              <input type="text" value={repClimate} onChange={(e) => setRepClimate(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap">
              Save Surveillance Aggregate
            </button>
          </div>
        </form>
      )}

      {/* Map + Threshold Rules Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6">
          <SierraLeoneMap
            alerts={alerts}
            surveillance={surveillance}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={setSelectedDistrict}
          />
        </div>
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Configurable Anomaly Rules & Active Thresholds
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent, auditable triggers configured in Central Administration
            </p>
            <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Malaria Case Surge Trigger</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">+{malariaThresh}% over baseline</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Respiratory Illness Surge Trigger</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">+{respThresh}% over baseline</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Diarrhoeal Disease Surge Trigger</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">+{diarThresh}% over baseline</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Healthcare Workforce Absenteeism</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">&ge; {absThresh}% staff absence</span>
              </div>
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-700 font-medium">Community Screening Coverage Floor</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">&lt; {covMin}% target coverage</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Critical / High</div>
              <div className="text-lg font-bold font-mono tabular-nums text-red-700 mt-0.5">
                {filteredAlerts.filter((a) => a.severity === 'Critical' || a.severity === 'High').length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Pending Review</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-0.5">
                {filteredAlerts.filter((a) => a.verificationStatus === 'Pending Verification' || a.verificationStatus === 'Under Investigation').length}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-500">Verified / Resolved</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                {filteredAlerts.filter((a) => a.verificationStatus === 'Resolved').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="print-only px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
          Report Scope: {activeTab === 'alerts' ? 'Public Health Alerts' : activeTab === 'surveillance' ? 'Surveillance Logs' : 'Workforce & Climate Indicators'} · District: {selectedDistrict === 'All' ? 'All 16 Districts' : selectedDistrict} · Period: {selectedPeriod}
        </div>
        <div className="no-print px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {([
              ['alerts', `Public Health Alerts (${filteredAlerts.length})`],
              ['surveillance', `Surveillance Logs (${filteredSurveillance.length})`],
              ['workforce', 'Workforce & Climate Indicators'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="All">All 16 Districts</option>
              {SIERRA_LEONE_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as 'All' | 'Daily' | 'Weekly' | 'Monthly')}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="All">All Periods</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>

        {activeTab === 'alerts' && (
          <div className="divide-y divide-slate-100">
            {filteredAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No public health alerts match the current district filter.
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div key={alert.id} className="print-avoid-break p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-slate-50/70">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900">{alert.referenceNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${
                        alert.severity === 'Critical' ? 'text-red-700' :
                        alert.severity === 'High' ? 'text-orange-700' :
                        alert.severity === 'Moderate' ? 'text-amber-700' : 'text-teal-700'
                      }`}>
                        {alert.severity} Severity
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-800">{alert.verificationStatus}</span>
                      {alert.isSynthetic && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-500">Synthetic Data</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {alert.condition} — {alert.district} ({alert.community || 'District-wide'})
                    </h4>
                    <p className="text-xs text-slate-700">
                      <strong>Trigger & Data:</strong> {alert.triggerRule}
                    </p>
                    <p className="text-xs text-slate-600">
                      <strong>Cases vs. Baseline:</strong>{' '}
                      <span className="font-mono tabular-nums">
                        {alert.reportedCases} reported / {alert.baselineCases} baseline ({alert.percentageChange !== undefined ? `${alert.percentageChange >= 0 ? '+' : ''}${alert.percentageChange}%` : 'N/A'})
                      </span>{' '}
                      · <strong>Facilities:</strong> {(alert.reportingFacilities || []).join(', ') || 'District network'}
                    </p>
                    <p className="text-xs text-teal-800">
                      <strong>Recommended Verification Action:</strong> {alert.recommendedResponse}
                    </p>
                    {alert.resolutionNotes && (
                      <p className="text-xs text-slate-500">
                        <strong>Officer Notes ({alert.assignedOfficer || 'Surveillance Desk'}):</strong> {alert.resolutionNotes}
                      </p>
                    )}
                  </div>

                  <div className="no-print flex items-center gap-2 shrink-0">
                    {canVerifyAlerts ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAlert(alert);
                          setNextStatus(alert.verificationStatus);
                          setAssignedOfficer(alert.assignedOfficer || user.displayName);
                          setResolutionNotes(alert.resolutionNotes || '');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
                      >
                        Review & Update Status
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">View-only (Public Health Officer required)</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'surveillance' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Period</th>
                  <th className="py-2.5 px-4 font-semibold">District</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Indicator</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Reported</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Baseline</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSurveillance.map((rec) => {
                  const delta = rec.baselineCases > 0 ? ((rec.reportedCases - rec.baselineCases) / rec.baselineCases) * 100 : 0;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{rec.periodType} · {rec.periodLabel}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{rec.district}</td>
                      <td className="py-2.5 px-4 text-slate-600">{rec.facilityName || rec.facilityId}</td>
                      <td className="py-2.5 px-4 text-slate-800">{rec.condition}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">{rec.reportedCases}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">{rec.baselineCases}</td>
                      <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${delta >= 35 ? 'text-red-700' : 'text-teal-700'}`}>
                        {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'workforce' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">District</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Staff Absenteeism</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Screening Coverage</th>
                  <th className="py-2.5 px-4 font-semibold">Environmental & Climate Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSurveillance.map((rec) => {
                  const abs = rec.workforceAbsenteeismPct ?? 0;
                  const cov = rec.screeningCoveragePct ?? 0;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{rec.district}</td>
                      <td className="py-2.5 px-4 text-slate-600">{rec.facilityName || rec.facilityId}</td>
                      <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${abs >= absThresh ? 'text-red-700' : 'text-slate-800'}`}>
                        {abs.toFixed(1)}% {abs >= absThresh ? '(Elevated)' : ''}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${cov < covMin ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {cov.toFixed(0)}% {cov < covMin ? '(Below Floor)' : ''}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{rec.climateFactor || 'Nominal seasonal conditions'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification Action Modal */}
      {editingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateAlert} className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start gap-2.5">
              {nextStatus === 'Resolved' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Verify Alert {editingAlert.referenceNumber}
                </h3>
                <p className="text-xs text-slate-600">
                  {editingAlert.condition} · {editingAlert.district}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Verification Status</label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as VerificationStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Pending Verification">Pending Verification</option>
                <option value="Acknowledged">Acknowledged</option>
                <option value="Under Investigation">Under Investigation</option>
                <option value="Escalated">Escalated</option>
                <option value="Resolved">Resolved</option>
                <option value="Dismissed">Dismissed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Responsible Public Health Officer</label>
              <input
                type="text"
                required
                value={assignedOfficer}
                onChange={(e) => setAssignedOfficer(e.target.value)}
                maxLength={140}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Recorded Verification / Investigation Reason</label>
              <textarea
                rows={3}
                required
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Document field investigation findings, verification against facility logs, or rationale for dismissal/resolution..."
                maxLength={400}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => setEditingAlert(null)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
                Save Verification Update
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
