# JaysalTech Central Hospital Hub — Technical, Deployment & User Documentation

**Tagline:** *Connecting Hospitals. Empowering Healthcare. Protecting Communities.*

## 1. Architecture & Persistence Overview
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 (`Plus Jakarta Sans`, `DM Sans`, `IBM Plex Mono`).
- **Live Cloud Persistence & Auth:** Provisioned Firebase Firestore (Enterprise edition) & Firebase Authentication (Google Sign-In with verified email enforcement), protected by `firestore.rules` and schema-checked via `firebase-blueprint.json`.
- **PostgreSQL / Supabase Migration Blueprint:** Complete 32-table normalized DDL, B-tree indexes, and Row Level Security policies are provided in `/supabase/migrations/001_initial_schema.sql` for organizations deploying onto dedicated PostgreSQL / Supabase clusters.

## 2. Environment Variables Template
See `.env.example`:
- `GEMINI_API_KEY` (optional server-side AI capabilities; never exposed to client)
- `APP_URL` (runtime hosting URL)
- Firebase configuration is stored in `firebase-applet-config.json` (client-safe Firebase web config only; no service-role keys are placed in frontend code).

## 3. Initial Administrator Setup Guide
1. Open the application and sign in with Google using the bootstrapped Super Administrator account (`jaahwix@gmail.com`).
2. On first sign-in, your profile is synchronized to `/users/{uid}` with `Super Administrator` privileges.
3. Click **Load Synthetic Dataset** on the Executive Overview to populate 5 Sierra Leone healthcare facilities (Connaught, Bo, Kenema, Makeni, Port Loko), synthetic patient records, screening loops, lab orders, pharmacy stock, blood units, and population health surveillance metrics.
4. Navigate to **Central Administration** to approve new hospitals, assign any of the 10 RBAC roles to staff, and tune early-warning alert thresholds.

## 4. Population Health Early Warning Engine (Primary Innovation)
- Tracks **Malaria**, **Hypertension**, **Diabetes**, **Respiratory Infections**, **Diarrhoeal Diseases**, **Maternal Health Risks**, and **Lassa Fever / VHF Screening**.
- Evaluates configurable percentage thresholds above 4-week baselines, facility workforce absenteeism percentages, and district screening coverage floors.
- **Important Clinical & Public Health Boundary:** Algorithmic alerts (`PHEW-YYYY-XXXX`) flag statistical anomalies requiring field verification and never represent an automated outbreak confirmation.

## 5. Closing the Screening-to-Care Loop (Supporting Innovation)
- Tracks every screened patient through 8 stages:
  `Registered -> Screened -> Results Recorded -> Risk Identified -> Referred -> Appointment Scheduled -> Treatment/Intervention -> Follow-up Completed`
- Any screening classified as `Abnormal`, `Indeterminate`, `High Risk`, or `Critical Risk` automatically creates a linked `followUpTasks` record and optional inter-facility `referrals` record so high-risk patients cannot silently drop out of care.

## 6. Interoperability (FHIR R4 & NHIE)
- Generates standards-aligned HL7 FHIR R4 `Bundle` payloads (`Patient`, `Encounter`, `Observation`, `DiagnosticReport`, `ServiceRequest`) from live clinical records.
- Ready for integration with external Sierra Leone Ministry of Health / DHIS2 endpoints upon certificate provisioning.

## 7. Security & Testing Verification Checklist
- [x] `npx eslint DRAFT_firestore.rules` passes with zero errors against `@firebase/eslint-plugin-security-rules`.
- [x] `firestore.rules` deployed via `DeployRules`.
- [ ] Post-build verification (`npm run lint` and `npm run build`).
- [ ] Manual functional verification: Sign-in, Synthetic Data Seed, Patient Registration & Duplicate Detection, Screening-to-Care Auto Follow-up Task, Early Warning Anomaly Scan, Lab Result Entry, Pharmacy Dispensing, Claims Adjudication, and Role Simulator across all 10 roles.
