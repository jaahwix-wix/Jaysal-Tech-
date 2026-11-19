-- JaysalTech Central Hospital Hub
-- Normalized Relational Schema & Row Level Security (PostgreSQL / Supabase Ready)
-- Version: 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Facilities
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(160) NOT NULL,
  facility_type VARCHAR(60) NOT NULL,
  district VARCHAR(80) NOT NULL,
  chiefdom VARCHAR(100),
  address VARCHAR(240),
  phone VARCHAR(40),
  status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Approved', 'Pending', 'Suspended')),
  bed_capacity INTEGER NOT NULL DEFAULT 0 CHECK (bed_capacity >= 0),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  head_of_department VARCHAR(140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Roles & 4. Permissions
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'approve', 'export'))
);

-- 5. Users (Staff)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(200) UNIQUE NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role_name VARCHAR(60) NOT NULL,
  facility_id UUID REFERENCES facilities(id),
  department VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Patients & 7. Patient Identifiers & 8. Medical Histories
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  full_name VARCHAR(160) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('Female', 'Male', 'Other')),
  district VARCHAR(80) NOT NULL,
  chiefdom VARCHAR(100),
  phone VARCHAR(40),
  emergency_contact_name VARCHAR(140),
  emergency_contact_phone VARCHAR(40),
  blood_group VARCHAR(10),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  system_uri VARCHAR(200) NOT NULL DEFAULT 'https://jaysaltech.sl/identifiers/patient-uid',
  identifier_value VARCHAR(60) UNIQUE NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergies TEXT,
  chronic_conditions TEXT,
  medication_history TEXT,
  insurance_provider VARCHAR(120),
  insurance_number VARCHAR(80),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Encounters, 10. Diagnoses, 11. Vital Signs
CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  encounter_type VARCHAR(40) NOT NULL,
  department VARCHAR(100) NOT NULL,
  clinician_name VARCHAR(140) NOT NULL,
  chief_complaint TEXT NOT NULL,
  nursing_notes TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  ward_bed VARCHAR(60),
  status VARCHAR(40) NOT NULL DEFAULT 'In Consultation',
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  icd10_code VARCHAR(20),
  description TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vital_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  heart_rate INTEGER,
  temperature_c NUMERIC(4,1),
  spo2_pct INTEGER,
  respiratory_rate INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Screening Campaigns, 13. Screenings, 14. Screening Results, 15. Follow-up Tasks
CREATE TABLE IF NOT EXISTS screening_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  title VARCHAR(180) NOT NULL,
  district VARCHAR(80) NOT NULL,
  target_condition VARCHAR(100) NOT NULL,
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  screened_count INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES screening_campaigns(id),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  district VARCHAR(80) NOT NULL,
  screening_type VARCHAR(100) NOT NULL,
  journey_stage VARCHAR(60) NOT NULL,
  follow_up_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id UUID NOT NULL REFERENCES screenings(id) ON DELETE CASCADE,
  measurement_summary VARCHAR(240),
  result_classification VARCHAR(40) NOT NULL CHECK (result_classification IN ('Normal', 'Abnormal', 'Indeterminate')),
  risk_level VARCHAR(40) NOT NULL CHECK (risk_level IN ('Low', 'Moderate', 'High', 'Critical')),
  clinician_decision TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id UUID NOT NULL REFERENCES screenings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  task_title VARCHAR(200) NOT NULL,
  priority VARCHAR(30) NOT NULL CHECK (priority IN ('Routine', 'High', 'Urgent')),
  due_date DATE NOT NULL,
  assigned_role VARCHAR(60),
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  missed_count INTEGER NOT NULL DEFAULT 0,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Referrals & 17. Appointments
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  from_facility_id UUID NOT NULL REFERENCES facilities(id),
  to_facility_id UUID NOT NULL REFERENCES facilities(id),
  specialty VARCHAR(100) NOT NULL,
  urgency VARCHAR(30) NOT NULL,
  reason TEXT NOT NULL,
  fhir_resource_type VARCHAR(60) DEFAULT 'ServiceRequest',
  exchange_authorized BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  referral_id UUID REFERENCES referrals(id),
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(20),
  status VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Laboratory Orders & 19. Laboratory Results
CREATE TABLE IF NOT EXISTS laboratory_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  test_name VARCHAR(140) NOT NULL,
  sample_code VARCHAR(60) UNIQUE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratory_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES laboratory_orders(id) ON DELETE CASCADE,
  result_value VARCHAR(160),
  reference_range VARCHAR(120),
  abnormal_flag BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by VARCHAR(120),
  approved_at TIMESTAMPTZ
);

-- 20. Medicines, 21. Prescriptions, 22. Pharmacy Transactions
CREATE TABLE IF NOT EXISTS medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  name VARCHAR(160) NOT NULL,
  generic_name VARCHAR(160),
  category VARCHAR(80),
  batch_number VARCHAR(60) NOT NULL,
  expiry_date DATE NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 50,
  unit_price NUMERIC(12,2) DEFAULT 0,
  unit VARCHAR(30) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  medicine_id UUID NOT NULL REFERENCES medicines(id),
  dosage VARCHAR(120),
  frequency VARCHAR(120),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  prescribed_by VARCHAR(140),
  status VARCHAR(40) NOT NULL DEFAULT 'Pending',
  dispensed_by VARCHAR(140),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pharmacy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES medicines(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('Restock', 'Dispense', 'Adjustment', 'Expired')),
  quantity_delta INTEGER NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. Insurance Providers & 24. Insurance Claims
CREATE TABLE IF NOT EXISTS insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) UNIQUE NOT NULL,
  scheme_type VARCHAR(60),
  contact_phone VARCHAR(40)
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_name VARCHAR(120) NOT NULL,
  policy_number VARCHAR(80),
  service_description VARCHAR(240) NOT NULL,
  amount_sll NUMERIC(14,2) NOT NULL CHECK (amount_sll >= 0),
  status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
  payment_reference VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. Blood Donors & 26. Blood Inventory
CREATE TABLE IF NOT EXISTS blood_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  donor_name VARCHAR(160) NOT NULL,
  blood_group VARCHAR(10) NOT NULL,
  phone VARCHAR(40),
  district VARCHAR(80) NOT NULL,
  last_donation_date DATE,
  eligibility_status VARCHAR(40) NOT NULL DEFAULT 'Eligible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  unit_code VARCHAR(60) UNIQUE NOT NULL,
  blood_group VARCHAR(10) NOT NULL,
  component_type VARCHAR(60) NOT NULL,
  collection_date DATE,
  expiry_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Available',
  cross_match_patient_id UUID REFERENCES patients(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. Telemedicine Appointments
CREATE TABLE IF NOT EXISTS telemedicine_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_name VARCHAR(140) NOT NULL,
  specialty VARCHAR(100),
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(20) NOT NULL,
  consultation_notes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. Disease Surveillance, 29. Public Health Alerts, 30. Workforce Health Indicators
CREATE TABLE IF NOT EXISTS disease_surveillance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  district VARCHAR(80) NOT NULL,
  condition VARCHAR(100) NOT NULL,
  period_type VARCHAR(20) NOT NULL,
  period_label VARCHAR(40) NOT NULL,
  reported_cases INTEGER NOT NULL CHECK (reported_cases >= 0),
  baseline_cases INTEGER NOT NULL CHECK (baseline_cases >= 0),
  climate_factor VARCHAR(120),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(60) UNIQUE NOT NULL,
  condition VARCHAR(100) NOT NULL,
  district VARCHAR(80) NOT NULL,
  community VARCHAR(120),
  reported_cases INTEGER NOT NULL,
  baseline_cases INTEGER NOT NULL,
  percentage_change NUMERIC(7,2),
  severity VARCHAR(30) NOT NULL,
  verification_status VARCHAR(40) NOT NULL DEFAULT 'Pending Verification',
  trigger_rule TEXT NOT NULL,
  recommended_response TEXT NOT NULL,
  assigned_officer VARCHAR(140),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workforce_health_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  district VARCHAR(80) NOT NULL,
  period_label VARCHAR(40) NOT NULL,
  absenteeism_pct NUMERIC(5,2) NOT NULL CHECK (absenteeism_pct >= 0 AND absenteeism_pct <= 100),
  screening_coverage_pct NUMERIC(5,2) CHECK (screening_coverage_pct >= 0 AND screening_coverage_pct <= 100),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 31. Notifications & 32. Audit Logs
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_uid UUID REFERENCES users(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id),
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid UUID NOT NULL,
  actor_email VARCHAR(200) NOT NULL,
  actor_role VARCHAR(60) NOT NULL,
  facility_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(128),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_district ON patients(district);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_screenings_patient ON screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_followup_status_due ON follow_up_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_surveillance_district_cond ON disease_surveillance_records(district, condition);
CREATE INDEX IF NOT EXISTS idx_alerts_district_status ON public_health_alerts(district, verification_status);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs(actor_uid, created_at DESC);

-- Enable Row Level Security (RLS) on sensitive facility-scoped tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example Facility-Isolation RLS Policy (Supabase Auth JWT / Users Table)
CREATE POLICY facility_isolation_patients ON patients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role_name = 'Super Administrator' OR u.facility_id = patients.facility_id)
    )
  );

CREATE POLICY facility_isolation_encounters ON encounters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role_name = 'Super Administrator' OR u.facility_id = encounters.facility_id)
    )
  );
