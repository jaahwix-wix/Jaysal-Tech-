/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Building2,
  CreditCard,
  Droplet,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Search,
  Stethoscope,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  ROLE_PERMISSION_MATRIX,
  USER_ROLES,
  clampStr,
  makeSafeId,
  type AuditLog,
  type BloodDonor,
  type BloodUnit,
  type Encounter,
  type Facility,
  type FollowUpTask,
  type InsuranceClaim,
  type LabOrder,
  type Medicine,
  type ModuleKey,
  type Patient,
  type PlatformSettings,
  type Prescription,
  type PublicHealthAlert,
  type Referral,
  type ScreeningCampaign,
  type ScreeningRecord,
  type SurveillanceRecord,
  type TelemedicineAppointment,
  type UserProfile,
  type UserRole,
} from './types/hub';
import {
  OperationType,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  safeSetDoc,
  testConnection,
} from './lib/firebase';
import { seedSyntheticSierraLeoneDataset } from './lib/seedData';
import { OverviewDashboard } from './components/modules/OverviewDashboard';
import { PopulationHealthModule } from './components/modules/PopulationHealthModule';
import { ScreeningCareLoopModule } from './components/modules/ScreeningCareLoopModule';
import { PatientsClinicalModule } from './components/modules/PatientsClinicalModule';
import { DiagnosticsOperationsModule } from './components/modules/DiagnosticsOperationsModule';
import { FinanceTelemedicineNhieModule } from './components/modules/FinanceTelemedicineNhieModule';
import { AdminGovernanceModule } from './components/modules/AdminGovernanceModule';

const NAV_ITEMS: { key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { key: 'population-health', label: 'Early Warning Engine', icon: Activity },
  { key: 'screening-loop', label: 'Screening-to-Care Loop', icon: GitBranch },
  { key: 'patients', label: 'Patient Registry', icon: Users },
  { key: 'clinical', label: 'Clinical & Encounters', icon: Stethoscope },
  { key: 'laboratory', label: 'Laboratory', icon: FlaskConical },
  { key: 'pharmacy', label: 'Pharmacy & Stock', icon: Pill },
  { key: 'blood-bank', label: 'Blood Bank', icon: Droplet },
  { key: 'insurance', label: 'Insurance & Claims', icon: CreditCard },
  { key: 'telemedicine', label: 'Telemedicine', icon: Video },
  { key: 'nhie-analytics', label: 'NHIE & Analytics', icon: ArrowLeftRight },
  { key: 'admin-docs', label: 'Central Admin & Docs', icon: Building2 },
];

const BOOTSTRAPPED_ADMIN_EMAIL = 'jaahwix@gmail.com';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [activeModule, setActiveModule] = useState<ModuleKey>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [seeding, setSeeding] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const notifContainerRef = useRef<HTMLDivElement | null>(null);

  // Live Firestore collection states
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [staffUsers, setStaffUsers] = useState<UserProfile[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [campaigns, setCampaigns] = useState<ScreeningCampaign[]>([]);
  const [screenings, setScreenings] = useState<ScreeningRecord[]>([]);
  const [followUpTasks, setFollowUpTasks] = useState<FollowUpTask[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bloodDonors, setBloodDonors] = useState<BloodDonor[]>([]);
  const [bloodUnits, setBloodUnits] = useState<BloodUnit[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [telemedicine, setTelemedicine] = useState<TelemedicineAppointment[]>([]);
  const [surveillance, setSurveillance] = useState<SurveillanceRecord[]>([]);
  const [alerts, setAlerts] = useState<PublicHealthAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4500);
  };

  // Boot connection check
  useEffect(() => {
    testConnection();
  }, []);

  // Dismiss header popovers on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifications(false);
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Firebase Auth listener & UserProfile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        const now = new Date().toISOString();

        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          const isBootAdmin = fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL;
          const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: clampStr(fbUser.email || 'user@jaysaltech.sl', 200),
            displayName: clampStr(fbUser.displayName || fbUser.email?.split('@')[0] || 'Clinician', 120),
            role: isBootAdmin ? 'Super Administrator' : 'Medical Doctor',
            facilityId: 'fac_connaught_sl',
            facilityName: 'Connaught National Referral Hospital',
            department: isBootAdmin ? 'Central Platform Governance' : 'Clinical Operations',
            status: 'Active',
            createdAt: now,
            updatedAt: now,
          };
          await safeSetDoc('users', fbUser.uid, newProfile as unknown as Record<string, unknown>);
          setUserProfile(newProfile);
        }
      } catch (err) {
        console.error('Error synchronizing user profile:', err);
        setAuthError('Unable to initialize user profile. Verify account permissions.');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Session inactivity auto-expiry
  useEffect(() => {
    if (!firebaseUser) return;
    const timeoutMs = (settings?.sessionTimeoutMinutes || 30) * 60 * 1000;
    let timer = window.setTimeout(() => {
      signOut(auth);
    }, timeoutMs);

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        signOut(auth);
      }, timeoutMs);
    };

    window.addEventListener('mousemove', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [firebaseUser, settings?.sessionTimeoutMinutes]);

  // Real-time Firestore listeners (only after authReady + signed-in userProfile)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;

    const isSuper =
      firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL ||
      userProfile.role === 'Super Administrator';

    const piiQuery = (colName: string): Query<DocumentData> =>
      isSuper
        ? collection(db, colName)
        : query(collection(db, colName), where('authorizedUids', 'array-contains', firebaseUser.uid));

    const subscribe = <T,>(
      colName: string,
      q: Query<DocumentData>,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) =>
      onSnapshot(
        q,
        (snap) => {
          setter(snap.docs.map((d) => d.data() as T));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, colName);
        }
      );

    const unsubs = [
      subscribe<Facility>(
        'facilities',
        isSuper ? collection(db, 'facilities') : query(collection(db, 'facilities'), where('status', '==', 'Approved')),
        setFacilities
      ),
      subscribe<UserProfile>(
        'users',
        isSuper ? collection(db, 'users') : query(collection(db, 'users'), where('uid', '==', firebaseUser.uid)),
        setStaffUsers
      ),
      subscribe<Patient>('patients', piiQuery('patients'), setPatients),
      subscribe<Encounter>('encounters', piiQuery('encounters'), setEncounters),
      subscribe<ScreeningCampaign>('screeningCampaigns', collection(db, 'screeningCampaigns'), setCampaigns),
      subscribe<ScreeningRecord>('screenings', piiQuery('screenings'), setScreenings),
      subscribe<FollowUpTask>('followUpTasks', piiQuery('followUpTasks'), setFollowUpTasks),
      subscribe<Referral>('referrals', piiQuery('referrals'), setReferrals),
      subscribe<LabOrder>('labOrders', piiQuery('labOrders'), setLabOrders),
      subscribe<Medicine>('medicines', collection(db, 'medicines'), setMedicines),
      subscribe<Prescription>('prescriptions', piiQuery('prescriptions'), setPrescriptions),
      subscribe<BloodDonor>('bloodDonors', piiQuery('bloodDonors'), setBloodDonors),
      subscribe<BloodUnit>('bloodInventory', collection(db, 'bloodInventory'), setBloodUnits),
      subscribe<InsuranceClaim>('insuranceClaims', piiQuery('insuranceClaims'), setClaims),
      subscribe<TelemedicineAppointment>('telemedicineAppointments', piiQuery('telemedicineAppointments'), setTelemedicine),
      subscribe<SurveillanceRecord>('surveillanceRecords', collection(db, 'surveillanceRecords'), setSurveillance),
      subscribe<PublicHealthAlert>('publicHealthAlerts', collection(db, 'publicHealthAlerts'), setAlerts),
      subscribe<AuditLog>(
        'auditLogs',
        isSuper ? collection(db, 'auditLogs') : query(collection(db, 'auditLogs'), where('actorUid', '==', firebaseUser.uid)),
        setAuditLogs
      ),
      onSnapshot(
        doc(db, 'platformSettings', 'global'),
        (snap) => {
          if (snap.exists()) setSettings(snap.data() as PlatformSettings);
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'platformSettings/global')
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, firebaseUser, userProfile]);

  const effectiveRole: UserRole = simulatedRole || userProfile?.role || 'Medical Doctor';
  const perms = ROLE_PERMISSION_MATRIX[effectiveRole];

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((item) => perms.modules.includes(item.key)),
    [perms.modules]
  );

  // Ensure activeModule stays authorized if simulated role changes
  useEffect(() => {
    if (!perms.modules.includes(activeModule)) {
      setActiveModule(perms.modules[0] || 'overview');
    }
  }, [perms.modules, activeModule]);

  const logAudit = async (
    action: string,
    resourceType: string,
    resourceId: string,
    details: string
  ) => {
    if (!firebaseUser || !userProfile) return;
    const id = makeSafeId('log');
    const logEntry: AuditLog = {
      id,
      actorUid: firebaseUser.uid,
      actorEmail: userProfile.email,
      actorRole: effectiveRole,
      facilityId: userProfile.facilityId,
      action: clampStr(action, 100),
      resourceType: clampStr(resourceType, 80),
      resourceId: clampStr(resourceId, 128),
      details: clampStr(details, 500),
      createdAt: new Date().toISOString(),
    };
    await safeSetDoc('auditLogs', id, logEntry as unknown as Record<string, unknown>);
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSeedDataset = async () => {
    if (!firebaseUser || !userProfile) return;
    setSeeding(true);
    try {
      await seedSyntheticSierraLeoneDataset(firebaseUser.uid, userProfile.email);
      showToast('Synthetic Sierra Leone demonstration dataset synchronized to Firestore.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to seed synthetic dataset.');
    } finally {
      setSeeding(false);
    }
  };

  // Live notification items
  const notifications = useMemo(() => {
    const items: { title: string; detail: string; target: ModuleKey }[] = [];
    alerts
      .filter((a) => a.verificationStatus === 'Pending Verification' || a.severity === 'Critical')
      .slice(0, 4)
      .forEach((a) =>
        items.push({
          title: `Early Warning: ${a.condition} (${a.district})`,
          detail: `${a.referenceNumber} · ${a.severity} severity · ${a.verificationStatus}`,
          target: 'population-health',
        })
      );
    followUpTasks
      .filter((t) => t.status === 'Overdue' || t.status === 'Missed')
      .slice(0, 3)
      .forEach((t) =>
        items.push({
          title: `Overdue Screening Follow-Up: ${t.patientName}`,
          detail: `${t.taskTitle} (Due ${t.dueDate})`,
          target: 'screening-loop',
        })
      );
    medicines
      .filter((m) => m.stockQuantity <= m.reorderLevel)
      .slice(0, 2)
      .forEach((m) =>
        items.push({
          title: `Low Pharmacy Stock: ${m.name}`,
          detail: `${m.stockQuantity} ${m.unit} remaining (Reorder at ${m.reorderLevel})`,
          target: 'pharmacy',
        })
      );
    return items;
  }, [alerts, followUpTasks, medicines]);

  // Global search results
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: { label: string; sub: string; target: ModuleKey; patientId?: string }[] = [];
    patients
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.patientUid.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) =>
        results.push({ label: p.fullName, sub: `${p.patientUid} · ${p.district}`, target: 'patients', patientId: p.id })
      );
    alerts
      .filter((a) => a.condition.toLowerCase().includes(q) || a.district.toLowerCase().includes(q) || a.referenceNumber.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((a) =>
        results.push({ label: `${a.referenceNumber} · ${a.condition}`, sub: `${a.district} · ${a.severity}`, target: 'population-health' })
      );
    return results;
  }, [globalSearch, patients, alerts]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">Initializing JaysalTech Central Hospital Hub...</div>
      </div>
    );
  }

  // Unauthenticated Sign-In Gate
  if (!firebaseUser || !userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6 flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-white border-r border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#0a1d37] border border-slate-200 shrink-0">
              <img
                src="/assets/aistudio/download_aecb1d1c.jpg"
                alt="JaysalTech Central Hospital Hub Logo"
                className="w-full h-full object-cover object-center scale-[1.7]"
              />
            </div>
            <div>
              <div className="text-base font-bold font-display text-slate-900 tracking-tight">
                JAYSALTECH CENTRAL HOSPITAL HUB
              </div>
              <div className="text-xs text-teal-700 font-medium">
                Sierra Leone & International Health Intelligence Network
              </div>
            </div>
          </div>

          <div className="max-w-md space-y-6 my-12">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold font-display text-slate-900 leading-tight text-balance">
                Connecting Hospitals. Empowering Healthcare. Protecting Communities.
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Centralized multi-facility clinical operations, Population & Workforce Health Early Warning, and end-to-end Screening-to-Care loop tracking.
              </p>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                {authError}
              </div>
            )}

            <button
              type="button"
              disabled={signingIn}
              onClick={handleSignIn}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
            >
              <span>{signingIn ? 'Authenticating...' : 'Sign in with Authorized Google Account'}</span>
            </button>

            <div className="border-t border-slate-200 pt-4 text-xs text-slate-500 space-y-1.5">
              <p>
                <strong>Role-Based Isolation:</strong> Access is scoped by verified user role and assigned healthcare facility under Firestore security rules.
              </p>
              <p>
                <strong>Demonstration Safeguard:</strong> Pre-loaded demonstration records are synthetic and clearly labeled; clinical & public health alerts require human verification.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            JaysalTech Health Systems · FHIR R4 Interoperability Ready
          </div>
        </div>

        <div className="lg:col-span-6 relative bg-slate-900 hidden lg:block overflow-hidden">
          <img
            src="/src/assets/images/hospital_campus_hero_1795084255241.jpg"
            alt="Modern West African regional hospital campus"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/35 to-transparent flex flex-col justify-end p-12 text-white">
            <div className="max-w-lg space-y-2">
              <div className="text-xs font-mono text-teal-300">Primary Innovation · Sierra Leone 16-District Network</div>
              <h2 className="text-2xl font-bold font-display">
                Population Health Early Warning & Screening-to-Care Closure
              </h2>
              <p className="text-sm text-slate-200">
                Transforming facility encounters, laboratory diagnostics, and community screenings into timely clinical follow-up and verifiable district-level surveillance.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentNavItem = NAV_ITEMS.find((n) => n.key === activeModule);

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 text-slate-100 shrink-0 border-r border-slate-800">
        <button
          type="button"
          onClick={() => setActiveModule('overview')}
          className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 text-left hover:bg-slate-800/60 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#0a1d37] border border-slate-700 shrink-0">
            <img
              src="/assets/aistudio/download_aecb1d1c.jpg"
              alt="JaysalTech Logo"
              className="w-full h-full object-cover object-center scale-[1.7]"
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold font-display tracking-wide text-white truncate">
              JAYSALTECH HUB
            </div>
            <div className="text-[11px] text-teal-300 truncate">Central Hospital Network</div>
          </div>
        </button>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveModule(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs space-y-2">
          <div className="text-slate-400 truncate">{userProfile.facilityName || userProfile.facilityId}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span className="truncate">{effectiveRole}</span>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative w-64 bg-slate-900 text-slate-100 h-full flex flex-col z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveModule('overview');
                  setMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 text-left"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#0a1d37] border border-slate-700 shrink-0">
                  <img
                    src="/assets/aistudio/download_aecb1d1c.jpg"
                    alt="JaysalTech Logo"
                    className="w-full h-full object-cover object-center scale-[1.7]"
                  />
                </div>
                <span className="text-xs font-bold font-display text-white">JAYSALTECH HUB</span>
              </button>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="p-1 text-slate-400 hover:text-white" aria-label="Close navigation">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg ${
                      activeModule === item.key ? 'bg-teal-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-bold font-display text-slate-900 truncate">
                {currentNavItem?.label || 'JaysalTech Central Hospital Hub'}
              </div>
              <div className="text-[11px] text-slate-500 hidden sm:block truncate">
                JaysalTech Central Hospital Hub · {userProfile.facilityName || 'Network Wide'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Global Search */}
            <div ref={searchContainerRef} className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchFocused(true);
                }}
                placeholder="Search patients, UIDs, alerts..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-60 bg-slate-50 focus:bg-white focus:outline-none focus:border-teal-600"
              />
              {searchFocused && searchResults.length > 0 && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 z-40">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveModule(res.target);
                        if (res.patientId) setFocusedPatientId(res.patientId);
                        setGlobalSearch('');
                        setSearchFocused(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-xs"
                    >
                      <div className="font-semibold text-slate-900">{res.label}</div>
                      <div className="text-slate-500">{res.sub}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Super Admin Role Preview Switcher */}
            {userProfile.role === 'Super Administrator' && (
              <select
                aria-label="Preview role permissions"
                value={effectiveRole}
                onChange={(e) => {
                  const next = e.target.value as UserRole;
                  setSimulatedRole(next === userProfile.role ? null : next);
                }}
                className="hidden xl:block px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    Role: {r}
                  </option>
                ))}
              </select>
            )}

            {/* Notification Centre */}
            <div ref={notifContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1 min-w-[16px] h-4 text-[10px] font-mono font-bold bg-red-600 text-white rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>Clinical & Surveillance Alerts</span>
                    <button type="button" onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500">All alerts and follow-ups are clear.</div>
                    ) : (
                      notifications.map((n, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveModule(n.target);
                            setShowNotifications(false);
                          }}
                          className="w-full text-left p-3.5 hover:bg-slate-50 text-xs flex items-start gap-2.5"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-slate-900">{n.title}</div>
                            <div className="text-slate-500 mt-0.5">{n.detail}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile + Sign Out */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <img
                src="/src/assets/images/clinician_profile_avatar_1795084254257.jpg"
                alt={userProfile.displayName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-900 max-w-[140px] truncate">{userProfile.displayName}</div>
                <div className="text-[11px] text-slate-500 max-w-[140px] truncate">{effectiveRole}</div>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="p-2 text-slate-500 hover:text-red-700 rounded-lg hover:bg-slate-100"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Toast Notification */}
        {toast && (
          <div className="mx-4 sm:mx-6 mt-4 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg flex items-center justify-between">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast('')} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeModule === 'overview' && (
            <OverviewDashboard
              facilities={facilities}
              patients={patients}
              encounters={encounters}
              screenings={screenings}
              followUpTasks={followUpTasks}
              alerts={alerts}
              labOrders={labOrders}
              medicines={medicines}
              referrals={referrals}
              surveillance={surveillance}
              seeding={seeding}
              onSeedDataset={handleSeedDataset}
              onNavigate={setActiveModule}
            />
          )}

          {activeModule === 'population-health' && (
            <PopulationHealthModule
              user={userProfile}
              facilities={facilities}
              surveillance={surveillance}
              alerts={alerts}
              settings={settings}
              canVerifyAlerts={perms.canVerifyAlerts}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}

          {activeModule === 'screening-loop' && (
            <ScreeningCareLoopModule
              user={userProfile}
              facilities={facilities}
              patients={patients}
              campaigns={campaigns}
              screenings={screenings}
              followUpTasks={followUpTasks}
              referrals={referrals}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}

          {(activeModule === 'patients' || activeModule === 'clinical') && (
            <PatientsClinicalModule
              mode={activeModule}
              user={userProfile}
              facilities={facilities}
              patients={patients}
              encounters={encounters}
              labs={labOrders}
              prescriptions={prescriptions}
              screenings={screenings}
              referrals={referrals}
              claims={claims}
              focusedPatientId={focusedPatientId}
              onClearFocusedPatient={() => setFocusedPatientId(null)}
              canEditPatients={perms.canEditPatients}
              canEditEncounters={perms.canEditEncounters}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}

          {(activeModule === 'laboratory' || activeModule === 'pharmacy' || activeModule === 'blood-bank') && (
            <DiagnosticsOperationsModule
              mode={activeModule}
              user={userProfile}
              facilities={facilities}
              patients={patients}
              labOrders={labOrders}
              medicines={medicines}
              prescriptions={prescriptions}
              bloodDonors={bloodDonors}
              bloodUnits={bloodUnits}
              canApproveLab={perms.canApproveLab}
              canDispensePharmacy={perms.canDispensePharmacy}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}

          {(activeModule === 'insurance' || activeModule === 'telemedicine' || activeModule === 'nhie-analytics') && (
            <FinanceTelemedicineNhieModule
              mode={activeModule}
              user={userProfile}
              facilities={facilities}
              patients={patients}
              encounters={encounters}
              labs={labOrders}
              screenings={screenings}
              medicines={medicines}
              surveillance={surveillance}
              claims={claims}
              telemedicine={telemedicine}
              referrals={referrals}
              canManageClaims={perms.canManageClaims}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}

          {activeModule === 'admin-docs' && (
            <AdminGovernanceModule
              user={userProfile}
              facilities={facilities}
              staffUsers={staffUsers}
              settings={settings}
              auditLogs={auditLogs}
              canManageFacilities={perms.canManageFacilities}
              canManageUsers={perms.canManageUsers}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}
