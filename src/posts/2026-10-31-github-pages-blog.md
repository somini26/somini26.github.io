---
title: "GitHub Pages 블로그 구축 기록"
date: 2026-10-31
categories: ["블로그/기술문서"]
tags: ["GitHub", "Blog", "Eleventy"]
description: "Markdown 글 작성부터 GitHub Pages 배포까지, 블로그 구조와 운영 방법을 정리했습니다."
---
> **수정 가능한 예시 글입니다.** 블로그 구조와 글 작성 방법을 안내합니다.

글은 Markdown 파일로 작성하고 Eleventy로 HTML 페이지를 만듭니다. 생성된 파일은 GitHub Pages에서 제공합니다.

## 정적 사이트의 구조

![Markdown 콘텐츠를 Eleventy가 HTML로 생성하고 GitHub Pages에서 발행하는 흐름](/assets/images/archive-flow.svg)

본문은 `src/posts/`에, 공통 레이아웃은 `src/_includes/`에 있습니다. 카테고리 이름과 URL용 slug는 `src/_data/topics.json`에서 관리합니다.

| 파일 또는 폴더 | 역할 |
| --- | --- |
| `src/posts/` | Markdown 게시글 |
| `src/_includes/` | 공통 레이아웃과 글 템플릿 |
| `src/assets/` | CSS, JavaScript, 이미지 |
| `_site/` | 빌드로 생성되는 배포 파일 |

## 새 글 작성하기

`src/posts/`에 영문 파일 이름으로 Markdown 파일을 추가하고, 맨 위에 메타데이터를 작성합니다.

```yaml
---
title: "새로운 학습 기록"
date: 2026-10-31
categories: ["개발"]
tags: ["Python", "Study"]
description: "이 글에서 다룰 내용을 한두 문장으로 정리합니다."
---
```

메타데이터 아래에 소제목과 본문을 작성합니다. 초안은 메타데이터에 `draft: true`를 추가하면 페이지와 검색에 발행되지 않습니다.

### 코드와 이미지

코드 블록에는 언어를 지정할 수 있습니다. 아래 코드는 출력 형식을 보여주는 짧은 예시입니다.

```python
from pathlib import Path

posts = sorted(Path("src/posts").glob("*.md"))
for post in posts:
    print(post.name)
```

이미지는 `src/assets/images/`에 추가한 뒤 Markdown 이미지 문법으로 삽입합니다. 이미지의 내용을 설명하는 대체 텍스트를 함께 작성합니다.

## 로컬 확인과 발행

Node.js 24 환경에서 다음 명령으로 로컬 사이트를 실행합니다.

```bash
npm ci
npm run dev
```

발행 전에는 정적 파일 생성과 내부 링크 검사를 실행합니다.

```bash
npm run build
npm test
```

`main` 브랜치에 변경 사항을 올리면 GitHub Actions가 빌드, 검사, 배포를 실행합니다. Pages의 Source는 **GitHub Actions**로 설정합니다. 실행 결과는 저장소의 **Actions** 탭에서 확인할 수 있습니다.

## 참고 문서

- [Eleventy 공식 문서](https://www.11ty.dev/docs/)
- [GitHub Pages 사용자 지정 워크플로 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
