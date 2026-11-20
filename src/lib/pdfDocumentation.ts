import { jsPDF } from 'jspdf';
import type { Facility, PlatformSettings, UserProfile } from '../types/hub';

interface PdfDocContext {
  user?: UserProfile;
  facilities?: Facility[];
  settings?: PlatformSettings | null;
}

const NAVY: [number, number, number] = [15, 23, 42];
const TEAL: [number, number, number] = [15, 118, 110];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const SLATE_50: [number, number, number] = [248, 250, 252];

export function downloadSystemDocumentationPdf(ctx: PdfDocContext = {}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const generatedDate = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  let y = 20;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = 24;
    }
  };

  const addSectionHeading = (num: string, title: string) => {
    ensureSpace(18);
    y += 4;
    doc.setFillColor(...TEAL);
    doc.rect(margin, y - 4.5, 2.5, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(`${num}. ${title}`, margin + 5, y + 0.5);
    y += 5;
    doc.setDrawColor(...SLATE_200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5.5;
  };

  const addSubHeading = (title: string) => {
    ensureSpace(12);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...TEAL);
    doc.text(title, margin, y);
    y += 5;
  };

  const addParagraph = (text: string, fontSize = 9.5) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...SLATE_700);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    const lineHeight = fontSize * 0.44;
    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 2.5;
  };

  const addBullets = (items: { lead: string; body: string }[]) => {
    const bulletIndent = 5;
    const textWidth = contentWidth - bulletIndent;
    for (const item of items) {
      doc.setFontSize(9.2);
      const fullLine = `${item.lead}: ${item.body}`;
      const lines = doc.splitTextToSize(fullLine, textWidth) as string[];
      const lineHeight = 4.2;
      ensureSpace(lines.length * lineHeight + 2);
      doc.setFillColor(...TEAL);
      doc.circle(margin + 1.5, y - 1.2, 0.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE_700);
      lines.forEach((line, idx) => {
        if (idx === 0 && line.startsWith(`${item.lead}:`)) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          const leadPart = `${item.lead}: `;
          const rest = line.slice(leadPart.length);
          doc.text(leadPart, margin + bulletIndent, y);
          const leadWidth = doc.getTextWidth(leadPart);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE_700);
          doc.text(rest, margin + bulletIndent + leadWidth, y);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE_700);
          doc.text(line, margin + bulletIndent, y);
        }
        y += lineHeight;
      });
      y += 1.2;
    }
    y += 2;
  };

  const addTable = (headers: string[], rows: string[][], colWidths: number[]) => {
    const rowPadding = 2.5;
    const lineHeight = 3.8;

    const renderHeader = () => {
      ensureSpace(12);
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(255, 255, 255);
      let x = margin + 2;
      headers.forEach((h, i) => {
        doc.text(h, x, y + 5);
        x += colWidths[i];
      });
      y += 7.5;
    };

    renderHeader();

    rows.forEach((row, rIdx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const cellLines = row.map((cell, cIdx) =>
        doc.splitTextToSize(cell, Math.max(10, colWidths[cIdx] - 4)) as string[]
      );
      const maxLines = Math.max(...cellLines.map((l) => l.length));
      const rowHeight = maxLines * lineHeight + rowPadding * 2;

      if (y + rowHeight > pageHeight - 20) {
        doc.addPage();
        y = 24;
        renderHeader();
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(...SLATE_50);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(...SLATE_200);
      doc.rect(margin, y, contentWidth, rowHeight, 'S');

      doc.setTextColor(...SLATE_700);
      let x = margin + 2;
      cellLines.forEach((lines, cIdx) => {
        if (cIdx === 0) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        lines.forEach((ln, lIdx) => {
          doc.text(ln, x, y + rowPadding + 2.8 + lIdx * lineHeight);
        });
        x += colWidths[cIdx];
      });
      y += rowHeight;
    });
    y += 4;
  };

  // =========================================================================
  // COVER PAGE
  // =========================================================================
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 68, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 68, pageWidth, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(153, 246, 228);
  doc.text('ENTERPRISE HEALTH INTELLIGENCE & CLINICAL OPERATIONS PLATFORM', margin, 22);

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('JaysalTech Central Hospital Hub', margin, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text('Official System Architecture, Governance & User Operations Documentation', margin, 43);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Sierra Leone 16-District Multi-Hospital Network · HL7 FHIR R4 · Cloud Firestore & PostgreSQL Ready', margin, 56);

  y = 84;

  // Document Metadata Box
  doc.setFillColor(...SLATE_50);
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('DOCUMENT CONTROL & PLATFORM METADATA', margin + 5, y + 7);

  const metaRows: [string, string][] = [
    ['Version & Release', 'v2.0 Enterprise Edition (Multi-Hospital Auth, Emergency Mode, Full Admin CRUD)'],
    ['Cloud Persistence', 'Firebase Authentication & Enterprise Cloud Firestore (Project: wise-lamp-h3bk6)'],
    ['Prepared For / By', ctx.user ? `${ctx.user.displayName} (${ctx.user.role} · ${ctx.user.facilityName || ctx.user.facilityId})` : 'Hospital Administration & Clinical Operations Teams'],
    ['Generated Timestamp', generatedDate],
  ];
  doc.setFontSize(8.5);
  metaRows.forEach(([k, v], i) => {
    const rowY = y + 14 + i * 5.8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE_500);
    doc.text(`${k}:`, margin + 5, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...NAVY);
    doc.text(v, margin + 45, rowY);
  });

  y += 48;

  // Executive Summary & Contents on Cover Page
  addSubHeading('Executive Overview');
  addParagraph(
    'JaysalTech Central Hospital Hub unifies clinical patient management, emergency vitals triage, laboratory diagnostics, pharmacy stock control, blood bank transfusion safety, insurance claims, telemedicine scheduling, closed-loop community screening follow-ups, and district-wide disease surveillance into a single secure enterprise platform.'
  );

  addSubHeading('Document Contents');
  addTable(
    ['Section', 'Topic', 'Audience'],
    [
      ['1', 'Solution Summary & Clinical Challenges Addressed', 'Ministry Leadership, Hospital Directors'],
      ['2', 'Technical Architecture, Persistence & Interoperability', 'System Architects, DevOps, Database Admins'],
      ['3', 'Hospital Network & Admin Password / Account Provisioning', 'Super Administrators, Hospital Admins, IT'],
      ['4', '10-Role RBAC & Full Administrative CRUD Controls', 'Hospital Admins, Compliance & Audit Teams'],
      ['5', 'Module-by-Module User & Clinical Operations Guide', 'Doctors, Nurses, Lab, Pharmacy, Finance, PHOs'],
      ['6', 'Emergency Mode, Early Warning Rules & Print/Export Standards', 'Emergency Triage Staff, Epidemiologists'],
      ['7', 'Security Rules, Privacy Isolation & Clinical Safety Boundaries', 'Security Auditors, Clinical Governance'],
    ],
    [18, 95, contentWidth - 113]
  );

  // =========================================================================
  // SECTION 1: SOLUTION SUMMARY
  // =========================================================================
  doc.addPage();
  y = 24;
  addSectionHeading('1', 'Solution Summary & Capabilities Built');
  addParagraph(
    'Sierra Leone healthcare facilities frequently operate with disconnected paper registers, delayed laboratory turnarounds, unmonitored pharmacy stockouts, missed abnormal screening follow-ups, and delayed inter-district outbreak escalation. JaysalTech Central Hospital Hub solves these structural bottlenecks through an interconnected 12-module digital health network:'
  );
  addBullets([
    {
      lead: 'Hospital-Scoped Portal Access & Staff Approval',
      body: 'Doctors, nurses, pharmacists, lab technicians, finance officers, and administrators select their specific hospital at login and sign in with staff username/password or Google SSO. New registrations remain gated until approved by hospital administration.',
    },
    {
      lead: 'Unified Longitudinal Patient Identity',
      body: 'Issues standardized Hub UIDs (JTH-SL-YYYY-XXXXXX) with real-time duplicate patient detection by name/DOB/phone and consolidates encounters, labs, prescriptions, screenings, referrals, and claims in one Patient Profile Drawer.',
    },
    {
      lead: 'Emergency Mode Triage Console',
      body: 'A single header toggle switches the workspace into a high-contrast critical response console highlighting abnormal physiological vitals (SpO2 < 92%, Temp >= 39.0 C, Systolic BP >= 180 or < 90 mmHg, HR >= 120 or < 50 bpm) and active triage patients.',
    },
    {
      lead: 'Closed Screening-to-Care Loop',
      body: 'Tracks every screened citizen across 8 stages and automatically creates follow-up tasks and inter-facility referrals whenever an abnormal or high-risk screening is recorded.',
    },
    {
      lead: 'Population Health Early Warning Engine',
      body: 'Evaluates district surveillance logs against configurable thresholds for Malaria, Respiratory Infections, Diarrhoeal Diseases, staff absenteeism, and screening coverage across all 16 districts.',
    },
    {
      lead: 'Standardized A4 Printing & Data Portability',
      body: 'Includes an A4 Print Preview with official letterhead and sign-off footer, CSV table export, JSON snapshot export, and HL7 FHIR R4 Bundle generation across all 12 modules.',
    },
  ]);

  // =========================================================================
  // SECTION 2: ARCHITECTURE
  // =========================================================================
  addSectionHeading('2', 'System Architecture & Data Persistence Stack');
  addParagraph(
    'The platform is built for resilient low-latency hospital operations with strict cloud authorization rules and relational portability:'
  );
  addTable(
    ['Layer', 'Technology / Standard', 'Purpose in Production'],
    [
      ['Client Application', 'React 19, TypeScript, Vite, Tailwind CSS v4', 'Responsive clinical workspace, print media sheets, real-time reactive UI'],
      ['Authentication', 'Firebase Auth (Email/Username + Google SSO)', 'Verified staff identity, password reset emails, session inactivity auto-lock'],
      ['Live Operational DB', 'Firebase Cloud Firestore (Enterprise DB)', 'Real-time onSnapshot synchronization across wards, labs, pharmacy & districts'],
      ['Security Enforcement', 'Cloud Firestore Rules (19 collection policies)', 'Server-side RBAC, schema validation, facilityId scoping & immutable audit logs'],
      ['SQL Migration Path', 'PostgreSQL / Supabase (001_initial_schema.sql)', 'Full normalized relational DDL with B-tree indexes and Row Level Security'],
      ['Health Exchange', 'HL7 FHIR R4 JSON Bundles', 'Standardized Patient, Encounter, Observation, ServiceRequest, DiagnosticReport'],
    ],
    [36, 60, contentWidth - 96]
  );

  // =========================================================================
  // SECTION 3: HOSPITAL ONBOARDING & ADMIN PASSWORDS
  // =========================================================================
  addSectionHeading('3', 'Hospital Network, Admin Passwords & Onboarding Workflow');
  addParagraph(
    'For enterprise security, no hardcoded plaintext passwords are stored anywhere in application source code. All staff and hospital administrator passwords are stored and hashed securely inside Firebase Authentication (project: wise-lamp-h3bk6).'
  );

  addSubHeading('3.1 Pre-Configured Sierra Leone Healthcare Facilities');
  const facRows = (ctx.facilities && ctx.facilities.length > 0
    ? ctx.facilities.map((f) => [f.code, f.id, f.name, f.district, `${f.bedCapacity} beds · ${f.status}`])
    : [
        ['SL-WAU-001', 'fac_connaught_sl', 'Connaught National Referral Hospital', 'Western Area Urban', '350 beds · Approved'],
        ['SL-BO-002', 'fac_bo_gov', 'Bo Government Regional Hospital', 'Bo', '220 beds · Approved'],
        ['SL-KEN-003', 'fac_kenema_gov', 'Kenema Government Hospital', 'Kenema', '190 beds · Approved'],
        ['SL-BOM-004', 'fac_makeni_reg', 'Makeni Regional Hospital', 'Bombali', '165 beds · Approved'],
        ['SL-PLK-005', 'fac_portloko_chc', 'Port Loko District Diagnostic & Health Centre', 'Port Loko', '75 beds · Approved'],
      ]);
  addTable(
    ['Code', 'Facility ID', 'Hospital / Centre Name', 'District', 'Capacity & Status'],
    facRows,
    [24, 34, 62, 32, contentWidth - 152]
  );

  addSubHeading('3.2 How to Obtain, Create, or Reset Admin Passwords for All Hospitals');
  addBullets([
    {
      lead: 'Master Super Administrator (All Hospitals)',
      body: 'Email jaahwix@gmail.com via "Sign in with Google" automatically holds Super Administrator authority across all 5 hospitals and all newly registered clinics.',
    },
    {
      lead: 'One-Time Prerequisite (Username/Password Sign-In)',
      body: 'In Firebase Console (wise-lamp-h3bk6) -> Authentication -> Sign-in method, ensure the "Email/Password" provider is enabled. Username inputs like "admin.bo" automatically resolve to "admin.bo@jaysaltech.sl".',
    },
    {
      lead: 'Method A — Self-Register + Super Admin Approval (Recommended)',
      body: 'Open the Login Screen -> choose "Register Staff Account" -> select the target hospital (e.g., Bo Government Regional Hospital) -> set Hospital Role to "Hospital Administrator" -> enter username (e.g., admin.bo) and password -> submit. Sign in as Super Admin (jaahwix@gmail.com) -> Central Admin & Docs -> Users & RBAC -> click "Approve Access".',
    },
    {
      lead: 'Method B — Direct Provisioning in Firebase Console',
      body: 'Open Firebase Console (wise-lamp-h3bk6) -> Authentication -> Users -> Add user to create or reset passwords for admin.connaught@jaysaltech.sl, admin.bo@jaysaltech.sl, admin.kenema@jaysaltech.sl, admin.makeni@jaysaltech.sl, or admin.portloko@jaysaltech.sl. Existing passwords cannot be read in plaintext; use Firebase Console "Reset password" or the login screen "Forgot Password?" link.',
    },
    {
      lead: 'Per-Hospital Registration Approval Gate',
      body: 'Every newly registered doctor, nurse, pharmacist, lab tech, or admin starts with status "Pending". The live approval screen automatically unlocks into their hospital workspace the moment their Hospital Administrator or Super Administrator clicks "Approve Access".',
    },
  ]);

  // =========================================================================
  // SECTION 4: RBAC & FULL ADMIN CRUD
  // =========================================================================
  addSectionHeading('4', '10-Role RBAC & Full Administrative CRUD Matrix');
  addParagraph(
    'Both Super Administrators (across all hospitals) and Hospital Administrators (within their assigned facilityId) are authorized to View, Add, Update, and Delete operational and clinical records across all platform modules.'
  );
  addTable(
    ['Role', 'Scope', 'Authorized Operations (View / Add / Update / Delete)'],
    [
      ['Super Administrator', 'Network-Wide', 'Full View, Add, Update & Delete on all hospitals, users, patients, encounters, labs, pharmacy, blood bank, claims, telemedicine, NHIE, campaigns & surveillance'],
      ['Hospital Administrator', 'Assigned Hospital', 'Full View, Add, Update & Delete on all records belonging to their facilityId; approves/manages staff accounts in their hospital'],
      ['Medical Doctor', 'Facility / Assigned', 'Manage patients, clinical encounters, lab orders/approvals, prescriptions, telemedicine & NHIE referrals'],
      ['Nurse', 'Facility / Assigned', 'Patient intake, vital signs, nursing notes, screening follow-ups, blood donor intake'],
      ['Laboratory Technician', 'Facility Diagnostics', 'Create lab orders, enter results, flag abnormalities, approve reports, cross-match & issue blood units'],
      ['Pharmacist', 'Facility Pharmacy', 'Register medicines, restock inventory (+50 / edit), dispense or cancel prescriptions with automatic stock decrement'],
      ['Medical Records Officer', 'Facility Registry', 'Register & edit patient demographics, manage unified records, view NHIE referrals'],
      ['Finance Officer', 'Facility Billing', 'Create, approve, reject, mark paid, edit & export insurance claims (NASSIT / FHCI / Private)'],
      ['Public Health Officer', '16 Districts', 'Submit aggregate surveillance reports, run anomaly scans, review & verify public health alerts'],
      ['Receptionist', 'Facility Front Desk', 'Register patients, schedule telemedicine slots, check screening follow-ups & claims status'],
    ],
    [38, 30, contentWidth - 68]
  );

  // =========================================================================
  // SECTION 5: MODULE OPERATIONS GUIDE
  // =========================================================================
  addSectionHeading('5', 'Module-by-Module Operations Guide');
  addBullets([
    {
      lead: '1. Executive Overview',
      body: 'Displays network-wide KPIs, pending hospital approval alerts, 16-district risk map, and synthetic Sierra Leone demonstration data synchronization.',
    },
    {
      lead: '2. Early Warning Engine (Population Health)',
      body: `Evaluates aggregate surveillance reports against configurable thresholds (Malaria +${ctx.settings?.malariaThresholdPct ?? 40}%, Respiratory +${ctx.settings?.respiratoryThresholdPct ?? 35}%, Diarrhoeal +${ctx.settings?.diarrhoealThresholdPct ?? 30}%, Workforce Absenteeism >=${ctx.settings?.absenteeismThresholdPct ?? 8}%, Screening Coverage <${ctx.settings?.screeningCoverageMinPct ?? 60}%). Admins can add, edit, verify, or delete surveillance logs and alerts.`,
    },
    {
      lead: '3. Screening-to-Care Loop',
      body: 'Manages outreach campaigns, individual screenings, 8-stage care journey advancement modal, and automated follow-up task escalation for missed appointments.',
    },
    {
      lead: '4. Patient Registry & 5. Clinical Encounters',
      body: 'Registers patients with duplicate checking, opens Unified Patient Profiles, logs encounters with structured vitals/diagnoses/treatment plans, and supports Admin editing/deletion (including discharged records).',
    },
    {
      lead: '6. Laboratory, 7. Pharmacy & 8. Blood Bank',
      body: 'Tracks specimen codes, reference ranges, abnormal flags, medicine stock & expiry alerts, automated dispensing deduction, donor eligibility, and cross-matched blood unit issuing.',
    },
    {
      lead: '9. Insurance, 10. Telemedicine & 11. NHIE Analytics',
      body: 'Handles SLE billing claims adjudication, virtual consultation scheduling, inter-facility referrals, cross-district analytics, and HL7 FHIR R4 Bundle previews.',
    },
    {
      lead: '12. Central Admin & Docs',
      body: 'Manages hospital onboarding/status, staff approvals & role assignments, threshold/timeout settings, immutable audit logs, SQL schema download, and this official PDF Documentation.',
    },
  ]);

  // =========================================================================
  // SECTION 6: EMERGENCY MODE & PRINT/EXPORT
  // =========================================================================
  addSectionHeading('6', 'Emergency Mode, Print Standards & Clinical Safety');
  addSubHeading('6.1 Emergency Mode Vitals Detection Rules');
  addParagraph(
    'When Emergency Mode is toggled on in the top bar, the vitals parser inspects every clinical encounter and highlights records meeting any of the following physiological or status criteria:'
  );
  addBullets([
    { lead: 'Hypoxemia', body: 'Oxygen Saturation SpO2 < 92%' },
    { lead: 'High Fever / Hyperpyrexia', body: 'Temperature >= 39.0 C' },
    { lead: 'Hypertensive Crisis or Shock', body: 'Systolic Blood Pressure >= 180 mmHg or < 90 mmHg' },
    { lead: 'Severe Tachycardia / Bradycardia', body: 'Heart Rate >= 120 bpm or < 50 bpm' },
    { lead: 'Active Emergency / Triage Queue', body: 'Encounter Type = Emergency or Status = Triage' },
  ]);

  addSubHeading('6.2 Print & Export Compliance');
  addParagraph(
    'Every module includes an A4 Print Preview toolbar generating standardized institutional reports with facility letterhead, user attribution, timestamp, and automatic hiding of interactive controls (no-print). All modules support instant CSV and JSON export.'
  );

  addSubHeading('6.3 Regulatory & Clinical Safety Boundaries');
  addParagraph(
    'Algorithmic alerts and emergency vitals flags are clinical decision-support indicators only and do not substitute for licensed clinician judgment. All destructive deletes require explicit two-step confirmation, and every Create/Update/Delete action is permanently recorded in the append-only auditLogs collection.'
  );

  // =========================================================================
  // RUNNING HEADER & PAGE FOOTER ON ALL PAGES (EXCEPT COVER HEADER)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_500);
      doc.text('JAYSALTECH CENTRAL HOSPITAL HUB · SYSTEM DOCUMENTATION', margin, 12);
      doc.setFont('helvetica', 'normal');
      doc.text('v2.0 Enterprise', pageWidth - margin, 12, { align: 'right' });
      doc.setDrawColor(...SLATE_200);
      doc.line(margin, 15, pageWidth - margin, 15);
    }

    doc.setDrawColor(...SLATE_200);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_500);
    doc.text('JaysalTech Health Systems · Confidential Governance & Clinical Operations Manual', margin, pageHeight - 9);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }

  doc.save('JaysalTech_Central_Hospital_Hub_Documentation.pdf');
}
