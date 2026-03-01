import { APP_ORIGIN } from "./portal-config.js";
import { applyYear, getCurrentProfile, getSession, hasSupabase, showSetupMessage, supabase } from "./supabase-client.js";

applyYear();

const setupNode = document.querySelector("[data-setup-message]");
if (!hasSupabase) {
  showSetupMessage(setupNode, "The public site stays up, but auth, uploads, milestones, and admin controls will stay locked until Supabase is connected.");
}

const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const forgotForm = document.querySelector("#forgot-form");
const resetForm = document.querySelector("#reset-form");
const statusNode = document.querySelector("[data-auth-status]");
const profileNode = document.querySelector("[data-profile-state]");

function setStatus(message, isError = false) {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.className = isError ? "status-text error" : "status-text";
}

async function maybeRedirectAuthenticatedUser() {
  if (!hasSupabase) return;
  const session = await getSession();
  if (!session?.user) return;
  const profile = await getCurrentProfile();
  if (!profile) return;
  if (profileNode) {
    profileNode.textContent = profile.portal_status === "active"
      ? `Signed in as ${profile.full_name || session.user.email}.`
      : `Account found for ${profile.full_name || session.user.email}. Portal access is still pending admin approval.`;
  }
}

if (loginForm && hasSupabase) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get("signin-email") || "").trim(),
      password: String(formData.get("signin-password") || ""),
    });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    const profile = await getCurrentProfile();
    if (profile?.role === "admin") {
      window.location.href = "admin-dashboard.html";
      return;
    }
    window.location.href = "client-portal.html";
  });
}

if (signupForm && hasSupabase) {
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const password = String(formData.get("signup-password") || "");
    const confirm = String(formData.get("signup-confirm") || "");
    if (password !== confirm) {
      setStatus("Passwords do not match.", true);
      return;
    }
    setStatus("Creating account request...");
    const { error } = await supabase.auth.signUp({
      email: String(formData.get("signup-email") || "").trim(),
      password,
      options: {
        emailRedirectTo: `${APP_ORIGIN}/signin.html`,
        data: {
          full_name: String(formData.get("signup-name") || "").trim(),
          phone: String(formData.get("signup-phone") || "").trim(),
          role: "client",
        },
      },
    });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus("Account request submitted. Once approved, the client can sign in and access the portal.");
    signupForm.reset();
  });
}

if (forgotForm && hasSupabase) {
  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(forgotForm);
    setStatus("Sending reset link...");
    const { error } = await supabase.auth.resetPasswordForEmail(String(formData.get("reset-email") || "").trim(), {
      redirectTo: `${APP_ORIGIN}/reset-password.html`,
    });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus("Reset link sent. Ask the client to check their email.");
  });
}

if (resetForm && hasSupabase) {
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(resetForm);
    const password = String(formData.get("reset-password") || "");
    const confirm = String(formData.get("reset-confirm") || "");
    if (password !== confirm) {
      setStatus("Passwords do not match.", true);
      return;
    }
    setStatus("Updating password...");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus("Password updated. You can sign in now.");
    resetForm.reset();
  });
}

maybeRedirectAuthenticatedUser();
