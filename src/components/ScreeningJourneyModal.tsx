import React, { useState } from 'react';
import { X, Check, AlertTriangle, ArrowRight } from 'lucide-react';
import { JOURNEY_STAGES, type JourneyStage, type ScreeningRecord } from '../types/hub';

interface Props {
  screening: ScreeningRecord;
  onClose: () => void;
  onAdvanceStage: (
    screening: ScreeningRecord,
    nextStage: JourneyStage,
    appointmentDate: string,
    treatmentStatus: string,
    clinicianDecision: string,
    markCompleted: boolean
  ) => Promise<void>;
}

export const ScreeningJourneyModal: React.FC<Props> = ({
  screening,
  onClose,
  onAdvanceStage,
}) => {
  const currentIdx = JOURNEY_STAGES.indexOf(screening.journeyStage);
  const [nextStage, setNextStage] = useState<JourneyStage>(screening.journeyStage);
  const [appointmentDate, setAppointmentDate] = useState(screening.appointmentDate || '');
  const [treatmentStatus, setTreatmentStatus] = useState(screening.treatmentStatus || '');
  const [clinicianDecision, setClinicianDecision] = useState(screening.clinicianDecision || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const completed = nextStage === 'Follow-up Completed';
      await onAdvanceStage(
        screening,
        nextStage,
        appointmentDate,
        treatmentStatus,
        clinicianDecision,
        completed
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-6 my-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-medium text-teal-700">
              Screening-to-Care Journey Tracker
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
              {screening.patientName} · <span className="font-mono text-sm">{screening.patientUid || screening.patientId}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {screening.screeningType} · {screening.facilityName || screening.facilityId} · {screening.district}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual 8-Stage Journey Pipeline */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-700">
            8-Stage Patient Care Loop Progress
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {JOURNEY_STAGES.map((stage, idx) => {
              const isCompleted = idx < currentIdx || (screening.followUpCompleted && idx === currentIdx);
              const isCurrent = idx === currentIdx && !screening.followUpCompleted;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setNextStage(stage)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    nextStage === stage
                      ? 'border-teal-600 bg-teal-50/70'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : isCurrent
                          ? 'border-amber-300 bg-amber-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                    <span>0{idx + 1}</span>
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : isCurrent ? (
                      <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                    ) : null}
                  </div>
                  <div className="text-xs font-semibold text-slate-900 leading-snug">{stage}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Safety / Clinical Governance Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 leading-relaxed">
            <strong>Clinical Decision Safeguard:</strong> Screening classification ({screening.resultClassification}, Risk: {screening.riskLevel}) is an early-detection indicator only. It never constitutes an automated diagnosis; authorized clinicians must record confirmatory assessment and intervention status before closing follow-up.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Journey Stage
              </label>
              <select
                value={nextStage}
                onChange={(e) => setNextStage(e.target.value as JourneyStage)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {JOURNEY_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Scheduled Follow-Up Appointment Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Treatment / Intervention Status
            </label>
            <input
              type="text"
              value={treatmentStatus}
              onChange={(e) => setTreatmentStatus(e.target.value)}
              placeholder="e.g., Confirmatory workup completed, antihypertensive therapy active"
              maxLength={80}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Authorized Clinician Decision & Outcome Notes
            </label>
            <textarea
              rows={3}
              value={clinicianDecision}
              onChange={(e) => setClinicianDecision(e.target.value)}
              placeholder="Record confirmatory clinical reasoning, patient outreach outcome, and completion verification..."
              maxLength={400}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Care Journey'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
