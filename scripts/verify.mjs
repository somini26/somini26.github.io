import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
const root = path.resolve("_site");
const categories = JSON.parse(fs.readFileSync("src/_data/topics.json", "utf8"));
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
const files = walk(root),
  html = files.filter((f) => f.endsWith(".html"));
assert(
  !files.some((file) => file.includes(`${path.sep}prototypes${path.sep}`)),
  "Prototype routes must not be published",
);
let links = 0;
for (const file of html) {
  const { document } = parseHTML(fs.readFileSync(file, "utf8"));
  assert(document.querySelector('html[lang="ko"]'), `${file}: lang`);
  assert(document.querySelector("title")?.textContent.trim(), `${file}: title`);
  assert(
    document.querySelector('meta[name="description"]')?.content,
    `${file}: description`,
  );
  assert(document.querySelector("main"), `${file}: main`);
  const ids = new Set();
  for (const node of document.querySelectorAll("[id]")) {
    assert(!ids.has(node.id), `${file}: duplicate id ${node.id}`);
    ids.add(node.id);
  }
  for (const img of document.querySelectorAll("img"))
    assert(img.hasAttribute("alt") && img.alt, `${file}: image alt`);
  for (const node of document.querySelectorAll("[href],[src]")) {
    const value = node.getAttribute("href") || node.getAttribute("src");
    if (!value || /^(https?:|mailto:|data:)/.test(value)) continue;
    const url = new URL(
      value,
      `https://somini26.github.io/${path.relative(root, file).replace(/index\.html$/, "")}`,
    );
    let target = path.join(root, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) target = path.join(target, "index.html");
    assert(fs.existsSync(target), `${file}: missing ${value}`);
    if (url.hash && target.endsWith(".html")) {
      const { document: doc } = parseHTML(fs.readFileSync(target, "utf8"));
      assert(
        doc.getElementById(decodeURIComponent(url.hash.slice(1))),
        `${file}: broken anchor ${value}`,
      );
    }
    links++;
  }
}
assert.equal(categories.length, 6);
for (const category of categories) {
  assert(/^[a-z-]+$/.test(category.slug));
  const text = fs.readFileSync(
    `${root}/categories/${category.slug}/index.html`,
    "utf8",
  );
  assert(text.includes(category.name));
}
const posts = JSON.parse(fs.readFileSync(`${root}/search.json`, "utf8"));

for (const post of posts) {
  assert(fs.existsSync(path.join(root, post.url, "index.html")));
  const text = fs.readFileSync(path.join(root, post.url, "index.html"), "utf8");
  assert(
    post.categories.every((c) =>
      categories.some((category) => category.name === c),
    ),
  );
  assert(!text.includes("[object Object]"), "Invalid category metadata");
  assert(
    Array.isArray(post.categories) &&
      post.categories.every((c) => typeof c === "string"),
  );
}
// Empty archives and posts without code are valid. Check the sample only while it exists.
const sample = `${root}/posts/github-pages-blog/index.html`;
if (fs.existsSync(sample))
  assert(
    fs.readFileSync(sample, "utf8").includes('class="token '),
    "Syntax highlighting missing",
  );
assert(fs.existsSync(`${root}/assets/images/social.png`));
assert(fs.existsSync(`${root}/.nojekyll`));
const sitemap = fs.readFileSync(`${root}/sitemap.xml`, "utf8");
assert(!sitemap.includes("/404.html"));
for (const post of posts) assert(sitemap.includes(post.url));
console.log(
  `PASS: ${html.length} HTML pages, ${links} internal references, 6 categories, ${posts.length} post(s), search index, syntax highlighting, sitemap, metadata and assets.`,
);
