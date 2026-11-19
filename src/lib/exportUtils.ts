import type { Encounter, LabOrder, Patient, Referral, ScreeningRecord } from '../types/hub';

export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const raw = row[h] === undefined || row[h] === null ? '' : String(row[h]);
          const escaped = raw.replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
