import { blogSeed } from "./blog-seed.js";
import { applyYear, formatLongDate, getCurrentProfile, hasSupabase, requireAuth, setUserBadge, showSetupMessage, signOutToLogin, slugify, supabase } from "./supabase-client.js";

applyYear();

const gateNode = document.querySelector("[data-admin-gate]");
const blogListNode = document.querySelector("[data-admin-blog-list]");
const demoFilesNode = document.querySelector("[data-demo-files]");
const pendingClientsNode = document.querySelector("[data-pending-clients]");
const postForm = document.querySelector("#blog-post-form");
const demoForm = document.querySelector("#demo-file-form");
const adminStatus = document.querySelector("[data-admin-status]");
const signOutButton = document.querySelector("#admin-signout");

function setStatus(message, isError = false) {
  if (!adminStatus) return;
  adminStatus.textContent = message;
  adminStatus.className = isError ? "status-text error" : "status-text";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSeedBlogList() {
  if (!blogListNode) return;
  blogListNode.innerHTML = blogSeed.map((post) => `
    <li>
      <span>${post.slug}</span>
      <button class="btn danger" type="button" disabled>Delete</button>
    </li>
  `).join("");
}

async function loadAdminData() {
  if (!hasSupabase) {
    showSetupMessage(gateNode, "Connect Supabase to unlock real admin roles, protected client records, blog CRUD, and secure file storage.");
    renderSeedBlogList();
    return;
  }

  const authState = await requireAuth({ role: "admin" });
  if (!authState) return;
  setUserBadge(authState.profile);
  gateNode.remove();

  const [postsResult, demoResult, clientsResult] = await Promise.all([
    supabase.from("blog_posts").select("id, slug, title, status, published_at").order("published_at", { ascending: false }),
    supabase.from("demo_files").select("id, file_name, description, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, phone, portal_status").eq("role", "client").order("created_at", { ascending: false }),
  ]);

  if (postsResult.error) setStatus(postsResult.error.message, true);
  if (demoResult.error) setStatus(demoResult.error.message, true);
  if (clientsResult.error) setStatus(clientsResult.error.message, true);

  blogListNode.innerHTML = (postsResult.data || []).map((post) => `
    <li>
      <span>${post.slug} • ${post.status}</span>
      <button class="btn danger" type="button" data-delete-post="${post.id}">Delete</button>
    </li>
  `).join("") || '<li><span>No blog posts yet.</span></li>';

  demoFilesNode.innerHTML = (demoResult.data || []).map((file) => `
    <li>
      <span>${file.file_name} • ${formatLongDate(file.created_at)}</span>
      <button class="btn danger" type="button" data-delete-demo="${file.id}">Delete</button>
    </li>
  `).join("") || '<li><span>No demo files yet.</span></li>';

  pendingClientsNode.innerHTML = (clientsResult.data || []).map((client) => `
    <li>
      <span>${client.full_name || "Unnamed Client"} • ${client.portal_status}</span>
      <button class="btn ghost" type="button" data-approve-client="${client.id}">Approve</button>
    </li>
  `).join("") || '<li><span>No client accounts yet.</span></li>';
}

if (postForm && hasSupabase) {
  postForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = await getCurrentProfile();
    const formData = new FormData(postForm);
    const title = String(formData.get("post-title") || "").trim();
    const slug = slugify(String(formData.get("post-slug") || title));
    setStatus("Saving blog post...");
    const { error } = await supabase.from("blog_posts").insert({
      title,
      slug,
      excerpt: String(formData.get("post-excerpt") || "").trim(),
      category: String(formData.get("post-category") || "").trim(),
      cover_image_url: String(formData.get("post-cover") || "").trim(),
      content: `<p>${escapeHtml(String(formData.get("post-content") || "").trim()).replaceAll("\n\n", "</p><p>")}</p>`,
      status: String(formData.get("post-status") || "draft"),
      author_id: profile.id,
    });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus("Blog post saved.");
    postForm.reset();
    loadAdminData();
  });
}

if (demoForm && hasSupabase) {
  demoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = await getCurrentProfile();
    const formData = new FormData(demoForm);
    const file = formData.get("demo-file");
    if (!(file instanceof File) || !file.name) {
      setStatus("Choose a demo file before uploading.", true);
      return;
    }
    const path = `${Date.now()}-${file.name}`;
    setStatus("Uploading demo file...");
    const upload = await supabase.storage.from("demo-files").upload(path, file, { upsert: false });
    if (upload.error) {
      setStatus(upload.error.message, true);
      return;
    }
    const { error } = await supabase.from("demo_files").insert({
      file_name: file.name,
      bucket_path: path,
      description: String(formData.get("demo-description") || "").trim(),
      uploaded_by: profile.id,
    });
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus("Demo file uploaded.");
    demoForm.reset();
    loadAdminData();
  });
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !hasSupabase) return;

  const postId = target.getAttribute("data-delete-post");
  if (postId) {
    const { error } = await supabase.from("blog_posts").delete().eq("id", postId);
    if (error) setStatus(error.message, true);
    else setStatus("Blog post deleted.");
    loadAdminData();
    return;
  }

  const demoId = target.getAttribute("data-delete-demo");
  if (demoId) {
    const { data: row } = await supabase.from("demo_files").select("bucket_path").eq("id", demoId).single();
    if (row?.bucket_path) await supabase.storage.from("demo-files").remove([row.bucket_path]);
    const { error } = await supabase.from("demo_files").delete().eq("id", demoId);
    if (error) setStatus(error.message, true);
    else setStatus("Demo file deleted.");
    loadAdminData();
    return;
  }

  const clientId = target.getAttribute("data-approve-client");
  if (clientId) {
    const { error } = await supabase.from("profiles").update({ portal_status: "active" }).eq("id", clientId);
    if (error) setStatus(error.message, true);
    else setStatus("Client portal access approved.");
    loadAdminData();
  }
});

if (signOutButton) {
  signOutButton.addEventListener("click", signOutToLogin);
}

loadAdminData();
