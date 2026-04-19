import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LEVELS } from '../lib/xpEngine.js';
import { getUserProfile, upsertUserProfile } from '../lib/queries.js';
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

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-2 rounded-full ${n === step ? 'bg-axis-accent' : 'bg-axis-border'}`}
        />
      ))}
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useStore((s) => s.user);

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [budget, setBudget] = useState('');
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromState = location.state?.username;
    const fromMeta = user?.user_metadata?.username;
    setUsername(fromState || fromMeta || '');
  }, [location.state, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: profileError } = await getUserProfile();
      if (cancelled) return;
      if (profileError) return;
      if (data?.username && Array.isArray(data?.habit_list) && data.habit_list.length >= 3) {
        navigate('/dashboard', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const canNext1 = useMemo(() => username.trim().length >= 2 && Number(budget) >= 0 && budget !== '', [username, budget]);

  const canNext2 = useMemo(() => picked.length >= 3 && picked.length <= 7, [picked]);

  function toggleHabit(name) {
    setPicked((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      if (prev.length >= 7) return prev;
      return [...prev, name];
    });
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      if (picked.length < 3 || picked.length > 7) {
        setError('Pick between 3 and 7 habits. Use Back to adjust your habits.');
        return;
      }
      const { data, error: upError } = await upsertUserProfile({
        ...(user?.id ? { id: user.id } : {}),
        username: username.trim(),
        daily_budget: Number(budget),
        habit_list: picked,
        badges: [],
        total_xp: 0,
        level: 1,
        streak_days: 0,
        longest_streak: 0,
      });
      if (upError) {
        setError(upError.message || 'Could not save your profile. Check Supabase RLS and constraints.');
        return;
      }
      if (data) {
        useStore.getState().setUserProfile(data);
      }
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setError(e?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-axis-bg px-4 py-10">
      <div className="mx-auto max-w-lg">
        <StepDots step={step} />

        {error ? (
          <div className="mt-4 rounded-xl border border-axis-danger/50 bg-axis-card px-4 py-3 font-mono text-xs text-axis-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-axis-border bg-axis-card p-6">
          {step === 1 && (
            <div>
              <h2 className="font-syne text-2xl font-bold text-white">What should we call you?</h2>
              <p className="mt-2 font-mono text-xs text-axis-muted">This shows up on your dashboard greeting.</p>

              <label className="mt-6 block">
                <span className="font-mono text-[11px] uppercase tracking-wide text-axis-muted">Username</span>
                <input
                  className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>

              <label className="mt-4 block">
                <span className="font-mono text-[11px] uppercase tracking-wide text-axis-muted">
                  Daily spend budget (₹)
                </span>
                <input
                  className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 1500"
                />
              </label>

              <button
                type="button"
                disabled={!canNext1}
                onClick={() => setStep(2)}
                className="mt-6 w-full rounded-xl bg-axis-accent py-3 font-mono text-sm font-bold text-axis-bg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-syne text-2xl font-bold text-white">Pick your habits</h2>
              <p className="mt-2 font-mono text-xs text-axis-muted">
                Choose 3–7. Selected: <span className="text-axis-accent">{picked.length}</span>/7
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {HABIT_OPTIONS.map((h) => {
                  const active = picked.includes(h);
                  const disabled = !active && picked.length >= 7;
                  return (
                    <button
                      key={h}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleHabit(h)}
                      className={`rounded-full border px-3 py-2 font-mono text-[11px] ${
                        active
                          ? 'border-axis-accent bg-axis-bg text-axis-accent'
                          : 'border-axis-border text-axis-muted'
                      } ${disabled ? 'opacity-30' : ''}`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 rounded-xl border border-axis-border py-3 font-mono text-sm text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canNext2}
                  onClick={() => setStep(3)}
                  className="w-2/3 rounded-xl bg-axis-accent py-3 font-mono text-sm font-bold text-axis-bg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-syne text-2xl font-bold text-white">Your level path</h2>
              <p className="mt-2 font-mono text-xs text-axis-muted">Earn XP daily. Levels unlock as you stay consistent.</p>

              <div className="mt-8 space-y-4">
                {LEVELS.map((lv, idx) => (
                  <div key={lv.level} className="flex gap-4">
                    <div className="flex w-6 flex-col items-center">
                      <div className={`h-3 w-3 rounded-full ${idx === 0 ? 'bg-axis-accent' : 'bg-axis-border'}`} />
                      {idx < LEVELS.length - 1 ? <div className="mt-1 w-px flex-1 bg-axis-border" /> : null}
                    </div>
                    <div className="pb-2">
                      <div className="font-syne text-lg text-white">{lv.title}</div>
                      <div className="font-mono text-xs text-axis-muted">LVL {lv.level} · {lv.minXp} XP</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 rounded-xl border border-axis-border py-3 font-mono text-sm text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={finish}
                  className="w-2/3 rounded-xl bg-axis-accent py-3 font-mono text-sm font-bold text-axis-bg disabled:opacity-40"
                >
                  Start Tracking →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
