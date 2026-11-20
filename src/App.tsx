/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
  Check,
  Clock,
  Copy,
  CreditCard,
  Droplet,
  Eye,
  EyeOff,
  FlaskConical,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Pill,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  Stethoscope,
  User,
  UserPlus,
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
  safeUpdateDoc,
  testConnection,
} from './lib/firebase';
import { seedSyntheticSierraLeoneDataset } from './lib/seedData';
import type { HubDatasetSnapshot } from './lib/exportUtils';
import { PrintFooter, PrintLetterhead } from './components/PrintHeaderFooter';
import { ModuleRecordsToolbar } from './components/ModuleRecordsToolbar';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { OverviewDashboard } from './components/modules/OverviewDashboard';
import { EmergencyDashboard } from './components/modules/EmergencyDashboard';
import { PopulationHealthModule } from './components/modules/PopulationHealthModule';
import { ScreeningCareLoopModule } from './components/modules/ScreeningCareLoopModule';
import { PatientsClinicalModule } from './components/modules/PatientsClinicalModule';
import { DiagnosticsOperationsModule } from './components/modules/DiagnosticsOperationsModule';
import { FinanceTelemedicineNhieModule } from './components/modules/FinanceTelemedicineNhieModule';
import { AdminGovernanceModule } from './components/modules/AdminGovernanceModule';

const PRINT_DOCUMENT_TITLES: Record<ModuleKey, string> = {
  overview: 'Hospital Network Executive Overview Report',
  'population-health': 'Population & Workforce Health Early Warning Report',
  'screening-loop': 'Screening-to-Care Loop & Follow-Up Register',
  patients: 'Authorized Patient Registry Report',
  clinical: 'Clinical Encounters & Ward Register',
  laboratory: 'Clinical Laboratory Diagnostics Sheet',
  pharmacy: 'Pharmacy Inventory & Dispensing Report',
  'blood-bank': 'Blood Bank Inventory & Transfusion Register',
  insurance: 'Hospital Billing & Insurance Claims Statement',
  telemedicine: 'Telemedicine Consultations Schedule',
  'nhie-analytics': 'NHIE Interoperability & District Executive Summary',
  'admin-docs': 'Central Administration & Governance Audit Report',
};

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
const PENDING_LOGIN_STORAGE_KEY = 'jaysaltech_pending_login_selection';

interface LoginHospitalOption {
  id: string;
  name: string;
  code: string;
  district: string;
  type: string;
}

const LOGIN_HOSPITALS: LoginHospitalOption[] = [
  {
    id: 'fac_connaught_sl',
    name: 'Connaught National Referral Hospital',
    code: 'SL-WAU-001',
    district: 'Western Area Urban',
    type: 'Tertiary Referral Hospital',
  },
  {
    id: 'fac_bo_gov',
    name: 'Bo Government Regional Hospital',
    code: 'SL-BO-002',
    district: 'Bo',
    type: 'Regional Hospital',
  },
  {
    id: 'fac_kenema_gov',
    name: 'Kenema Government Hospital',
    code: 'SL-KEN-003',
    district: 'Kenema',
    type: 'Regional Hospital',
  },
  {
    id: 'fac_makeni_reg',
    name: 'Makeni Regional Hospital',
    code: 'SL-BOM-004',
    district: 'Bombali',
    type: 'Regional Hospital',
  },
  {
    id: 'fac_portloko_chc',
    name: 'Port Loko District Diagnostic & Health Centre',
    code: 'SL-PLK-005',
    district: 'Port Loko',
    type: 'Diagnostic & District Clinic',
  },
];

interface PendingLoginSelection {
  facilityId: string;
  facilityName: string;
  displayName?: string;
  role?: UserRole;
  department?: string;
}

function normalizeStaffIdentifier(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return '';
  if (cleaned.includes('@')) return cleaned;
  const safeUser = cleaned.replace(/[^a-z0-9._-]/g, '.').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
  return safeUser ? `${safeUser}@jaysaltech.sl` : '';
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [emailProviderDisabled, setEmailProviderDisabled] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Portal login & hospital selection state
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [customHospitalCode, setCustomHospitalCode] = useState('');
  const [customHospitalName, setCustomHospitalName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerFullName, setRegisterFullName] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('Medical Doctor');
  const [registerDepartment, setRegisterDepartment] = useState('Outpatient');

  const [activeModule, setActiveModule] = useState<ModuleKey>('overview');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [refreshingApproval, setRefreshingApproval] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [focusedPatientId, setFocusedPatientId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [seeding, setSeeding] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const notifContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingLoginSelectionRef = useRef<PendingLoginSelection | null>(null);

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

      let pending: PendingLoginSelection | null = pendingLoginSelectionRef.current;
      if (!pending) {
        try {
          const rawPending = window.sessionStorage.getItem(PENDING_LOGIN_STORAGE_KEY);
          if (rawPending) {
            pending = JSON.parse(rawPending) as PendingLoginSelection;
          }
        } catch {
          pending = null;
        }
      }
      pendingLoginSelectionRef.current = null;
      try {
        window.sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup errors
      }

      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        const now = new Date().toISOString();

        if (snap.exists()) {
          const existingProfile = snap.data() as UserProfile;
          const isBootAdmin = fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL && fbUser.emailVerified;
          const facilityChanged =
            Boolean(pending?.facilityId) && pending?.facilityId !== existingProfile.facilityId;
          const facilityNameChanged =
            Boolean(pending?.facilityName) && pending?.facilityName !== existingProfile.facilityName;

          if (pending?.facilityId && (facilityChanged || facilityNameChanged)) {
            const nextStatus: UserProfile['status'] = isBootAdmin
              ? 'Active'
              : facilityChanged
                ? 'Pending'
                : existingProfile.status;
            const updatedFields = {
              facilityId: clampStr(pending.facilityId, 128),
              facilityName: clampStr(pending.facilityName || pending.facilityId, 160),
              status: nextStatus,
              updatedAt: now,
            };
            await safeUpdateDoc('users', fbUser.uid, updatedFields);
            setUserProfile({ ...existingProfile, ...updatedFields });
          } else {
            setUserProfile(existingProfile);
          }
        } else {
          const isBootAdmin = fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL && fbUser.emailVerified;
          const requestedRole =
            pending?.role && pending.role !== 'Super Administrator' ? pending.role : 'Medical Doctor';
          const newProfile: UserProfile = {
            uid: fbUser.uid,
            email: clampStr(fbUser.email || 'user@jaysaltech.sl', 200),
            displayName: clampStr(
              pending?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || 'Clinician',
              120
            ),
            role: isBootAdmin ? 'Super Administrator' : requestedRole,
            facilityId: clampStr(pending?.facilityId || 'fac_connaught_sl', 128),
            facilityName: clampStr(pending?.facilityName || 'Connaught National Referral Hospital', 160),
            department: clampStr(
              pending?.department || (isBootAdmin ? 'Central Platform Governance' : 'Clinical Operations'),
              100
            ),
            status: isBootAdmin ? 'Active' : 'Pending',
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

  // Keep current user's own approval status & role synchronized in real time
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      },
      () => {
        // Ignore transient permission errors before initial creation
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

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

  // Real-time Firestore listeners (only after authReady + approved Active userProfile)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;
    const isBootAdmin = firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
    if (userProfile.status !== 'Active' && !isBootAdmin) return;

    const isSuper =
      isBootAdmin ||
      userProfile.role === 'Super Administrator';
    const isFacilityAdmin = userProfile.role === 'Hospital Administrator';

    const piiQuery = (colName: string): Query<DocumentData> => {
      if (isSuper) return collection(db, colName);
      if (isFacilityAdmin && userProfile.facilityId) {
        if (colName === 'referrals') {
          return query(collection(db, colName), where('fromFacilityId', '==', userProfile.facilityId));
        }
        return query(collection(db, colName), where('facilityId', '==', userProfile.facilityId));
      }
      return query(collection(db, colName), where('authorizedUids', 'array-contains', firebaseUser.uid));
    };

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

    const usersQuery = isSuper
      ? collection(db, 'users')
      : isFacilityAdmin
        ? query(collection(db, 'users'), where('facilityId', '==', userProfile.facilityId))
        : query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));

    const auditQuery = isSuper
      ? collection(db, 'auditLogs')
      : isFacilityAdmin && userProfile.facilityId
        ? query(collection(db, 'auditLogs'), where('facilityId', '==', userProfile.facilityId))
        : query(collection(db, 'auditLogs'), where('actorUid', '==', firebaseUser.uid));

    const unsubs = [
      subscribe<Facility>(
        'facilities',
        isSuper ? collection(db, 'facilities') : query(collection(db, 'facilities'), where('status', '==', 'Approved')),
        setFacilities
      ),
      subscribe<UserProfile>('users', usersQuery, setStaffUsers),
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
      subscribe<AuditLog>('auditLogs', auditQuery, setAuditLogs),
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
  const canAdminManageRecords =
    effectiveRole === 'Super Administrator' || effectiveRole === 'Hospital Administrator';

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

  const hubSnapshot: HubDatasetSnapshot = useMemo(
    () => ({
      facilities,
      staffUsers,
      patients,
      encounters,
      campaigns,
      screenings,
      followUpTasks,
      referrals,
      labOrders,
      medicines,
      prescriptions,
      bloodDonors,
      bloodUnits,
      claims,
      telemedicine,
      surveillance,
      alerts,
      auditLogs,
      settings,
    }),
    [
      facilities,
      staffUsers,
      patients,
      encounters,
      campaigns,
      screenings,
      followUpTasks,
      referrals,
      labOrders,
      medicines,
      prescriptions,
      bloodDonors,
      bloodUnits,
      claims,
      telemedicine,
      surveillance,
      alerts,
      auditLogs,
      settings,
    ]
  );

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

  const resolveSelectedHospital = (): { facilityId: string; facilityName: string } | null => {
    if (!selectedHospitalId) return null;
    if (selectedHospitalId === 'other') {
      const cleanCode = customHospitalCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanName = customHospitalName.trim();
      if (!cleanCode || !cleanName) return null;
      return {
        facilityId: cleanCode,
        facilityName: cleanName,
      };
    }
    const found = LOGIN_HOSPITALS.find((h) => h.id === selectedHospitalId);
    return found ? { facilityId: found.id, facilityName: found.name } : null;
  };

  const storePendingLoginSelection = (selection: PendingLoginSelection | null) => {
    pendingLoginSelectionRef.current = selection;
    try {
      if (selection) {
        window.sessionStorage.setItem(PENDING_LOGIN_STORAGE_KEY, JSON.stringify(selection));
      } else {
        window.sessionStorage.removeItem(PENDING_LOGIN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage availability issues
    }
  };

  const mapAuthError = (err: unknown, fallback: string) => {
    const code = (err as { code?: string })?.code || '';
    const message = err instanceof Error ? err.message : fallback;
    if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
      const host = window.location.hostname || window.location.host;
      setUnauthorizedDomain(host);
      setAuthError(`This deployed domain (${host}) is not authorized for Firebase Authentication yet.`);
      return;
    }
    if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
      setEmailProviderDisabled(true);
      setAuthError('Email/Password sign-in is not yet enabled in the Firebase Authentication console for project wise-lamp-h3bk6.');
      return;
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      setAuthError('Invalid staff username/email or password. Please verify your credentials or register a new staff account.');
      return;
    }
    if (code === 'auth/email-already-in-use') {
      setAuthError('This username or email is already registered. Switch to "Staff Sign In" to access your hospital portal.');
      return;
    }
    if (code === 'auth/weak-password') {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (code === 'auth/invalid-email') {
      setAuthError('Please enter a valid staff username (e.g., dr.kamara) or email address.');
      return;
    }
    if (code === 'auth/too-many-requests') {
      setAuthError('Too many failed sign-in attempts. Please wait briefly or reset your password.');
      return;
    }
    setAuthError(message);
  };

  const handlePortalAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setEmailProviderDisabled(false);
    setUnauthorizedDomain('');
    setCopiedDomain(false);

    const hospital = resolveSelectedHospital();
    if (!hospital) {
      setAuthError(
        selectedHospitalId === 'other'
          ? 'Please enter both the registered Facility Code/ID and Hospital Name.'
          : 'Please select the hospital or healthcare facility where you belong before signing in.'
      );
      return;
    }

    const normalizedEmail = normalizeStaffIdentifier(usernameInput);
    if (!normalizedEmail) {
      setAuthError('Please enter your staff username or email address.');
      return;
    }
    if (!passwordInput || passwordInput.length < 6) {
      setAuthError('Please enter a password (minimum 6 characters).');
      return;
    }
    if (authMode === 'register' && registerFullName.trim().length < 2) {
      setAuthError('Please enter your full name and clinical title (e.g., Dr. Mohamed Kamara).');
      return;
    }

    setSigningIn(true);
    try {
      if (authMode === 'register') {
        const cleanName = clampStr(registerFullName.trim(), 120);
        const safeRole: UserRole =
          registerRole === 'Super Administrator' ? 'Medical Doctor' : registerRole;
        storePendingLoginSelection({
          facilityId: hospital.facilityId,
          facilityName: hospital.facilityName,
          displayName: cleanName,
          role: safeRole,
          department: clampStr(registerDepartment.trim() || 'Clinical Operations', 100),
        });
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, passwordInput);
        await updateProfile(cred.user, { displayName: cleanName });
        setPasswordInput('');
      } else {
        storePendingLoginSelection({
          facilityId: hospital.facilityId,
          facilityName: hospital.facilityName,
        });
        await signInWithEmailAndPassword(auth, normalizedEmail, passwordInput);
        setPasswordInput('');
      }
    } catch (err) {
      storePendingLoginSelection(null);
      mapAuthError(err, 'Hospital portal authentication failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError('');
    setAuthNotice('');
    setEmailProviderDisabled(false);
    const trimmed = usernameInput.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setAuthError('Enter your full registered staff email address above to receive a password reset link.');
      return;
    }
    setSigningIn(true);
    try {
      await sendPasswordResetEmail(auth, trimmed.toLowerCase());
      setAuthNotice(`Password reset link sent to ${trimmed.toLowerCase()}. Check your inbox to set a new password.`);
    } catch (err) {
      mapAuthError(err, 'Unable to send password reset email.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError('');
    setAuthNotice('');
    setEmailProviderDisabled(false);
    setUnauthorizedDomain('');
    setCopiedDomain(false);
    const hospital = resolveSelectedHospital();
    storePendingLoginSelection(
      hospital
        ? {
            facilityId: hospital.facilityId,
            facilityName: hospital.facilityName,
          }
        : null
    );
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      storePendingLoginSelection(null);
      mapAuthError(err, 'Google Sign-In failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleCopyDomain = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
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
    const selectedHospitalMeta = LOGIN_HOSPITALS.find((h) => h.id === selectedHospitalId);
    const staffAssignableRoles = USER_ROLES.filter((r) => r !== 'Super Administrator');

    return (
      <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-white border-r border-slate-200 overflow-y-auto">
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

          <div className="max-w-lg w-full space-y-5 my-8">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 leading-tight text-balance">
                Connecting Hospitals. Empowering Healthcare. Protecting Communities.
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Select your assigned hospital or healthcare facility, then sign in with your staff username and password to access your portal.
              </p>
            </div>

            {/* Auth Mode Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                  setAuthNotice('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Staff Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                  setAuthNotice('');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Staff Account</span>
              </button>
            </div>

            {authNotice && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-900">
                {authNotice}
              </div>
            )}

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 text-xs text-red-900 space-y-2.5">
                <div className="font-semibold text-red-900">{authError}</div>
                {emailProviderDisabled && (
                  <div className="text-red-800 space-y-1 leading-relaxed">
                    <p>
                      Administrator setup required once in <strong>Firebase Console (wise-lamp-h3bk6) → Authentication → Sign-in method</strong>:
                    </p>
                    <p>Click <strong>Add new provider → Email/Password → Enable → Save</strong>.</p>
                  </div>
                )}
                {unauthorizedDomain && (
                  <div className="space-y-2 text-red-800">
                    <p className="leading-relaxed">
                      Add this exact hostname in <strong>Firebase Console (wise-lamp-h3bk6) → Authentication → Settings → Authorized domains</strong>:
                    </p>
                    <div className="flex items-center justify-between gap-2 bg-white border border-red-200 rounded-md px-2.5 py-1.5">
                      <code className="text-[11px] font-mono text-slate-900 truncate">
                        {unauthorizedDomain}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyDomain}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded shrink-0"
                      >
                        {copiedDomain ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy domain</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handlePortalAuthSubmit} className="space-y-4">
              {/* Step 1: Select Hospital */}
              <div className="space-y-1.5">
                <label htmlFor="hospital-select" className="block text-xs font-semibold text-slate-700">
                  1. Hospital / Healthcare Facility
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="hospital-select"
                    value={selectedHospitalId}
                    onChange={(e) => {
                      setSelectedHospitalId(e.target.value);
                      setAuthError('');
                    }}
                    required
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  >
                    <option value="">Select the hospital where you belong...</option>
                    {LOGIN_HOSPITALS.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.code} · {h.district})
                      </option>
                    ))}
                    <option value="other">Other Registered Facility (Enter Facility Code)</option>
                  </select>
                </div>
                {selectedHospitalMeta && (
                  <div className="flex items-center justify-between text-[11px] text-teal-800 bg-teal-50/70 border border-teal-200 rounded-lg px-3 py-1.5">
                    <span className="font-medium truncate">{selectedHospitalMeta.type} · {selectedHospitalMeta.district} District</span>
                    <span className="font-mono font-semibold shrink-0 ml-2">{selectedHospitalMeta.code}</span>
                  </div>
                )}
              </div>

              {selectedHospitalId === 'other' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div>
                    <label htmlFor="custom-fac-code" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Facility ID / Code
                    </label>
                    <input
                      id="custom-fac-code"
                      type="text"
                      value={customHospitalCode}
                      onChange={(e) => setCustomHospitalCode(e.target.value)}
                      placeholder="e.g., fac_lunsar_hosp"
                      required
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-fac-name" className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Hospital / Clinic Name
                    </label>
                    <input
                      id="custom-fac-name"
                      type="text"
                      value={customHospitalName}
                      onChange={(e) => setCustomHospitalName(e.target.value)}
                      placeholder="e.g., Lunsar Baptist Hospital"
                      required
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              )}

              {authMode === 'register' && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div>
                    <label htmlFor="register-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name & Clinical Title
                    </label>
                    <input
                      id="register-fullname"
                      type="text"
                      value={registerFullName}
                      onChange={(e) => setRegisterFullName(e.target.value)}
                      placeholder="e.g., Dr. Mohamed Kamara"
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-role" className="block text-xs font-semibold text-slate-700 mb-1">
                        Hospital Role
                      </label>
                      <select
                        id="register-role"
                        value={registerRole}
                        onChange={(e) => setRegisterRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                      >
                        {staffAssignableRoles.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="register-dept" className="block text-xs font-semibold text-slate-700 mb-1">
                        Department / Unit
                      </label>
                      <input
                        id="register-dept"
                        type="text"
                        value={registerDepartment}
                        onChange={(e) => setRegisterDepartment(e.target.value)}
                        placeholder="e.g., Outpatient, Maternity"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Username & Password */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="portal-username" className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Staff Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="portal-username"
                      type="text"
                      autoComplete="username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="e.g., dr.kamara or dr.kamara@bohospital.sl"
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Enter a full email address or staff username (mapped automatically to <code className="font-mono">@jaysaltech.sl</code>).
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="portal-password" className="block text-xs font-semibold text-slate-700">
                      3. Password
                    </label>
                    {authMode === 'signin' && (
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={signingIn}
                        className="text-[11px] font-medium text-teal-700 hover:text-teal-800"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="portal-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={authMode === 'register' ? 'Create password (min 6 characters)' : 'Enter your password'}
                      required
                      minLength={6}
                      className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>
                  {signingIn
                    ? 'Authenticating...'
                    : authMode === 'register'
                      ? 'Register & Submit for Hospital Approval'
                      : 'Login to Hospital Portal'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-[11px] font-medium text-slate-400">Or continue with SSO</span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled={signingIn}
              onClick={handleSignIn}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{signingIn ? 'Authenticating...' : 'Sign in with Authorized Google Account'}</span>
            </button>

            <div className="border-t border-slate-200 pt-3.5 text-xs text-slate-500 space-y-1">
              <p>
                <strong>Hospital Administration Approval:</strong> Every newly registered staff member remains Pending until approved by their assigned Hospital Administration.
              </p>
              <p>
                <strong>Facility & Role Isolation:</strong> Access is scoped by verified user role and selected healthcare facility under Firestore security rules.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400">
            JaysalTech Health Systems · FHIR R4 Interoperability Ready
          </div>
        </div>

        <div className="lg:col-span-6 relative bg-slate-900 hidden lg:block overflow-hidden">
          <img
            src="/assets/aistudio/202210_sierraleone_slpth_scharles_23337_2d92a9b3.jpg"
            alt="Sierra Leone hospital inpatient ward"
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

  const isBootstrappedSuperAdmin =
    firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

  // Hospital Administration Approval Gate for Pending / Suspended accounts
  if (userProfile.status !== 'Active' && !isBootstrappedSuperAdmin) {
    const isSuspended = userProfile.status === 'Suspended';
    const handleRefreshApproval = async () => {
      setRefreshingApproval(true);
      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        }
      } catch (err) {
        console.error('Unable to refresh approval status:', err);
      } finally {
        setRefreshingApproval(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#0a1d37] border border-slate-200 shrink-0">
              <img
                src="/assets/aistudio/download_aecb1d1c.jpg"
                alt="JaysalTech Logo"
                className="w-full h-full object-cover object-center scale-[1.7]"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold font-display text-slate-900 truncate">
                JAYSALTECH CENTRAL HOSPITAL HUB
              </div>
              <div className="text-xs text-slate-500 truncate">
                {userProfile.facilityName || userProfile.facilityId}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className={`inline-flex items-center gap-2 text-xs font-semibold ${isSuspended ? 'text-red-700' : 'text-amber-700'}`}>
              {isSuspended ? <ShieldAlert className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span>{isSuspended ? 'ACCOUNT ACCESS SUSPENDED' : 'PENDING HOSPITAL ADMINISTRATION APPROVAL'}</span>
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900">
              {isSuspended
                ? 'Your portal access is currently suspended'
                : 'Awaiting Hospital Administration verification'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isSuspended
                ? `Your account for ${userProfile.facilityName || userProfile.facilityId} was suspended or declined by Hospital Administration. Contact your facility administrator to restore access.`
                : `Every newly registered clinician or staff member must be approved by the Hospital Administration at ${userProfile.facilityName || userProfile.facilityId} (or the Platform Super Administrator) before accessing patient or clinical modules.`}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Staff Member</span>
              <span className="font-semibold text-slate-900">{userProfile.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Username / Email</span>
              <span className="font-mono text-slate-800">{userProfile.email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Assigned Hospital</span>
              <span className="font-semibold text-slate-900">{userProfile.facilityName || userProfile.facilityId}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Requested Role</span>
              <span className="font-medium text-slate-800">{userProfile.role}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Approval Status</span>
              <span className={`font-semibold ${isSuspended ? 'text-red-700' : 'text-amber-700'}`}>
                {userProfile.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={refreshingApproval}
              onClick={handleRefreshApproval}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingApproval ? 'animate-spin' : ''}`} />
              <span>{refreshingApproval ? 'Checking...' : 'Check Approval Status'}</span>
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentNavItem = NAV_ITEMS.find((n) => n.key === activeModule);
  const pendingApprovalsCount = staffUsers.filter((s) => s.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Desktop Sidebar (hidden in simplified Emergency Mode) */}
      {!emergencyMode && (
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
      )}

      {/* Mobile Navigation Drawer */}
      {!emergencyMode && mobileNavOpen && (
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
            {!emergencyMode && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold font-display text-slate-900 truncate">
                {emergencyMode
                  ? 'Emergency Response & Active Triage'
                  : currentNavItem?.label || 'JaysalTech Central Hospital Hub'}
              </div>
              <div className="text-[11px] text-slate-500 hidden sm:block truncate">
                JaysalTech Central Hospital Hub · {userProfile.facilityName || 'Network Wide'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Emergency Mode Toggle */}
            <button
              type="button"
              onClick={() => setEmergencyMode((prev) => !prev)}
              aria-pressed={emergencyMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                emergencyMode
                  ? 'bg-red-700 text-white border-red-700 hover:bg-red-800'
                  : 'bg-red-50/70 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              <Siren className="w-3.5 h-3.5 shrink-0" />
              <span>{emergencyMode ? 'Exit Emergency Mode' : 'Emergency Mode'}</span>
            </button>

            {/* Global Search (standard mode) */}
            {!emergencyMode && (
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
            )}

            {/* Super Admin Role Preview Switcher */}
            {!emergencyMode && userProfile.role === 'Super Administrator' && (
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

            {/* Print Preview & Export Current Module */}
            {!emergencyMode && (
            <button
              type="button"
              onClick={() => setShowPrintPreview(true)}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              title="Open Standard A4 Print Preview"
              aria-label="Open Standard A4 Print Preview"
            >
              <Printer className="w-4 h-4" />
            </button>
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
          <div className="no-print mx-4 sm:mx-6 mt-4 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg flex items-center justify-between">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast('')} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {emergencyMode ? (
            <EmergencyDashboard
              user={userProfile}
              patients={patients}
              encounters={encounters}
              screenings={screenings}
              labs={labOrders}
              prescriptions={prescriptions}
              referrals={referrals}
              claims={claims}
              canEditEncounters={perms.canEditEncounters}
              onExitEmergencyMode={() => setEmergencyMode(false)}
              onLogAudit={logAudit}
              onToast={showToast}
            />
          ) : (
            <>
              <PrintLetterhead
                documentTitle={PRINT_DOCUMENT_TITLES[activeModule] || 'Hospital Operations Report'}
                facilityName={userProfile.facilityName || 'Network Wide'}
                preparedBy={userProfile.displayName}
                preparedRole={effectiveRole}
              />
              <ModuleRecordsToolbar
                moduleKey={activeModule}
                user={userProfile}
                effectiveRole={effectiveRole}
                data={hubSnapshot}
                onOpenPrintPreview={() => setShowPrintPreview(true)}
                onToast={showToast}
              />
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
                  pendingApprovalsCount={pendingApprovalsCount}
                  canManageUsers={perms.canManageUsers}
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
              canAdminManageRecords={canAdminManageRecords}
              onLogAudit={logAudit}
              onToast={showToast}
              onOpenPrintPreview={() => setShowPrintPreview(true)}
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
              canAdminManageRecords={canAdminManageRecords}
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
              canAdminManageRecords={canAdminManageRecords}
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
              canAdminManageRecords={canAdminManageRecords}
              onLogAudit={logAudit}
              onToast={showToast}
              onOpenPrintPreview={() => setShowPrintPreview(true)}
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
              canAdminManageRecords={canAdminManageRecords}
              onLogAudit={logAudit}
              onToast={showToast}
              onOpenPrintPreview={() => setShowPrintPreview(true)}
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
                  canAdminManageRecords={canAdminManageRecords}
                  onLogAudit={logAudit}
                  onToast={showToast}
                />
              )}

              <PrintFooter preparedBy={userProfile.displayName} preparedRole={effectiveRole} />
            </>
          )}
        </main>
      </div>

      {showPrintPreview && (
        <PrintPreviewModal
          moduleKey={activeModule}
          user={userProfile}
          effectiveRole={effectiveRole}
          data={hubSnapshot}
          onClose={() => setShowPrintPreview(false)}
          onToast={showToast}
        />
      )}
    </div>
  );
}
