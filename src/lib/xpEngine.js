import { getIstDateString, shiftIstDateString } from './queries.js';

export const LEVELS = [
  { level: 1, minXp: 0, title: 'Ghost' },
  { level: 2, minXp: 200, title: 'Aware' },
  { level: 3, minXp: 500, title: 'Consistent' },
  { level: 4, minXp: 1000, title: 'Disciplined' },
  { level: 5, minXp: 2000, title: 'Optimized' },
  { level: 6, minXp: 3500, title: 'Sovereign' },
  { level: 7, minXp: 5500, title: 'Architect' },
  { level: 8, minXp: 8000, title: 'Ascendant' },
];

export const BADGE_IDS = [
  'first_blood',
  'week_warrior',
  'iron_body',
  'monk_mode',
  'deep_sleeper',
  'broke_proof',
  'no_zero_days',
];

export function normalizeHabitList(habitList) {
  if (!habitList) return [];
  if (Array.isArray(habitList)) return habitList.filter(Boolean);
  if (Array.isArray(habitList?.habits)) return habitList.habits.filter(Boolean);
  return [];
}

function normalizeHabitsMap(log) {
  const h = log?.habits;
  if (!h || typeof h !== 'object' || Array.isArray(h)) return {};
  return h;
}

export function isFullDayLogged(log, habitList) {
  if (!log) return false;
  const list = normalizeHabitList(habitList);
  const habitsMap = normalizeHabitsMap(log);

  const sleepOk = log.sleep_hours != null && log.sleep_hours !== '';
  const gymOk = log.gym_done === true || log.gym_done === false;
  const moodOk = log.mood != null && log.mood !== '';
  const spendOk = log.spend != null && log.spend !== '';

  let habitsOk = false;
  if (list.length === 0) {
    habitsOk = log.habits != null && typeof log.habits === 'object';
  } else {
    habitsOk = list.every((name) => habitsMap[name] === true);
  }

  return sleepOk && gymOk && moodOk && spendOk && habitsOk;
}

export function countModulesLogged(log, habitList) {
  if (!log) return 0;
  const list = normalizeHabitList(habitList);
  const habitsMap = normalizeHabitsMap(log);
  let n = 0;

  if (log.sleep_hours != null && log.sleep_hours !== '') n += 1;
  if (log.gym_done === true || log.gym_done === false) n += 1;
  if (log.mood != null && log.mood !== '') n += 1;
  if (log.spend != null && log.spend !== '') n += 1;

  if (list.length === 0) {
    if (log.habits != null && typeof log.habits === 'object') n += 1;
  } else {
    const done = list.filter((name) => habitsMap[name] === true).length;
    if (done === list.length) n += 1;
  }

  return n;
}

export function calculateDayXP(log, budget, habitList) {
  const breakdown = [];
  let total = 0;
  const b = Number(budget) || 0;
  const list = normalizeHabitList(habitList);
  const habitsMap = normalizeHabitsMap(log);

  if (log?.sleep_hours != null && log.sleep_hours !== '') {
    breakdown.push({ id: 'sleep', label: 'Sleep logged', xp: 10 });
    total += 10;
    const hrs = Number(log.sleep_hours);
    if (!Number.isNaN(hrs) && hrs >= 7) {
      breakdown.push({ id: 'sleep_bonus', label: '7h+ sleep bonus', xp: 15 });
      total += 15;
    }
  }

  if (log?.gym_done === true) {
    breakdown.push({ id: 'gym', label: 'Gym logged', xp: 20 });
    total += 20;
    const dur = Number(log.gym_duration) || 0;
    if (dur > 45) {
      breakdown.push({ id: 'gym_bonus', label: '45m+ bonus', xp: 10 });
      total += 10;
    }
  }

  if (log?.mood != null && log.mood !== '') {
    breakdown.push({ id: 'mood', label: 'Mood logged', xp: 5 });
    total += 5;
  }

  if (log?.spend != null && log.spend !== '') {
    breakdown.push({ id: 'spend', label: 'Spend logged', xp: 5 });
    total += 5;
    const spend = Number(log.spend);
    if (!Number.isNaN(spend) && b > 0 && spend <= b) {
      breakdown.push({ id: 'budget_bonus', label: 'Under budget bonus', xp: 10 });
      total += 10;
    }
  }

  for (const h of list) {
    if (habitsMap[h]) {
      breakdown.push({ id: `habit:${h}`, label: h, xp: 8 });
      total += 8;
    }
  }

  if (list.length > 0) {
    const doneCount = list.filter((name) => habitsMap[name] === true).length;
    if (doneCount === list.length) {
      breakdown.push({ id: 'habits_all', label: 'All habits bonus', xp: 25 });
      total += 25;
    }
  }

  if (countModulesLogged(log, list) === 5) {
    breakdown.push({ id: 'modules_all', label: 'Full day bonus', xp: 50 });
    total += 50;
  }

  return { total, breakdown };
}

export function getLevelFromXP(totalXP) {
  const xp = Math.max(0, Number(totalXP) || 0);
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (xp >= LEVELS[i].minXp) idx = i;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const nextLevelXP = next ? next.minXp : current.minXp;
  const prevXp = current.minXp;
  const span = next ? next.minXp - prevXp : 1;
  const progress = next ? Math.min(1, Math.max(0, (xp - prevXp) / span)) : 1;

  return {
    level: current.level,
    title: current.title,
    nextLevelXP,
    progress,
    minXp: current.minXp,
    isMax: !next,
  };
}

function normalizeBadgeList(profile) {
  const raw = profile?.badges;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (Array.isArray(raw?.earned)) return raw.earned.filter(Boolean);
  return [];
}

function sortLogsAsc(logs) {
  return [...(logs ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function consecutiveSleepStreakMax(logsAsc, predicate) {
  let best = 0;
  let cur = 0;
  for (const log of logsAsc) {
    const hrs = Number(log.sleep_hours);
    if (!Number.isNaN(hrs) && predicate(hrs)) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

function hasMonkWindow(logsAsc, habitList, window) {
  const list = normalizeHabitList(habitList);
  if (list.length === 0) return false;
  const byDate = new Map(logsAsc.map((l) => [l.date, l]));
  const dates = [...new Set(logsAsc.map((l) => l.date))].sort();

  for (let i = 0; i <= dates.length - window; i += 1) {
    let ok = true;
    const start = dates[i];
    for (let k = 0; k < window; k += 1) {
      const d = shiftIstDateString(start, k);
      const log = byDate.get(d);
      if (!log) {
        ok = false;
        break;
      }
      const map = normalizeHabitsMap(log);
      const all = list.every((name) => map[name] === true);
      if (!all) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function hasBrokeProofWindow(logsAsc, budget, window) {
  const b = Number(budget) || 0;
  if (b <= 0) return false;
  const byDate = new Map(logsAsc.map((l) => [l.date, l]));
  const dates = [...new Set(logsAsc.map((l) => l.date))].sort();

  for (let i = 0; i <= dates.length - window; i += 1) {
    let ok = true;
    const start = dates[i];
    for (let k = 0; k < window; k += 1) {
      const d = shiftIstDateString(start, k);
      const log = byDate.get(d);
      if (!log) {
        ok = false;
        break;
      }
      const spend = Number(log.spend);
      if (Number.isNaN(spend) || spend > b) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function checkBadges(profile, allLogs) {
  const earned = new Set(normalizeBadgeList(profile));
  const next = [];
  const logsAsc = sortLogsAsc(allLogs);
  const habitList = normalizeHabitList(profile?.habit_list);
  const budget = profile?.daily_budget;

  const fullDays = logsAsc.filter((l) => isFullDayLogged(l, habitList));
  if (!earned.has('first_blood') && fullDays.length >= 1) {
    next.push('first_blood');
  }

  const streak = Number(profile?.streak_days) || 0;
  if (!earned.has('week_warrior') && streak >= 7) {
    next.push('week_warrior');
  }

  const gymCount = logsAsc.filter((l) => l.gym_done === true).length;
  if (!earned.has('iron_body') && gymCount >= 30) {
    next.push('iron_body');
  }

  if (!earned.has('monk_mode') && hasMonkWindow(logsAsc, habitList, 7)) {
    next.push('monk_mode');
  }

  if (!earned.has('deep_sleeper') && consecutiveSleepStreakMax(logsAsc, (h) => h >= 8) >= 5) {
    next.push('deep_sleeper');
  }

  if (!earned.has('broke_proof') && hasBrokeProofWindow(logsAsc, budget, 14)) {
    next.push('broke_proof');
  }

  if (!earned.has('no_zero_days') && streak >= 30) {
    next.push('no_zero_days');
  }

  return next.filter((id) => !earned.has(id));
}

export function moodStripColor(mood) {
  const m = Number(mood);
  if (Number.isNaN(m)) return '#333333';
  const t = Math.min(1, Math.max(0, (m - 1) / 4));
  const r1 = 255;
  const g1 = 68;
  const b1 = 68;
  const r2 = 200;
  const g2 = 245;
  const b2 = 90;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

export function getIstWeekDates() {
  const today = getIstDateString();
  return Array.from({ length: 7 }, (_, i) => shiftIstDateString(today, -6 + i));
}
