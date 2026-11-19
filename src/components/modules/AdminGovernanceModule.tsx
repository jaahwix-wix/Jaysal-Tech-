import React, { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Building2, Sliders, FileText, CheckCircle2, Download, Copy } from 'lucide-react';
import {
  SIERRA_LEONE_DISTRICTS,
  USER_ROLES,
  clampStr,
  makeSafeId,
  type AuditLog,
  type Facility,
  type PlatformSettings,
  type UserProfile,
  type UserRole,
} from '../../types/hub';
import { safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import initialSqlSchema from '../../../supabase/migrations/001_initial_schema.sql?raw';
import platformDocsMd from '../../../docs/PLATFORM_DOCUMENTATION.md?raw';

interface Props {
  user: UserProfile;
  facilities: Facility[];
  staffUsers: UserProfile[];
  settings: PlatformSettings | null;
  auditLogs: AuditLog[];
  canManageFacilities: boolean;
  canManageUsers: boolean;
  onLogAudit: (action: string, resourceType: string, resourceId: string, details: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export const AdminGovernanceModule: React.FC<Props> = ({
  user,
  facilities,
  staffUsers,
  settings,
  auditLogs,
  canManageFacilities,
  canManageUsers,
  onLogAudit,
  onToast,
}) => {
  const [tab, setTab] = useState<'facilities' | 'staff' | 'settings' | 'audit' | 'docs'>('facilities');

  // Facility Form
  const [showFacForm, setShowFacForm] = useState(false);
  const [facName, setFacName] = useState('');
  const [facCode, setFacCode] = useState('');
  const [facType, setFacType] = useState('Regional Hospital');
  const [facDistrict, setFacDistrict] = useState<string>('Bo');
  const [facBeds, setFacBeds] = useState('120');
  const [facDepts, setFacDepts] = useState('Outpatient, Maternity, Laboratory, Pharmacy');

  // Settings Form
  const [malariaT, setMalariaT] = useState(String(settings?.malariaThresholdPct ?? 40));
  const [respT, setRespT] = useState(String(settings?.respiratoryThresholdPct ?? 35));
  const [diarT, setDiarT] = useState(String(settings?.diarrhoealThresholdPct ?? 30));
  const [absT, setAbsT] = useState(String(settings?.absenteeismThresholdPct ?? 8));
  const [covT, setCovT] = useState(String(settings?.screeningCoverageMinPct ?? 60));
  const [timeoutMin, setTimeoutMin] = useState(String(settings?.sessionTimeoutMinutes ?? 30));
  const [docPreview, setDocPreview] = useState<'none' | 'sql' | 'docs'>('none');

  useEffect(() => {
    if (!settings) return;
    setMalariaT(String(settings.malariaThresholdPct));
    setRespT(String(settings.respiratoryThresholdPct));
    setDiarT(String(settings.diarrhoealThresholdPct));
    setAbsT(String(settings.absenteeismThresholdPct));
    setCovT(String(settings.screeningCoverageMinPct));
    setTimeoutMin(String(settings.sessionTimeoutMinutes));
  }, [settings]);

  const downloadTextFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRegisterFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = makeSafeId('fac');
      const now = new Date().toISOString();
      const depts = facDepts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 25);
      const fac: Facility = {
        id,
        name: clampStr(facName, 160),
        code: clampStr(facCode || `SL-${Date.now().toString().slice(-4)}`, 40),
        type: clampStr(facType, 60),
        district: clampStr(facDistrict, 80),
        chiefdom: '',
        address: '',
        phone: '',
        status: canManageFacilities ? 'Approved' : 'Pending',
        bedCapacity: Math.max(0, Number(facBeds) || 0),
        departments: depts.length ? depts : ['Outpatient'],
        isSynthetic: false,
        createdByUid: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      await safeSetDoc('facilities', id, fac as unknown as Record<string, unknown>);
      await onLogAudit('REGISTER_FACILITY', 'Facility', id, `Registered facility ${fac.name} (${fac.code})`);
      setShowFacForm(false);
      setFacName('');
      setFacCode('');
      onToast(`Facility ${fac.name} registered.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to register facility.');
    }
  };

  const handleFacilityStatus = async (fac: Facility, status: Facility['status']) => {
    try {
      await safeUpdateDoc('facilities', fac.id, {
        status,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_FACILITY_STATUS', 'Facility', fac.id, `Changed ${fac.name} status to ${status}`);
      onToast(`Facility status updated to ${status}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update facility status.');
    }
  };

  const handleRoleUpdate = async (target: UserProfile, nextRole: UserRole) => {
    try {
      await safeUpdateDoc('users', target.uid, {
        role: nextRole,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_USER_ROLE', 'UserProfile', target.uid, `Updated ${target.email} role to ${nextRole}`);
      onToast(`Assigned ${nextRole} to ${target.displayName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update staff role.');
    }
  };

  const handleStaffFacilityUpdate = async (target: UserProfile, nextFacilityId: string) => {
    try {
      const fac = facilities.find((f) => f.id === nextFacilityId);
      await safeUpdateDoc('users', target.uid, {
        facilityId: nextFacilityId,
        facilityName: clampStr(fac?.name || nextFacilityId, 160),
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_USER_FACILITY', 'UserProfile', target.uid, `Assigned ${target.email} to ${fac?.name || nextFacilityId}`);
      onToast(`Updated facility assignment for ${target.displayName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update staff facility.');
    }
  };

  const handleStaffStatusUpdate = async (target: UserProfile, nextStatus: UserProfile['status']) => {
    try {
      await safeUpdateDoc('users', target.uid, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      await onLogAudit('UPDATE_USER_STATUS', 'UserProfile', target.uid, `Updated ${target.email} status to ${nextStatus}`);
      onToast(`${target.displayName} status updated to ${nextStatus}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update staff status.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: PlatformSettings = {
        id: 'global',
        malariaThresholdPct: Math.min(500, Math.max(5, Number(malariaT) || 40)),
        respiratoryThresholdPct: Math.min(500, Math.max(5, Number(respT) || 35)),
        diarrhoealThresholdPct: Math.min(500, Math.max(5, Number(diarT) || 30)),
        absenteeismThresholdPct: Math.min(100, Math.max(1, Number(absT) || 8)),
        screeningCoverageMinPct: Math.min(100, Math.max(5, Number(covT) || 60)),
        sessionTimeoutMinutes: Math.min(480, Math.max(5, Number(timeoutMin) || 30)),
        backupSchedule: 'Daily 02:00 UTC Automated Point-in-Time Snapshot',
        updatedByUid: user.uid,
        updatedAt: now,
      };
      await safeSetDoc('platformSettings', 'global', payload as unknown as Record<string, unknown>);
      await onLogAudit('UPDATE_PLATFORM_SETTINGS', 'PlatformSettings', 'global', 'Updated Early Warning thresholds & session security settings.');
      onToast('Platform surveillance and security settings saved.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save platform settings.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Central Administration, RBAC & System Documentation</h2>
          <p className="text-xs text-slate-600 mt-1">
            Multi-hospital onboarding, 10-role access control, configurable surveillance thresholds, immutable audit logs, and PostgreSQL / deployment architecture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            ['facilities', 'Hospitals', Building2],
            ['staff', 'Users & RBAC', ShieldCheck],
            ['settings', 'Thresholds', Sliders],
            ['audit', 'Audit Logs', FileText],
            ['docs', 'SQL & Docs', FileText],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowFacForm(!showFacForm)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
              <Plus className="w-3.5 h-3.5" /> Register Hospital / Clinic
            </button>
          </div>

          {showFacForm && (
            <form onSubmit={handleRegisterFacility} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Facility Name</label>
                <input type="text" required value={facName} onChange={(e) => setFacName(e.target.value)} placeholder="e.g., Kailahun District Hospital" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Facility Code</label>
                <input type="text" required value={facCode} onChange={(e) => setFacCode(e.target.value)} placeholder="SL-KAI-006" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Facility Type</label>
                <select value={facType} onChange={(e) => setFacType(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                  <option value="Tertiary Referral Hospital">Tertiary Referral Hospital</option>
                  <option value="Regional Hospital">Regional Hospital</option>
                  <option value="District Clinic">District Clinic</option>
                  <option value="Diagnostic Centre">Diagnostic Centre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">District</label>
                <select value={facDistrict} onChange={(e) => setFacDistrict(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                  {SIERRA_LEONE_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bed Capacity</label>
                <input type="number" min={0} required value={facBeds} onChange={(e) => setFacBeds(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Departments (comma-separated)</label>
                <input type="text" value={facDepts} onChange={(e) => setFacDepts(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg" />
              </div>
              <div className="sm:col-span-3 flex justify-end">
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">Submit Facility Registration</button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Code</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">District</th>
                  <th className="py-2.5 px-4 font-semibold">Departments</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-700">{f.code}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{f.name}</div>
                      <div className="text-[11px] text-slate-500">{f.type} · {f.bedCapacity} beds</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{f.district}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs">{f.departments.join(' · ')}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{f.status}</td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      {canManageFacilities && f.status !== 'Approved' && (
                        <button type="button" onClick={() => handleFacilityStatus(f, 'Approved')} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white rounded">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {canManageFacilities && f.status === 'Approved' && (
                        <button type="button" onClick={() => handleFacilityStatus(f, 'Suspended')} className="px-2.5 py-1 border border-slate-300 rounded text-slate-700">
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="px-5 py-3 border-b border-slate-200 text-xs text-slate-600">
            Authenticated Platform Staff & 10-Role Access Control Matrix
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                <th className="py-2.5 px-4 font-semibold">Facility</th>
                <th className="py-2.5 px-4 font-semibold">Current Role</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffUsers.map((s) => (
                <tr key={s.uid}>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900">{s.displayName}</div>
                    <div className="text-slate-500">{s.email}</div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">
                    {canManageUsers && facilities.length > 0 ? (
                      <select
                        value={s.facilityId}
                        onChange={(e) => handleStaffFacilityUpdate(s, e.target.value)}
                        className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs max-w-[220px]"
                      >
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{s.facilityName || s.facilityId}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {canManageUsers ? (
                      <select
                        value={s.role}
                        onChange={(e) => handleRoleUpdate(s, e.target.value as UserRole)}
                        className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs"
                      >
                        {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className="font-medium text-slate-800">{s.role}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {canManageUsers ? (
                      <select
                        value={s.status}
                        onChange={(e) => handleStaffStatusUpdate(s, e.target.value as UserProfile['status'])}
                        className={`px-2.5 py-1 border border-slate-300 rounded bg-white text-xs font-medium ${
                          s.status === 'Active' ? 'text-emerald-700' : s.status === 'Suspended' ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    ) : (
                      <span className="text-emerald-700 font-medium">{s.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 max-w-2xl">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Early Warning Thresholds & Security Policy</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure statistical trigger percentages and session inactivity limits.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Malaria Spike Threshold (%)</label>
              <input type="number" min={5} max={500} value={malariaT} onChange={(e) => setMalariaT(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Respiratory Surge Threshold (%)</label>
              <input type="number" min={5} max={500} value={respT} onChange={(e) => setRespT(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Diarrhoeal Surge Threshold (%)</label>
              <input type="number" min={5} max={500} value={diarT} onChange={(e) => setDiarT(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Workforce Absenteeism Threshold (%)</label>
              <input type="number" min={1} max={100} value={absT} onChange={(e) => setAbsT(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Screening Coverage Floor (%)</label>
              <input type="number" min={5} max={100} value={covT} onChange={(e) => setCovT(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Automatic Session Timeout (mins)</label>
              <input type="number" min={5} max={480} value={timeoutMin} onChange={(e) => setTimeoutMin(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono" />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
            Save Platform Configuration
          </button>
        </form>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                <th className="py-2.5 px-4 font-semibold">Actor & Role</th>
                <th className="py-2.5 px-4 font-semibold">Action</th>
                <th className="py-2.5 px-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 40).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">{log.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{log.actorEmail}</div>
                    <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-teal-800">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-700">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'docs' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Architecture, PostgreSQL/Supabase Migration & Deployment Reference</h3>
              <p className="mt-1">
                Full deliverables are stored in the project repository under <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">/supabase/migrations/001_initial_schema.sql</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">/docs/PLATFORM_DOCUMENTATION.md</code>, <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">/firebase-blueprint.json</code>, and <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">/firestore.rules</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDocPreview(docPreview === 'sql' ? 'none' : 'sql')}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {docPreview === 'sql' ? 'Hide SQL Preview' : 'Preview SQL Schema'}
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile('001_initial_schema.sql', initialSqlSchema, 'text/sql')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800"
              >
                <Download className="w-3.5 h-3.5" /> Download SQL
              </button>
              <button
                type="button"
                onClick={() => setDocPreview(docPreview === 'docs' ? 'none' : 'docs')}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {docPreview === 'docs' ? 'Hide Docs Preview' : 'Preview Platform Docs'}
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile('PLATFORM_DOCUMENTATION.md', platformDocsMd, 'text/markdown')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" /> Download Docs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <h4 className="font-semibold text-slate-900">Active Runtime Persistence & Auth</h4>
              <p>Connected live to Firebase Firestore (Enterprise database) & Google OAuth via Firebase Authentication with email verification, RBAC role checks, and facility-level PII isolation (`authorizedUids` + Super Admin override).</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <h4 className="font-semibold text-slate-900">PostgreSQL / Supabase Migration Readiness</h4>
              <p>Complete normalized DDL (`001_initial_schema.sql`) with B-tree indexes, foreign key constraints, and PostgreSQL Row Level Security (RLS) policies ready for Supabase or Cloud SQL PostgreSQL deployment.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <h4 className="font-semibold text-slate-900">Compliance & Privacy Safeguards</h4>
              <p>Synthetic records are explicitly labeled (`isSynthetic: true`). Automated alerts include explicit verification disclaimers. Audit logs are append-only and immutable. Designed to support Sierra Leone data protection & HIPAA controls pending formal pre-production compliance audit.</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <h4 className="font-semibold text-slate-900">10-Role RBAC Verification</h4>
              <p>Super Administrators may switch the active workspace view using the Role Simulator in the top bar to verify permission scoping across all 10 clinical, diagnostic, finance, and public health roles.</p>
            </div>
          </div>

          {docPreview !== 'none' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-mono font-semibold text-slate-800">
                  {docPreview === 'sql' ? '/supabase/migrations/001_initial_schema.sql' : '/docs/PLATFORM_DOCUMENTATION.md'}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(docPreview === 'sql' ? initialSqlSchema : platformDocsMd);
                    onToast('Copied document contents to clipboard.');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 p-4 overflow-x-auto max-h-96">
                {docPreview === 'sql' ? initialSqlSchema : platformDocsMd}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
