import type {
  AuditLog,
  BloodDonor,
  BloodUnit,
  Encounter,
  Facility,
  FollowUpTask,
  InsuranceClaim,
  LabOrder,
  Medicine,
  ModuleKey,
  Patient,
  PlatformSettings,
  Prescription,
  PublicHealthAlert,
  Referral,
  ScreeningCampaign,
  ScreeningRecord,
  SurveillanceRecord,
  TelemedicineAppointment,
  UserProfile,
} from '../types/hub';

export interface HubDatasetSnapshot {
  facilities: Facility[];
  staffUsers: UserProfile[];
  patients: Patient[];
  encounters: Encounter[];
  campaigns: ScreeningCampaign[];
  screenings: ScreeningRecord[];
  followUpTasks: FollowUpTask[];
  referrals: Referral[];
  labOrders: LabOrder[];
  medicines: Medicine[];
  prescriptions: Prescription[];
  bloodDonors: BloodDonor[];
  bloodUnits: BloodUnit[];
  claims: InsuranceClaim[];
  telemedicine: TelemedicineAppointment[];
  surveillance: SurveillanceRecord[];
  alerts: PublicHealthAlert[];
  auditLogs: AuditLog[];
  settings: PlatformSettings | null;
}

export function exportToCsv(
  filename: string,
  rows: Record<string, unknown>[],
  fallbackHeaders?: string[]
): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : fallbackHeaders || ['Status'];
  const csvLines = [
    headers.join(','),
    ...(rows.length > 0
      ? rows.map((row) =>
          headers
            .map((h) => {
              const raw = row[h] === undefined || row[h] === null ? '' : String(row[h]);
              const escaped = raw.replace(/"/g, '""');
              return `"${escaped}"`;
            })
            .join(',')
        )
      : []),
  ];

  // UTF-8 BOM ensures Excel opens accented names and symbols cleanly
  const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export function downloadJsonFile(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  triggerBlobDownload(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

export function downloadHtmlReport(
  filename: string,
  documentTitle: string,
  innerHtml: string
): void {
  const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentTitle)} — JaysalTech Central Hospital Hub</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm 16mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-shell { max-width: 210mm; margin: 0 auto; }
    img { max-width: 100%; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
    .print-avoid-break { break-inside: avoid; page-break-inside: avoid; }
    .flex { display: flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .gap-3 { gap: 10px; }
    .gap-4 { gap: 14px; }
    .gap-6 { gap: 20px; }
    .justify-between { justify-content: space-between; }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .font-bold, .font-semibold { font-weight: 700; }
    .uppercase { text-transform: uppercase; }
    .border { border: 1px solid #cbd5e1; }
    .border-b-2 { border-bottom: 2px solid #0f172a; }
    .border-t { border-top: 1px solid #cbd5e1; }
    .rounded-lg { border-radius: 6px; }
    .p-3 { padding: 10px; }
    .pb-3 { padding-bottom: 10px; }
    .pt-4 { padding-top: 14px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 14px; }
    .mb-5 { margin-bottom: 18px; }
    .mt-8 { margin-top: 24px; }
    .bg-slate-50 { background: #f8fafc; }
    .text-red-700 { color: #b91c1c; }
    .text-emerald-700 { color: #047857; }
    .text-amber-700 { color: #b45309; }
    .text-teal-800 { color: #115e59; }
    .text-slate-500 { color: #64748b; }
    .text-slate-600 { color: #475569; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="report-shell">
    ${innerHtml}
  </div>
</body>
</html>`;
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  triggerBlobDownload(blob, filename.endsWith('.html') ? filename : `${filename}.html`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getModuleExportMetadata(
  moduleKey: ModuleKey,
  data: HubDatasetSnapshot
): {
  title: string;
  filenameBase: string;
  recordSummary: string;
  totalCount: number;
} {
  switch (moduleKey) {
    case 'overview':
      return {
        title: 'Hospital Network Executive Overview Report',
        filenameBase: 'jaysaltech-executive-overview',
        recordSummary: `${data.facilities.length} facilities · ${data.patients.length} patients · ${data.alerts.length} alerts`,
        totalCount: data.facilities.length + data.patients.length + data.alerts.length,
      };
    case 'population-health':
      return {
        title: 'Population & Workforce Health Early Warning Report',
        filenameBase: 'jaysaltech-population-early-warning',
        recordSummary: `${data.alerts.length} alerts · ${data.surveillance.length} surveillance logs`,
        totalCount: data.alerts.length + data.surveillance.length,
      };
    case 'screening-loop':
      return {
        title: 'Screening-to-Care Loop & Follow-Up Register',
        filenameBase: 'jaysaltech-screening-to-care',
        recordSummary: `${data.screenings.length} screenings · ${data.followUpTasks.length} tasks · ${data.campaigns.length} campaigns`,
        totalCount: data.screenings.length + data.followUpTasks.length + data.campaigns.length,
      };
    case 'patients':
      return {
        title: 'Authorized Patient Registry (All Records)',
        filenameBase: 'jaysaltech-patient-registry',
        recordSummary: `${data.patients.length} registered patients`,
        totalCount: data.patients.length,
      };
    case 'clinical':
      return {
        title: 'Clinical Encounters & Ward Register',
        filenameBase: 'jaysaltech-clinical-encounters',
        recordSummary: `${data.encounters.length} clinical encounters`,
        totalCount: data.encounters.length,
      };
    case 'laboratory':
      return {
        title: 'Clinical Laboratory Diagnostics Sheet',
        filenameBase: 'jaysaltech-laboratory-orders',
        recordSummary: `${data.labOrders.length} laboratory orders`,
        totalCount: data.labOrders.length,
      };
    case 'pharmacy':
      return {
        title: 'Pharmacy Inventory & Dispensing Report',
        filenameBase: 'jaysaltech-pharmacy-records',
        recordSummary: `${data.medicines.length} medicines · ${data.prescriptions.length} prescriptions`,
        totalCount: data.medicines.length + data.prescriptions.length,
      };
    case 'blood-bank':
      return {
        title: 'Blood Bank Inventory & Transfusion Register',
        filenameBase: 'jaysaltech-blood-bank',
        recordSummary: `${data.bloodUnits.length} blood units · ${data.bloodDonors.length} donors`,
        totalCount: data.bloodUnits.length + data.bloodDonors.length,
      };
    case 'insurance':
      return {
        title: 'Hospital Billing & Insurance Claims Statement',
        filenameBase: 'jaysaltech-insurance-claims',
        recordSummary: `${data.claims.length} insurance claims`,
        totalCount: data.claims.length,
      };
    case 'telemedicine':
      return {
        title: 'Telemedicine Consultations Schedule & Records',
        filenameBase: 'jaysaltech-telemedicine-consults',
        recordSummary: `${data.telemedicine.length} virtual consultations`,
        totalCount: data.telemedicine.length,
      };
    case 'nhie-analytics':
      return {
        title: 'NHIE Interoperability & District Executive Summary',
        filenameBase: 'jaysaltech-nhie-referrals-analytics',
        recordSummary: `${data.referrals.length} referrals · ${data.surveillance.length} district logs`,
        totalCount: data.referrals.length + data.surveillance.length,
      };
    case 'admin-docs':
      return {
        title: 'Central Administration, RBAC & Audit Governance Report',
        filenameBase: 'jaysaltech-admin-governance',
        recordSummary: `${data.facilities.length} facilities · ${data.staffUsers.length} staff · ${data.auditLogs.length} audit logs`,
        totalCount: data.facilities.length + data.staffUsers.length + data.auditLogs.length,
      };
  }
}

export function exportModuleRecordsAsCsv(
  moduleKey: ModuleKey,
  data: HubDatasetSnapshot
): number {
  const meta = getModuleExportMetadata(moduleKey, data);

  switch (moduleKey) {
    case 'patients': {
      const rows = data.patients.map((p) => ({
        PatientUID: p.patientUid,
        FullName: p.fullName,
        DateOfBirth: p.dateOfBirth,
        Gender: p.gender,
        BloodGroup: p.bloodGroup || '',
        District: p.district,
        Chiefdom: p.chiefdom || '',
        Facility: p.facilityName || p.facilityId,
        Phone: p.phone || '',
        EmergencyContact: p.emergencyContactName || '',
        EmergencyPhone: p.emergencyContactPhone || '',
        Allergies: p.allergies || '',
        ChronicConditions: p.chronicConditions || '',
        InsuranceProvider: p.insuranceProvider || '',
        InsuranceNumber: p.insuranceNumber || '',
        SyntheticDemo: p.isSynthetic ? 'Yes' : 'No',
        CreatedAt: p.createdAt,
      }));
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['PatientUID', 'FullName', 'DateOfBirth', 'Gender', 'District', 'Facility']);
      return rows.length;
    }

    case 'clinical': {
      const rows = data.encounters.map((e) => ({
        EncounterID: e.id,
        PatientUID: e.patientUid || '',
        PatientName: e.patientName,
        Facility: e.facilityName || e.facilityId,
        EncounterType: e.encounterType,
        Department: e.department,
        WardBed: e.wardBed || '',
        Clinician: e.clinicianName,
        Status: e.status,
        ChiefComplaint: e.chiefComplaint,
        VitalSigns: e.vitalSigns || '',
        NursingNotes: e.nursingNotes || '',
        Diagnosis: e.diagnosis || '',
        TreatmentPlan: e.treatmentPlan || '',
        DischargeSummary: e.dischargeSummary || '',
        UpdatedAt: e.updatedAt,
      }));
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['EncounterID', 'PatientUID', 'PatientName', 'EncounterType', 'Department', 'Status']);
      return rows.length;
    }

    case 'laboratory': {
      const rows = data.labOrders.map((l) => ({
        SampleCode: l.sampleCode,
        PatientUID: l.patientUid || '',
        PatientName: l.patientName,
        Facility: l.facilityName || l.facilityId,
        TestName: l.testName,
        ResultValue: l.resultValue || 'Pending',
        ReferenceRange: l.referenceRange || 'Standard',
        AbnormalFlag: l.abnormalFlag ? 'ABNORMAL' : 'Normal',
        Status: l.status,
        ApprovedBy: l.approvedBy || '',
        UpdatedAt: l.updatedAt,
      }));
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['SampleCode', 'PatientUID', 'PatientName', 'TestName', 'ResultValue', 'Status']);
      return rows.length;
    }

    case 'pharmacy': {
      const rows = [
        ...data.medicines.map((m) => ({
          RecordType: 'Medicine Inventory',
          ReferenceID: m.id,
          ItemOrPatient: m.name,
          Detail: `${m.category || 'General'} · Batch ${m.batchNumber} · Exp ${m.expiryDate}`,
          Quantity: `${m.stockQuantity} ${m.unit}`,
          ThresholdOrDosage: `Reorder <= ${m.reorderLevel}`,
          Status: m.stockQuantity <= m.reorderLevel ? 'LOW STOCK' : 'In Stock',
          Facility: m.facilityName || m.facilityId,
          UpdatedAt: m.updatedAt,
        })),
        ...data.prescriptions.map((r) => ({
          RecordType: 'Prescription',
          ReferenceID: r.id,
          ItemOrPatient: `${r.patientName} (${r.patientUid || ''})`,
          Detail: r.medicineName,
          Quantity: String(r.quantity),
          ThresholdOrDosage: `${r.dosage || ''} ${r.frequency || ''}`.trim(),
          Status: r.status,
          Facility: r.facilityName || r.facilityId,
          UpdatedAt: r.updatedAt,
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'ReferenceID', 'ItemOrPatient', 'Detail', 'Quantity', 'Status']);
      return rows.length;
    }

    case 'blood-bank': {
      const rows = [
        ...data.bloodUnits.map((u) => ({
          RecordType: 'Blood Unit',
          CodeOrName: u.unitCode,
          BloodGroup: u.bloodGroup,
          Detail: `${u.componentType}${u.crossMatchPatientName ? ` · Matched: ${u.crossMatchPatientName}` : ''}`,
          DateOrDistrict: `Exp: ${u.expiryDate}`,
          Status: u.status,
          Facility: u.facilityName || u.facilityId,
        })),
        ...data.bloodDonors.map((d) => ({
          RecordType: 'Blood Donor',
          CodeOrName: d.donorName,
          BloodGroup: d.bloodGroup,
          Detail: d.phone || 'No phone',
          DateOrDistrict: `${d.district}${d.lastDonationDate ? ` · Last: ${d.lastDonationDate}` : ''}`,
          Status: d.eligibilityStatus,
          Facility: d.facilityName || d.facilityId,
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'CodeOrName', 'BloodGroup', 'Detail', 'DateOrDistrict', 'Status']);
      return rows.length;
    }

    case 'insurance': {
      const rows = data.claims.map((c) => ({
        ClaimID: c.id,
        PatientUID: c.patientUid || '',
        PatientName: c.patientName,
        Facility: c.facilityName || c.facilityId,
        Insurer: c.providerName,
        PolicyNumber: c.policyNumber || '',
        ServiceDescription: c.serviceDescription,
        AmountSLE: c.amountSLL,
        Status: c.status,
        PaymentReference: c.paymentReference || '',
        UpdatedAt: c.updatedAt,
      }));
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['ClaimID', 'PatientUID', 'PatientName', 'Insurer', 'AmountSLE', 'Status']);
      return rows.length;
    }

    case 'telemedicine': {
      const rows = data.telemedicine.map((t) => ({
        AppointmentID: t.id,
        PatientUID: t.patientUid || '',
        PatientName: t.patientName,
        Facility: t.facilityName || t.facilityId,
        Doctor: t.doctorName,
        Specialty: t.specialty || '',
        ScheduledDate: t.scheduledDate,
        ScheduledTime: t.scheduledTime,
        Status: t.status,
        EndpointStatus: t.integrationEndpointStatus || '',
        Notes: t.consultationNotes || '',
      }));
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['AppointmentID', 'PatientName', 'Doctor', 'ScheduledDate', 'ScheduledTime', 'Status']);
      return rows.length;
    }

    case 'screening-loop': {
      const rows = [
        ...data.screenings.map((s) => ({
          RecordType: 'Screening Record',
          PatientUID: s.patientUid || '',
          PatientOrCampaign: s.patientName,
          District: s.district,
          Facility: s.facilityName || s.facilityId,
          Category: s.screeningType,
          MeasurementOrTarget: s.measurementSummary || '',
          ClassificationOrPriority: `${s.resultClassification} / ${s.riskLevel} Risk`,
          JourneyStageOrStatus: s.journeyStage,
          FollowUpClosed: s.followUpCompleted ? 'Yes' : 'No',
          Notes: s.clinicianDecision || '',
          UpdatedAt: s.updatedAt,
        })),
        ...data.followUpTasks.map((t) => ({
          RecordType: 'Follow-Up Task',
          PatientUID: t.patientUid || '',
          PatientOrCampaign: t.patientName,
          District: t.district || '',
          Facility: t.facilityId,
          Category: t.taskTitle,
          MeasurementOrTarget: `Due: ${t.dueDate}`,
          ClassificationOrPriority: t.priority,
          JourneyStageOrStatus: t.status,
          FollowUpClosed: t.status === 'Completed' ? 'Yes' : 'No',
          Notes: t.resolutionNotes || '',
          UpdatedAt: t.updatedAt,
        })),
        ...data.campaigns.map((c) => ({
          RecordType: 'Screening Campaign',
          PatientUID: c.id,
          PatientOrCampaign: c.title,
          District: c.district,
          Facility: c.facilityName || c.facilityId,
          Category: c.targetCondition,
          MeasurementOrTarget: `${c.screenedCount} / ${c.targetCount} screened`,
          ClassificationOrPriority: c.status,
          JourneyStageOrStatus: c.status,
          FollowUpClosed: c.status === 'Completed' ? 'Yes' : 'No',
          Notes: `Start: ${c.startDate || ''}`,
          UpdatedAt: c.updatedAt,
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'PatientUID', 'PatientOrCampaign', 'District', 'Category', 'JourneyStageOrStatus']);
      return rows.length;
    }

    case 'population-health': {
      const rows = [
        ...data.alerts.map((a) => ({
          RecordType: 'Early Warning Alert',
          Reference: a.referenceNumber,
          District: a.district,
          FacilityOrCommunity: a.community || (a.reportingFacilities || []).join('; '),
          Indicator: a.condition,
          Period: '',
          ReportedCases: a.reportedCases,
          BaselineCases: a.baselineCases,
          PercentChange: a.percentageChange ?? '',
          Severity: a.severity,
          Status: a.verificationStatus,
          TriggerOrClimate: a.triggerRule,
          RecommendedAction: a.recommendedResponse,
          Officer: a.assignedOfficer || '',
        })),
        ...data.surveillance.map((s) => ({
          RecordType: 'Surveillance Log',
          Reference: s.id,
          District: s.district,
          FacilityOrCommunity: s.facilityName || s.facilityId,
          Indicator: s.condition,
          Period: `${s.periodType} ${s.periodLabel}`,
          ReportedCases: s.reportedCases,
          BaselineCases: s.baselineCases,
          PercentChange:
            s.baselineCases > 0
              ? (((s.reportedCases - s.baselineCases) / s.baselineCases) * 100).toFixed(1)
              : '',
          Severity: (s.workforceAbsenteeismPct ?? 0) >= 12 ? 'Elevated Absenteeism' : 'Routine',
          Status: s.isAggregate ? 'De-Identified Aggregate' : 'Facility Report',
          TriggerOrClimate: `Absenteeism ${s.workforceAbsenteeismPct ?? 0}% · Coverage ${s.screeningCoveragePct ?? 0}% · ${s.climateFactor || ''}`,
          RecommendedAction: '',
          Officer: '',
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'Reference', 'District', 'Indicator', 'ReportedCases', 'BaselineCases', 'Severity', 'Status']);
      return rows.length;
    }

    case 'nhie-analytics': {
      const rows = [
        ...data.referrals.map((r) => ({
          RecordType: 'NHIE Referral',
          Reference: r.id,
          PatientOrDistrict: `${r.patientName} (${r.patientUid || ''})`,
          FromOrReported: r.fromFacilityName || r.fromFacilityId,
          ToOrBaseline: r.toFacilityName || r.toFacilityId,
          SpecialtyOrCoverage: r.specialty,
          Urgency: r.urgency,
          Status: r.status,
          AppointmentDate: r.appointmentDate || '',
          Reason: r.reason,
        })),
        ...data.surveillance.map((s) => ({
          RecordType: 'District Surveillance Metric',
          Reference: s.id,
          PatientOrDistrict: s.district,
          FromOrReported: String(s.reportedCases),
          ToOrBaseline: String(s.baselineCases),
          SpecialtyOrCoverage: `${s.screeningCoveragePct ?? 0}% coverage`,
          Urgency: s.condition,
          Status: `${s.periodType} ${s.periodLabel}`,
          AppointmentDate: '',
          Reason: s.climateFactor || '',
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'Reference', 'PatientOrDistrict', 'FromOrReported', 'ToOrBaseline', 'Status']);
      return rows.length;
    }

    case 'admin-docs': {
      const rows = [
        ...data.facilities.map((f) => ({
          RecordType: 'Healthcare Facility',
          ID: f.code,
          NameOrActor: f.name,
          RoleOrType: f.type,
          DistrictOrResource: f.district,
          Details: `${f.bedCapacity} beds · ${f.departments.join('; ')}`,
          Status: f.status,
          Timestamp: f.updatedAt,
        })),
        ...data.staffUsers.map((u) => ({
          RecordType: 'Staff User',
          ID: u.uid,
          NameOrActor: `${u.displayName} (${u.email})`,
          RoleOrType: u.role,
          DistrictOrResource: u.facilityName || u.facilityId,
          Details: u.department || '',
          Status: u.status,
          Timestamp: u.updatedAt,
        })),
        ...data.auditLogs.map((l) => ({
          RecordType: 'Audit Log',
          ID: l.id,
          NameOrActor: l.actorEmail,
          RoleOrType: l.actorRole,
          DistrictOrResource: `${l.action} (${l.resourceType})`,
          Details: l.details || '',
          Status: 'Logged',
          Timestamp: l.createdAt,
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['RecordType', 'ID', 'NameOrActor', 'RoleOrType', 'DistrictOrResource', 'Status']);
      return rows.length;
    }

    case 'overview': {
      const rows = [
        ...data.facilities.map((f) => ({
          Section: 'Facility Network',
          CodeOrRef: f.code,
          Title: f.name,
          District: f.district,
          MetricOrType: `${f.type} (${f.bedCapacity} beds)`,
          Status: f.status,
        })),
        ...data.alerts.map((a) => ({
          Section: 'Early Warning Alert',
          CodeOrRef: a.referenceNumber,
          Title: a.condition,
          District: a.district,
          MetricOrType: `${a.reportedCases} reported vs ${a.baselineCases} baseline`,
          Status: `${a.severity} (${a.verificationStatus})`,
        })),
        ...data.patients.map((p) => ({
          Section: 'Registered Patient',
          CodeOrRef: p.patientUid,
          Title: p.fullName,
          District: p.district,
          MetricOrType: `${p.gender} · ${p.facilityName || p.facilityId}`,
          Status: p.isSynthetic ? 'Synthetic Demo' : 'Active',
        })),
      ];
      exportToCsv(`${meta.filenameBase}.csv`, rows, ['Section', 'CodeOrRef', 'Title', 'District', 'MetricOrType', 'Status']);
      return rows.length;
    }
  }
}

export function buildModuleJsonBundle(
  moduleKey: ModuleKey,
  data: HubDatasetSnapshot
): Record<string, unknown> {
  const exportedAt = new Date().toISOString();
  const base = {
    platform: 'JaysalTech Central Hospital Hub',
    module: moduleKey,
    exportedAt,
  };

  switch (moduleKey) {
    case 'patients':
      return { ...base, totalPatients: data.patients.length, patients: data.patients };
    case 'clinical':
      return { ...base, totalEncounters: data.encounters.length, encounters: data.encounters };
    case 'laboratory':
      return { ...base, totalLabOrders: data.labOrders.length, labOrders: data.labOrders };
    case 'pharmacy':
      return { ...base, medicines: data.medicines, prescriptions: data.prescriptions };
    case 'blood-bank':
      return { ...base, bloodUnits: data.bloodUnits, bloodDonors: data.bloodDonors };
    case 'insurance':
      return { ...base, claims: data.claims };
    case 'telemedicine':
      return { ...base, telemedicineAppointments: data.telemedicine };
    case 'screening-loop':
      return {
        ...base,
        campaigns: data.campaigns,
        screenings: data.screenings,
        followUpTasks: data.followUpTasks,
      };
    case 'population-health':
      return {
        ...base,
        alerts: data.alerts,
        surveillanceRecords: data.surveillance,
        thresholdSettings: data.settings,
      };
    case 'nhie-analytics':
      return {
        ...base,
        referrals: data.referrals,
        surveillanceRecords: data.surveillance,
      };
    case 'admin-docs':
      return {
        ...base,
        facilities: data.facilities,
        staffUsers: data.staffUsers,
        settings: data.settings,
        auditLogs: data.auditLogs,
      };
    case 'overview':
      return {
        ...base,
        summary: {
          facilities: data.facilities.length,
          patients: data.patients.length,
          encounters: data.encounters.length,
          screenings: data.screenings.length,
          followUpTasks: data.followUpTasks.length,
          alerts: data.alerts.length,
          labOrders: data.labOrders.length,
          medicines: data.medicines.length,
          prescriptions: data.prescriptions.length,
          bloodUnits: data.bloodUnits.length,
          bloodDonors: data.bloodDonors.length,
          claims: data.claims.length,
          telemedicine: data.telemedicine.length,
          referrals: data.referrals.length,
        },
        ...data,
      };
  }
}

export function buildFhirR4Bundle(
  patient: Patient,
  encounters: Encounter[],
  labs: LabOrder[],
  screenings: ScreeningRecord[],
  referrals: Referral[]
) {
  return {
    resourceType: 'Bundle',
    id: `bundle-${patient.id}`,
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      tag: [
        {
          system: 'https://jaysaltech.sl/fhir/CodeSystem/data-origin',
          code: patient.isSynthetic ? 'synthetic-demo' : 'facility-record',
          display: patient.isSynthetic ? 'Synthetic Demonstration Record' : 'Facility Clinical Record',
        },
      ],
    },
    entry: [
      {
        fullUrl: `urn:uuid:patient-${patient.id}`,
        resource: {
          resourceType: 'Patient',
          id: patient.id,
          identifier: [
            {
              use: 'official',
              system: 'https://jaysaltech.sl/identifiers/patient-uid',
              value: patient.patientUid,
            },
          ],
          name: [{ text: patient.fullName }],
          gender: patient.gender.toLowerCase(),
          birthDate: patient.dateOfBirth,
          telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
          address: [
            {
              district: patient.district,
              city: patient.chiefdom || patient.district,
              country: 'SL',
            },
          ],
          managingOrganization: {
            reference: `Organization/${patient.facilityId}`,
            display: patient.facilityName || patient.facilityId,
          },
        },
      },
      ...encounters.map((enc) => ({
        fullUrl: `urn:uuid:encounter-${enc.id}`,
        resource: {
          resourceType: 'Encounter',
          id: enc.id,
          status: enc.status === 'Discharged' || enc.status === 'Completed' ? 'finished' : 'in-progress',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: enc.encounterType === 'Inpatient' ? 'IMP' : enc.encounterType === 'Emergency' ? 'EMER' : 'AMB',
            display: enc.encounterType,
          },
          subject: { reference: `Patient/${patient.id}`, display: patient.fullName },
          reasonCode: [{ text: enc.chiefComplaint }],
        },
      })),
      ...labs.map((lab) => ({
        fullUrl: `urn:uuid:diagnostic-${lab.id}`,
        resource: {
          resourceType: 'DiagnosticReport',
          id: lab.id,
          status: lab.status === 'Approved' ? 'final' : 'preliminary',
          code: { text: lab.testName },
          subject: { reference: `Patient/${patient.id}`, display: patient.fullName },
          conclusion: lab.resultValue
            ? `${lab.resultValue} (Ref: ${lab.referenceRange || 'N/A'})`
            : 'Pending laboratory result',
        },
      })),
      ...screenings.map((scr) => ({
        fullUrl: `urn:uuid:observation-${scr.id}`,
        resource: {
          resourceType: 'Observation',
          id: scr.id,
          status: 'final',
          category: [{ coding: [{ code: 'survey', display: 'Screening' }] }],
          code: { text: scr.screeningType },
          subject: { reference: `Patient/${patient.id}`, display: patient.fullName },
          valueString: `${scr.resultClassification} · Risk: ${scr.riskLevel} · ${scr.measurementSummary || ''}`,
        },
      })),
      ...referrals.map((ref) => ({
        fullUrl: `urn:uuid:servicerequest-${ref.id}`,
        resource: {
          resourceType: 'ServiceRequest',
          id: ref.id,
          status: ref.status === 'Completed' ? 'completed' : 'active',
          intent: 'order',
          priority: ref.urgency.toLowerCase(),
          code: { text: `Referral: ${ref.specialty}` },
          subject: { reference: `Patient/${patient.id}`, display: patient.fullName },
          requester: { display: ref.fromFacilityName || ref.fromFacilityId },
          performer: [{ display: ref.toFacilityName || ref.toFacilityId }],
          note: [{ text: ref.reason }],
        },
      })),
    ],
  };
}

export function triggerPrintReport(): void {
  window.print();
}
