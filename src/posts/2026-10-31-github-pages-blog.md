---
title: "GitHub Pages 블로그 구축 기록"
date: 2026-10-31
categories: ["블로그/기술문서"]
tags: ["GitHub", "Eleventy", "GitHub Actions", "Markdown"]
description: "Eleventy로 개인 기술 블로그를 구성하고 GitHub Actions로 GitHub Pages에 자동 배포한 과정을 정리했습니다."
---
보안과 개발 공부를 꾸준히 남길 공간이 필요했다. 글 한 편을 올릴 때마다 화면을 직접 수정하기보다 Markdown 파일 하나만 추가하면 목록, 카테고리, 검색, RSS까지 함께 갱신되는 구조를 목표로 블로그를 구성했다.

![Markdown 콘텐츠를 Eleventy가 HTML로 생성하고 GitHub Pages에서 발행하는 흐름](/assets/images/archive-flow.svg)

## GitHub Pages를 선택한 이유

학습 기록은 별도의 서버나 데이터베이스가 없어도 제공할 수 있는 정적 콘텐츠다. GitHub Pages를 사용하면 블로그 코드와 글의 변경 이력을 같은 저장소에서 관리하고, `main` 브랜치에 반영한 결과를 자동으로 배포할 수 있다.

이 블로그는 GitHub 사용자 사이트 저장소인 `somini26/somini26.github.io`를 사용한다. 따라서 배포 주소의 기준 경로는 저장소 이름이 붙은 하위 경로가 아니라 `/`이며, 기존 URL을 유지한 채 정적 파일을 제공한다.

## Eleventy를 사용한 이유

프로젝트를 시작한 환경에는 Node.js가 준비되어 있었다. 같은 생태계에서 Markdown 변환과 로컬 검증, 자동 테스트를 함께 구성할 수 있도록 Eleventy 3을 선택했다.

Eleventy는 콘텐츠를 정적 HTML로 생성하고, Nunjucks를 이용해 헤더·푸터·게시글 카드 같은 공통 화면을 재사용한다. 브라우저에는 생성된 HTML과 순수 CSS, 필요한 만큼의 JavaScript만 전달하므로 별도의 프론트엔드 프레임워크를 추가하지 않았다.

## 블로그 프로젝트 구조

콘텐츠와 화면, 검증 코드를 다음과 같이 나눴다.

| 경로 | 역할 |
| --- | --- |
| `src/posts/` | Markdown 게시글과 비공개 초안 |
| `src/_includes/` | Nunjucks 공통 레이아웃과 게시글 카드 |
| `src/_data/` | 사이트, 프로필, 카테고리, 프로젝트 데이터 |
| `src/assets/` | CSS, JavaScript, 이미지와 파비콘 |
| `scripts/` | 빌드 결과와 콘텐츠 정책 검증 |
| `tests/` | Playwright 브라우저·접근성 검사 |
| `_site/` | Eleventy가 생성하는 배포 결과물 |

빌드 전에 `_site/`를 비우도록 해 삭제된 글이 결과물에 남지 않게 했고, 생성 폴더와 `node_modules/`는 Git으로 추적하지 않는다.

## GitHub Actions 자동 배포

`.github/workflows/pages.yml`은 `main`에 push되면 다음 순서로 동작한다.

1. Node.js 24 환경을 준비한다.
2. `npm ci`로 잠금 파일과 일치하는 의존성을 설치한다.
3. `npm run build`로 `_site/`를 생성한다.
4. `npm test`로 내부 링크와 필수 산출물을 검사한다.
5. 검사를 통과한 `_site/`만 GitHub Pages 아티팩트로 업로드하고 배포한다.

Pull Request에서는 빌드와 검사까지만 수행하고 배포 단계는 실행하지 않는다. Pages 배포 권한도 배포 job에만 부여해 작업 범위를 구분했다.

## 6개 카테고리 구성

Knights Frontier 미션에서 요구한 여섯 주제를 `src/_data/topics.json`에서 관리한다.

- 개발
- CTF/Wargame
- Bug Bounty
- 블로그/기술문서
- 논문/컨퍼런스
- 공모전/자격증

표시 이름과 URL용 영문 slug를 분리했기 때문에 `/`가 포함된 카테고리 이름도 안전한 주소를 사용한다. 각 카테고리는 글 개수를 보여 주며, 아직 글이 없는 경우에도 페이지와 빈 상태 안내가 유지된다.

## Markdown으로 게시글 작성

`src/posts/`에 Markdown 파일을 만들고 다음 메타데이터를 작성한다.

```yaml
---
title: "새로운 학습 기록"
date: 2026-10-31
categories: ["개발"]
tags: ["Python", "Study"]
description: "이 글에서 다룰 내용을 한두 문장으로 정리합니다."
---
```

`title`, `date`, `categories`, `tags`, `description`은 빌드 전에 검증된다. 작성 중인 글에는 `draft: true`를 추가한다. 초안은 상세 페이지뿐 아니라 홈, 아카이브, 검색 인덱스, RSS, Sitemap에서도 제외된다.

게시글을 공개하면 날짜 내림차순으로 정렬되어 홈과 아카이브에 자동으로 나타난다. 카테고리와 태그 링크도 메타데이터에서 생성되므로 글마다 목록 화면을 별도로 수정할 필요가 없다.

## 구현한 주요 기능

운영하면서 글을 찾고 읽는 흐름에 필요한 기능을 우선 구현했다.

- 제목·설명·본문·태그·카테고리를 대상으로 하는 검색
- 카테고리별 정적 페이지와 태그 필터
- 다크·라이트 테마 선택과 브라우저 저장
- 모바일 메뉴와 반응형 카드 레이아웃
- 본문 목차, 읽기 진행 표시, 코드 문법 강조와 복사 버튼
- 표의 가로 스크롤과 이미지 대체 텍스트 정책
- RSS, Sitemap, canonical URL, Open Graph 메타데이터
- JavaScript가 없어도 가능한 기본 탐색과 글 읽기

원시 HTML은 Markdown에서 실행하지 않도록 막고, 템플릿 자동 이스케이프를 켜 콘텐츠가 그대로 스크립트로 해석되지 않게 했다.

## 검증 방법

배포 전에는 같은 의존성으로 다시 설치한 뒤 정적 결과와 브라우저 동작을 나누어 확인한다.

```bash
npm ci
npm run build
npm test
npm run test:content
npm run test:browser
```

`npm test`는 내부 링크, 중복 ID, 이미지 대체 텍스트, 6개 카테고리, 검색 인덱스, Sitemap과 주요 자산을 확인한다. `test:content`는 임시 글을 생성해 자동 반영, 다중 카테고리, 초안 제외, 잘못된 카테고리 거부를 검증한 뒤 파일을 삭제한다.

Playwright 검사는 데스크톱과 모바일에서 메뉴, 검색, 태그, 테마 유지, 코드 복사, 오버플로, 콘솔 오류와 접근성을 확인하고 주요 화면을 캡처한다.

## 향후 운영 계획

앞으로 CTF/Wargame 풀이 과정, 시스템 해킹과 리버싱 학습 노트, 개발 프로젝트 기록을 중심으로 글을 쌓을 계획이다. 논문이나 컨퍼런스를 정리할 때는 원문과 개인적인 해석을 구분하고, 공개할 수 없는 문제나 확인되지 않은 성과는 게시하지 않는다.

프로젝트 목록은 데이터 파일로 분리해 실제 공개할 작업이 생겼을 때만 추가할 수 있게 했다. 기능을 늘리기 전에는 Markdown으로 기록하는 흐름과 기존 URL, 모바일 읽기 경험이 안정적으로 유지되는지를 먼저 확인할 것이다.
