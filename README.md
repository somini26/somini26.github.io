# somini26.github.io

somani's archive | System Hacking · Reversing · Development

**somani**가 시스템 해킹과 리버스 엔지니어링을 중심으로 CTF와 개발 학습 과정을 기록하는 개인 기술 블로그입니다. Knights Frontier 3기 첫 번째 미션의 목적에 맞춰, 계속 글을 추가하고 관리할 수 있는 Markdown 기반 아카이브로 구성했습니다.

- 블로그 주소: **https://somini26.github.io**
- GitHub 프로필: https://github.com/somini26
- 기본 브랜치: `main`

## 사용 기술과 선택 이유

- **Eleventy 3**: Markdown을 HTML 파일로 변환하는 정적 사이트 생성기
- **Nunjucks**: 헤더, 푸터, 글 카드, 본문 레이아웃 재사용
- **Markdown-it / Prism**: Markdown 표, 자동 목차용 제목 ID, 코드 문법 강조
- **순수 CSS / JavaScript**: 반응형 디자인, 검색, 코드 복사, 테마 선택
- **GitHub Actions → GitHub Pages**: `_site/`를 빌드하고 배포
- **Playwright / axe-core**: 데스크톱·모바일 기능 및 자동 접근성 검사

Jekyll도 GitHub Pages에 적합하지만, 구현 환경에 Ruby가 없고 Node.js가 준비되어 있어 로컬 빌드를 직접 검증할 수 있는 Eleventy를 선택했습니다. 방문자에게는 정적 HTML/CSS와 작은 JavaScript 파일만 제공되며, 서버나 데이터베이스가 필요하지 않습니다. Jekyll 배포 설정과 혼용하지 않습니다.

## 로컬에서 실행하기

1. [Node.js](https://nodejs.org/) **24 LTS**와 Git을 설치합니다.
2. 터미널에서 아래 명령을 실행합니다.

```bash
git clone https://github.com/somini26/somini26.github.io.git
cd somini26.github.io
npm ci
npm run dev
```

터미널에 표시되는 주소(기본 `http://localhost:8080`)를 브라우저에서 엽니다. 파일을 수정하면 자동으로 다시 생성됩니다.

배포 파일과 내부 링크를 확인하려면:

```bash
npm run build
npm test
```

글 작성 시스템(자동 반영, 초안 제외, 카테고리 검증)도 검사하려면 `npm run test:content`를 실행하세요. 임시 검증 글은 검사 후 자동 삭제됩니다.

브라우저 기능 검사까지 실행하려면 최초 한 번 Chromium을 설치합니다. Linux에서 시스템 라이브러리가 부족하면 `npx playwright install --with-deps chromium`을 사용할 수 있습니다.

```bash
npx playwright install chromium
npm run test:browser
```

빌드 결과는 `_site/`에 생성됩니다. 이 폴더와 `node_modules/`는 Git에 올리지 않습니다.

## 새 글 작성하기

1. `src/posts/`에 `2026-11-01-my-learning-note.md`처럼 **날짜-영문이름.md** 파일을 만듭니다.
2. 아래 메타데이터를 파일 맨 위에 넣고, `---` 아래에 본문을 작성합니다.

```yaml
---
title: "첫 번째 기록"
date: 2026-11-01
categories: ["블로그/기술문서"]
tags: ["GitHub", "Blog"]
description: "이 글에서 다루는 내용을 간단히 소개합니다."
---
```

- `title`, `date`, `categories`, `tags`, `description`은 필수입니다. 잘못된 카테고리나 누락된 필드는 빌드에서 알려줍니다.
- `categories`와 `tags`는 배열이며 여러 값을 넣을 수 있습니다. 태그가 없으면 `tags: []`로 작성합니다.
- 글 목록은 날짜 내림차순으로 자동 생성됩니다. 같은 날짜는 URL 순서로 정렬됩니다.
- 예시 파일의 주소는 `/posts/my-learning-note/`입니다. 게시 후 파일 이름을 바꾸면 URL도 바뀌므로 주의하세요.
- 임시 글은 메타데이터에 `draft: true`를 추가합니다. 상세 페이지, 목록, 검색, RSS, Sitemap에 공개되지 않습니다. 발행하려면 해당 줄을 지웁니다.
- 미래 날짜도 발행됩니다. 예약 발행 기능은 없으므로 미완성 글에는 `draft: true`를 사용하세요.
- 새 글은 홈, 아카이브, 카테고리, 태그, 검색, RSS, Sitemap에 자동 반영됩니다.
- `## 소제목`, `### 하위 제목`으로 목차가 자동 생성됩니다.
- Markdown 본문은 템플릿 코드를 실행하지 않으며 원시 HTML은 허용하지 않습니다.

코드 블록의 시작에 언어를 지정하면 문법 강조와 복사 버튼이 표시됩니다. Python, Java, Bash, YAML, JSON, HTML, CSS, JavaScript, C를 지원하며, 다른 언어도 일반 코드로 표시됩니다.

````markdown
```python
print("Hello, somani")
```
````

반복해서 사용할 수 있는 비공개 초안 템플릿도 `src/posts/draft-*.md`에 준비되어 있습니다.

- CTF/Wargame Write-up
- 개발 프로젝트 기록
- 시스템 해킹 및 리버싱 학습 노트
- 논문/컨퍼런스 정리
- 공모전/자격증 활동 기록

템플릿에는 모두 `draft: true`가 지정되어 있어 상세 페이지, 목록, 검색, RSS, Sitemap에 공개되지 않습니다. 복사해서 사용할 때도 작성이 끝나기 전에는 해당 값을 유지하세요.

## 카테고리 설정

필수 카테고리의 표시 이름과 URL은 `src/_data/topics.json`에서 관리합니다.

| 표시 이름       | 안전한 URL                                 |
| --------------- | ------------------------------------------ |
| 개발            | `/categories/development/`                 |
| CTF/Wargame     | `/categories/ctf-wargame/`                 |
| Bug Bounty      | `/categories/bug-bounty/`                  |
| 블로그/기술문서 | `/categories/blog-docs/`                   |
| 논문/컨퍼런스   | `/categories/papers-conferences/`          |
| 공모전/자격증   | `/categories/competitions-certifications/` |

글에는 **표시 이름을 정확하게** 입력하세요. `/`가 있는 카테고리도 URL용 `slug`와 분리되어 있어 안전합니다. 게시글이 없어도 카테고리와 빈 상태 안내가 표시됩니다. 카테고리 정보를 수정할 때는 필수 6개 이름을 유지하고, `slug`는 서로 다른 영문 소문자와 하이픈으로 작성하세요.

## 이미지와 링크 추가

이미지를 `src/assets/images/`에 저장합니다. 영문 파일 이름을 권장하며, 용량을 줄인 WebP·PNG·SVG 등을 사용하세요.

```markdown
![이미지 내용을 설명하는 대체 텍스트](/assets/images/example.webp)

[GitHub 프로필](https://github.com/somini26)
```

이미지에는 대체 텍스트를 넣고, 소유권이 있거나 사용 허가가 있는 자산만 사용하세요. 포함된 도식과 파비콘은 이 프로젝트를 위해 작성했습니다. `social.png`는 링크 공유용 이미지입니다.

## 프로필 수정

About 페이지의 이름, 소속, 연락처, 관심 분야는 `src/_data/profile.json`에서 수정합니다. 프로필 이미지를 넣으려면 파일을 `src/assets/images/`에 추가한 뒤 `image`에 `/assets/images/profile.webp`처럼 경로를 지정하고, `imageAlt`에 이미지 설명을 적으세요. `image`를 비워 두면 기본 `s.` 표시가 유지됩니다.

## 검색과 테마

검색은 제목·설명·본문·태그·카테고리를 대상으로 대소문자를 구분하지 않고 찾습니다. 카테고리와 태그를 함께 필터링할 수 있습니다. 검색 조건은 URL에 저장되어 공유하거나 새로고침해도 유지됩니다. 검색 인덱스는 빌드할 때 생성되는 `search.json`입니다. 글이 많이 쌓이면 분할 인덱스나 검색 전용 도구 도입을 고려하세요.

기본 테마는 다크 모드입니다. 헤더의 테마 버튼으로 라이트 모드를 선택할 수 있고 선택은 해당 브라우저에 저장됩니다. 외부 폰트, 분석 도구, 추적 스크립트를 사용하지 않습니다. JavaScript 없이도 페이지 이동과 글 읽기, 카테고리 탐색이 가능합니다.

## GitHub Pages 배포

**배포 방식은 GitHub Actions 한 가지만 사용합니다.** `main`에 push하면 `.github/workflows/pages.yml`이 다음 순서로 실행됩니다.

1. `npm ci`로 잠긴 버전의 의존성 설치
2. `npm run build`로 `_site/` 생성
3. `npm test`로 내부 링크, 카테고리, 메타데이터, 산출물 검사
4. GitHub Pages 아티팩트 업로드 및 배포

Pull Request에서는 빌드와 검사만 실행하고 배포하지 않습니다. 브라우저 검사는 로컬에서 별도로 실행합니다.

저장소 관리자가 최초 한 번 해야 할 설정:

1. GitHub 저장소의 **Settings → Pages**에 들어갑니다.
2. **Build and deployment → Source → GitHub Actions**를 선택합니다. `Deploy from a branch`와 병행하지 않습니다.
3. **Actions**에서 워크플로 실행이 허용되어 있는지 확인합니다.
4. 로컬 변경을 커밋하고 `main`에 push합니다. 이미 push했다면 **Actions → Build and deploy somani archive → Run workflow → main**으로 실행할 수 있습니다.
5. 작업의 `build`, `deploy` 성공 여부와 배포 URL을 확인합니다.
6. `https://somini26.github.io` 및 `/archive/`, `/categories/blog-docs/`, `/posts/github-pages-blog/`를 직접 열어 확인합니다.

```bash
git add .
git commit -m "Build somani security archive"
git push origin main
```

Git 인증이 없으면 GitHub 계정으로 인증한 환경에서 실행하세요. Personal Access Token은 코드나 설정 파일에 넣지 않습니다. 워크플로는 GitHub가 제공하는 `GITHUB_TOKEN`을 사용합니다.

- 이 저장소는 사용자 사이트이므로 **base path는 `/`**이며 별도의 저장소 이름 경로를 붙이지 않습니다.
- 사이트 주소와 설명은 `src/_data/site.json`에서 수정합니다. 도메인을 바꿀 때 `src/robots.txt`의 Sitemap 주소도 수정하세요.
- 각 페이지는 `폴더/index.html`로 생성되므로 상세 주소 직접 접속과 새로고침이 가능합니다.
- `404.html`, `feed.xml`, `sitemap.xml`, `.nojekyll`도 함께 발행됩니다.
- 배포 실패 시 Actions 로그를 확인하세요. Pages Source, Actions 사용 허용, `github-pages` 환경의 브랜치 보호 규칙을 점검합니다.
- 로컬 빌드 성공은 원격 배포 성공을 의미하지 않습니다. 실제 발행 여부는 GitHub Actions와 대상 URL에서 확인합니다.

## 프로젝트 구조

```text
.github/workflows/pages.yml   # main 빌드·검사·배포
src/
  _data/
    site.json                # 사이트 정보
    topics.json              # 카테고리 이름과 slug
    profile.json             # About 프로필 정보
    projects.json            # 공개 프로젝트 카드 데이터
  _includes/                 # 공통 레이아웃
  assets/                    # CSS, JavaScript, 이미지, favicon
  posts/                     # Markdown 글과 글 공통 설정
  index.njk                  # 홈
  archive.njk                # 검색·태그·전체 목록
  categories.njk             # 카테고리 안내
  category.njk               # 카테고리별 정적 페이지
  about.njk                  # 소개
  404.njk                    # 오류 페이지
  search.njk                 # 검색 인덱스
  feed.njk                   # RSS
  sitemap.njk                # Sitemap
scripts/verify.mjs           # 빌드 결과 검사
scripts/verify-content.mjs   # 글 자동 반영·초안 제외 검사
tests/blog.spec.js          # 브라우저 기능·접근성 검사
eleventy.config.js          # Markdown·컬렉션·메타데이터 검증
package.json                # 실행 명령과 의존성
package-lock.json           # 재현 가능한 설치
```
