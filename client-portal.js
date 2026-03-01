import { applyYear, formatLongDate, getCurrentProfile, hasSupabase, requireAuth, setUserBadge, showSetupMessage, signOutToLogin, supabase } from "./supabase-client.js";

applyYear();

const gateNode = document.querySelector("[data-portal-gate]");
const milestonesNode = document.querySelector("[data-milestones]");
const documentsNode = document.querySelector("[data-documents]");
const uploadForm = document.querySelector("#upload-form");
const portalStatus = document.querySelector("[data-portal-status]");
const signOutButton = document.querySelector("#client-signout");

function setPortalStatus(message, isError = false) {
  if (!portalStatus) return;
  portalStatus.textContent = message;
  portalStatus.className = isError ? "status-text error" : "status-text";
}

function renderMilestones(milestones) {
  if (!milestonesNode) return;
  if (!milestones.length) {
    milestonesNode.innerHTML = '<div class="note-card"><strong>No milestones yet.</strong><p>Once Juanita opens the transaction workflow, the milestone timeline will appear here.</p></div>';
    return;
  }
  milestonesNode.innerHTML = milestones
    .map((item) => {
      const klass = item.status === "complete" ? "done" : item.status === "in_progress" ? "current" : "";
      const label = item.status === "complete" ? "Complete" : item.status === "in_progress" ? "In Progress" : "Pending";
      return `
        <div class="milestone-item ${klass}">
          <div>
            <strong>${item.title}</strong>
            <p>${item.details || ""}</p>
          </div>
          <span class="status-pill ${klass ? `status-${item.status === "complete" ? "done" : "current"}` : ""}">${label}</span>
        </div>
      `;
    })
    .join("");
}

function renderDocuments(documents) {
  if (!documentsNode) return;
  if (!documents.length) {
    documentsNode.innerHTML = '<div class="note-card"><strong>No uploaded files yet.</strong><p>Client uploads will appear here after the first secure upload is submitted.</p></div>';
    return;
  }
  documentsNode.innerHTML = documents
    .map((item) => `
      <div class="note-card">
        <strong>${item.original_name}</strong>
        <p>${item.note || "No note added."}</p>
        <p class="small-note">Uploaded ${formatLongDate(item.created_at)}</p>
      </div>
    `)
    .join("");
}

async function loadPortal() {
  if (!hasSupabase) {
    showSetupMessage(gateNode, "Protected portal screens only become active after Supabase auth and storage are connected.");
    return;
  }

  const authState = await requireAuth({ role: "client" });
  if (!authState) return;
  setUserBadge(authState.profile);

  if (authState.pending) {
    gateNode.innerHTML = '<div class="setup-alert"><strong>Portal access pending approval.</strong><p>The client account exists, but admin approval is still required before sensitive files and milestones are shown.</p></div>';
    return;
  }

  gateNode.remove();

  const [{ data: milestones, error: milestoneError }, { data: documents, error: documentError }] = await Promise.all([
    supabase
      .from("portal_milestones")
      .select("id, title, details, status, stage_order")
      .order("stage_order", { ascending: true }),
    supabase
      .from("client_documents")
      .select("id, original_name, note, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (milestoneError) setPortalStatus(milestoneError.message, true);
  if (documentError) setPortalStatus(documentError.message, true);

  renderMilestones(milestones || []);
  renderDocuments(documents || []);
}

if (uploadForm && hasSupabase) {
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = await getCurrentProfile();
    const formData = new FormData(uploadForm);
    const file = formData.get("portal-file");
    if (!(file instanceof File) || !file.name) {
      setPortalStatus("Choose a file before uploading.", true);
      return;
    }
    const path = `${profile.id}/${Date.now()}-${file.name}`;
    setPortalStatus("Uploading securely...");
    const upload = await supabase.storage.from("client-documents").upload(path, file, { upsert: false });
    if (upload.error) {
      setPortalStatus(upload.error.message, true);
      return;
    }
    const { error } = await supabase.from("client_documents").insert({
      client_id: profile.id,
      uploaded_by: profile.id,
      bucket_path: path,
      original_name: file.name,
      note: String(formData.get("portal-notes") || "").trim(),
    });
    if (error) {
      setPortalStatus(error.message, true);
      return;
    }
    setPortalStatus("File uploaded successfully.");
    uploadForm.reset();
    loadPortal();
  });
}

if (signOutButton) {
  signOutButton.addEventListener("click", signOutToLogin);
}

loadPortal();
