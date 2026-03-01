import { blogSeed } from "./blog-seed.js";
import { applyYear, formatLongDate, hasSupabase, supabase } from "./supabase-client.js";

applyYear();

const listNode = document.querySelector("[data-blog-list]");

function renderPosts(posts) {
  if (!listNode) return;
  listNode.innerHTML = posts.map((post) => `
    <article class="card reveal">
      <div class="meta"><span>${formatLongDate(post.published_at)}</span><span>${post.category || "Blog"}</span></div>
      <h4><a href="blog-post.html?slug=${encodeURIComponent(post.slug)}">${post.title}</a></h4>
      <p>${post.excerpt || ""}</p>
      <a class="text-link" href="blog-post.html?slug=${encodeURIComponent(post.slug)}">Read article</a>
    </article>
  `).join("");
}

async function loadPosts() {
  if (!hasSupabase) {
    renderPosts(blogSeed);
    return;
  }
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, category, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error || !data?.length) {
    renderPosts(blogSeed);
    return;
  }
  renderPosts(data);
}

loadPosts();
