import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileJson, FileSpreadsheet, Printer, X } from 'lucide-react';
import type { ModuleKey, UserProfile } from '../types/hub';
import {
  buildModuleJsonBundle,
  downloadHtmlReport,
  downloadJsonFile,
  exportModuleRecordsAsCsv,
  getModuleExportMetadata,
  triggerPrintReport,
  type HubDatasetSnapshot,
} from '../lib/exportUtils';
import { StandardModuleReportDocument } from './StandardModuleReport';

interface Props {
  moduleKey: ModuleKey;
  user: UserProfile;
  effectiveRole: string;
  data: HubDatasetSnapshot;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const PrintPreviewModal: React.FC<Props> = ({
  moduleKey,
  user,
  effectiveRole,
  data,
  onClose,
  onToast,
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const meta = getModuleExportMetadata(moduleKey, data);

  useEffect(() => {
    document.body.classList.add('printing-module-report');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.classList.remove('printing-module-report');
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleDownloadHtml = () => {
    if (!previewRef.current) return;
    downloadHtmlReport(`${meta.filenameBase}-report.html`, meta.title, previewRef.current.innerHTML);
    onToast(`Downloaded standardized HTML report (${meta.filenameBase}-report.html).`);
  };

  const handleDownloadJson = () => {
    downloadJsonFile(`${meta.filenameBase}-all-records.json`, buildModuleJsonBundle(moduleKey, data));
    onToast(`Downloaded complete JSON archive (${meta.filenameBase}-all-records.json).`);
  };

  const handleExportCsv = () => {
    const count = exportModuleRecordsAsCsv(moduleKey, data);
    onToast(`Exported ${count} record(s) to ${meta.filenameBase}.csv.`);
  };

  const printPortal = createPortal(
    <div className="module-report-print-portal">
      <StandardModuleReportDocument
        moduleKey={moduleKey}
        user={user}
        effectiveRole={effectiveRole}
        data={data}
      />
    </div>,
    document.body
  );

  return (
    <>
      {printPortal}
      <div className="no-print fixed inset-0 z-50 bg-slate-900/75 flex flex-col">
        {/* Preview Toolbar */}
        <div className="bg-slate-950 text-white px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-bold font-display tracking-wide text-teal-300 uppercase">
              Standard A4 Print Preview
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {meta.title} · <span className="text-slate-300 font-normal">{meta.recordSummary}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-300" />
              Download JSON
            </button>
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg"
            >
              <Download className="w-3.5 h-3.5 text-sky-300" />
              Download Report
            </button>
            <button
              type="button"
              onClick={triggerPrintReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Document
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              aria-label="Close print preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Centered A4 Paper Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div
            ref={previewRef}
            className="w-full max-w-[210mm] min-h-[297mm] mx-auto bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-sm p-6 sm:p-10"
          >
            <StandardModuleReportDocument
              moduleKey={moduleKey}
              user={user}
              effectiveRole={effectiveRole}
              data={data}
            />
          </div>
        </div>
      </div>
    </>
  );
};
