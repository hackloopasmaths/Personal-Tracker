import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { authGetSession, authOnAuthStateChange, getUserProfile } from './lib/queries.js';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Profile from './pages/Profile.jsx';
import { useStore } from './store/useStore.js';

function BootScreen() {
  return <div className="min-h-full bg-axis-bg" />;
}

function RequireAuth() {
  const user = useStore((s) => s.user);
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

function RequireProfile() {
  const [status, setStatus] = useState('loading');
  const user = useStore((s) => s.user);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await getUserProfile();
      if (cancelled) return;
      if (error || !data?.username || !Array.isArray(data.habit_list) || data.habit_list.length < 3) {
        setStatus('missing');
        return;
      }
      useStore.getState().setUserProfile(data);
      setStatus('ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (status === 'loading') return <BootScreen />;
  if (status === 'missing') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function OnboardingRoute() {
  const user = useStore((s) => s.user);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await getUserProfile();
      if (cancelled) return;
      if (!error && data?.username && Array.isArray(data.habit_list) && data.habit_list.length >= 3) {
        setStatus('has');
        return;
      }
      setStatus('need');
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (status === 'loading') return <BootScreen />;
  if (status === 'has') return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
}

function AppShell() {
  return (
    <div className="min-h-full bg-axis-bg pb-24">
      <Outlet />
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-axis-border bg-axis-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
          {[
            { to: '/dashboard', label: 'Dashboard', icon: '▣' },
            { to: '/history', label: 'History', icon: '⌁' },
            { to: '/profile', label: 'Profile', icon: '○' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 font-mono text-[10px] ${
                  isActive ? 'text-axis-accent' : 'text-axis-muted'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function IndexRoute() {
  const user = useStore((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/auth" replace />;
}

export default function App() {
  const setUser = useStore((s) => s.setUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await authGetSession();
      if (cancelled) return;
      if (error) {
        setUser(null);
      } else {
        setUser(data.session?.user ?? null);
      }
      setReady(true);
    })();

    const { data: sub } = authOnAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [setUser]);

  if (!ready) return <BootScreen />;

  return (
    <Routes>
      <Route path="/" element={<IndexRoute />} />
      <Route path="/auth" element={<Auth />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route element={<RequireProfile />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
