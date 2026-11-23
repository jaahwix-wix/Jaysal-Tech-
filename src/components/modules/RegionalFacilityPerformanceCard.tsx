import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Building2, Calendar, Download, TrendingUp } from 'lucide-react';
import type { Facility } from '../../types/hub';
import { exportToCsv, type HubDatasetSnapshot } from '../../lib/exportUtils';

interface CanonicalHospitalMeta {
  id: string;
  shortName: string;
  name: string;
  code: string;
  district: string;
  bedCapacity: number;
  color: string;
}

const FIVE_REGISTERED_HOSPITALS: CanonicalHospitalMeta[] = [
  {
    id: 'fac_connaught_sl',
    shortName: 'Connaught Referral',
    name: 'Connaught National Referral Hospital',
    code: 'SL-WAU-001',
    district: 'Western Area Urban',
    bedCapacity: 320,
    color: '#0f766e',
  },
  {
    id: 'fac_bo_gov',
    shortName: 'Bo Regional',
    name: 'Bo Government Regional Hospital',
    code: 'SL-BO-002',
    district: 'Bo',
    bedCapacity: 240,
    color: '#2563eb',
  },
  {
    id: 'fac_kenema_gov',
    shortName: 'Kenema Gov',
    name: 'Kenema Government Hospital',
    code: 'SL-KEN-003',
    district: 'Kenema',
    bedCapacity: 210,
    color: '#d97706',
  },
  {
    id: 'fac_makeni_reg',
    shortName: 'Makeni Regional',
    name: 'Makeni Regional Hospital',
    code: 'SL-BOM-004',
    district: 'Bombali',
    bedCapacity: 185,
    color: '#7c3aed',
  },
  {
    id: 'fac_portloko_chc',
    shortName: 'Port Loko CHC',
    name: 'Port Loko District Diagnostic & Health Centre',
    code: 'SL-PLK-005',
    district: 'Port Loko',
    bedCapacity: 75,
    color: '#e11d48',
  },
];

const EXTRA_COLORS = ['#0891b2', '#4f46e5', '#059669', '#ea580c', '#be185d'];

type LoadMetric = 'combined' | 'encounters' | 'cumulative';
type ChartKind = 'line' | 'area' | 'bar';
type RangeDays = 7 | 30 | 90;

interface Props {
  facilities: Facility[];
  hubData?: HubDatasetSnapshot;
  onToast?: (msg: string) => void;
}

function toIsoDateKey(raw?: string): string {
  if (!raw || raw.length < 10) return '';
  return raw.slice(0, 10);
}

function formatAxisDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const RegionalFacilityPerformanceCard: React.FC<Props> = ({ facilities, hubData, onToast }) => {
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [metric, setMetric] = useState<LoadMetric>('combined');
  const [chartKind, setChartKind] = useState<ChartKind>('line');
  const [hiddenFacilityIds, setHiddenFacilityIds] = useState<string[]>([]);

  // Resolve the 5 registered hospitals cleanly from Firestore + canonical Sierra Leone defaults
  const trackedHospitals = useMemo(() => {
    const liveMap = new Map<string, Facility>();
    facilities.forEach((f) => liveMap.set(f.id, f));

    const canonicalIds = new Set(FIVE_REGISTERED_HOSPITALS.map((h) => h.id));
    const resolved = FIVE_REGISTERED_HOSPITALS.map((base) => {
      const live = liveMap.get(base.id);
      return {
        id: base.id,
        shortName: base.shortName,
        name: live?.name || base.name,
        code: live?.code || base.code,
        district: live?.district || base.district,
        bedCapacity: live?.bedCapacity ?? base.bedCapacity,
        status: live?.status || 'Approved',
        color: base.color,
      };
    });

    // If custom facilities were registered in place of defaults and fewer than 5 canonical match live
    const extraLive = facilities.filter((f) => !canonicalIds.has(f.id));
    if (facilities.length > 0 && extraLive.length > 0 && resolved.every((r) => !liveMap.has(r.id))) {
      return facilities.slice(0, 5).map((f, idx) => ({
        id: f.id,
        shortName: f.name.split(' ').slice(0, 2).join(' '),
        name: f.name,
        code: f.code,
        district: f.district,
        bedCapacity: f.bedCapacity,
        status: f.status,
        color: FIVE_REGISTERED_HOSPITALS[idx]?.color || EXTRA_COLORS[idx % EXTRA_COLORS.length],
      }));
    }

    return resolved;
  }, [facilities]);

  // Build rolling calendar window (7 / 30 / 90 days) + live counts per facility
  const { chartData, summaryByHospital, totalWindowLoad, peakDayInfo } = useMemo(() => {
    const days: { dateKey: string; label: string }[] = [];
    const today = new Date();
    for (let offset = rangeDays - 1; offset >= 0; offset--) {
      const dt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
      const dateKey = dt.toISOString().slice(0, 10);
      days.push({
        dateKey,
        label: formatAxisDate(dateKey),
      });
    }

    const dayIndexMap = new Map<string, number>();
    days.forEach((d, idx) => dayIndexMap.set(d.dateKey, idx));

    const encounters = hubData?.encounters || [];
    const patients = hubData?.patients || [];
    const screenings = hubData?.screenings || [];
    const labOrders = hubData?.labOrders || [];

    // Initialize daily counts matrix
    const dailyCombined: Record<string, number[]> = {};
    const dailyEncounters: Record<string, number[]> = {};
    trackedHospitals.forEach((h) => {
      dailyCombined[h.id] = new Array(rangeDays).fill(0);
      dailyEncounters[h.id] = new Array(rangeDays).fill(0);
    });

    const addCount = (map: Record<string, number[]>, facilityId: string, dateStr?: string) => {
      if (!map[facilityId]) return;
      const key = toIsoDateKey(dateStr);
      const idx = dayIndexMap.get(key);
      if (idx !== undefined) {
        map[facilityId][idx] += 1;
      }
    };

    encounters.forEach((e) => {
      addCount(dailyEncounters, e.facilityId, e.createdAt);
      addCount(dailyCombined, e.facilityId, e.createdAt);
    });
    patients.forEach((p) => addCount(dailyCombined, p.facilityId, p.createdAt));
    screenings.forEach((s) => addCount(dailyCombined, s.facilityId, s.createdAt));
    labOrders.forEach((l) => addCount(dailyCombined, l.facilityId, l.createdAt));

    // Cumulative matrix
    const runningTotals: Record<string, number> = {};
    trackedHospitals.forEach((h) => {
      runningTotals[h.id] = 0;
    });

    let totalLoad = 0;
    let peakDay = { label: days[days.length - 1]?.label || 'Today', count: 0 };

    const rows = days.map((d, idx) => {
      const point: Record<string, string | number> = {
        dateKey: d.dateKey,
        dateLabel: d.label,
      };
      let daySum = 0;
      trackedHospitals.forEach((h) => {
        const combVal = dailyCombined[h.id][idx] || 0;
        const encVal = dailyEncounters[h.id][idx] || 0;
        runningTotals[h.id] += combVal;

        const val =
          metric === 'encounters'
            ? encVal
            : metric === 'cumulative'
              ? runningTotals[h.id]
              : combVal;
        point[h.id] = val;
        daySum += combVal;
      });
      totalLoad += daySum;
      if (daySum >= peakDay.count) {
        peakDay = { label: d.label, count: daySum };
      }
      return point;
    });

    const summaries = trackedHospitals.map((h) => {
      const loadWindow = dailyCombined[h.id].reduce((sum, n) => sum + n, 0);
      const encWindow = dailyEncounters[h.id].reduce((sum, n) => sum + n, 0);
      const activeEncounters = encounters.filter(
        (e) => e.facilityId === h.id && e.status !== 'Discharged' && e.status !== 'Completed'
      ).length;
      const registeredPatients = patients.filter((p) => p.facilityId === h.id).length;
      const utilizationPct =
        h.bedCapacity > 0 ? Math.min(100, Math.round((activeEncounters / h.bedCapacity) * 100)) : 0;

      return {
        ...h,
        loadWindow,
        encWindow,
        activeEncounters,
        registeredPatients,
        utilizationPct,
      };
    });

    return {
      chartData: rows,
      summaryByHospital: summaries,
      totalWindowLoad: totalLoad,
      peakDayInfo: peakDay,
    };
  }, [trackedHospitals, hubData, metric, rangeDays]);

  const toggleHospitalSeries = (id: string) => {
    setHiddenFacilityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const visibleHospitals = trackedHospitals.filter((h) => !hiddenFacilityIds.includes(h.id));
  const xAxisInterval = rangeDays === 7 ? 0 : rangeDays === 30 ? 4 : 13;

  const metricLabel =
    metric === 'encounters'
      ? 'Clinical Encounters / Day'
      : metric === 'cumulative'
        ? `Cumulative ${rangeDays}-Day Patient Load`
        : 'Total Patient Load / Day';

  const handleDownloadCsv = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const csvRows = chartData.map((point) => {
      const row: Record<string, unknown> = {
        Date: point.dateKey,
        Date_Label: point.dateLabel,
        Timeframe_Days: rangeDays,
        Metric_View: metricLabel,
      };
      let networkTotal = 0;
      trackedHospitals.forEach((h) => {
        const value = Number(point[h.id] ?? 0);
        row[`${h.shortName} (${h.code})`] = value;
        networkTotal += value;
      });
      row['Network_Total'] = networkTotal;
      return row;
    });

    exportToCsv(`regional_facility_performance_${rangeDays}d_${metric}_${todayIso}.csv`, csvRows);
    onToast?.(`Exported ${rangeDays}-day Regional Facility Performance CSV report.`);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      {/* Card Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-700" />
            <h3 className="text-base font-bold text-slate-900">Regional Facility Performance</h3>
            <span className="text-[11px] font-mono font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
              Last {rangeDays} Days
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Patient load trends across the five registered Sierra Leone hospitals computed from live Firestore registrations, encounters, screenings, and lab activity.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          {/* Date Range Selector (7d / 30d / 90d) */}
          <div
            role="group"
            aria-label="Select performance date range"
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg"
          >
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRangeDays(days)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  rangeDays === days
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                ['combined', 'Daily Load'],
                ['encounters', 'Encounters'],
                ['cumulative', `${rangeDays}d Cumulative`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  metric === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                ['line', 'Line'],
                ['area', 'Area'],
                ['bar', 'Bar'],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setChartKind(kind)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartKind === kind
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Top Network Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">{rangeDays}-Day Network Patient Load</div>
            <div className="text-lg font-bold font-mono text-slate-900">{totalWindowLoad}</div>
          </div>
          <Activity className="w-4 h-4 text-teal-700" />
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Peak Network Day ({rangeDays}d)</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {peakDayInfo.count} <span className="text-xs font-sans font-normal text-slate-500">on {peakDayInfo.label}</span>
            </div>
          </div>
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-500">Tracked Registered Hospitals</div>
            <div className="text-lg font-bold font-mono text-slate-900">
              {trackedHospitals.length} <span className="text-xs font-sans font-normal text-slate-500">Facilities</span>
            </div>
          </div>
          <Building2 className="w-4 h-4 text-slate-600" />
        </div>
      </div>

      {/* Interactive Hospital Series Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {trackedHospitals.map((h) => {
            const hidden = hiddenFacilityIds.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => toggleHospitalSeries(h.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-opacity ${
                  hidden
                    ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
                title={`Click to ${hidden ? 'show' : 'hide'} ${h.name}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: h.color }}
                />
                <span className="font-medium">{h.shortName}</span>
                <span className="text-[10px] font-mono text-slate-500">{h.code}</span>
              </button>
            );
          })}
        </div>
        <div className="text-[11px] font-medium text-slate-500">{metricLabel}</div>
      </div>

      {/* Recharts Trend Visualization */}
      <div className="w-full h-[300px] border border-slate-100 rounded-xl bg-slate-50/40 pt-3 pr-3 pb-1 pl-0">
        {visibleHospitals.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            Select at least one hospital in the legend above to display patient load trends.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartKind === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={xAxisInterval}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(max + 1, 4)]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                  }}
                />
                {visibleHospitals.map((h) => (
                  <Area
                    key={h.id}
                    type="monotone"
                    dataKey={h.id}
                    name={h.shortName}
                    stroke={h.color}
                    fill={h.color}
                    fillOpacity={0.14}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            ) : chartKind === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={xAxisInterval}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(max + 1, 4)]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                  }}
                />
                {visibleHospitals.map((h) => (
                  <Bar
                    key={h.id}
                    dataKey={h.id}
                    name={h.shortName}
                    fill={h.color}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={xAxisInterval}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(max + 1, 4)]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                  }}
                />
                {visibleHospitals.map((h) => (
                  <Line
                    key={h.id}
                    type="monotone"
                    dataKey={h.id}
                    name={h.shortName}
                    stroke={h.color}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* 5-Hospital Performance Scorecard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {summaryByHospital.map((h) => (
          <div
            key={h.id}
            className="border border-slate-200 rounded-xl p-3 bg-white space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: h.color }}
                  />
                  <span className="text-xs font-bold text-slate-900 truncate" title={h.name}>
                    {h.shortName}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  {h.code} · {h.district}
                </div>
              </div>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                  h.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : h.status === 'Suspended'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {h.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 text-center">
              <div>
                <div className="text-[10px] text-slate-500">{rangeDays}d Load</div>
                <div className="text-xs font-bold font-mono text-slate-900">{h.loadWindow}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Patients</div>
                <div className="text-xs font-bold font-mono text-slate-900">{h.registeredPatients}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Active Enc.</div>
                <div className="text-xs font-bold font-mono text-slate-900">{h.activeEncounters}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Bed Load ({h.activeEncounters}/{h.bedCapacity})</span>
                <span className="font-mono font-semibold text-slate-700">{h.utilizationPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(h.utilizationPct, h.activeEncounters > 0 ? 4 : 0)}%`,
                    backgroundColor: h.color,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
