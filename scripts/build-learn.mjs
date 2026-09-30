// Compiles the learning center (content/learn/*.mdx) into static JSON at build time.
// Articles are Markdown with YAML frontmatter; rendering happens here (Node), so no Markdown/MDX
// runtime ships to the Worker or the browser. Also emits a small client-side search index.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "content", "learn");
const outDir = path.join(root, "src", "generated");
const SECTIONS = ["before-authoring", "before-submitting", "before-reviewing"];
const OFFICIAL = /^https:\/\/(info\.arxiv\.org|blog\.arxiv\.org|arxiv\.org)\//;

// open external links in a new tab
function rehypeExternalLinks() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === "element" && node.tagName === "a") {
        const href = String(node.properties?.href ?? "");
        if (/^https?:\/\//.test(href)) {
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        }
      }
      (node.children ?? []).forEach(walk);
    };
    walk(tree);
  };
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
  .use(rehypeSlug).use(rehypeExternalLinks).use(rehypeStringify);

const errors = [];
const articles = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx") || f.endsWith(".md")).sort()) {
  const slug = file.replace(/\.mdx?$/, "");
  const { data, content } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
  const need = ["title", "description", "section", "order", "lastVerified", "sources", "faq"];
  for (const k of need) if (data[k] === undefined) errors.push(`${file}: missing ${k}`);
  if (data.section && !SECTIONS.includes(data.section)) errors.push(`${file}: bad section ${data.section}`);
  if (!Array.isArray(data.sources) || data.sources.length === 0) errors.push(`${file}: needs sources`);
  for (const s of data.sources ?? []) if (!OFFICIAL.test(s.url)) errors.push(`${file}: non-arXiv source ${s.url}`);
  if (/^#\s/m.test(content)) errors.push(`${file}: use ## headings; the title renders as H1`);
  const html = String(await processor.process(content));
  const headings = [...content.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  articles.push({
    slug,
    title: data.title,
    description: data.description,
    section: data.section,
    order: Number(data.order),
    lastVerified: String(data.lastVerified),
    needsReview: data.needsReview !== false,
    cta: data.cta === "endorser" ? "endorser" : "author",
    sources: data.sources ?? [],
    faq: data.faq ?? [],
    related: data.related ?? [],
    headings,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    html,
  });
}
const slugs = new Set(articles.map((a) => a.slug));
for (const a of articles) for (const r of a.related) if (!slugs.has(r)) errors.push(`${a.slug}: unknown related slug ${r}`);
if (errors.length) {
  console.error("Learning center content errors:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
articles.sort((a, b) => a.order - b.order);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "learn.json"), JSON.stringify({ articles }, null, 0));
const search = articles.map((a) => ({ slug: a.slug, title: a.title, description: a.description, faq: a.faq.map((f) => f.q) }));
fs.writeFileSync(path.join(outDir, "learn-search.json"), JSON.stringify(search));
console.log(`learn: compiled ${articles.length} articles`);
