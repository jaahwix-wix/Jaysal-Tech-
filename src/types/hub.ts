export const USER_ROLES = [
  'Super Administrator',
  'Hospital Administrator',
  'Medical Doctor',
  'Nurse',
  'Laboratory Technician',
  'Pharmacist',
  'Medical Records Officer',
  'Finance Officer',
  'Public Health Officer',
  'Receptionist',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const SIERRA_LEONE_DISTRICTS = [
  'Western Area Urban',
  'Western Area Rural',
  'Bo',
  'Kenema',
  'Bombali',
  'Port Loko',
  'Kailahun',
  'Kono',
  'Tonkolili',
  'Moyamba',
  'Kambia',
  'Karene',
  'Falaba',
  'Koinadugu',
  'Pujehun',
  'Bonthe',
] as const;

export type SierraLeoneDistrict = (typeof SIERRA_LEONE_DISTRICTS)[number];

export const JOURNEY_STAGES = [
  'Registered',
  'Screened',
  'Results Recorded',
  'Risk Identified',
  'Referred',
  'Appointment Scheduled',
  'Treatment/Intervention',
  'Follow-up Completed',
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export type AlertSeverity = 'Informational' | 'Low' | 'Moderate' | 'High' | 'Critical';
export type VerificationStatus =
  | 'Pending Verification'
  | 'Acknowledged'
  | 'Under Investigation'
  | 'Escalated'
  | 'Resolved'
  | 'Dismissed';

export type ModuleKey =
  | 'overview'
  | 'population-health'
  | 'screening-loop'
  | 'patients'
  | 'clinical'
  | 'laboratory'
  | 'pharmacy'
  | 'blood-bank'
  | 'insurance'
  | 'telemedicine'
  | 'nhie-analytics'
  | 'admin-docs';

export interface RolePermissions {
  modules: ModuleKey[];
  canManageFacilities: boolean;
  canManageUsers: boolean;
  canEditPatients: boolean;
  canEditEncounters: boolean;
  canApproveLab: boolean;
  canDispensePharmacy: boolean;
  canManageClaims: boolean;
  canVerifyAlerts: boolean;
  canExportData: boolean;
}

export const ROLE_PERMISSION_MATRIX: Record<UserRole, RolePermissions> = {
  'Super Administrator': {
    modules: ['overview', 'population-health', 'screening-loop', 'patients', 'clinical', 'laboratory', 'pharmacy', 'blood-bank', 'insurance', 'telemedicine', 'nhie-analytics', 'admin-docs'],
    canManageFacilities: true,
    canManageUsers: true,
    canEditPatients: true,
    canEditEncounters: true,
    canApproveLab: true,
    canDispensePharmacy: true,
    canManageClaims: true,
    canVerifyAlerts: true,
    canExportData: true,
  },
  'Hospital Administrator': {
    modules: ['overview', 'population-health', 'screening-loop', 'patients', 'clinical', 'laboratory', 'pharmacy', 'blood-bank', 'insurance', 'telemedicine', 'nhie-analytics', 'admin-docs'],
    canManageFacilities: true,
    canManageUsers: true,
    canEditPatients: true,
    canEditEncounters: true,
    canApproveLab: true,
    canDispensePharmacy: true,
    canManageClaims: true,
    canVerifyAlerts: true,
    canExportData: true,
  },
  'Medical Doctor': {
    modules: ['overview', 'population-health', 'screening-loop', 'patients', 'clinical', 'laboratory', 'pharmacy', 'blood-bank', 'telemedicine', 'nhie-analytics'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: true,
    canEditEncounters: true,
    canApproveLab: true,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: true,
  },
  'Nurse': {
    modules: ['overview', 'screening-loop', 'patients', 'clinical', 'laboratory', 'blood-bank', 'telemedicine'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: true,
    canEditEncounters: true,
    canApproveLab: false,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: false,
  },
  'Laboratory Technician': {
    modules: ['overview', 'screening-loop', 'patients', 'laboratory', 'blood-bank'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: false,
    canEditEncounters: false,
    canApproveLab: true,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: true,
  },
  'Pharmacist': {
    modules: ['overview', 'patients', 'pharmacy'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: false,
    canEditEncounters: false,
    canApproveLab: false,
    canDispensePharmacy: true,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: true,
  },
  'Medical Records Officer': {
    modules: ['overview', 'screening-loop', 'patients', 'clinical', 'nhie-analytics'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: true,
    canEditEncounters: false,
    canApproveLab: false,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: true,
  },
  'Finance Officer': {
    modules: ['overview', 'patients', 'insurance', 'nhie-analytics'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: false,
    canEditEncounters: false,
    canApproveLab: false,
    canDispensePharmacy: false,
    canManageClaims: true,
    canVerifyAlerts: false,
    canExportData: true,
  },
  'Public Health Officer': {
    modules: ['overview', 'population-health', 'screening-loop', 'nhie-analytics', 'admin-docs'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: false,
    canEditEncounters: false,
    canApproveLab: false,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: true,
    canExportData: true,
  },
  'Receptionist': {
    modules: ['overview', 'screening-loop', 'patients', 'telemedicine', 'insurance'],
    canManageFacilities: false,
    canManageUsers: false,
    canEditPatients: true,
    canEditEncounters: false,
    canApproveLab: false,
    canDispensePharmacy: false,
    canManageClaims: false,
    canVerifyAlerts: false,
    canExportData: false,
  },
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  facilityId: string;
  facilityName?: string;
  department?: string;
  status: 'Active' | 'Suspended' | 'Pending';
  createdAt: string;
  updatedAt: string;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  type: string;
  district: string;
  chiefdom?: string;
  address?: string;
  phone?: string;
  status: 'Approved' | 'Pending' | 'Suspended';
  bedCapacity: number;
  departments: string[];
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  patientUid: string;
  facilityId: string;
  facilityName?: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'Female' | 'Male' | 'Other';
  district: string;
  chiefdom?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicConditions?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  facilityId: string;
  facilityName?: string;
  encounterType: 'Outpatient' | 'Inpatient' | 'Emergency' | 'Maternal' | 'Follow-Up';
  department: string;
  clinicianName: string;
  chiefComplaint: string;
  vitalSigns?: string;
  nursingNotes?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  dischargeSummary?: string;
  status: 'Triage' | 'In Consultation' | 'Admitted' | 'Discharged' | 'Completed';
  wardBed?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningCampaign {
  id: string;
  title: string;
  district: string;
  facilityId: string;
  facilityName?: string;
  targetCondition: string;
  targetCount: number;
  screenedCount: number;
  startDate?: string;
  endDate?: string;
  status: 'Active' | 'Planned' | 'Completed';
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningRecord {
  id: string;
  campaignId?: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  facilityId: string;
  facilityName?: string;
  district: string;
  screeningType: string;
  measurementSummary?: string;
  resultClassification: 'Normal' | 'Abnormal' | 'Indeterminate';
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  journeyStage: JourneyStage;
  referralId?: string;
  appointmentDate?: string;
  treatmentStatus?: string;
  clinicianDecision?: string;
  followUpCompleted: boolean;
  isOverdue?: boolean;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpTask {
  id: string;
  screeningId: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  facilityId: string;
  district?: string;
  taskTitle: string;
  priority: 'Routine' | 'High' | 'Urgent';
  dueDate: string;
  assignedRole?: string;
  status: 'Pending' | 'Scheduled' | 'In Progress' | 'Overdue' | 'Missed' | 'Completed' | 'Escalated';
  resolutionNotes?: string;
  missedCount?: number;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  fromFacilityId: string;
  fromFacilityName?: string;
  toFacilityId: string;
  toFacilityName?: string;
  specialty: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
  reason: string;
  fhirResourceType?: string;
  exchangeAuthorized?: boolean;
  status: 'Pending' | 'Accepted' | 'Appointment Scheduled' | 'Completed' | 'Declined';
  appointmentDate?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  facilityId: string;
  facilityName?: string;
  testName: string;
  sampleCode: string;
  sampleStatus?: string;
  resultValue?: string;
  referenceRange?: string;
  abnormalFlag: boolean;
  status: 'Requested' | 'Sample Collected' | 'Processing' | 'Results Entered' | 'Approved';
  approvedBy?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Medicine {
  id: string;
  facilityId: string;
  facilityName?: string;
  name: string;
  genericName?: string;
  category?: string;
  batchNumber: string;
  expiryDate: string;
  stockQuantity: number;
  reorderLevel: number;
  unitPrice?: number;
  unit: string;
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  facilityId: string;
  facilityName?: string;
  medicineId: string;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  quantity: number;
  prescribedBy?: string;
  status: 'Pending' | 'Dispensed' | 'Cancelled';
  dispensedBy?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface BloodDonor {
  id: string;
  facilityId: string;
  facilityName?: string;
  donorName: string;
  bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
  phone?: string;
  district: string;
  lastDonationDate?: string;
  eligibilityStatus: 'Eligible' | 'Deferred' | 'Temporary Deferral';
  unitsDonated?: number;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface BloodUnit {
  id: string;
  facilityId: string;
  facilityName?: string;
  unitCode: string;
  bloodGroup: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
  componentType: string;
  collectionDate?: string;
  expiryDate: string;
  status: 'Available' | 'Cross-Matched' | 'Issued' | 'Expired' | 'Quarantined';
  crossMatchPatientName?: string;
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceClaim {
  id: string;
  facilityId: string;
  facilityName?: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  providerName: string;
  policyNumber?: string;
  serviceDescription: string;
  amountSLL: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Paid';
  paymentReference?: string;
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface TelemedicineAppointment {
  id: string;
  facilityId: string;
  facilityName?: string;
  patientId: string;
  patientName: string;
  patientUid?: string;
  doctorName: string;
  specialty?: string;
  scheduledDate: string;
  scheduledTime: string;
  consultationNotes?: string;
  integrationEndpointStatus?: string;
  status: 'Scheduled' | 'Ready' | 'Completed' | 'Cancelled';
  isSynthetic?: boolean;
  authorizedUids: string[];
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveillanceRecord {
  id: string;
  facilityId: string;
  facilityName?: string;
  district: string;
  condition: string;
  periodType: 'Daily' | 'Weekly' | 'Monthly';
  periodLabel: string;
  reportedCases: number;
  baselineCases: number;
  workforceAbsenteeismPct?: number;
  screeningCoveragePct?: number;
  climateFactor?: string;
  isAggregate: boolean;
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicHealthAlert {
  id: string;
  referenceNumber: string;
  condition: string;
  district: string;
  community?: string;
  reportingFacilities?: string[];
  reportedCases: number;
  baselineCases: number;
  percentageChange?: number;
  severity: AlertSeverity;
  verificationStatus: VerificationStatus;
  triggerRule: string;
  recommendedResponse: string;
  assignedOfficer?: string;
  resolutionNotes?: string;
  isAggregate: boolean;
  isSynthetic?: boolean;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  facilityId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: string;
  createdAt: string;
}

export interface PlatformSettings {
  id: string;
  malariaThresholdPct: number;
  respiratoryThresholdPct: number;
  diarrhoealThresholdPct: number;
  absenteeismThresholdPct: number;
  screeningCoverageMinPct: number;
  sessionTimeoutMinutes: number;
  backupSchedule?: string;
  updatedByUid: string;
  updatedAt: string;
}

// Validation helpers synchronized with firebase-blueprint.json
export function clampStr(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return val.trim().slice(0, maxLen);
}

export function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
