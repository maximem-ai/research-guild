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

// Inline definitions: wrap the first mention of each glossary term in an article (max 10 per article)
// with the same markup as the <Term> component. Skips headings, links and code.
const glossary = JSON.parse(fs.readFileSync(path.join(dir, "glossary.json"), "utf8")).terms;
const AUTO_SKIP = new Set(["arxiv", "reviewer"]); // "arxiv" is everywhere; "reviewer" in articles usually means a journal reviewer
const patterns = glossary.filter((t) => !AUTO_SKIP.has(t.slug))
  .flatMap((t) => [t.term.replace(/[“”"]/g, "").replace(/\s*\(.*\)$/, ""), ...t.aliases].map((p) => ({ p, t })))
  .filter((x) => x.p.length >= 3)
  .sort((a, b) => b.p.length - a.p.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const termRe = new RegExp(`(?<![\\w-])(${patterns.map((x) => esc(x.p)).join("|")})(?![\\w-])`, "gi");
const lookup = (m) => patterns.find((x) => x.p.toLowerCase() === m.toLowerCase()).t;

function rehypeGlossary() {
  return (tree, file) => {
    const used = new Set();
    let n = 0;
    const SKIP = new Set(["a", "h1", "h2", "h3", "h4", "code", "pre"]);
    const walk = (node) => {
      if (node.type === "element" && SKIP.has(node.tagName)) return;
      if (!node.children) return;
      const out = [];
      for (const child of node.children) {
        if (child.type !== "text" || n >= 10) { walk(child); out.push(child); continue; }
        let last = 0; const v = child.value; termRe.lastIndex = 0; let m;
        while ((m = termRe.exec(v)) && n < 10) {
          const t = lookup(m[1]);
          if (used.has(t.slug)) continue;
          used.add(t.slug); n++;
          if (m.index > last) out.push({ type: "text", value: v.slice(last, m.index) });
          const id = `def-${t.slug}`;
          out.push({ type: "element", tagName: "span", properties: { className: ["term"] }, children: [
            { type: "element", tagName: "a", properties: { href: `/learn/glossary#${t.slug}`, className: ["term-link"], ariaDescribedBy: id }, children: [{ type: "text", value: m[1] }] },
            { type: "element", tagName: "span", properties: { role: "tooltip", id, className: ["term-tip"] }, children: [
              { type: "element", tagName: "strong", properties: {}, children: [{ type: "text", value: t.term }] },
              { type: "text", value: t.definition }] }] });
          last = m.index + m[1].length;
        }
        if (last < v.length) out.push({ type: "text", value: v.slice(last) });
      }
      node.children = out;
    };
    walk(tree);
    file.data.terms = [...used];
  };
}

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
  .use(rehypeSlug).use(rehypeGlossary).use(rehypeExternalLinks).use(rehypeStringify);

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
  const vfile = await processor.process(content);
  const html = String(vfile);
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
    terms: vfile.data.terms ?? [],
    html,
  });
}
const slugs = new Set(articles.map((a) => a.slug));
const termSlugs = new Set();
for (const t of glossary) {
  if (termSlugs.has(t.slug)) errors.push(`glossary: duplicate slug ${t.slug}`);
  termSlugs.add(t.slug);
  if (t.article && !slugs.has(t.article)) errors.push(`glossary: ${t.slug} links unknown article ${t.article}`);
}
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

// llms.txt for the site (https://researchguild.org/llms.txt), regenerated from the same articles.
const SITE = "https://researchguild.org";
const SECTION_TITLES = { "before-authoring": "Before authoring", "before-submitting": "Before submitting", "before-reviewing": "Before reviewing or endorsing" }; // as in src/lib/learn.ts
const llms = [
  "# ResearchGuild",
  "> Get honest feedback on your paper before publishing, and find someone to endorse you for your first paper in a domain. Authors post an abstract, revise with people who have published, and find an arXiv endorser in their field. Free and open source (AGPL-3.0); not affiliated with arXiv.",
  "",
  "## Start here",
  `- [Home and FAQ](${SITE}/#faq): how to find an endorser and how to become one`,
  `- [arXiv readiness check](${SITE}/learn/readiness-check): 7 questions, no sign-in`,
  `- [Glossary](${SITE}/learn/glossary): arXiv and ResearchGuild terms`,
  `- [Source code](https://github.com/maximem-ai/research-guild)`,
  "",
  ...Object.entries(SECTION_TITLES).flatMap(([id, title]) => [
    `## Learning center: ${title}`,
    ...articles.filter((a) => a.section === id).map((a) => `- [${a.title}](${SITE}/learn/${a.slug}): ${a.description}`),
    "",
  ]),
].join("\n");
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/llms.txt", llms);
