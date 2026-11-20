import React, { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Building2, Sliders, FileText, CheckCircle2, Download, Copy, UserCheck, XCircle, Edit3, KeyRound } from 'lucide-react';
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
import { safeDeleteDoc, safeSetDoc, safeUpdateDoc } from '../../lib/firebase';
import { downloadSystemDocumentationPdf } from '../../lib/pdfDocumentation';
import { ConfirmDeleteButton } from '../ConfirmDeleteButton';
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
  canAdminManageRecords?: boolean;
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
  canAdminManageRecords = false,
  onLogAudit,
  onToast,
}) => {
  const isSuperAdmin = user.role === 'Super Administrator';
  const pendingStaff = staffUsers.filter((s) => s.status === 'Pending');
  const [tab, setTab] = useState<'facilities' | 'staff' | 'settings' | 'audit' | 'docs'>(
    !canManageFacilities && canManageUsers ? 'staff' : 'facilities'
  );
  const assignableRoles = isSuperAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => r !== 'Super Administrator');

  // Facility Form
  const [showFacForm, setShowFacForm] = useState(false);
  const [editingFac, setEditingFac] = useState<Facility | null>(null);
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

  const openNewFacility = () => {
    setEditingFac(null);
    setFacName('');
    setFacCode('');
    setFacType('Regional Hospital');
    setFacDistrict('Bo');
    setFacBeds('120');
    setFacDepts('Outpatient, Maternity, Laboratory, Pharmacy');
    setShowFacForm(!showFacForm);
  };

  const openEditFacility = (f: Facility) => {
    setEditingFac(f);
    setFacName(f.name);
    setFacCode(f.code);
    setFacType(f.type);
    setFacDistrict(f.district);
    setFacBeds(String(f.bedCapacity));
    setFacDepts(f.departments.join(', '));
    setShowFacForm(true);
  };

  const handleRegisterFacility = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const depts = facDepts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 25);

      if (editingFac) {
        await safeUpdateDoc('facilities', editingFac.id, {
          name: clampStr(facName, 160),
          code: clampStr(facCode || editingFac.code, 40),
          type: clampStr(facType, 60),
          district: clampStr(facDistrict, 80),
          bedCapacity: Math.max(0, Number(facBeds) || 0),
          departments: depts.length ? depts : ['Outpatient'],
          updatedAt: now,
        });
        await onLogAudit('UPDATE_FACILITY', 'Facility', editingFac.id, `Updated facility ${facName} (${facCode})`);
        setEditingFac(null);
        setShowFacForm(false);
        onToast(`Facility ${facName} updated.`);
        return;
      }

      const id = makeSafeId('fac');
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
      onToast(err instanceof Error ? err.message : 'Unable to save facility.');
    }
  };

  const handleDeleteFacility = async (fac: Facility) => {
    try {
      await safeDeleteDoc('facilities', fac.id);
      await onLogAudit('DELETE_FACILITY', 'Facility', fac.id, `Deleted facility ${fac.name} (${fac.code})`);
      onToast(`Facility ${fac.name} deleted.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete facility.');
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
      const actionName =
        target.status === 'Pending' && nextStatus === 'Active'
          ? 'APPROVE_STAFF_USER'
          : 'UPDATE_USER_STATUS';
      await onLogAudit(
        actionName,
        'UserProfile',
        target.uid,
        `Updated ${target.email} (${target.facilityName || target.facilityId}) status from ${target.status} to ${nextStatus}`
      );
      onToast(
        nextStatus === 'Active' && target.status === 'Pending'
          ? `Approved ${target.displayName} for ${target.facilityName || target.facilityId}.`
          : `${target.displayName} status updated to ${nextStatus}.`
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to update staff status.');
    }
  };

  const handleDeleteStaffUser = async (target: UserProfile) => {
    try {
      await safeDeleteDoc('users', target.uid);
      await onLogAudit(
        'DELETE_STAFF_USER',
        'UserProfile',
        target.uid,
        `Deleted user profile ${target.email} (${target.role})`
      );
      onToast(`Removed user profile for ${target.displayName}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to delete user profile.');
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
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Central Administration, RBAC & System Documentation</h2>
          <p className="text-xs text-slate-600 mt-1">
            Multi-hospital onboarding, 10-role access control, full CRUD governance, configurable surveillance thresholds, immutable audit logs, and official PDF documentation.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadSystemDocumentationPdf({ user, facilities, settings });
              onToast('Generated and downloaded JaysalTech_Central_Hospital_Hub_Documentation.pdf');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF Docs
          </button>
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {([
              ['facilities', 'Hospitals', Building2],
              ['staff', pendingStaff.length > 0 ? `Users & RBAC (${pendingStaff.length} Pending)` : 'Users & RBAC', ShieldCheck],
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
      </div>

      {tab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={openNewFacility} className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800">
              <Plus className="w-3.5 h-3.5" /> Register Hospital / Clinic
            </button>
          </div>

          {showFacForm && (
            <form onSubmit={handleRegisterFacility} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-3 flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingFac ? `Edit Hospital · ${editingFac.name}` : 'Register New Hospital / Healthcare Facility'}
                </h3>
                <button type="button" onClick={() => { setShowFacForm(false); setEditingFac(null); }} className="text-xs text-slate-500">Close</button>
              </div>
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
              <div className="sm:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowFacForm(false); setEditingFac(null); }} className="px-3 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg">
                  {editingFac ? 'Save Facility Changes' : 'Submit Facility Registration'}
                </button>
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
                  <th className="no-print py-2.5 px-4 font-semibold text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities.map((f) => {
                  const canEditFac = isSuperAdmin || (canManageFacilities && f.id === user.facilityId);
                  return (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-700">{f.code}</td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{f.name}</div>
                        <div className="text-[11px] text-slate-500">{f.type} · {f.bedCapacity} beds · <span className="font-mono">{f.id}</span></div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{f.district}</td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs">{f.departments.join(' · ')}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{f.status}</td>
                      <td className="no-print py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canEditFac && (
                            <button type="button" onClick={() => openEditFacility(f)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100">
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {isSuperAdmin && f.status !== 'Approved' && (
                            <button type="button" onClick={() => handleFacilityStatus(f, 'Approved')} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                          )}
                          {isSuperAdmin && f.status === 'Approved' && (
                            <button type="button" onClick={() => handleFacilityStatus(f, 'Suspended')} className="px-2 py-1 border border-slate-300 rounded text-slate-700 text-[11px]">
                              Suspend
                            </button>
                          )}
                          {isSuperAdmin && (
                            <ConfirmDeleteButton compact onConfirm={() => handleDeleteFacility(f)} title={`Delete ${f.name}`} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="space-y-4">
          {canManageUsers && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pending Hospital Administration Approvals ({pendingStaff.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isSuperAdmin
                      ? 'Every newly registered staff member requires approval before accessing clinical or operational data.'
                      : `Showing pending staff registrations assigned to ${user.facilityName || user.facilityId}.`}
                  </p>
                </div>
              </div>

              {pendingStaff.length === 0 ? (
                <div className="px-5 py-4 text-xs text-slate-500">
                  No staff accounts are currently awaiting hospital administration approval.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {pendingStaff.map((s) => (
                    <div
                      key={s.uid}
                      className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-amber-50/40"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-slate-900">
                          {s.displayName} <span className="font-normal text-slate-500">· {s.email}</span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Hospital: <span className="font-semibold text-slate-800">{s.facilityName || s.facilityId}</span>
                          {' · '}Requested Role: <span className="font-semibold text-slate-800">{s.role}</span>
                          {s.department ? ` · ${s.department}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select
                          aria-label={`Assign role for ${s.displayName}`}
                          value={s.role}
                          onChange={(e) => handleRoleUpdate(s, e.target.value as UserRole)}
                          className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleStaffStatusUpdate(s, 'Active')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve Access</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStaffStatusUpdate(s, 'Suspended')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <div className="px-5 py-3 border-b border-slate-200 text-xs text-slate-600">
              {isSuperAdmin
                ? 'Authenticated Platform Staff & 10-Role Access Control Matrix'
                : `Hospital Staff Directory — ${user.facilityName || user.facilityId}`}
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                  <th className="py-2.5 px-4 font-semibold">Facility</th>
                  <th className="py-2.5 px-4 font-semibold">Current Role</th>
                  <th className="py-2.5 px-4 font-semibold">Approval Status</th>
                  <th className="no-print py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffUsers.map((s) => {
                  const canEditTarget =
                    canManageUsers &&
                    (isSuperAdmin || s.role !== 'Super Administrator');
                  const canDeleteTarget =
                    canAdminManageRecords &&
                    s.uid !== user.uid &&
                    s.email !== 'jaahwix@gmail.com' &&
                    (isSuperAdmin || (s.facilityId === user.facilityId && s.role !== 'Super Administrator'));
                  return (
                    <tr key={s.uid}>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{s.displayName}</div>
                        <div className="text-slate-500">{s.email}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {isSuperAdmin && facilities.length > 0 ? (
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
                        {canEditTarget ? (
                          <select
                            value={s.role}
                            onChange={(e) => handleRoleUpdate(s, e.target.value as UserRole)}
                            className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs"
                          >
                            {assignableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span className="font-medium text-slate-800">{s.role}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {canEditTarget ? (
                          <select
                            value={s.status}
                            onChange={(e) => handleStaffStatusUpdate(s, e.target.value as UserProfile['status'])}
                            className={`px-2.5 py-1 border border-slate-300 rounded bg-white text-xs font-medium ${
                              s.status === 'Active' ? 'text-emerald-700' : s.status === 'Suspended' ? 'text-red-700' : 'text-amber-700'
                            }`}
                          >
                            <option value="Active">Active (Approved)</option>
                            <option value="Pending">Pending Approval</option>
                            <option value="Suspended">Suspended</option>
                          </select>
                        ) : (
                          <span className="text-emerald-700 font-medium">{s.status}</span>
                        )}
                      </td>
                      <td className="no-print py-2.5 px-4 text-right whitespace-nowrap">
                        {canDeleteTarget ? (
                          <ConfirmDeleteButton
                            compact
                            onConfirm={() => handleDeleteStaffUser(s)}
                            title={`Delete staff account ${s.displayName}`}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                onClick={() => {
                  downloadSystemDocumentationPdf({ user, facilities, settings });
                  onToast('Downloaded official PDF System Documentation.');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF Documentation
              </button>
              <button
                type="button"
                onClick={() => downloadTextFile('PLATFORM_DOCUMENTATION.md', platformDocsMd, 'text/markdown')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" /> Download Markdown
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <KeyRound className="w-4 h-4 text-teal-700" />
              Hospital Admin Password & Credential Provisioning Playbook
            </div>
            <p className="text-xs text-slate-600">
              Passwords are never hardcoded in source files; Firebase Authentication (<code className="font-mono bg-white px-1 py-0.5 border border-slate-200 rounded">wise-lamp-h3bk6</code>) hashes and stores all credentials securely. The master Super Administrator across all hospitals is <strong className="font-mono text-slate-900">jaahwix@gmail.com</strong> (Google Sign-In). To create or reset a Hospital Administrator password for any facility, use <strong>Register Staff Account</strong> on the login screen (selecting role <em>Hospital Administrator</em>, then approve under <em>Users & RBAC</em>) or add/reset the user in <strong>Firebase Console → Authentication → Users</strong>:
            </p>
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Code</th>
                    <th className="py-2 px-3 font-semibold">Facility ID</th>
                    <th className="py-2 px-3 font-semibold">Hospital Name</th>
                    <th className="py-2 px-3 font-semibold">Recommended Admin Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr><td className="py-2 px-3">SL-WAU-001</td><td className="py-2 px-3">fac_connaught_sl</td><td className="py-2 px-3 font-sans">Connaught National Referral Hospital</td><td className="py-2 px-3 text-teal-800">admin.connaught@jaysaltech.sl</td></tr>
                  <tr><td className="py-2 px-3">SL-BO-002</td><td className="py-2 px-3">fac_bo_gov</td><td className="py-2 px-3 font-sans">Bo Government Regional Hospital</td><td className="py-2 px-3 text-teal-800">admin.bo@jaysaltech.sl</td></tr>
                  <tr><td className="py-2 px-3">SL-KEN-003</td><td className="py-2 px-3">fac_kenema_gov</td><td className="py-2 px-3 font-sans">Kenema Government Hospital</td><td className="py-2 px-3 text-teal-800">admin.kenema@jaysaltech.sl</td></tr>
                  <tr><td className="py-2 px-3">SL-BOM-004</td><td className="py-2 px-3">fac_makeni_reg</td><td className="py-2 px-3 font-sans">Makeni Regional Hospital</td><td className="py-2 px-3 text-teal-800">admin.makeni@jaysaltech.sl</td></tr>
                  <tr><td className="py-2 px-3">SL-PLK-005</td><td className="py-2 px-3">fac_portloko_chc</td><td className="py-2 px-3 font-sans">Port Loko District Diagnostic & Health Centre</td><td className="py-2 px-3 text-teal-800">admin.portloko@jaysaltech.sl</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 space-y-1.5">
              <h4 className="font-semibold text-slate-900">Active Runtime Persistence & Auth</h4>
              <p>Connected live to Firebase Firestore (Enterprise database) & Google OAuth via Firebase Authentication with email verification, RBAC role checks, and facility-level PII isolation (`authorizedUids` + Super/Hospital Admin authority).</p>
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
