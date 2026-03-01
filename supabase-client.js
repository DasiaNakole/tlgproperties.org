import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, PORTAL_BRAND } from "./portal-config.js";

export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function applyYear() {
  const yearNode = document.querySelector("[data-year]");
  if (yearNode) yearNode.textContent = String(new Date().getFullYear());
}

export function showSetupMessage(node, extra = "") {
  if (!node) return;
  node.innerHTML = `<div class="setup-alert"><strong>Portal setup required.</strong><p>Add your Supabase URL and anon key in <code>portal-config.js</code>. ${extra}</p></div>`;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentProfile() {
  if (!supabase) return null;
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role, portal_status")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function requireAuth({ role } = {}) {
  const session = await getSession();
  if (!session?.user) {
    window.location.href = "signin.html";
    return null;
  }
  const profile = await getCurrentProfile();
  if (!profile) {
    await supabase.auth.signOut();
    window.location.href = "signin.html";
    return null;
  }
  if (role && profile.role !== role) {
    window.location.href = profile.role === "admin" ? "admin-dashboard.html" : "client-portal.html";
    return null;
  }
  if (profile.role === "client" && profile.portal_status !== "active") {
    return { session, profile, pending: true };
  }
  return { session, profile, pending: false };
}

export async function signOutToLogin() {
  if (supabase) await supabase.auth.signOut();
  window.location.href = "signin.html";
}

export function formatLongDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function setUserBadge(profile) {
  const badge = document.querySelector("[data-user-badge]");
  if (!badge || !profile) return;
  badge.textContent = `${profile.full_name || PORTAL_BRAND} • ${profile.role}`;
}
