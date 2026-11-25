import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import matter from "gray-matter";
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
  assert.equal(
    document.querySelectorAll('meta[property="og:title"]').length,
    1,
    `${file}: duplicate og:title`,
  );
  assert.equal(
    document.querySelectorAll('meta[property="og:description"]').length,
    1,
    `${file}: duplicate og:description`,
  );
  assert.equal(
    document.querySelectorAll('meta[property="og:image"]').length,
    1,
    `${file}: duplicate og:image`,
  );
  const ogImage = document.querySelector('meta[property="og:image"]')?.content;
  assert(ogImage?.startsWith("https://"), `${file}: absolute og:image`);
  assert(!ogImage.includes("/assets/images/social.png"), `${file}: stale og:image`);
  assert(!ogImage.includes("social-space-v20261125.png"), `${file}: old space card`);
  assert(
    document.querySelector('meta[name="twitter:image"]')?.content === ogImage,
    `${file}: twitter:image`,
  );
  assert(
    document.querySelector('link[rel="manifest"]')?.href.endsWith(
      "/site-v20261125.webmanifest",
    ),
    `${file}: manifest`,
  );
  assert(document.querySelector("main"), `${file}: main`);
  if (path.relative(root, file).startsWith(`posts${path.sep}`)) {
    assert.equal(
      document.querySelectorAll("h1").length,
      1,
      `${file}: posts must have one page heading`,
    );
    for (const code of document.querySelectorAll(".article-prose pre code"))
      assert(
        [...code.classList].some((name) => name.startsWith("language-")),
        `${file}: fenced code language missing`,
      );
  }
  const ids = new Set();
  for (const node of document.querySelectorAll("[id]")) {
    assert(!ids.has(node.id), `${file}: duplicate id ${node.id}`);
    ids.add(node.id);
  }
  for (const img of document.querySelectorAll("img"))
    assert(img.hasAttribute("alt"), `${file}: image alt`);
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
const expectedPostCount = fs
  .readdirSync("src/posts")
  .filter((file) => file.endsWith(".md"))
  .map((file) => matter(fs.readFileSync(path.join("src/posts", file), "utf8")).data)
  .filter((data) => !data.draft).length;
assert.equal(posts.length, expectedPostCount, "공개 글 수가 소스와 다릅니다.");
const recordOrders = posts.map((post) => post.recordOrder);
assert(recordOrders.every((value) => Number.isInteger(value) && value > 0));
assert.equal(new Set(recordOrders).size, recordOrders.length, "recordOrder 중복");
assert.deepEqual(
  posts.map(({ date, recordOrder, url }) => ({ date, recordOrder, url })),
  [...posts]
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        Number(b.recordOrder) - Number(a.recordOrder) ||
        a.url.localeCompare(b.url),
    )
    .map(({ date, recordOrder, url }) => ({ date, recordOrder, url })),
  "검색 인덱스가 실제 게시 날짜 최신순이 아닙니다.",
);

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
const chronological = [...posts].sort((a, b) => a.recordOrder - b.recordOrder);
for (const [index, post] of chronological.entries()) {
  const { document } = parseHTML(
    fs.readFileSync(path.join(root, post.url, "index.html"), "utf8"),
  );
  const navigation = document.querySelector('.record-navigation[aria-label="글 탐색"]');
  assert(navigation, `${post.url}: 글 탐색 누락`);
  assert(
    navigation.querySelector(".current-record")?.textContent.includes(
      String(post.recordOrder).padStart(3, "0"),
    ),
    `${post.url}: 현재 순번 불일치`,
  );
  const links = [...navigation.querySelectorAll("a")].map((link) => link.href);
  assert.equal(
    links.includes(chronological[index - 1]?.url),
    index > 0,
    `${post.url}: 이전 글 연결 오류`,
  );
  assert.equal(
    links.includes(chronological[index + 1]?.url),
    index < chronological.length - 1,
    `${post.url}: 다음 글 연결 오류`,
  );
}
// Empty archives and posts without code are valid. Check the sample only while it exists.
const sample = `${root}/posts/github-pages-blog/index.html`;
if (fs.existsSync(sample)) {
  const sampleHtml = fs.readFileSync(sample, "utf8");
  assert(
    sampleHtml.includes('class="token '),
    "Syntax highlighting missing",
  );
  const { document } = parseHTML(sampleHtml);
  const sequence = document.querySelector(".article-label span");
  const expectedSequence = String(
    posts.find((post) => post.url === "/posts/github-pages-blog/").recordOrder,
  ).padStart(3, "0");
  assert.equal(
    sequence?.textContent.trim(),
    `No. ${expectedSequence}`,
    "Post sequence missing",
  );
  assert(document.querySelector('.record-navigation[aria-label="글 탐색"]'));
}
assert(fs.existsSync(`${root}/assets/images/social-orbit-v2-20261125.png`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-v20261125.svg`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-16-v20261125.png`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-32-v20261125.png`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-180-v20261125.png`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-192-v20261125.png`));
assert(fs.existsSync(`${root}/assets/icons/planet-ring-512-v20261125.png`));
assert(fs.existsSync(`${root}/assets/images/space/station-launch-v20261125.webp`));
assert(fs.existsSync(`${root}/assets/images/space/station-bridge-dark-v20261125.webp`));
assert(fs.existsSync(`${root}/assets/images/space/station-bridge-light-v20261125.webp`));
assert(fs.existsSync(`${root}/assets/images/space/orbit-observatory-dark-v20261125.webp`));
assert(fs.existsSync(`${root}/assets/images/space/orbit-observatory-light-v20261125.webp`));
assert(fs.existsSync(`${root}/favicon.ico`));
assert(fs.existsSync(`${root}/favicon-v20261125.ico`));
assert(fs.existsSync(`${root}/site-v20261125.webmanifest`));
assert(fs.existsSync(`${root}/.nojekyll`));
const sitemap = fs.readFileSync(`${root}/sitemap.xml`, "utf8");
assert(!sitemap.includes("/404.html"));
for (const post of posts) assert(sitemap.includes(post.url));
console.log(
  `PASS: ${html.length} HTML pages, ${links} internal references, 6 categories, ${posts.length} post(s), search index, syntax highlighting, sitemap, metadata and assets.`,
);
