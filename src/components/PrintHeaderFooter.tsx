import React from 'react';

interface PrintLetterheadProps {
  documentTitle: string;
  facilityName: string;
  preparedBy: string;
  preparedRole: string;
  documentRef?: string;
  classification?: string;
  alwaysVisible?: boolean;
}

export const PrintLetterhead: React.FC<PrintLetterheadProps> = ({
  documentTitle,
  facilityName,
  preparedBy,
  preparedRole,
  documentRef,
  classification = 'CONFIDENTIAL HOSPITAL & PUBLIC HEALTH RECORD',
  alwaysVisible = false,
}) => {
  const generatedAt = new Date().toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`${alwaysVisible ? '' : 'print-only '}border-b-2 border-slate-900 pb-3 mb-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-[#0a1d37] border border-slate-300 shrink-0">
            <img
              src="/assets/aistudio/download_aecb1d1c.jpg"
              alt="JaysalTech Logo"
              className="w-full h-full object-cover object-center scale-[1.7]"
            />
          </div>
          <div>
            <div className="text-sm font-bold font-display tracking-wide text-slate-900">
              JAYSALTECH CENTRAL HOSPITAL HUB
            </div>
            <div className="text-[10px] text-teal-800 font-medium">
              Connecting Hospitals. Empowering Healthcare. Protecting Communities.
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              Facility: <strong className="text-slate-900">{facilityName}</strong>
            </div>
          </div>
        </div>

        <div className="text-right text-[10px] text-slate-700 space-y-0.5 shrink-0">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            {documentTitle}
          </div>
          {documentRef && (
            <div className="font-mono text-slate-800">Ref: {documentRef}</div>
          )}
          <div>
            Prepared By: <strong className="text-slate-900">{preparedBy}</strong> ({preparedRole})
          </div>
          <div className="font-mono">Generated: {generatedAt}</div>
          <div className="text-[9px] font-semibold tracking-wider text-slate-600 uppercase pt-0.5">
            {classification}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrintFooterProps {
  preparedBy: string;
  preparedRole: string;
  alwaysVisible?: boolean;
}

export const PrintFooter: React.FC<PrintFooterProps> = ({
  preparedBy,
  preparedRole,
  alwaysVisible = false,
}) => {
  return (
    <div className={`${alwaysVisible ? '' : 'print-only '}print-avoid-break border-t border-slate-300 pt-4 mt-8 text-[10px] text-slate-600 space-y-4`}>
      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="text-slate-500 mb-6">Prepared By (Clinician / Officer)</div>
          <div className="border-t border-slate-400 pt-1 font-medium text-slate-900">
            {preparedBy} · {preparedRole}
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-6">Verified By (Medical Officer / Supervisor)</div>
          <div className="border-t border-slate-400 pt-1 text-slate-700">
            Name, Signature &amp; Date
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-6">Official Facility Stamp</div>
          <div className="border-t border-slate-400 pt-1 text-slate-700">
            Authorized Seal
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-200 pt-2">
        <span>JaysalTech Central Hospital Hub · HL7 FHIR R4 Interoperable Record</span>
        <span>Algorithmic early-warning indicators require human clinical &amp; epidemiological verification.</span>
      </div>
    </div>
  );
};
