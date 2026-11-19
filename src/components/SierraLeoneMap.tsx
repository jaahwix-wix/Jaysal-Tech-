import React from 'react';
import type { PublicHealthAlert, SurveillanceRecord } from '../types/hub';

interface DistrictGeo {
  name: string;
  x: number;
  y: number;
  r: number;
  region: string;
}

const DISTRICT_COORDS: DistrictGeo[] = [
  { name: 'Kambia', x: 105, y: 120, r: 22, region: 'North West' },
  { name: 'Karene', x: 165, y: 112, r: 24, region: 'North West' },
  { name: 'Falaba', x: 265, y: 92, r: 25, region: 'Northern' },
  { name: 'Koinadugu', x: 295, y: 145, r: 25, region: 'Northern' },
  { name: 'Bombali', x: 215, y: 155, r: 26, region: 'Northern' },
  { name: 'Port Loko', x: 132, y: 172, r: 24, region: 'North West' },
  { name: 'Tonkolili', x: 240, y: 205, r: 25, region: 'Northern' },
  { name: 'Kono', x: 328, y: 208, r: 25, region: 'Eastern' },
  { name: 'Western Area Urban', x: 84, y: 208, r: 18, region: 'Western' },
  { name: 'Western Area Rural', x: 106, y: 232, r: 18, region: 'Western' },
  { name: 'Moyamba', x: 158, y: 252, r: 25, region: 'Southern' },
  { name: 'Bo', x: 222, y: 268, r: 26, region: 'Southern' },
  { name: 'Kenema', x: 295, y: 266, r: 26, region: 'Eastern' },
  { name: 'Kailahun', x: 356, y: 252, r: 24, region: 'Eastern' },
  { name: 'Bonthe', x: 166, y: 318, r: 23, region: 'Southern' },
  { name: 'Pujehun', x: 245, y: 332, r: 25, region: 'Southern' },
];

interface Props {
  alerts: PublicHealthAlert[];
  surveillance: SurveillanceRecord[];
  selectedDistrict: string;
  onSelectDistrict: (district: string) => void;
}

export const SierraLeoneMap: React.FC<Props> = ({
  alerts,
  surveillance,
  selectedDistrict,
  onSelectDistrict,
}) => {
  const getDistrictStatus = (name: string) => {
    const distAlerts = alerts.filter(
      (a) => a.district === name && a.verificationStatus !== 'Resolved' && a.verificationStatus !== 'Dismissed'
    );
    const distSurv = surveillance.filter((s) => s.district === name);
    const cases = distSurv.reduce((sum, s) => sum + s.reportedCases, 0);

    let severityColor = '#E2E8F0';
    let strokeColor = '#94A3B8';
    let textColor = '#0F172A';
    let highestSeverity = 'Nominal';

    if (distAlerts.some((a) => a.severity === 'Critical')) {
      severityColor = '#DC2626';
      strokeColor = '#991B1B';
      textColor = '#FFFFFF';
      highestSeverity = 'Critical';
    } else if (distAlerts.some((a) => a.severity === 'High')) {
      severityColor = '#EA580C';
      strokeColor = '#9A3412';
      textColor = '#FFFFFF';
      highestSeverity = 'High';
    } else if (distAlerts.some((a) => a.severity === 'Moderate')) {
      severityColor = '#D97706';
      strokeColor = '#92400E';
      textColor = '#FFFFFF';
      highestSeverity = 'Moderate';
    } else if (distAlerts.some((a) => a.severity === 'Low' || a.severity === 'Informational')) {
      severityColor = '#0D9488';
      strokeColor = '#115E59';
      textColor = '#FFFFFF';
      highestSeverity = 'Low / Info';
    } else if (cases > 0) {
      severityColor = '#CCFBF1';
      strokeColor = '#0D9488';
      textColor = '#0F172A';
    }

    return {
      alertsCount: distAlerts.length,
      cases,
      severityColor,
      strokeColor,
      textColor,
      highestSeverity,
    };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Sierra Leone District Surveillance Topology
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any of the 16 districts to filter alerts, cases, and workforce indicators
          </p>
        </div>
        {selectedDistrict !== 'All' && (
          <button
            type="button"
            onClick={() => onSelectDistrict('All')}
            className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
          >
            Clear filter ({selectedDistrict})
          </button>
        )}
      </div>

      <div className="relative flex-1 flex items-center justify-center bg-slate-50 border border-slate-200/80 rounded-lg p-3 overflow-hidden">
        <svg viewBox="0 0 430 400" className="w-full max-w-[440px] h-auto select-none" role="img" aria-label="Interactive Sierra Leone 16-District Public Health Surveillance Map">
          {/* National border silhouette */}
          <path
            d="M 88,108 L 152,78 L 245,62 L 320,88 L 355,155 L 386,238 L 368,288 L 304,316 L 265,368 L 210,360 L 140,336 L 106,276 L 64,225 L 78,175 Z"
            fill="#F1F5F9"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* District connection lines representing regional referral corridors */}
          <g stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3">
            <line x1="84" y1="208" x2="132" y2="172" />
            <line x1="132" y1="172" x2="215" y2="155" />
            <line x1="84" y1="208" x2="158" y2="252" />
            <line x1="158" y1="252" x2="222" y2="268" />
            <line x1="222" y1="268" x2="295" y2="266" />
            <line x1="295" y1="266" x2="356" y2="252" />
            <line x1="215" y1="155" x2="240" y2="205" />
            <line x1="240" y1="205" x2="222" y2="268" />
          </g>

          {DISTRICT_COORDS.map((d) => {
            const st = getDistrictStatus(d.name);
            const isSelected = selectedDistrict === d.name;
            return (
              <g
                key={d.name}
                onClick={() => onSelectDistrict(isSelected ? 'All' : d.name)}
                className="cursor-pointer group"
              >
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={d.r}
                  fill={st.severityColor}
                  stroke={isSelected ? '#0F172A' : st.strokeColor}
                  strokeWidth={isSelected ? 3 : 1.5}
                  className="transition-opacity group-hover:opacity-90"
                />
                <text
                  x={d.x}
                  y={d.y - 2}
                  textAnchor="middle"
                  fill={st.textColor}
                  fontSize="8.5"
                  fontWeight="600"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  {d.name.replace('Western Area ', 'W. ')}
                </text>
                <text
                  x={d.x}
                  y={d.y + 9}
                  textAnchor="middle"
                  fill={st.textColor}
                  fontSize="7.5"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {st.cases > 0 ? `${st.cases}c` : '—'}
                  {st.alertsCount > 0 ? ` · ${st.alertsCount}!` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" /> Critical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-orange-600 inline-block" /> High
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 inline-block" /> Moderate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block" /> Low / Info
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-100 border border-teal-600 inline-block" /> Active Baseline
          </span>
        </div>
        <span className="text-slate-500">16 Sierra Leone Districts</span>
      </div>
    </div>
  );
};
