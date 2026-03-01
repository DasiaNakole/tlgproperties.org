import { blogSeed } from "./blog-seed.js";
import { applyYear, formatLongDate, hasSupabase, supabase } from "./supabase-client.js";

applyYear();

const articleNode = document.querySelector("[data-blog-post]");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

function renderPost(post) {
  if (!articleNode || !post) return;
  articleNode.innerHTML = `
    <div class="eyebrow">${formatLongDate(post.published_at)} • ${post.category || "Blog"}</div>
    <h2>${post.title}</h2>
    ${post.cover_image_url ? `<img src="${post.cover_image_url}" alt="${post.title}" class="article-cover" />` : ""}
    ${post.content}
    <a class="btn ghost" href="blog.html">Back to Blog</a>
  `;
}

async function loadPost() {
  const fallback = blogSeed.find((post) => post.slug === slug) || blogSeed[0];
  if (!hasSupabase || !slug) {
    renderPost(fallback);
    return;
  }
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, category, published_at, content, cover_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  renderPost(error || !data ? fallback : data);
}

loadPost();
