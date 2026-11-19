import type { Encounter } from '../types/hub';

export type VitalSeverity = 'normal' | 'warning' | 'critical';

export interface ParsedVitalMetric {
  key: 'bp' | 'hr' | 'temp' | 'spo2' | 'rr';
  label: string;
  value: string;
  severity: VitalSeverity;
  note?: string;
}

export interface ParsedVitalsAnalysis {
  raw: string;
  metrics: ParsedVitalMetric[];
  overallSeverity: VitalSeverity;
  criticalFlags: string[];
}

export function parseVitalsString(raw?: string): ParsedVitalsAnalysis {
  const text = (raw || '').trim();
  const metrics: ParsedVitalMetric[] = [];
  const criticalFlags: string[] = [];

  if (!text) {
    return { raw: '', metrics: [], overallSeverity: 'normal', criticalFlags: [] };
  }

  // Blood Pressure (e.g., BP 178/108 mmHg)
  const bpMatch = text.match(/(?:bp|blood\s*pressure)\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (bpMatch) {
    const sys = Number(bpMatch[1]);
    const dia = Number(bpMatch[2]);
    let sev: VitalSeverity = 'normal';
    let note: string | undefined;
    if (sys >= 180 || dia >= 120) {
      sev = 'critical';
      note = 'Hypertensive Crisis';
      criticalFlags.push(`BP ${sys}/${dia} (${note})`);
    } else if (sys < 90 || dia < 55) {
      sev = 'critical';
      note = 'Hypotension';
      criticalFlags.push(`BP ${sys}/${dia} (${note})`);
    } else if (sys >= 160 || dia >= 100) {
      sev = 'warning';
      note = 'Severe HTN';
      criticalFlags.push(`BP ${sys}/${dia} (${note})`);
    }
    metrics.push({ key: 'bp', label: 'BP', value: `${sys}/${dia} mmHg`, severity: sev, note });
  }

  // Heart Rate (e.g., HR 126 bpm or Pulse 88)
  const hrMatch = text.match(/(?:hr|heart\s*rate|pulse)\s*[:=]?\s*(\d{2,3})/i);
  if (hrMatch) {
    const hr = Number(hrMatch[1]);
    let sev: VitalSeverity = 'normal';
    let note: string | undefined;
    if (hr >= 120) {
      sev = 'critical';
      note = 'Severe Tachycardia';
      criticalFlags.push(`HR ${hr} bpm (${note})`);
    } else if (hr <= 45) {
      sev = 'critical';
      note = 'Severe Bradycardia';
      criticalFlags.push(`HR ${hr} bpm (${note})`);
    } else if (hr >= 105 || hr <= 55) {
      sev = 'warning';
      note = hr >= 105 ? 'Tachycardia' : 'Bradycardia';
      criticalFlags.push(`HR ${hr} bpm (${note})`);
    }
    metrics.push({ key: 'hr', label: 'HR', value: `${hr} bpm`, severity: sev, note });
  }

  // Temperature (e.g., Temp 39.4 C or T 39.4°C)
  const tempMatch = text.match(/(?:temp|temperature|t)\s*[:=]?\s*(\d{2}(?:\.\d+)?)/i);
  if (tempMatch) {
    const temp = Number(tempMatch[1]);
    let sev: VitalSeverity = 'normal';
    let note: string | undefined;
    if (temp >= 39.0) {
      sev = 'critical';
      note = 'Hyperpyrexia';
      criticalFlags.push(`Temp ${temp.toFixed(1)}°C (${note})`);
    } else if (temp <= 35.0) {
      sev = 'critical';
      note = 'Hypothermia';
      criticalFlags.push(`Temp ${temp.toFixed(1)}°C (${note})`);
    } else if (temp >= 38.0) {
      sev = 'warning';
      note = 'Pyrexia';
      criticalFlags.push(`Temp ${temp.toFixed(1)}°C (${note})`);
    }
    metrics.push({ key: 'temp', label: 'Temp', value: `${temp.toFixed(1)}°C`, severity: sev, note });
  }

  // SpO2 (e.g., SpO2 96% or O2 88%)
  const spo2Match = text.match(/(?:spo2|o2\s*sat|saturation)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (spo2Match) {
    const spo2 = Number(spo2Match[1]);
    let sev: VitalSeverity = 'normal';
    let note: string | undefined;
    if (spo2 < 92) {
      sev = 'critical';
      note = 'Hypoxia';
      criticalFlags.push(`SpO2 ${spo2}% (${note})`);
    } else if (spo2 < 95) {
      sev = 'warning';
      note = 'Borderline O2';
      criticalFlags.push(`SpO2 ${spo2}% (${note})`);
    }
    metrics.push({ key: 'spo2', label: 'SpO2', value: `${spo2}%`, severity: sev, note });
  }

  // Respiratory Rate (e.g., RR 28/min)
  const rrMatch = text.match(/(?:rr|resp(?:iratory)?\s*rate)\s*[:=]?\s*(\d{1,2})/i);
  if (rrMatch) {
    const rr = Number(rrMatch[1]);
    let sev: VitalSeverity = 'normal';
    let note: string | undefined;
    if (rr >= 26) {
      sev = 'critical';
      note = 'Tachypnoea';
      criticalFlags.push(`RR ${rr}/min (${note})`);
    } else if (rr <= 8) {
      sev = 'critical';
      note = 'Bradypnoea';
      criticalFlags.push(`RR ${rr}/min (${note})`);
    } else if (rr >= 22) {
      sev = 'warning';
      note = 'Elevated RR';
      criticalFlags.push(`RR ${rr}/min (${note})`);
    }
    metrics.push({ key: 'rr', label: 'RR', value: `${rr}/min`, severity: sev, note });
  }

  const overallSeverity: VitalSeverity = metrics.some((m) => m.severity === 'critical')
    ? 'critical'
    : metrics.some((m) => m.severity === 'warning')
      ? 'warning'
      : 'normal';

  return { raw: text, metrics, overallSeverity, criticalFlags };
}

export function isEmergencyOrTriageEncounter(enc: Encounter): boolean {
  if (enc.status === 'Discharged' || enc.status === 'Completed') return false;
  if (enc.status === 'Triage' || enc.encounterType === 'Emergency' || enc.status === 'Admitted') {
    return true;
  }
  const analysis = parseVitalsString(enc.vitalSigns);
  return analysis.overallSeverity !== 'normal';
}

export function getEncounterUrgencyScore(enc: Encounter): number {
  const analysis = parseVitalsString(enc.vitalSigns);
  let score = 0;
  if (enc.status === 'Triage') score += 40;
  if (enc.encounterType === 'Emergency') score += 35;
  if (analysis.overallSeverity === 'critical') score += 30;
  if (analysis.overallSeverity === 'warning') score += 15;
  if (enc.status === 'Admitted') score += 10;
  if (enc.status === 'In Consultation') score += 5;
  return score;
}
