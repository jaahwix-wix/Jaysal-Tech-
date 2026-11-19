import React, { useRef } from 'react';
import { Download, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import type { ModuleKey, UserProfile } from '../types/hub';
import {
  buildModuleJsonBundle,
  downloadHtmlReport,
  downloadJsonFile,
  exportModuleRecordsAsCsv,
  getModuleExportMetadata,
  type HubDatasetSnapshot,
} from '../lib/exportUtils';
import { StandardModuleReportDocument } from './StandardModuleReport';

interface Props {
  moduleKey: ModuleKey;
  user: UserProfile;
  effectiveRole: string;
  data: HubDatasetSnapshot;
  onOpenPrintPreview: () => void;
  onToast: (msg: string) => void;
}

export const ModuleRecordsToolbar: React.FC<Props> = ({
  moduleKey,
  user,
  effectiveRole,
  data,
  onOpenPrintPreview,
  onToast,
}) => {
  const hiddenReportRef = useRef<HTMLDivElement | null>(null);
  const meta = getModuleExportMetadata(moduleKey, data);

  const handleDownloadReport = () => {
    if (!hiddenReportRef.current) return;
    downloadHtmlReport(
      `${meta.filenameBase}-report.html`,
      meta.title,
      hiddenReportRef.current.innerHTML
    );
    onToast(`Downloaded standardized A4 report (${meta.filenameBase}-report.html).`);
  };

  const handleDownloadAllJson = () => {
    downloadJsonFile(
      `${meta.filenameBase}-all-records.json`,
      buildModuleJsonBundle(moduleKey, data)
    );
    onToast(`Downloaded all ${meta.totalCount} record(s) as ${meta.filenameBase}-all-records.json.`);
  };

  const handleExportCsv = () => {
    const count = exportModuleRecordsAsCsv(moduleKey, data);
    onToast(`Exported ${count} record(s) as ${meta.filenameBase}.csv.`);
  };

  return (
    <>
      <div className="no-print mb-5 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold text-slate-900">Records &amp; Reporting:</span>
          <span className="font-mono text-[11px] text-slate-700">{meta.recordSummary}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPrintPreview}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-slate-700" />
            Print Preview
          </button>
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-teal-700" />
            Download Report
          </button>
          <button
            type="button"
            onClick={handleDownloadAllJson}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-700" />
            Download JSON
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Offscreen rendered standard A4 document used for instant standalone HTML download */}
      <div ref={hiddenReportRef} className="hidden" aria-hidden="true">
        <StandardModuleReportDocument
          moduleKey={moduleKey}
          user={user}
          effectiveRole={effectiveRole}
          data={data}
        />
      </div>
    </>
  );
};
