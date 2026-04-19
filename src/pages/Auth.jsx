import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authSignInWithPassword, authSignUp } from '../lib/queries.js';
import { useStore } from '../store/useStore.js';

export default function Auth() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const title = useMemo(() => (mode === 'login' ? 'Welcome back' : 'Create account'), [mode]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const { data, error: signError } = await authSignInWithPassword({ email, password });
      if (signError) {
        setError(signError.message);
        return;
      }
      if (data?.user) navigate('/dashboard', { replace: true });
      return;
    }

    const { data, error: signUpError } = await authSignUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data?.user) {
      navigate('/onboarding', { replace: true, state: { username } });
    }
  }

  return (
    <div className="min-h-full bg-axis-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-axis-border bg-axis-card p-8">
        <h1 className="font-syne text-4xl font-extrabold tracking-tight text-white">AXIS</h1>
        <p className="mt-2 font-mono text-xs text-axis-muted">{title}</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          {mode === 'signup' && (
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-wide text-axis-muted">Username</span>
              <input
                className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
          )}

          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wide text-axis-muted">Email</span>
            <input
              className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-wide text-axis-muted">Password</span>
            <input
              className="mt-2 w-full rounded-xl border border-axis-border bg-axis-bg px-3 py-3 font-mono text-sm text-white outline-none focus:border-axis-accent"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          {error ? <p className="font-mono text-xs text-axis-danger">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-axis-accent py-3 font-mono text-sm font-bold text-axis-bg"
          >
            {mode === 'login' ? 'Login' : 'Sign up'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-xs text-axis-muted">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="text-axis-accent underline" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already tracking?{' '}
              <button type="button" className="text-axis-accent underline" onClick={() => setMode('login')}>
                Login
              </button>
            </>
          )}
        </p>

      </div>
    </div>
  );
}
