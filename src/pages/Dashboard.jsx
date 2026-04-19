import { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';
import TodayPanel from '../components/TodayPanel.jsx';
import { getIstDateString, getLast30Days, getTodayLog, getUserProfile } from '../lib/queries.js';
import {
  BADGE_IDS,
  countModulesLogged,
  getIstWeekDates,
  getLevelFromXP,
  moodStripColor,
  normalizeHabitList,
} from '../lib/xpEngine.js';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';
import { useStore } from '../store/useStore.js';

const BADGE_META = {
  first_blood: { name: 'First Blood', emoji: '⚡' },
  week_warrior: { name: 'Week Warrior', emoji: '🔥' },
  iron_body: { name: 'Iron Body', emoji: '💪' },
  monk_mode: { name: 'Monk Mode', emoji: '🧘' },
  deep_sleeper: { name: 'Deep Sleeper', emoji: '🌙' },
  broke_proof: { name: 'Broke Proof', emoji: '💰' },
  no_zero_days: { name: 'No Zero Days', emoji: '🗓️' },
};

function useIstHour() {
  const [hour, setHour] = useState(0);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    });
    const tick = () => {
      const parts = fmt.formatToParts(new Date());
      const h = Number(parts.find((p) => p.type === 'hour')?.value || '0');
      setHour(h);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return hour;
}

function greetingForHour(h) {
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function habitIntensityColor(pct) {
  if (pct <= 0) return '#333333';
  if (pct < 0.34) return '#2a331f';
  if (pct < 0.67) return '#5a6a22';
  return '#8aaa2a';
}

function XpToast() {
  const xpToast = useStore((s) => s.xpToast);
  const setXpToast = useStore((s) => s.setXpToast);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!xpToast) return;
    setOpen(false);
    const t = setTimeout(() => setXpToast(null), 4000);
    return () => clearTimeout(t);
  }, [xpToast, setXpToast]);

  if (!xpToast) return null;

  return (
    <div className="pointer-events-auto fixed bottom-24 left-0 right-0 z-40 px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto block w-full max-w-md rounded-xl border border-axis-border bg-axis-card px-4 py-4 text-left"
      >
        <div className="font-mono text-3xl font-bold text-axis-accent">+{xpToast.total} XP</div>
        <div className="mt-1 font-mono text-[10px] text-axis-muted">Tap for breakdown</div>
        {open ? (
          <div className="mt-3 space-y-2 border-t border-axis-border pt-3">
            {xpToast.breakdown.map((b) => (
              <div key={b.id} className="flex items-center justify-between font-mono text-xs text-axis-muted">
                <span>{b.label}</span>
                <span className="text-axis-accent">+{b.xp}</span>
              </div>
            ))}
          </div>
        ) : null}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const hour = useIstHour();
  const setLogModalOpen = useStore((s) => s.setLogModalOpen);
  const userProfile = useStore((s) => s.userProfile);
  const setUserProfile = useStore((s) => s.setUserProfile);

  const [todayLog, setTodayLog] = useState(null);
  const [weekLogs, setWeekLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [levelUp, setLevelUp] = useState(null);
  const [streakLost, setStreakLost] = useState(false);

  const habitList = useMemo(() => normalizeHabitList(userProfile?.habit_list), [userProfile]);

  const refresh = useCallback(async () => {
    setLoadError('');
    const [{ data: prof, error: pe }, { data: log, error: le }, { data: logs, error: we }] = await Promise.all([
      getUserProfile(),
      getTodayLog(),
      getLast30Days(),
    ]);
    if (pe) setLoadError(pe.message);
    if (le) setLoadError(le.message);
    if (we) setLoadError(we.message);
    if (prof) setUserProfile(prof);
    setTodayLog(log);
    setWeekLogs(logs ?? []);
  }, [setUserProfile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const username = userProfile?.username || 'friend';
  const todayStr = getIstDateString();

  const modulesCount = useMemo(() => countModulesLogged(todayLog, habitList), [todayLog, habitList]);

  const radialData = useMemo(
    () => [{ name: 'modules', value: modulesCount, fill: '#C8F55A' }],
    [modulesCount],
  );

  const levelInfo = useMemo(() => getLevelFromXP(userProfile?.total_xp ?? 0), [userProfile?.total_xp]);
  const xpDisplay = useAnimatedNumber(userProfile?.total_xp ?? 0, 1000);

  const weekDates = useMemo(() => getIstWeekDates(), []);
  const logsByDate = useMemo(() => new Map(weekLogs.map((l) => [l.date, l])), [weekLogs]);

  const budget = Number(userProfile?.daily_budget) || 0;

  const earnedBadges = useMemo(() => {
    const raw = userProfile?.badges;
    if (Array.isArray(raw)) return new Set(raw);
    return new Set();
  }, [userProfile?.badges]);

  return (
    <div className="min-h-full bg-axis-bg pb-32">
      {levelUp ? (
        <div className="pointer-events-none fixed inset-0 z-50 bg-axis-accent/10" />
      ) : null}
      {levelUp ? (
        <div className="fixed left-0 right-0 top-10 z-50 px-4">
          <div className="mx-auto max-w-md rounded-xl border border-axis-border bg-axis-card px-4 py-4 text-center">
            <div className="font-mono text-xs text-axis-muted">LEVEL UP</div>
            <div className="mt-2 font-syne text-2xl font-bold text-axis-accent">
              LVL {levelUp.level} · {levelUp.title}
            </div>
          </div>
        </div>
      ) : null}

      {streakLost ? (
        <div className="fixed left-0 right-0 top-10 z-50 px-4">
          <div className="mx-auto max-w-md rounded-xl border border-axis-danger bg-axis-card px-4 py-4 text-center">
            <div className="font-mono text-xs text-axis-danger">Streak lost</div>
            <div className="mt-2 font-mono text-sm text-axis-muted">Yesterday had no log. Streak reset.</div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-md px-4 pt-8 axis-stagger space-y-6">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs text-axis-accent">
            LVL {levelInfo.level} · {levelInfo.title}
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-white">
              🔥 <span className="text-axis-accent">{userProfile?.streak_days ?? 0}</span>
            </div>
            <div className="font-mono text-[10px] text-axis-muted">day streak</div>
          </div>
        </div>

        {loadError ? <div className="font-mono text-xs text-axis-danger">{loadError}</div> : null}

        <div>
          <div className="font-syne text-4xl font-extrabold tracking-tight text-white">
            {greetingForHour(hour)}, {username}
          </div>
          <div className="mt-2 font-mono text-sm text-axis-muted">{todayStr}</div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="68%"
                outerRadius="100%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 5]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: '#1a1a1a' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="-mt-36 flex items-center justify-center pb-10">
              <div className="font-mono text-4xl font-bold text-white">
                {modulesCount}
                <span className="text-axis-muted">/5</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-axis-muted">7-day strip</div>
          <div className="mt-4 space-y-3">
            {[
              { key: 'sleep', label: 'Sleep' },
              { key: 'gym', label: 'Gym' },
              { key: 'mood', label: 'Mood' },
              { key: 'spend', label: 'Spend' },
              { key: 'habits', label: 'Habits' },
            ].map((row) => (
              <div key={row.key} className="grid grid-cols-[92px_1fr] items-center gap-3">
                <div className="font-mono text-[11px] text-axis-muted">{row.label}</div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDates.map((d) => {
                    const log = logsByDate.get(d);
                    let bg = '#333333';
                    if (row.key === 'sleep') {
                      if (!log) bg = '#333333';
                      else {
                        const h = Number(log.sleep_hours);
                        if (Number.isNaN(h)) bg = '#333333';
                        else if (h < 6) bg = '#FF4444';
                        else if (h >= 7) bg = '#C8F55A';
                        else bg = '#888888';
                      }
                    }
                    if (row.key === 'gym') {
                      if (!log) bg = '#333333';
                      else if (log.gym_done === true) bg = '#C8F55A';
                      else if (log.gym_done === false) bg = '#333333';
                    }
                    if (row.key === 'mood') {
                      if (!log || log.mood == null) bg = '#333333';
                      else bg = moodStripColor(log.mood);
                    }
                    if (row.key === 'spend') {
                      if (!log || log.spend == null) bg = '#333333';
                      else {
                        const s = Number(log.spend);
                        if (budget > 0 && s > budget) bg = '#FF4444';
                        else if (budget > 0 && s <= budget) bg = '#C8F55A';
                        else bg = '#888888';
                      }
                    }
                    if (row.key === 'habits') {
                      if (!log) bg = '#333333';
                      else {
                        const map = log.habits && typeof log.habits === 'object' ? log.habits : {};
                        const list = habitList;
                        if (!list.length) bg = '#333333';
                        else {
                          const done = list.filter((n) => map[n] === true).length;
                          bg = habitIntensityColor(done / list.length);
                        }
                      }
                    }
                    return <div key={d} className="h-6 rounded-md" style={{ backgroundColor: bg }} title={d} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="text-center font-syne text-lg text-white">{levelInfo.title}</div>
          <div className="mt-3 flex items-center justify-between font-mono text-xs text-axis-muted">
            <span>{xpDisplay} XP</span>
            <span>{levelInfo.isMax ? 'MAX' : `${levelInfo.nextLevelXP} XP`}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-axis-border">
            <div
              className="h-2 rounded-full bg-axis-accent"
              style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-axis-muted">Badges</div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {BADGE_IDS.map((id) => {
              const meta = BADGE_META[id];
              const earned = earnedBadges.has(id);
              return (
                <div
                  key={id}
                  className={`min-w-[140px] rounded-xl border px-3 py-3 ${
                    earned ? 'border-axis-accent' : 'border-axis-border opacity-40'
                  }`}
                >
                  <div className={`text-2xl ${earned ? '' : 'blur-[2px] grayscale'}`}>{meta.emoji}</div>
                  <div className={`mt-2 font-mono text-[11px] ${earned ? 'text-white' : 'text-axis-muted blur-[1px]'}`}>
                    {meta.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setLogModalOpen(true)}
        className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-axis-accent px-6 py-4 font-mono text-sm font-bold text-axis-bg shadow-lg"
      >
        LOG TODAY →
      </button>

      <XpToast />

      <TodayPanel
        profile={userProfile}
        onProfileUpdated={(p) => {
          setUserProfile(p);
          refresh();
          setTimeout(() => setLevelUp(null), 1600);
          setTimeout(() => setStreakLost(false), 2200);
        }}
        onLevelUp={(info) => {
          setLevelUp(info);
          confetti({ particleCount: 160, spread: 75, origin: { y: 0.2 } });
        }}
        onStreakLost={() => {
          setStreakLost(true);
        }}
        onBadgeEarned={() => {}}
      />
    </div>
  );
}
