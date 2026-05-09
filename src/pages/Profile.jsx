import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAllUserData, getAllLogs, getUserProfile, signOutUser, upsertUserProfile } from '../lib/queries.js';
import { BADGE_IDS, getLevelFromXP } from '../lib/xpEngine.js';
import { useStore } from '../store/useStore.js';

const HABIT_OPTIONS = [
  'Read',
  'Walk',
  'Meditate',
  'No junk food',
  'Cold shower',
  'Journal',
  'No social media',
  'Study',
  'Stretch',
  'Hydrate',
  'Sleep by 11pm',
  'Wake before 7am',
];

const BADGE_META = {
  first_blood: { name: 'First Blood', emoji: '⚡' },
  week_warrior: { name: 'Week Warrior', emoji: '🔥' },
  iron_body: { name: 'Iron Body', emoji: '💪' },
  monk_mode: { name: 'Monk Mode', emoji: '🧘' },
  deep_sleeper: { name: 'Deep Sleeper', emoji: '🌙' },
  broke_proof: { name: 'Broke Proof', emoji: '💰' },
  no_zero_days: { name: 'No Zero Days', emoji: '🗓️' },
};

function toCsvRow(cells) {
  return cells
    .map((c) => {
      const s = String(c ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(',');
}

export default function Profile() {
  const navigate = useNavigate();
  const setUserProfile = useStore((s) => s.setUserProfile);
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [budget, setBudget] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newHabit, setNewHabit] = useState('');

  function handleAddCustomHabit(e) {
    e.preventDefault();
    const val = newHabit.trim();
    if (!val) return;
    if (picked.includes(val)) {
      setNewHabit('');
      return;
    }
    if (picked.length >= 7) return;
    setPicked((prev) => [...prev, val]);
    setNewHabit('');
  }

  async function load() {
    const [{ data: p, error: pe }, { data: l, error: le }] = await Promise.all([getUserProfile(), getAllLogs()]);
    if (pe) setError(pe.message);
    if (le) setError(le.message);
    if (p) {
      setProfile(p);
      setUserProfile(p);
      setUsername(p.username || '');
      setBudget(String(p.daily_budget ?? ''));
      setPicked(Array.isArray(p.habit_list) ? p.habit_list : []);
    }
    setLogs(l ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const levelInfo = useMemo(() => getLevelFromXP(profile?.total_xp ?? 0), [profile?.total_xp]);
  const earned = useMemo(() => new Set(Array.isArray(profile?.badges) ? profile.badges : []), [profile?.badges]);
  const initial = (profile?.username || 'U').slice(0, 1).toUpperCase();

  function toggleHabit(name) {
    setPicked((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      if (prev.length >= 7) return prev;
      return [...prev, name];
    });
  }

  async function saveSettings() {
    setBusy(true);
    setError('');
    const { data, error: upError } = await upsertUserProfile({
      username: username.trim(),
      daily_budget: Number(budget) || 0,
      habit_list: picked,
    });
    setBusy(false);
    if (upError) {
      setError(upError.message);
      return;
    }
    if (data) {
      setProfile(data);
      setUserProfile(data);
    }
  }

  function exportCsv() {
    const cols = [
      'id',
      'user_id',
      'date',
      'sleep_hours',
      'sleep_quality',
      'gym_done',
      'gym_type',
      'gym_duration',
      'mood',
      'mood_note',
      'spend',
      'spend_category',
      'habits',
      'xp_earned',
      'created_at',
    ];
    const lines = [toCsvRow(cols)];
    for (const row of logs) {
      lines.push(
        toCsvRow(
          cols.map((k) => {
            if (k === 'habits') return JSON.stringify(row[k] ?? {});
            return row[k];
          }),
        ),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'axis-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAll() {
    setBusy(true);
    const { error: delError } = await deleteAllUserData();
    setBusy(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    setConfirmOpen(false);
    setUserProfile(null);
    await signOutUser();
    navigate('/auth', { replace: true });
  }

  const daysTracked = logs.length;

  return (
    <div className="min-h-full bg-axis-bg px-4 pb-32 pt-8">
      <div className="mx-auto max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-axis-border bg-axis-card font-syne text-4xl font-bold text-axis-accent">
            {initial}
          </div>
          <div className="mt-4 font-syne text-2xl font-bold text-white">{profile?.username || '—'}</div>
          <div className="mt-1 font-mono text-xs text-axis-muted">{levelInfo.title}</div>
        </div>

        {error ? <div className="font-mono text-xs text-axis-danger">{error}</div> : null}

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total XP', value: profile?.total_xp ?? 0 },
            { label: 'Current level', value: levelInfo.level },
            { label: 'Days tracked', value: daysTracked },
            { label: 'Longest streak', value: `${profile?.longest_streak ?? 0}d` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-axis-border bg-axis-card p-4">
              <div className="font-mono text-[10px] uppercase text-axis-muted">{s.label}</div>
              <div className="mt-2 font-mono text-2xl text-white">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase text-axis-muted">All badges</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {BADGE_IDS.map((id) => {
              const meta = BADGE_META[id];
              const on = earned.has(id);
              return (
                <div
                  key={id}
                  className={`rounded-xl border p-4 ${on ? 'border-axis-accent' : 'border-axis-border bg-[#333]'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{on ? meta.emoji : '🔒'}</div>
                  </div>
                  <div className={`mt-2 font-mono text-[11px] ${on ? 'text-white' : 'text-axis-muted'}`}>{meta.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-axis-border bg-axis-card p-4 space-y-4">
          <div className="font-mono text-[10px] uppercase text-axis-muted">Settings</div>
          <label className="block">
            <span className="font-mono text-[11px] text-axis-muted">Username</span>
            <input
              className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-axis-muted">Daily budget (₹)</span>
            <input
              className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <div>
            <div className="font-mono text-[11px] text-axis-muted">Habits (3–7)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from(new Set([...HABIT_OPTIONS, ...picked])).map((h) => {
                const active = picked.includes(h);
                const disabled = !active && picked.length >= 7;
                return (
                  <button
                    key={h}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleHabit(h)}
                    className={`rounded-full border px-3 py-2 font-mono text-[11px] ${
                      active ? 'border-axis-accent text-axis-accent' : 'border-axis-border text-axis-muted'
                    } ${disabled ? 'opacity-30' : ''}`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            {picked.length < 7 && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Custom habit..."
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCustomHabit(e);
                  }}
                  className="flex-1 rounded-xl border border-axis-border bg-axis-bg px-3 py-2 font-mono text-sm text-white outline-none focus:border-axis-accent"
                />
                <button
                  type="button"
                  onClick={handleAddCustomHabit}
                  disabled={!newHabit.trim()}
                  className="rounded-xl border border-axis-border bg-axis-card px-4 py-2 font-mono text-xs font-bold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={busy || picked.length < 3}
            onClick={saveSettings}
            className="w-full rounded-xl bg-axis-accent py-3 font-mono text-sm font-bold text-axis-bg disabled:opacity-40"
          >
            Save changes
          </button>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="w-full rounded-xl border border-axis-border py-3 font-mono text-sm text-white"
        >
          Export my data as CSV
        </button>

        <div className="rounded-xl border border-axis-danger/40 bg-axis-card p-4">
          <div className="font-mono text-[10px] uppercase text-axis-danger">Danger zone</div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-3 w-full rounded-xl bg-axis-danger py-3 font-mono text-sm font-bold text-white"
          >
            Delete all my data
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded-xl border border-axis-border bg-axis-card p-6">
            <div className="font-syne text-xl text-white">Delete everything?</div>
            <p className="mt-2 font-mono text-xs text-axis-muted">This removes your profile and all daily logs.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-axis-border py-3 font-mono text-sm text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={deleteAll}
                className="flex-1 rounded-xl bg-axis-danger py-3 font-mono text-sm font-bold text-white disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
