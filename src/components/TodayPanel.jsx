import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  getAllLogs,
  getIstDateString,
  getLast30Days,
  getLogForDate,
  getTodayLog,
  shiftIstDateString,
  upsertLog,
  upsertUserProfile,
} from '../lib/queries.js';
import { calculateDayXP, checkBadges, getLevelFromXP, normalizeHabitList } from '../lib/xpEngine.js';
import { useStore } from '../store/useStore.js';

const MOODS = [
  { v: 1, emoji: '😞' },
  { v: 2, emoji: '😕' },
  { v: 3, emoji: '😐' },
  { v: 4, emoji: '🙂' },
  { v: 5, emoji: '😄' },
];

const FITNESS_TYPES = ['Stretch', 'Badminton', 'Walk/Run', 'Others'];
const SPEND_CATS = ['Food', 'Transport', 'Social', 'Subs', 'Other'];

function normalizeHabitsMapLocal(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return {};
  const { _nofap, _expenses, ...rest } = h;
  return rest;
}

function habitStreakCount({ habitName, todayStr, draftMap, logsByDate }) {
  let streak = 0;
  let d = todayStr;
  for (let i = 0; i < 120; i += 1) {
    let map;
    if (d === todayStr) map = draftMap;
    else {
      const log = logsByDate.get(d);
      map = normalizeHabitsMapLocal(log?.habits);
    }
    if (map?.[habitName]) streak += 1;
    else break;
    d = shiftIstDateString(d, -1);
  }
  return streak;
}

function CardShell({ title, done, open, onToggle, children, summary }) {
  return (
    <div className="rounded-xl border border-axis-border bg-axis-bg">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-white">{title}</div>
        <div className="font-mono text-sm text-axis-muted">{done ? '✓' : '○'}</div>
      </button>
      {open ? <div className="border-t border-axis-border px-4 py-4">{children}</div> : null}
      {!open && summary ? <div className="border-t border-axis-border px-4 py-3 font-mono text-xs text-axis-muted">{summary}</div> : null}
    </div>
  );
}

export default function TodayPanel({ profile, onProfileUpdated, onLevelUp, onStreakLost, onBadgeEarned }) {
  const isOpen = useStore((s) => s.isLogModalOpen);
  const setLogModalOpen = useStore((s) => s.setLogModalOpen);
  const setXpToast = useStore((s) => s.setXpToast);
  const setTodayDraft = useStore((s) => s.setTodayDraft);

  const [expanded, setExpanded] = useState('sleep');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [gymTrain, setGymTrain] = useState(null);
  const [gymType, setGymType] = useState('Stretch');
  const [customFitness, setCustomFitness] = useState('');
  const [gymDuration, setGymDuration] = useState(45);
  const [nofapDone, setNofapDone] = useState(null);
  const [mood, setMood] = useState(null);
  const [moodNote, setMoodNote] = useState('');
  const [expenses, setExpenses] = useState([{ id: Date.now(), amount: '', category: 'Food', details: '' }]);

  function addExpense() {
    setExpenses([...expenses, { id: Date.now() + Math.random(), amount: '', category: 'Food', details: '' }]);
  }

  function updateExpense(id, field, value) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  function removeExpense(id) {
    const updated = expenses.filter(e => e.id !== id);
    if (updated.length === 0) {
      setExpenses([{ id: Date.now(), amount: '', category: 'Food', details: '' }]);
    } else {
      setExpenses(updated);
    }
  }
  const [habitsMap, setHabitsMap] = useState({});

  const [recentLogs, setRecentLogs] = useState([]);

  const habitList = useMemo(() => normalizeHabitList(profile?.habit_list), [profile]);

  const logsByDate = useMemo(() => new Map(recentLogs.map((l) => [l.date, l])), [recentLogs]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const [{ data: log, error: logError }, { data: logs, error: logsError }] = await Promise.all([
        getTodayLog(),
        getLast30Days(),
      ]);
      if (cancelled) return;
      if (logsError) {
        setFormError(logsError.message);
      } else {
        setRecentLogs(logs ?? []);
      }
      if (logError) {
        setFormError(logError.message);
        return;
      }

      if (log) {
        setSleepHours(Number(log.sleep_hours ?? 7));
        setSleepQuality(Number(log.sleep_quality ?? 3));
        if (log.gym_done === true) setGymTrain(true);
        else if (log.gym_done === false) setGymTrain(false);
        else setGymTrain(null);

        const gType = log.gym_type || 'Stretch';
        if (['Stretch', 'Badminton', 'Walk/Run'].includes(gType)) {
          setGymType(gType);
          setCustomFitness('');
        } else {
          setGymType('Others');
          setCustomFitness(gType);
        }

        setGymDuration(Number(log.gym_duration ?? 45));
        setMood(log.mood != null ? Number(log.mood) : null);
        setMoodNote(log.mood_note || '');
        const savedExp = log.habits?._expenses;
        if (Array.isArray(savedExp) && savedExp.length > 0) {
          setExpenses(savedExp);
        } else if (log.spend != null) {
          setExpenses([{ id: Date.now(), amount: String(log.spend), category: log.spend_category || 'Food', details: '' }]);
        } else {
          setExpenses([{ id: Date.now(), amount: '', category: 'Food', details: '' }]);
        }
        setHabitsMap(normalizeHabitsMapLocal(log.habits));
        setNofapDone(log.habits?._nofap ?? null);
      } else {
        setSleepHours(7);
        setSleepQuality(3);
        setGymTrain(null);
        setGymType('Stretch');
        setCustomFitness('');
        setGymDuration(45);
        setMood(null);
        setMoodNote('');
        setExpenses([{ id: Date.now(), amount: '', category: 'Food', details: '' }]);
        const blank = {};
        habitList.forEach((h) => {
          blank[h] = false;
        });
        setHabitsMap(blank);
        setNofapDone(null);
      }
      setExpanded('sleep');
      setFormError('');
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, habitList.join('|')]);

  const todayStr = getIstDateString();

  const sleepDone = sleepHours != null;
  const gymDone = gymTrain === true || gymTrain === false;
  const moodDone = mood != null;
  const validExpenses = expenses.filter(e => e.amount !== '');
  const spendDone = validExpenses.length > 0;
  const totalSpend = validExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const habitsDone = habitList.length === 0 ? true : habitList.every((h) => habitsMap[h] === true);

  const habitsSummaryCount = useMemo(() => {
    const done = habitList.filter((h) => habitsMap[h] === true).length;
    return `${done}/${habitList.length} done`;
  }, [habitList, habitsMap]);

  async function save() {
    setBusy(true);
    setFormError('');

    const gym_done = gymTrain === null ? null : gymTrain === true;
    const payload = {
      date: todayStr,
      sleep_hours: sleepHours,
      sleep_quality: sleepQuality,
      gym_done,
      gym_type: gymTrain === true ? (gymType === 'Others' ? (customFitness.trim() || 'Others') : gymType) : null,
      gym_duration: gymTrain === true ? Number(gymDuration) || 0 : null,
      mood,
      mood_note: moodNote.slice(0, 100),
      spend: spendDone ? totalSpend : null,
      spend_category: spendDone ? (validExpenses.length > 1 ? 'Multiple' : validExpenses[0].category) : null,
      habits: { ...habitsMap, _nofap: nofapDone, _expenses: validExpenses },
    };

    const xpLog = {
      ...payload,
      gym_done: gymTrain === false ? false : gym_done,
    };

    const xpPreview = calculateDayXP(xpLog, profile?.daily_budget, habitList);

    payload.xp_earned = xpPreview.total;

    const { data: beforeToday } = await getTodayLog();
    const oldTodayXp = Number(beforeToday?.xp_earned) || 0;

    const { data: saved, error: upLogError } = await upsertLog(payload);
    if (upLogError) {
      setFormError(upLogError.message);
      setBusy(false);
      return;
    }

    const oldTotalXp = Number(profile?.total_xp) || 0;
    const adjustedOld = oldTotalXp - oldTodayXp;
    const newTotalXp = adjustedOld + xpPreview.total;

    const yesterdayStr = shiftIstDateString(todayStr, -1);
    const { data: yLog } = await getLogForDate(yesterdayStr);
    const hadYesterdayLog = !!yLog;

    const prevStreak = Number(profile?.streak_days) || 0;
    let newStreak = prevStreak;
    let lost = false;

    if (hadYesterdayLog) {
      newStreak = prevStreak + 1;
    } else if (prevStreak > 0) {
      newStreak = 0;
      lost = true;
    } else {
      newStreak = 1;
    }

    if (lost) onStreakLost?.();

    const oldLevel = getLevelFromXP(oldTotalXp).level;
    const newLevelInfo = getLevelFromXP(newTotalXp);
    const newLevel = newLevelInfo.level;

    const longest = Math.max(Number(profile?.longest_streak) || 0, newStreak);

    const { data: allLogs, error: allErr } = await getAllLogs();
    if (allErr) {
      setFormError(allErr.message);
      setBusy(false);
      return;
    }

    const mergedLogs = [...(allLogs ?? []).filter((l) => l.date !== todayStr), saved].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );

    const newBadgeIds = checkBadges(
      {
        ...profile,
        streak_days: newStreak,
        total_xp: newTotalXp,
      },
      mergedLogs,
    );

    const existingBadges = Array.isArray(profile?.badges) ? profile.badges : [];
    const mergedBadges = [...new Set([...existingBadges, ...newBadgeIds])];

    const { data: updatedProfile, error: profErr } = await upsertUserProfile({
      total_xp: newTotalXp,
      level: newLevel,
      streak_days: newStreak,
      longest_streak: longest,
      badges: mergedBadges,
    });

    if (profErr) {
      setFormError(profErr.message);
      setBusy(false);
      return;
    }

    if (newLevel > oldLevel) {
      onLevelUp?.(newLevelInfo);
      confetti({ particleCount: 140, spread: 70, origin: { y: 0.25 } });
    }

    if (newBadgeIds.length) {
      newBadgeIds.forEach((id) => onBadgeEarned?.(id));
      confetti({ particleCount: 110, spread: 60, origin: { y: 0.35 } });
    }

    const fullDay = xpPreview.breakdown.some((b) => b.id === 'modules_all');
    if (fullDay) {
      confetti({ particleCount: 80, spread: 55, origin: { y: 0.65 } });
    }

    setXpToast({ total: xpPreview.total, breakdown: xpPreview.breakdown });
    setTodayDraft({});
    onProfileUpdated?.(updatedProfile);
    setLogModalOpen(false);
    setBusy(false);
  }

  if (!isOpen) return null;

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="rounded-xl border border-axis-border bg-axis-card px-6 py-6 font-mono text-sm text-axis-muted">
          Loading profile…
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70"
        onClick={() => setLogModalOpen(false)}
      />

      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-axis-border bg-axis-card p-4 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-axis-border" />

        <div className="mx-auto max-w-md space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-syne text-xl font-bold text-white">Log today</div>
              <div className="font-mono text-xs text-axis-muted">{todayStr}</div>
            </div>
            <button type="button" className="font-mono text-xs text-axis-muted" onClick={() => setLogModalOpen(false)}>
              Close
            </button>
          </div>

          {formError ? <div className="font-mono text-xs text-axis-danger">{formError}</div> : null}

          <CardShell
            title="Sleep"
            done={sleepDone}
            open={expanded === 'sleep'}
            onToggle={() => setExpanded((e) => (e === 'sleep' ? null : 'sleep'))}
            summary={sleepDone ? `${sleepHours}h · Q${sleepQuality}` : null}
          >
            <div className="flex items-center justify-between gap-4">
              <input
                type="range"
                min={4}
                max={10}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                className="w-full accent-axis-accent"
              />
              <div className="font-mono text-3xl font-bold text-axis-accent">{sleepHours}</div>
            </div>
            <div className="mt-4 font-mono text-[11px] uppercase text-axis-muted">Quality</div>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSleepQuality(s)}
                  className={`h-9 w-9 rounded-lg border font-mono text-sm ${
                    sleepQuality >= s ? 'border-axis-accent text-axis-accent' : 'border-axis-border text-axis-muted'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </CardShell>

          <CardShell
            title="Fitness"
            done={gymDone}
            open={expanded === 'gym'}
            onToggle={() => setExpanded((e) => (e === 'gym' ? null : 'gym'))}
            summary={
              gymTrain === true ? `${gymType === 'Others' ? (customFitness || 'Others') : gymType} · ${gymDuration}m` : gymTrain === false ? 'Rest day' : null
            }
          >
            <div className="font-mono text-[11px] uppercase text-axis-muted">Did you workout today?</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setGymTrain(true)}
                className={`flex-1 rounded-full py-2 font-mono text-xs ${
                  gymTrain === true ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setGymTrain(false)}
                className={`flex-1 rounded-full py-2 font-mono text-xs ${
                  gymTrain === false ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                }`}
              >
                No
              </button>
            </div>

            {gymTrain === true ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="font-mono text-[11px] uppercase text-axis-muted">Type</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FITNESS_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setGymType(t)}
                        className={`rounded-full px-3 py-2 font-mono text-[11px] ${
                          gymType === t ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {gymType === 'Others' && (
                  <label className="block">
                    <span className="font-mono text-[11px] uppercase text-axis-muted">Activity Name</span>
                    <input
                      className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                      value={customFitness}
                      onChange={(e) => setCustomFitness(e.target.value)}
                      placeholder="e.g. Swimming"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="font-mono text-[11px] uppercase text-axis-muted">Duration (minutes)</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                    inputMode="numeric"
                    value={gymDuration}
                    onChange={(e) => setGymDuration(Number(e.target.value))}
                  />
                </label>
              </div>
            ) : null}
          </CardShell>

          <CardShell
            title="Mood"
            done={moodDone}
            open={expanded === 'mood'}
            onToggle={() => setExpanded((e) => (e === 'mood' ? null : 'mood'))}
            summary={moodDone ? `Score ${mood}` : null}
          >
            <div className="flex justify-between gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMood(m.v)}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl ${
                    mood === m.v ? 'border-axis-accent' : 'border-axis-border'
                  }`}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="font-mono text-[11px] uppercase text-axis-muted">What&apos;s on your mind?</span>
              <textarea
                className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                rows={3}
                maxLength={100}
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
              />
              <div className="mt-1 text-right font-mono text-[10px] text-axis-muted">{moodNote.length}/100</div>
            </label>
          </CardShell>

          <CardShell
            title="Money"
            done={spendDone}
            open={expanded === 'money'}
            onToggle={() => setExpanded((e) => (e === 'money' ? null : 'money'))}
            summary={spendDone ? `₹${totalSpend} · ${validExpenses.length > 1 ? validExpenses.length + ' items' : validExpenses[0].category}` : null}
          >
            <div className="space-y-6">
              {expenses.map((exp) => (
                <div key={exp.id} className="relative rounded-xl border border-axis-border bg-[#1A1A1A] p-4">
                  {expenses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExpense(exp.id)}
                      className="absolute right-3 top-3 text-axis-muted hover:text-axis-danger"
                    >
                      ✕
                    </button>
                  )}
                  <label className="block pr-6">
                    <span className="font-mono text-[11px] uppercase text-axis-muted">Amount</span>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-axis-border bg-axis-bg px-3">
                      <span className="font-mono text-lg text-axis-muted">₹</span>
                      <input
                        className="w-full bg-transparent py-3 font-mono text-xl text-white outline-none"
                        inputMode="decimal"
                        value={exp.amount}
                        onChange={(e) => updateExpense(exp.id, 'amount', e.target.value)}
                      />
                    </div>
                  </label>
                  <div className="mt-4 font-mono text-[11px] uppercase text-axis-muted">Category</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SPEND_CATS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateExpense(exp.id, 'category', c)}
                        className={`rounded-full px-3 py-2 font-mono text-[11px] ${
                          exp.category === c ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {exp.category === 'Other' && (
                    <label className="mt-4 block">
                      <span className="font-mono text-[11px] uppercase text-axis-muted">Details</span>
                      <input
                        className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-axis-accent"
                        value={exp.details || ''}
                        onChange={(e) => updateExpense(exp.id, 'details', e.target.value)}
                        placeholder="What did you spend on?"
                      />
                    </label>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addExpense}
                className="w-full rounded-xl border border-axis-border border-dashed py-3 font-mono text-sm text-axis-muted hover:text-white"
              >
                + Add Expense
              </button>
            </div>
          </CardShell>

          <CardShell
            title="NoFap"
            done={nofapDone != null}
            open={expanded === 'nofap'}
            onToggle={() => setExpanded((e) => (e === 'nofap' ? null : 'nofap'))}
            summary={nofapDone === true ? 'Maintained Streak' : nofapDone === false ? 'Relapsed' : null}
          >
            <div className="font-mono text-[11px] uppercase text-axis-muted">Did you maintain your NoFap streak?</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setNofapDone(true)}
                className={`flex-1 rounded-full py-2 font-mono text-xs ${
                  nofapDone === true ? 'bg-axis-accent text-axis-bg' : 'border border-axis-border text-axis-muted'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setNofapDone(false)}
                className={`flex-1 rounded-full py-2 font-mono text-xs ${
                  nofapDone === false ? 'bg-axis-danger text-white border-axis-danger' : 'border border-axis-border text-axis-muted'
                }`}
              >
                Relapsed
              </button>
            </div>
          </CardShell>

          <CardShell
            title="Habits"
            done={habitsDone}
            open={expanded === 'habits'}
            onToggle={() => setExpanded((e) => (e === 'habits' ? null : 'habits'))}
            summary={habitsSummaryCount}
          >
            <div className="space-y-2">
              {habitList.map((h) => {
                const streak = habitStreakCount({
                  habitName: h,
                  todayStr,
                  draftMap: habitsMap,
                  logsByDate,
                });
                return (
                  <label key={h} className="flex items-center justify-between gap-3 rounded-xl border border-axis-border bg-axis-bg px-3 py-3">
                    <div className="font-mono text-xs text-white">
                      {h}
                      {streak >= 3 ? <span className="ml-2">🔥</span> : null}
                    </div>
                    <input
                      type="checkbox"
                      checked={!!habitsMap[h]}
                      onChange={(e) => setHabitsMap((m) => ({ ...m, [h]: e.target.checked }))}
                      className="h-4 w-4 accent-axis-accent"
                    />
                  </label>
                );
              })}
            </div>
          </CardShell>

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="w-full rounded-xl bg-axis-accent py-4 font-mono text-sm font-bold text-axis-bg disabled:opacity-40"
          >
            SAVE TODAY
          </button>
        </div>
      </div>
    </div>
  );
}
