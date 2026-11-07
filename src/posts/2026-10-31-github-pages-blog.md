---
title: "GitHub Pages 블로그 구축 기록"
date: 2026-10-31
recordOrder: 1
categories: ["블로그/기술문서"]
tags: ["GitHub", "Eleventy", "GitHub Actions", "Markdown"]
description: "Eleventy로 개인 기술 블로그를 구성하고 GitHub Actions로 GitHub Pages에 자동 배포한 과정과 실제 문제 해결 기록을 정리했습니다."
---
안녕하세요. somani입니다!

이번 글에서는 GitHub Pages로 블로그를 만들고 배포한 과정을 정리해 보려고 합니다. 시스템 해킹과 리버싱을 공부하다 보면 명령 한 줄보다 그 명령이 왜 필요했는지, 실패했을 때 무엇을 확인했는지가 더 오래 남습니다. CTF 풀이, 개발 프로젝트, 논문을 읽은 기록까지 한곳에 쌓으려면 글을 쓰는 과정이 복잡하지 않아야 했습니다. 그래서 Markdown 파일을 추가하면 목록, 카테고리, 검색, RSS가 함께 갱신되는 개인 아카이브를 만들었습니다.

완성된 화면만 소개하기보다 `somini26/somini26.github.io` 저장소의 실제 구조와 Git 기록을 기준으로, Eleventy가 Markdown을 어떻게 HTML로 바꾸고 GitHub Actions가 그 결과를 어떻게 Pages에 올리는지 살펴보겠습니다. 구축 이후 서로 다른 로컬 저장소 때문에 커밋을 바로 찾지 못했던 일, 인증과 커밋 이메일 문제를 해결한 과정도 함께 남깁니다.

![Markdown 콘텐츠를 Eleventy가 HTML로 생성하고 GitHub Pages에서 발행하는 흐름](/assets/images/archive-flow.svg)

## 1. 블로그를 만든 이유

처음부터 서버가 필요한 서비스보다는 오래 유지할 수 있는 기록 공간을 원했습니다. 이 블로그에서 중요하게 본 조건은 세 가지였습니다.

1. 글은 에디터에 종속되지 않은 Markdown 파일로 남을 것
2. 시스템 해킹, 리버싱, CTF, 개발 등 서로 다른 기록을 일관된 분류로 찾을 수 있을 것
3. 로컬에서 확인한 결과를 Git에 남기면 배포까지 자동으로 이어질 것

GitHub Pages는 GitHub 저장소의 정적 파일을 웹사이트로 제공하는 호스팅 기능입니다. 이 저장소는 사용자 사이트 규칙에 맞춘 `somini26.github.io`라는 이름을 사용하므로 공개 주소는 `https://somini26.github.io/`가 됩니다. 프로젝트 사이트처럼 저장소 이름이 URL 뒤에 붙지 않아 Eleventy의 출력 경로도 `/`를 기준으로 작성했습니다.

### 정적 사이트와 동적 사이트의 차이

동적 사이트는 요청이 들어올 때 서버가 데이터베이스를 조회하고 HTML을 만들어 응답할 수 있습니다. 로그인이나 실시간 데이터처럼 서버 처리가 필요한 기능에는 적합하지만, 서버와 데이터베이스를 계속 운영해야 합니다.

정적 사이트는 배포 전에 HTML을 미리 생성합니다. 방문자는 이미 완성된 HTML, CSS, JavaScript를 받는다. 글을 읽고 검색하는 개인 블로그에는 이 방식으로 충분했고, 서버 공격 표면과 운영 비용을 줄일 수 있다는 점도 잘 맞았다. 이 블로그의 검색 역시 서버 요청이 아니라 빌드 시 생성한 `/search.json`을 브라우저에서 읽는 방식입니다.

| 구분 | 정적 사이트 | 동적 사이트 |
| --- | --- | --- |
| HTML 생성 시점 | 빌드할 때 미리 생성 | 요청을 받을 때 생성 가능 |
| 운영 구성 | 정적 파일 호스팅 | 애플리케이션 서버·DB 등이 필요할 수 있음 |
| 콘텐츠 변경 | 다시 빌드하고 배포 | 관리자 화면이나 DB에서 즉시 변경 가능 |
| 이 블로그에서의 선택 | Markdown 중심 기록에 적합 | 현재 요구에는 과한 구성 |

GitHub Pages를 선택한 가장 큰 이유는 코드와 글, 변경 이력을 같은 Git 저장소에서 관리할 수 있기 때문입니다. 별도 서버 비용 없이 HTTPS와 배포 환경을 사용할 수 있고, 문제가 생기면 어느 커밋에서 바뀌었는지도 추적할 수 있습니다.

## 2. 사용한 기술과 각 역할

도구를 많이 넣기보다 각 도구의 책임을 분명하게 나눴다.

| 기술 | 이 프로젝트에서 하는 일 |
| --- | --- |
| GitHub Pages | `_site/`에 생성된 정적 결과물을 공개 주소에서 제공한다. |
| Git / GitHub | 소스와 글의 변경 이력을 커밋으로 남기고 Actions 실행의 시작점이 된다. |
| Eleventy 3 | `src/`의 Markdown·Nunjucks를 읽어 `_site/`의 HTML로 생성한다. |
| Nunjucks | 헤더, 푸터, 글 본문, 카드처럼 반복되는 HTML 구조를 템플릿으로 재사용한다. |
| Markdown | 게시글 내용과 front matter 메타데이터를 함께 관리한다. |
| HTML / CSS / JavaScript | 의미 있는 문서 구조, 반응형 화면, 테마·검색·목차·복사 기능을 담당한다. |
| GitHub Actions | 저장소를 checkout하고 의존성 설치, 빌드, 검증, Pages 배포를 자동화한다. |
| Playwright / axe-core | 실제 Chromium에서 데스크톱·모바일 동작과 접근성, 콘솔 오류를 확인한다. |

Eleventy를 고른 이유는 Node.js 환경에서 Markdown 변환과 템플릿, 테스트를 한 프로젝트로 묶을 수 있기 때문입니다. React 같은 런타임 프레임워크 없이도 필요한 페이지를 빌드할 수 있어 방문자에게는 생성된 HTML과 순수 CSS, 기능에 필요한 작은 JavaScript만 전달됩니다.

Nunjucks는 콘텐츠와 화면 구조를 분리합니다. 예를 들어 모든 글에 공통으로 필요한 제목, 날짜, 태그, 목차 영역은 `src/_includes/post.njk` 한 곳에서 관리합니다. Markdown 글은 레이아웃을 반복해서 작성하지 않고 본문에 집중할 수 있습니다.

## 3. 저장소를 준비하고 로컬에서 실행하기

현재 `package.json`은 Node.js 22 이상을 요구하고, README에서는 배포 환경과 맞춘 Node.js 24 LTS를 안내합니다. Git과 Node.js를 준비한 뒤 다음 순서로 실행합니다.

```bash
git clone https://github.com/somini26/somini26.github.io.git
cd somini26.github.io
npm ci
npm run dev
```

`git clone`은 원격 저장소의 커밋과 파일을 로컬로 가져온다. `npm ci`는 `package-lock.json`에 기록된 정확한 버전으로 의존성을 설치합니다. 잠금 파일을 새로 계산하는 `npm install`과 달리 CI와 로컬이 같은 의존성 조합을 쓰게 하는 데 목적이 있습니다.

`npm run dev`는 먼저 이전 `_site/` 결과를 지운 다음 Eleventy 개발 서버를 실행합니다. 기본 주소는 `http://localhost:8080`이며 파일을 고치면 변경 사항을 다시 빌드합니다. 실제 배포 결과만 만들 때는 다음 명령을 쓴다.

```bash
npm run build
```

이 명령의 실제 정의는 `node scripts/clean.mjs && eleventy`다. 먼저 생성 폴더를 비우기 때문에 삭제했거나 `draft`로 바꾼 글이 오래된 HTML로 남는 문제를 막는다. 그 다음 Eleventy가 `src/`를 읽어 `_site/`를 만듭니다.

## 4. 프로젝트 구조와 파일의 책임

현재 저장소에서 빌드와 콘텐츠에 직접 관련된 구조를 추리면 다음과 같습니다.

```text
somini26.github.io/
├── .github/workflows/pages.yml       # 빌드·검증·Pages 배포
├── eleventy.config.js                # Eleventy와 Markdown 설정
├── package.json                      # 실행 명령과 의존성
├── package-lock.json                 # 설치 버전 고정
├── playwright.config.js              # 데스크톱·모바일 브라우저 설정
├── scripts/
│   ├── clean.mjs                     # 이전 _site 삭제
│   ├── verify.mjs                    # 생성 결과와 내부 링크 검증
│   └── verify-content.mjs            # 글 발행·초안 정책 검증
├── tests/blog.spec.js                # 브라우저·접근성 테스트
└── src/
    ├── _data/
    │   ├── profile.json              # somani 프로필과 관심 분야
    │   ├── projects.json             # 공개 프로젝트 데이터
    │   ├── site.json                 # 주소·설명·GitHub 링크
    │   └── topics.json               # 6개 카테고리와 slug
    ├── _includes/
    │   ├── base.njk                  # 공통 head·헤더·푸터
    │   ├── post.njk                  # 게시글 본문·목차 레이아웃
    │   └── post-card.njk             # 목록의 게시글 표현
    ├── assets/                        # CSS·JS·이미지·파비콘
    ├── posts/                         # 공개 글과 draft 템플릿
    ├── feed.njk                       # RSS 생성
    ├── search.njk                     # 검색 JSON 생성
    └── sitemap.njk                    # Sitemap 생성
```

`_site/`와 `node_modules/`는 생성 결과이므로 Git으로 추적하지 않습니다. 소스는 `src/`, 자동 검증은 `scripts/`와 `tests/`로 분리해 배포 파일과 개발 도구가 섞이지 않게 했습니다.

### `eleventy.config.js`: 빌드 규칙의 중심

설정 파일은 입력과 출력 폴더를 다음처럼 지정합니다.

```javascript
return {
  dir: {
    input: "src",
    output: "_site",
    includes: "_includes",
    data: "_data",
  },
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
  templateFormats: ["md", "njk"],
};
```

Markdown 안에서 템플릿 표현식을 실행하지 않도록 `markdownTemplateEngine: false`로 두고, Markdown-it의 `html: false`도 사용합니다. 사용자가 쓴 원시 HTML을 그대로 실행하지 않고 Nunjucks 자동 이스케이프까지 켠 구성입니다.

게시글 collection은 `src/posts/*.md`를 모은 뒤 초안을 제외하고 날짜 역순으로 정렬합니다.

```javascript
config.addCollection("posts", (api) =>
  api
    .getFilteredByGlob("src/posts/*.md")
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.date - a.date || a.url.localeCompare(b.url)),
);
```

빌드 직전에는 front matter의 `title`, `description`, `date`, `categories`, `tags`를 검사합니다. 존재하지 않는 카테고리를 쓰면 조용히 목록에서 빠지는 대신 빌드를 실패시켜 오타를 바로 찾을 수 있습니다.

### `package.json`: 사람이 실행하는 명령을 고정하기

```json
{
  "scripts": {
    "dev": "node scripts/clean.mjs && eleventy --serve",
    "build": "node scripts/clean.mjs && eleventy",
    "test": "node scripts/verify.mjs",
    "test:browser": "playwright test",
    "test:content": "node scripts/verify-content.mjs"
  }
}
```

긴 명령을 외우기보다 같은 이름으로 실행하게 해 로컬과 Actions의 차이를 줄였습니다. `private: true`도 지정해 이 블로그 프로젝트가 실수로 npm 패키지로 배포되지 않게 했습니다.

### `src/_data/topics.json`: 표시 이름과 URL 분리

필수 여섯 카테고리는 데이터 파일 한 곳에서 관리합니다.

```json
{
  "name": "CTF/Wargame",
  "slug": "ctf-wargame",
  "label": "CTF / Wargame",
  "description": "CTF 문제 풀이와 리버싱, 포렌식 노트"
}
```

화면에는 `CTF/Wargame`을 표시하지만 URL에는 `/categories/ctf-wargame/`처럼 안전한 slug를 사용합니다. 현재 카테고리는 개발, CTF/Wargame, Bug Bounty, 블로그/기술문서, 논문/컨퍼런스, 공모전/자격증 여섯 개다. 아직 글이 없어도 카테고리 페이지와 빈 상태 안내는 유지됩니다.

### `src/_data/profile.json`: 화면과 개인정보 분리

프로필 이름, 소속, 이미지 경로, 관심 분야는 템플릿 안에 반복해서 적지 않고 JSON으로 분리했습니다. About와 홈은 같은 데이터를 읽기 때문에 닉네임이나 관심 분야가 달라지는 일을 줄입니다. 현재 이미지는 프로젝트 내부의 `/assets/images/profile-hachiware.jpg`를 사용하고, 대체 텍스트도 데이터에 함께 둔다.

### `src/_includes/`: 공통 레이아웃 재사용

`base.njk`는 모든 일반 페이지의 문서 뼈대다. canonical URL, Open Graph, RSS 링크, 테마 스크립트를 넣고 헤더·주 메뉴·푸터를 제공합니다. `post.njk`는 그 위에 읽기 진행 표시, 글 메타데이터, 본문, 목차와 목록 복귀 링크를 배치합니다.

공통 레이아웃 덕분에 새 Markdown 글을 만들 때 HTML 전체를 복사할 필요가 없습니다. 헤더의 접근성이나 메타 태그를 고쳐도 모든 생성 페이지에 다음 빌드부터 반영됩니다.

## 5. Markdown 글이 공개되기까지

글 파일 이름은 날짜와 영문 slug를 함께 사용합니다. 이 글의 파일은 `src/posts/2026-10-31-github-pages-blog.md`이고 URL은 `/posts/github-pages-blog/`다. 기존 링크를 유지하려면 발행 후 파일 slug를 함부로 바꾸지 않아야 합니다.

```yaml
---
title: "새로운 학습 기록"
date: 2026-11-05
categories: ["CTF/Wargame"]
tags: ["Reversing", "Study"]
description: "이 글에서 확인한 내용을 한두 문장으로 정리합니다."
draft: true
---
```

`draft: true`인 파일은 `posts.11tydata.js`에서 permalink가 `false`가 되고 collection에서도 제외됩니다. 따라서 상세 HTML뿐 아니라 홈, 아카이브, 검색 JSON, RSS, Sitemap에도 나타나지 않습니다. 글을 완성한 후 `draft` 줄을 지우는 것이 공개 절차다.

### 검색과 태그

Eleventy의 `searchData` 필터가 공개 글의 제목, 설명, 본문, 태그, 카테고리를 JSON으로 직렬화합니다. 아카이브 화면의 JavaScript는 `/search.json`을 한 번 읽어 브라우저에서 필터링합니다. 선택한 검색어와 태그는 URL query에 저장되므로 새로고침하거나 링크를 공유해도 조건이 복원됩니다.

검색 결과 DOM은 문자열을 HTML로 삽입하지 않고 `textContent` 기반으로 구성합니다. 검색창에 태그처럼 보이는 문자열을 입력해도 실행 가능한 요소가 만들어지지 않는지 Playwright로 확인합니다.

### 다크·라이트 테마

테마 버튼에서 선택한 값은 `localStorage`의 `somani-theme`에 저장합니다. `<head>`에서 먼저 실행되는 `theme.js`가 저장값을 읽어 `data-theme`을 적용하므로 CSS가 로드된 뒤 색상이 갑자기 바뀌는 현상을 줄였습니다. 예전 키인 `somini-theme` 값이 있으면 새 키로 옮겨 기존 방문자의 선택도 보존합니다.

## 6. GitHub Actions와 Pages 자동 배포

배포 흐름은 다음과 같습니다.

```text
코드·글 수정
  → git commit
  → git push origin main
  → GitHub Actions build job
  → npm ci / build / test
  → _site 아티팩트 업로드
  → deploy job
  → GitHub Pages 반영
```

`.github/workflows/pages.yml`은 `main` push와 pull request, 수동 실행을 처리합니다. 핵심 build 단계는 다음과 같습니다.

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-node@v7
    with:
      node-version: "24"
      cache: npm
  - run: npm ci
  - run: npm run build
  - run: npm test
  - uses: actions/upload-pages-artifact@v5
    if: github.event_name != 'pull_request'
    with:
      path: _site
```

checkout은 해당 커밋의 파일을 runner로 가져오고, setup-node는 Node.js 24와 npm 캐시를 준비합니다. 그 뒤 잠금 파일 그대로 설치하고 `_site/`를 생성한 다음 내부 링크와 필수 파일을 검사합니다. 하나라도 실패하면 아티팩트 업로드와 배포로 넘어가지 않습니다.

deploy job은 build 성공 후에만 실행됩니다. `pages: write`와 `id-token: write` 권한도 이 job에만 준다. Pull Request에서는 빌드와 검사까지만 하고 실제 Pages 배포는 생략합니다. `concurrency` 설정은 같은 ref에서 새 실행이 시작되면 오래된 실행을 취소해 이전 결과가 나중에 배포되는 상황을 줄입니다.

## 7. 실제로 겪은 트러블슈팅

초기 구축과 이후 개선은 한 번에 진행된 작업이 아닙니다. Git 기록을 기준으로 보면 2026년 10월 31일 `0d15e90`에서 기본 블로그와 배포 구조를 만들었고, 같은 날 `d2a2385`에서 About 정보를 보정했습니다. 11월 2일 `be2279a`에서 화면 닉네임을 somani로 통일했습니다. 11월 5일에는 운영 구조 개선 커밋과 하치와레·블루 테마 개선 커밋 `766268f`가 이어졌다.

### 7.1 `Everything up-to-date`인데 개선 내용이 보이지 않았다

**문제 상황.** 개선 커밋 `d5e37ca`를 만들었다고 생각한 뒤 다른 터미널에서 `git push origin main`을 실행했지만 `Everything up-to-date`가 출력됐습니다. 공개 저장소에는 기존 `be2279a`까지만 보이는 상태였습니다.

**원인 분석.** `git push`는 컴퓨터 전체에서 최근에 만든 커밋을 찾지 않습니다. 현재 디렉터리의 현재 브랜치가 가리키는 커밋만 원격과 비교합니다. 당시 push를 실행한 저장소의 `main`과 `origin/main`은 모두 `be2279a`를 가리켰기 때문에 Git의 응답 자체는 정확했습니다. 개선 커밋은 다른 로컬 작업 공간에 있었습니다.

다음 명령으로 저장소와 브랜치를 먼저 구분했습니다.

```bash
pwd
git remote -v
git status -sb
git log -5 --oneline --decorate
git branch -avv
git cat-file -t d5e37ca
git reflog --all --date=iso
```

`git cat-file -t`가 `commit`을 출력해 객체가 남아 있음을 확인했고, reflog에는 `be2279a`를 부모로 하는 `d5e37ca`가 기록돼 있었습니다.

**해결 방법.** 운영 저장소에서 원격을 fetch한 후 개선 커밋을 fast-forward로 연결하고, 다시 로컬 `main`과 `origin/main`을 비교했습니다. force push는 사용하지 않았습니다.

**결과.** 개선 파일을 다시 만들지 않고 기존 커밋의 트리를 보존했습니다. 이후 이메일 문제를 해결하며 커밋 ID는 `61c04ce`로 바뀌었지만 파일 내용은 `d5e37ca`와 동일하다.

**배운 점.** push 전에는 `pwd`, `git status -sb`, `git log --decorate`, `git remote -v`를 한 묶음으로 확인해야 합니다. 같은 저장소 이름의 폴더가 여러 개면 터미널의 위치가 특히 중요합니다.

### 7.2 GitHub CLI 인증과 Git 전송 설정

**문제 상황.** 브라우저에서 GitHub에 로그인한 것과 터미널에서 HTTPS push 권한이 준비된 것은 별개였습니다. 인증을 마친 뒤에도 Git이 GitHub CLI 자격 증명을 사용하도록 연결할 필요가 있었습니다.

**원인 분석.** `gh`의 로그인 상태와 Git의 credential helper 설정은 역할이 다르다. 저장소 remote는 `https://github.com/somini26/somini26.github.io.git`이므로 HTTPS 인증 경로를 확인해야 했습니다.

**해결 방법.** 다음 명령으로 계정과 프로토콜을 확인하고 Git 연동을 설정했습니다.

```bash
gh auth status
gh auth setup-git
git remote -v
```

**결과.** `somini26` 계정으로 로그인되어 있고 Git 작업이 HTTPS 프로토콜을 사용하도록 구성된 것을 확인했습니다. 인증 토큰 자체는 로그나 문서에 남기지 않았습니다.

**배운 점.** 인증 오류가 나면 커밋을 다시 만들기 전에 계정, remote URL, 전송 프로토콜을 각각 확인하는 편이 빠르다.

### 7.3 GH007 이메일 공개 방지 오류

**문제 상황.** 개선 커밋을 push하는 과정에서 GitHub의 이메일 공개 방지 정책 때문에 GH007 오류가 발생했습니다.

**원인 분석.** Git 객체에 남은 증거가 명확했습니다. `d5e37ca`의 author와 committer 이메일은 개인 이메일이었고, GitHub 계정은 이를 노출하는 push를 차단하도록 설정돼 있었습니다.

```bash
git show --no-patch --format=fuller d5e37ca
git config user.email "266410610+somini26@users.noreply.github.com"
git commit --amend --no-edit --reset-author
```

**해결 방법.** 저장소의 Git 이메일을 GitHub noreply 주소로 바꾸고 아직 원격에 올라가지 않은 커밋만 amend했습니다. 이 과정에서 `d5e37ca`는 `61c04ce`가 됐습니다.

**결과.** 두 커밋의 tree ID는 모두 `22e7b81b...`로 같아 파일 내용은 바뀌지 않았고, 커밋 작성자 이메일만 noreply 주소로 정리됐습니다. 원격 기록을 덮을 필요가 없었으므로 force push도 하지 않았습니다.

**배운 점.** 커밋 ID에는 파일뿐 아니라 작성자 정보도 포함됩니다. 내용이 같아도 이메일을 amend하면 ID가 달라지며, push 전에 `git log --format='%h %ae %s'`로 확인할 수 있습니다.

### 7.4 Node.js 버전과 Actions 버전 경고

**문제 상황.** Actions 실행에서 Node.js 런타임 deprecation 경고가 보였습니다. 워크플로의 `node-version`은 이미 `24`였지만, `uses:`로 불러오는 action 자체의 내부 런타임은 별도로 관리됩니다.

**원인 분석.** 초기 `0d15e90`의 워크플로는 `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/configure-pages@v5`, `actions/deploy-pages@v4`를 사용했습니다. 애플리케이션에 지정한 Node.js 버전만 올려서는 오래된 action 런타임 경고가 사라진다고 볼 수 없었습니다.

**해결 방법.** 각 action의 호환되는 주요 버전을 확인해 운영 개선 커밋에서 checkout·setup-node를 v7, upload-pages-artifact를 v5, configure-pages를 v6, deploy-pages를 v5로 갱신했습니다. `npm ci → build → test → upload → deploy` 순서와 권한 분리는 유지했습니다.

**결과.** 워크플로 구조를 바꾸지 않고 action 구현의 런타임을 갱신했습니다. Node.js 24에서 잠금 파일 설치와 Eleventy 빌드가 통과하는지도 다시 확인했습니다.

**배운 점.** `node-version`은 프로젝트 실행 환경이고, `actions/*@버전`의 내부 런타임은 다른 문제다. 경고를 볼 때 어느 단계가 출력했는지 먼저 구분해야 합니다.

### 7.5 로컬 빌드 성공은 배포 성공과 같지 않다

**문제 상황.** 로컬에서 `npm run build`와 테스트가 성공해도 공개 사이트가 바로 바뀌지 않았습니다.

**원인 분석.** 로컬 성공은 현재 작업 폴더의 소스가 `_site/`로 생성된다는 뜻입니다. 실제 공개까지는 올바른 커밋을 push하고, 원격 Actions가 같은 커밋을 checkout해 build job과 deploy job을 모두 마쳐야 합니다. 다른 저장소에서 push하거나 인증이 막히면 이 연결이 끊긴다.

**해결 방법.** 아래 네 지점을 따로 확인했습니다.

```bash
git rev-parse HEAD
git rev-parse origin/main
gh run list --workflow pages.yml --limit 5
gh run view --log-failed
```

마지막에는 Pages 주소에서 변경된 제목과 자산이 실제로 응답하는지도 확인합니다. 브라우저 캐시 때문에 오래된 화면이 보일 수 있어 새로고침만으로 판단하지 않고 배포 run과 응답을 함께 본다.

**결과.** `766268f`까지 원격 `main`과 Pages 배포가 이어졌고, 로컬 검증과 원격 배포를 서로 다른 단계로 점검하는 절차가 생겼다.

**배운 점.** “빌드 성공”, “push 성공”, “Actions 성공”, “Pages 반영”은 네 개의 별도 상태다. 어느 단계까지 완료됐는지 구분하면 원인을 훨씬 빨리 좁힐 수 있습니다.

## 8. 완성된 기능과 검증 방법

현재 블로그에는 다음 기능이 실제 코드와 테스트로 연결돼 있습니다.

- 여섯 카테고리 페이지와 글이 없는 카테고리의 안내
- 데스크톱·모바일 반응형 레이아웃과 모바일 메뉴
- 저장 후 새로고침해도 유지되는 다크·라이트 테마
- 제목·설명·본문·태그·카테고리 검색과 URL 상태 복원
- Markdown 표·이미지·코드 하이라이트와 코드 복사
- 제목에서 자동 생성되는 목차와 읽기 진행 표시
- `draft: true` 글의 상세 페이지·검색·RSS·Sitemap 제외
- RSS, Sitemap, canonical URL과 Open Graph 메타데이터
- GitHub Actions의 자동 빌드·검사·Pages 배포

배포 전 검증은 생성 결과와 실제 브라우저를 나눠 실행합니다.

```bash
npm ci
npm run build
npm test
npm run test:content
npm run test:browser
```

`npm test`는 생성된 HTML의 내부 링크, 중복 ID, 이미지 대체 텍스트, 여섯 카테고리, 검색 인덱스, Sitemap과 필수 자산을 확인합니다. `test:content`는 임시 Markdown 글을 만들어 자동 반영, 다중 카테고리, 태그, RSS와 Sitemap 반영, 초안 제외, 오래된 출력 삭제, 잘못된 카테고리 거부를 검사한 뒤 임시 파일을 정리합니다.

Playwright는 Chromium에서 데스크톱과 모바일 두 구성을 실행합니다. 메뉴, 검색과 태그, 테마 유지, 목차, 코드 복사, 가로 오버플로와 콘솔 오류를 확인하고 axe-core로 WCAG 2 A·AA 범위의 자동 접근성 검사도 진행합니다. 자동 검사만으로 접근성이 완성되는 것은 아니므로 키보드 이동과 텍스트 가독성은 화면을 직접 보며 함께 점검합니다.

## 9. 정적 아카이브를 운영하며 배운 점

정적 사이트 생성은 단순히 Markdown을 HTML로 바꾸는 기능이 아니었습니다. 콘텐츠, 공통 레이아웃, 데이터, 생성 규칙을 분리하고 빌드 시점에 합치는 방식이었습니다. 이 구조를 이해하니 카테고리 목록이나 RSS를 글마다 수동으로 수정하지 않아도 되는 이유가 명확해졌다.

GitHub Actions 자동화의 장점도 배포 버튼을 없애는 데만 있지 않았습니다. 누구의 컴퓨터에서 작업했는지와 관계없이 잠금 파일대로 설치하고 같은 검사를 통과한 결과만 배포합니다. 반대로 로컬 저장소 위치, 커밋 이메일, 원격 브랜치처럼 자동화 바깥의 Git 상태가 잘못되면 파이프라인이 시작조차 하지 않는다는 점도 배웠습니다.

Markdown은 코드와 함께 diff를 확인하기 쉽고 특정 서비스에서 내보내기 작업을 할 필요가 없습니다. 대신 front matter의 정확성, 이미지 경로, 한 번 공개한 URL을 안정적으로 관리해야 합니다. 이 프로젝트에서는 빌드 전 메타데이터 검사와 draft 정책, 내부 링크 테스트로 그 실수를 줄였습니다.

앞으로는 시스템 해킹과 리버싱 학습 노트, 공개 가능한 CTF/Wargame 풀이, 개발 프로젝트 기록을 실제 진행 순서에 맞춰 추가할 계획입니다. 기능을 무작정 늘리기보다 글을 꾸준히 작성할 수 있는 흐름, 코드 블록과 긴 기술 문서의 가독성, 기존 URL과 모바일 탐색이 안정적으로 유지되는지를 먼저 확인하려 합니다.

읽어주셔서 감사합니다. (꾸벅)
