import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getIstDateString, getLast30Days, getLast90Days, getUserProfile, shiftIstDateString } from '../lib/queries.js';
import { useStore } from '../store/useStore.js';

const METRICS = [
  { id: 'sleep', label: 'Sleep hours' },
  { id: 'mood', label: 'Mood score' },
  { id: 'spend', label: 'Daily spend' },
  { id: 'gym', label: 'Gym (0/1)' },
];

function xpHeatColor(xp, maxXp) {
  if (!xp || xp <= 0) return '#1a1a1a';
  const t = maxXp > 0 ? xp / maxXp : 0;
  if (t < 0.25) return '#1a1a1a';
  if (t < 0.5) return '#4a5a1a';
  if (t < 0.75) return '#8aaa2a';
  return '#C8F55A';
}

function rollingAvg(arr, win, getter) {
  let best = null;
  for (let i = 0; i <= arr.length - win; i += 1) {
    const slice = arr.slice(i, i + win);
    const vals = slice.map(getter).filter((v) => v != null && !Number.isNaN(v));
    if (vals.length < win) continue;
    const avg = vals.reduce((a, c) => a + c, 0) / vals.length;
    if (best == null || avg > best.value) best = { value: avg };
  }
  return best;
}

function rollingAvgMin(arr, win, getter) {
  let best = null;
  for (let i = 0; i <= arr.length - win; i += 1) {
    const slice = arr.slice(i, i + win);
    const vals = slice.map(getter).filter((v) => v != null && !Number.isNaN(v));
    if (vals.length < win) continue;
    const avg = vals.reduce((a, c) => a + c, 0) / vals.length;
    if (best == null || avg < best.value) best = { value: avg };
  }
  return best;
}

function pick(row, id) {
  if (id === 'sleep') return Number(row.sleep_hours);
  if (id === 'mood') return Number(row.mood);
  if (id === 'spend') return Number(row.spend);
  if (id === 'gym') return row.gym_done === true ? 1 : 0;
  return NaN;
}

function buildInsight(rows, a, b) {
  if (a === b) return 'Pick two different metrics to compare.';
  const clean = rows
    .map((r) => ({ x: pick(r, a), y: pick(r, b) }))
    .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
  if (clean.length < 4) return 'Log a few more days to unlock comparisons.';

  if (a === 'sleep' && b === 'mood') {
    const good = clean.filter((p) => p.x >= 7);
    const bad = clean.filter((p) => p.x < 7);
    const avg = (arr) => (arr.length ? arr.reduce((s, p) => s + p.y, 0) / arr.length : 0);
    const gm = avg(good);
    const bm = avg(bad);
    return `On days you slept 7+ hours, avg mood was ${gm.toFixed(2)} vs ${bm.toFixed(2)} on other days.`;
  }

  const hi = clean.filter((p) => p.x >= median(clean.map((c) => c.x)));
  const lo = clean.filter((p) => p.x < median(clean.map((c) => c.x)));
  const avgY = (arr) => (arr.length ? arr.reduce((s, p) => s + p.y, 0) / arr.length : 0);
  return `Higher ${a} days averaged ${METRICS.find((m) => m.id === b)?.label}: ${avgY(hi).toFixed(
    2,
  )} vs ${avgY(lo).toFixed(2)} on lower ${a} days.`;
}

function median(nums) {
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function History() {
  const setUserProfile = useStore((s) => s.setUserProfile);
  const [logs30, setLogs30] = useState([]);
  const [logs90, setLogs90] = useState([]);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [chart, setChart] = useState('sleep');
  const [gymOverlay, setGymOverlay] = useState(true);
  const [a, setA] = useState('sleep');
  const [b, setB] = useState('mood');
  const [tip, setTip] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p, error: pe }, { data: l30, error: e30 }, { data: l90, error: e90 }] = await Promise.all([
        getUserProfile(),
        getLast30Days(),
        getLast90Days(),
      ]);
      if (cancelled) return;
      if (pe) setError(pe.message);
      if (e30) setError(e30.message);
      if (e90) setError(e90.message);
      if (p) {
        setProfile(p);
        setUserProfile(p);
      }
      setLogs30([...(l30 ?? [])].sort((x, y) => String(x.date).localeCompare(String(y.date))));
      setLogs90([...(l90 ?? [])].sort((x, y) => String(x.date).localeCompare(String(y.date))));
    })();
    return () => {
      cancelled = true;
    };
  }, [setUserProfile]);

  const chartRows = useMemo(() => {
    return logs30.map((l) => ({
      date: l.date,
      sleep: Number(l.sleep_hours),
      mood: Number(l.mood),
      spend: Number(l.spend),
      gym: l.gym_done === true ? 1 : 0,
      gymDay: l.gym_done === true,
    }));
  }, [logs30]);

  const maxXp = useMemo(() => Math.max(0, ...logs90.map((l) => Number(l.xp_earned) || 0)), [logs90]);

  const heatCells = useMemo(() => {
    const by = new Map(logs90.map((l) => [l.date, l]));
    const today = getIstDateString();
    const out = [];
    for (let i = 89; i >= 0; i -= 1) {
      const ds = shiftIstDateString(today, -i);
      const log = by.get(ds);
      const xp = log ? Number(log.xp_earned) || 0 : 0;
      const modules = log
        ? [
            log.sleep_hours != null && log.sleep_hours !== '',
            log.gym_done === true || log.gym_done === false,
            log.mood != null,
            log.spend != null,
            log.habits && typeof log.habits === 'object',
          ].filter(Boolean).length
        : 0;
      out.push({ date: ds, xp, modules, log });
    }
    return out;
  }, [logs90]);

  const bestsComputed = useMemo(() => {
    const asc = [...logs30].sort((x, y) => String(x.date).localeCompare(String(y.date)));
    const sleepWeek = rollingAvg(asc, 7, (l) => Number(l.sleep_hours));
    const maxXpDay = asc.reduce(
      (m, l) => {
        const v = Number(l.xp_earned) || 0;
        return v > m.value ? { value: v, date: l.date } : m;
      },
      { value: 0, date: null },
    );
    const spendWeek = rollingAvgMin(asc, 7, (l) => Number(l.spend));
    return {
      longest: Number(profile?.longest_streak) || 0,
      sleepWeek,
      maxXpDay,
      spendWeek,
    };
  }, [logs30, profile]);

  const insight = useMemo(() => buildInsight(logs30, a, b), [logs30, a, b]);

  const corrRows = useMemo(() => {
    return logs30.map((r) => ({
      date: r.date,
      A: pick(r, a),
      B: pick(r, b),
    }));
  }, [logs30, a, b]);

  return (
    <div className="min-h-full bg-axis-bg px-4 pb-32 pt-8">
      <div className="mx-auto max-w-md space-y-8">
        <div>
          <h1 className="font-syne text-3xl font-extrabold text-white">History</h1>
          <p className="mt-2 font-mono text-xs text-axis-muted">Last 30 days · IST dates</p>
        </div>

        {error ? <div className="font-mono text-xs text-axis-danger">{error}</div> : null}

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase text-axis-muted">Trend</div>
            <label className="flex items-center gap-2 font-mono text-[10px] text-axis-muted">
              <input type="checkbox" checked={gymOverlay} onChange={(e) => setGymOverlay(e.target.checked)} />
              Gym dots
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            {['sleep', 'mood', 'spend'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setChart(id)}
                className={`rounded-full px-3 py-2 font-mono text-[11px] ${
                  chart === id ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis width={28} tick={{ fill: '#555', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #1f1f1f', fontFamily: 'Space Mono' }}
                  labelStyle={{ color: '#C8F55A' }}
                />
                <Line
                  type="monotone"
                  dataKey={chart}
                  stroke="#C8F55A"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (!gymOverlay || !payload?.gymDay) {
                      return <circle cx={cx} cy={cy} r={2} fill="#C8F55A" />;
                    }
                    return <circle cx={cx} cy={cy} r={5} fill="#0a0a0a" stroke="#C8F55A" strokeWidth={2} />;
                  }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase text-axis-muted">Correlation</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="rounded-xl border border-axis-border bg-axis-bg px-2 py-2 font-mono text-xs text-white"
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-axis-border bg-axis-bg px-2 py-2 font-mono text-xs text-white"
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              {METRICS.map((m) => (
                <option key={`${m.id}-b`} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={corrRows}>
                <CartesianGrid stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="date" tick={false} axisLine={false} />
                <YAxis yAxisId="left" width={28} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  width={28}
                  tick={{ fill: '#555', fontSize: 10 }}
                  axisLine={false}
                />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #1f1f1f', fontFamily: 'Space Mono' }} />
                <Line yAxisId="left" type="monotone" dataKey="A" stroke="#C8F55A" dot={false} name={a} />
                <Line yAxisId="right" type="monotone" dataKey="B" stroke="#888888" dot={false} name={b} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 font-mono text-xs text-axis-muted">{insight}</p>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase text-axis-muted">XP heatmap · 90 days</div>
          <div className="mt-3 grid grid-cols-[repeat(13,1fr)] gap-1">
            {heatCells.map((c) => (
              <button
                key={c.date}
                type="button"
                className="aspect-square rounded-sm"
                style={{ backgroundColor: xpHeatColor(c.xp, maxXp || 1) }}
                onClick={() => setTip(c)}
              />
            ))}
          </div>
          {tip ? (
            <div className="mt-3 rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-xs text-axis-muted">
              <div className="text-white">{tip.date}</div>
              <div className="mt-1">XP: {tip.xp}</div>
              <div>Modules: {tip.modules}/5</div>
              <button type="button" className="mt-2 text-axis-accent" onClick={() => setTip(null)}>
                Close
              </button>
            </div>
          ) : null}
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase text-axis-muted">Personal bests</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-axis-border bg-axis-card p-4">
              <div className="font-mono text-[10px] text-axis-muted">Longest streak</div>
              <div className="mt-2 font-mono text-2xl text-white">{bestsComputed.longest}d</div>
            </div>
            <div className="rounded-xl border border-axis-border bg-axis-card p-4">
              <div className="font-mono text-[10px] text-axis-muted">Best sleep week</div>
              <div className="mt-2 font-mono text-2xl text-white">
                {bestsComputed.sleepWeek ? `${bestsComputed.sleepWeek.value.toFixed(1)}h` : '—'}
              </div>
            </div>
            <div className="rounded-xl border border-axis-border bg-axis-card p-4">
              <div className="font-mono text-[10px] text-axis-muted">Most XP / day</div>
              <div className="mt-2 font-mono text-2xl text-white">{bestsComputed.maxXpDay.value}</div>
            </div>
            <div className="rounded-xl border border-axis-border bg-axis-card p-4">
              <div className="font-mono text-[10px] text-axis-muted">Lowest spend week</div>
              <div className="mt-2 font-mono text-2xl text-white">
                {bestsComputed.spendWeek ? `₹${bestsComputed.spendWeek.value.toFixed(0)}` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
