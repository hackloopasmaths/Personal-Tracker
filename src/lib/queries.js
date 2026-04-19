import { supabase } from './supabase.js';

export async function authGetSession() {
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

export function authOnAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function authSignInWithPassword({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function authSignUp({ email, password, options }) {
  const { data, error } = await supabase.auth.signUp({ email, password, options });
  return { data, error };
}

export function getIstDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function shiftIstDateString(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + deltaDays);
  return u.toISOString().slice(0, 10);
}

export async function getCurrentUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const fromSession = sessionData?.session?.user?.id;
  if (fromSession) return { userId: fromSession, error: null };

  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, error };
  if (!data?.user) return { userId: null, error: new Error('Not authenticated') };
  return { userId: data.user.id, error: null };
}

export async function getTodayLog() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: null, error: userError };

  const today = getIstDateString();
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  return { data, error };
}

export async function upsertLog(log) {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: null, error: userError };

  const date = log.date ?? getIstDateString();
  const payload = { ...log, user_id: userId, date };

  const { data, error } = await supabase
    .from('daily_logs')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single();

  return { data, error };
}

export async function getLast7Days() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: [], error: userError };

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(7);

  return { data: data ?? [], error };
}

export async function getLast30Days() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: [], error: userError };

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  return { data: data ?? [], error };
}

export async function getLast90Days() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: [], error: userError };

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(90);

  return { data: data ?? [], error };
}

export async function getAllLogs() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: [], error: userError };

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  return { data: data ?? [], error };
}

export async function getUserProfile() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: null, error: userError };

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { data, error };
}

export async function upsertUserProfile(updates) {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: null, error: userError };

  const payload = { ...updates, user_id: userId, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  return { data, error };
}

export async function getLogForDate(dateStr) {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { data: null, error: userError };

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle();

  return { data, error };
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function deleteAllUserData() {
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { error: userError };

  const { error: logsError } = await supabase.from('daily_logs').delete().eq('user_id', userId);
  if (logsError) return { error: logsError };

  const { error: profileError } = await supabase.from('user_profiles').delete().eq('user_id', userId);
  if (profileError) return { error: profileError };

  return { error: null };
}

export { shiftIstDateString };
