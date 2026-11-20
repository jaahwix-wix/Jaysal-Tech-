# JaysalTech Central Hospital Hub — System Documentation

**Version:** 2.0 (Enterprise Production Architecture)  
**Platform Brand:** JaysalTech Central Hospital Hub  
**Healthcare Network:** Sierra Leone 16-District Multi-Hospital Clinical, Diagnostic & Public Health Network  
**Persistence & Auth:** Firebase Authentication & Enterprise Cloud Firestore (`wise-lamp-h3bk6`) + PostgreSQL/Supabase Migration DDL (`/supabase/migrations/001_initial_schema.sql`)

---

## 1. Executive Solution Summary

**JaysalTech Central Hospital Hub** is an integrated, role-secured, multi-hospital digital health platform connecting tertiary referral centres, regional hospitals, and district diagnostic clinics across Sierra Leone's 16 districts.

### Key Capabilities Delivered
1. **Hospital-Scoped Portal Authentication & Mandatory Approval Gate**: Staff select their assigned hospital at sign-in (`Connaught`, `Bo`, `Kenema`, `Makeni`, `Port Loko`, or a custom registered facility), authenticate via Staff Username/Password or Google SSO, and remain in an **Awaiting Hospital Administration Approval** gate until approved by their Hospital Administrator or the Super Administrator.
2. **Unified Patient Registry & Clinical Encounters**: Unique Hub Patient UIDs (`JTH-SL-YYYY-XXXXXX`), real-time duplicate patient detection, outpatient/inpatient/emergency/maternal encounters, vital signs, nursing observations, diagnoses, and discharge summaries.
3. **Emergency Mode Dashboard**: One-click emergency triage toggle in the workspace header that simplifies the viewport to display critical vitals alerts (`SpO2 < 92%`, `Temp >= 39.0°C`, `Systolic BP >= 180 or < 90 mmHg`, `HR >= 120 or < 50 bpm`, `Emergency` encounters, and `Triage` queue) with one-click triage actions.
4. **Closed Screening-to-Care Loop**: 8-stage longitudinal tracking (`Registered` -> `Screened` -> `Results Recorded` -> `Risk Identified` -> `Referred` -> `Appointment Scheduled` -> `Treatment/Intervention` -> `Follow-up Completed`) with automatic referral and follow-up task generation on abnormal or high-risk findings.
5. **Population & Workforce Health Early Warning Engine**: Explainable, threshold-driven surveillance across all 16 districts tracking Malaria, Respiratory Infections, Diarrhoeal Diseases, Workforce Absenteeism, and Screening Coverage against configurable baseline rules.
6. **Laboratory, Pharmacy & Blood Bank Operations**: Sample tracking, abnormal flags, supervisor approval, batch expiry warnings, automatic stock deduction on prescription dispensing, donor registry, and blood unit cross-matching/issuing.
7. **Billing, Insurance Claims, Telemedicine & HL7 FHIR R4 NHIE**: NASSIT/FHCI/private claims adjudication, virtual consultation scheduling, inter-facility referrals, and live HL7 FHIR R4 Bundle builder.
8. **Standard A4 Print Preview & Multi-Format Data Export**: Standardized A4 letterhead printouts (`Print Preview`, `Print`, CSV export, JSON export, and official PDF System Documentation export) across every module.
9. **Full Administrative Governance (View, Add, Update, Delete)**: Super Administrators (all hospitals) and Hospital Administrators (within their assigned facility) have full CRUD control over hospital records with two-step delete safeguards and immutable audit logging.

---

## 2. Hospital Network & Admin Credential Provisioning

### Pre-Configured Sierra Leone Facilities

| Facility ID | Code | Facility Name | District | Type |
|---|---|---|---|---|
| `fac_connaught_sl` | `SL-WAU-001` | Connaught National Referral Hospital | Western Area Urban | Tertiary Referral Hospital |
| `fac_bo_gov` | `SL-BO-002` | Bo Government Regional Hospital | Bo | Regional Hospital |
| `fac_kenema_gov` | `SL-KEN-003` | Kenema Government Hospital | Kenema | Regional Hospital |
| `fac_makeni_reg` | `SL-BOM-004` | Makeni Regional Hospital | Bombali | Regional Hospital |
| `fac_portloko_chc` | `SL-PLK-005` | Port Loko District Diagnostic & Health Centre | Port Loko | Diagnostic & District Clinic |

### How Hospital Admin Passwords & Accounts Work
For security and compliance, **no hardcoded plaintext passwords exist in the codebase**. Authentication is managed securely by Firebase Authentication (`wise-lamp-h3bk6`):

- **Master Super Administrator (All Hospitals):** `jaahwix@gmail.com` via **Sign in with Google** (bootstrapped automatically with `Super Administrator` authority across all 5 hospitals and newly registered facilities).
- **Issuing a Hospital Administrator Login & Password for Any Hospital (Method 1 — In-App Onboarding):**
  1. Ensure **Email/Password** is enabled in Firebase Console (`wise-lamp-h3bk6` -> Authentication -> Sign-in method -> Email/Password -> Enable).
  2. On the login page, click **Register Staff Account**.
  3. Select the target hospital (e.g., *Bo Government Regional Hospital*), select **Hospital Role: `Hospital Administrator`**, enter the administrator's username (e.g., `admin.bo` -> `admin.bo@jaysaltech.sl`) or email and choose a password (minimum 6 characters).
  4. Sign in as the Master Super Administrator (`jaahwix@gmail.com`) -> open **Central Admin & Docs -> Users & RBAC** -> click **Approve Access**.
- **Issuing / Resetting Hospital Admin Passwords Directly (Method 2 — Firebase Console):**
  1. Open **Firebase Console (`wise-lamp-h3bk6`) -> Authentication -> Users -> Add user**.
  2. Enter a facility admin email (e.g., `admin.bo@jaysaltech.sl`, `admin.connaught@jaysaltech.sl`, `admin.kenema@jaysaltech.sl`, `admin.makeni@jaysaltech.sl`, `admin.portloko@jaysaltech.sl`) and set their password.
  3. Alternatively, use **Forgot Password?** on the login screen (for real email addresses) or click **Reset password** in Firebase Console.

---

## 3. 10-Role RBAC & Full Admin Record Governance

| Role | Scope | Record Operations |
|---|---|---|
| **Super Administrator** | All hospitals network-wide | View, Add, Update, Delete all records; approve hospitals & users; configure surveillance thresholds; inspect all audit logs |
| **Hospital Administrator** | Assigned hospital (`facilityId`) | View, Add, Update, Delete all clinical & operational records in their hospital; approve hospital staff registrations |
| **Medical Doctor** | Facility / authorized patients | View, create, and update patients, encounters, lab requests/approvals, prescriptions, referrals, telemedicine |
| **Nurse** | Facility / authorized patients | View, create, and update patients, triage/nursing encounters, screening follow-ups, blood donor logs |
| **Laboratory Technician** | Facility diagnostics | Process lab samples, enter results, approve lab reports, manage blood bank cross-matching |
| **Pharmacist** | Facility pharmacy | Manage medicine inventory, restock batches, dispense/cancel prescriptions with automatic stock deduction |
| **Medical Records Officer** | Facility registry & NHIE | Manage patient demographics, UIDs, unified longitudinal profiles, and referral summaries |
| **Finance Officer** | Facility billing | Create, approve, reject, and settle NASSIT/FHCI/private insurance claims; export financial CSVs |
| **Public Health Officer** | District surveillance | Submit aggregate surveillance reports, run anomaly scans, review & verify public health alerts |
| **Receptionist** | Facility front desk | Register patients, check screening follow-ups, schedule telemedicine appointments, view claims |

### Administrative Delete Safeguards
- Every destructive deletion requires a two-step inline confirmation (**Delete -> Confirm Delete**) to prevent accidental data loss without using blocking browser popups.
- Audit logs (`auditLogs`) remain strictly **append-only and immutable** — neither Super Administrators nor Hospital Administrators can alter or delete historical audit entries.
- The bootstrapped Super Administrator account (`jaahwix@gmail.com`) and active self-accounts are protected against accidental deletion.

---

## 4. Technical Architecture, Database Schema & Security

- **Frontend Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide icons, jsPDF for client-side PDF generation.
- **Enterprise Firestore Collections (19 collections)**: `users`, `facilities`, `patients`, `encounters`, `screeningCampaigns`, `screenings`, `followUpTasks`, `referrals`, `labOrders`, `medicines`, `prescriptions`, `bloodDonors`, `bloodInventory`, `insuranceClaims`, `telemedicineAppointments`, `surveillanceRecords`, `publicHealthAlerts`, `auditLogs`, `platformSettings`.
- **Relational PostgreSQL / Supabase Migration (`/supabase/migrations/001_initial_schema.sql`)**: Normalized relational schema with UUID primary keys, foreign key integrity, B-tree indexes, and PostgreSQL Row Level Security (RLS) policies for Cloud SQL / Supabase deployments.
- **Firestore Security Rules (`/firestore.rules`)**: Default-deny posture, strict field whitelisting (`keys().hasOnly(...)`), type/length validation, `status == 'Active'` enforcement, `authorizedUids` PII isolation for clinicians, and `facilityId` scoping for Hospital Administrators.

---

## 5. Clinical Safety & Regulatory Disclaimers

1. **Automated Alerts Are Decision-Support Signals**: Early Warning Engine alerts and Emergency Mode vitals flags highlight statistical or physiological deviations and **never** constitute an automated diagnosis or confirmed outbreak declaration without qualified clinical and epidemiological verification.
2. **Synthetic Data Tagging**: Demonstration records generated via the platform seeder carry `isSynthetic: true` so evaluators and clinicians always distinguish simulated data from live clinical entries.
3. **External Integrations**: Live WebRTC telemedicine video transport and external Ministry/DHIS2 endpoints require signed facility certificates and licensed media gateway configuration before external activation.
