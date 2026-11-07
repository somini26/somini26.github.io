import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const file = "src/posts/2099-01-01-verification-only.md";
assert(!fs.existsSync(file), "검증용 파일 이름이 이미 존재합니다.");
const baselinePosts = JSON.parse(fs.readFileSync("_site/search.json", "utf8"));
const recordOrder = Math.max(...baselinePosts.map((post) => post.recordOrder)) + 1;
const source = `---
title: "자동 반영 검사 전용"
date: 2099-01-01
recordOrder: ${recordOrder}
categories: ["개발", "CTF/Wargame"]
tags: ["Verification"]
description: "발행하지 않는 임시 검증 파일입니다."
---
## 검증
새 글 자동 반영을 확인하는 임시 콘텐츠입니다.
`;
function build() {
  try {
    execFileSync("npm", ["run", "build"], { stdio: "pipe" });
  } catch (error) {
    throw new Error(error.stderr?.toString() || error.message);
  }
}
try {
  fs.writeFileSync(file, source);
  build();
  const posts = JSON.parse(fs.readFileSync("_site/search.json", "utf8"));
  assert.equal(posts[0].title, "자동 반영 검사 전용");
  assert.equal(posts[0].url, "/posts/verification-only/");
  assert.equal(posts[0].categories.length, 2);
  assert(posts[0].tags.includes("Verification"));
  const expectedSequence = String(recordOrder).padStart(3, "0");
  assert(
    fs
      .readFileSync("_site/posts/verification-only/index.html", "utf8")
      .includes(
        `<span class="article-sequence" aria-hidden="true">${expectedSequence}</span>`,
      ),
    "게시글 배경 번호가 고정 작성 순번과 일치해야 합니다.",
  );
  for (const slug of ["development", "ctf-wargame"]) {
    assert(
      fs
        .readFileSync(`_site/categories/${slug}/index.html`, "utf8")
        .includes("자동 반영 검사 전용"),
    );
  }
  for (const filename of [
    "index.html",
    "archive/index.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    assert(
      fs
        .readFileSync(`_site/${filename}`, "utf8")
        .includes(
          filename === "sitemap.xml"
            ? "/posts/verification-only/"
            : "자동 반영 검사 전용",
        ),
    );
  }
  fs.writeFileSync(file, source.replace("date:", "draft: true\ndate:"));
  build();
  assert(!fs.existsSync("_site/posts/verification-only/index.html"));
  for (const filename of [
    "search.json",
    "index.html",
    "archive/index.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    assert(
      !fs
        .readFileSync(`_site/${filename}`, "utf8")
        .includes(
          filename === "sitemap.xml"
            ? "/posts/verification-only/"
            : "자동 반영 검사 전용",
        ),
    );
  }
  const restoredPosts = JSON.parse(fs.readFileSync("_site/search.json", "utf8"));
  assert.deepEqual(
    restoredPosts.map(({ url, recordOrder }) => ({ url, recordOrder })),
    baselinePosts.map(({ url, recordOrder }) => ({ url, recordOrder })),
    "글이 비공개로 바뀌어도 기존 순번을 다시 매기면 안 됩니다.",
  );
  fs.writeFileSync(
    file,
    source.replace('"개발", "CTF/Wargame"', '"Unknown Category"'),
  );
  assert.throws(build, /categories/);
  fs.writeFileSync(file, source.replace(`recordOrder: ${recordOrder}`, "recordOrder: 1"));
  assert.throws(build, /recordOrder .*중복/);
  console.log(
    "PASS: Markdown auto-publishing, fixed record order, multiple categories, tags, RSS, sitemap, draft exclusion, stable existing numbers, stale output removal, invalid category and duplicate order rejection.",
  );
} finally {
  fs.rmSync(file, { force: true });
  build();
}
