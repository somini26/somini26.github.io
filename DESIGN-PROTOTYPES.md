# somani's archive design prototypes

이 작업공간은 운영 중인 `main`과 분리한 로컬 브랜치
`prototype/editorial-desktop-v1`의 디자인 비교용 결과물이다. 두 시안은
현재 저장소의 카테고리, 게시글, 프로젝트, 프로필 데이터와
`profile-hachiware.jpg`만 사용한다.

## 로컬 미리보기

```bash
cd /home/somini/projects/somini-design-prototypes
npm ci
npm run dev
```

- 시안 A: <http://localhost:8080/prototypes/editorial-workspace/>
- 시안 A 게시글: <http://localhost:8080/prototypes/editorial-workspace/github-pages-blog/>
- 시안 B: <http://localhost:8080/prototypes/creative-desktop/>
- 시안 B 게시글: <http://localhost:8080/prototypes/creative-desktop/github-pages-blog/>

## A — Editorial Workspace

- 약 70%의 에디토리얼 영역과 30%의 작은 workspace
- 큰 serif 타이포그래피, 비대칭 여백, 설명을 함께 둔 6개 번호형 인덱스
- 하치와레 프로필 창 위에 최근 글·프로젝트 탭 창을 가볍게 겹친 구성
- 긴 글에서는 큰 에디토리얼 표지와 고정 목차를 사용

정보의 위계가 분명하고 카테고리 설명을 충분히 보여 줄 수 있어 글이 많이
쌓였을 때 확장하기 쉽다. 첫 화면 이후 인덱스로 스크롤해야 하므로 B보다
탐색 밀도는 낮다.

## B — Creative Desktop Archive

- 에디토리얼 인덱스와 desktop workspace를 거의 50:50으로 배치
- Profile, Latest, Project 버튼으로 실제 앞쪽 창을 선택
- 데스크톱에서는 창을 겹치고, 모바일에서는 같은 창을 읽기 순서대로 펼침
- 긴 글에는 document title bar와 경계가 있는 reading surface를 사용

한 화면에서 탐색과 활동 미리보기를 함께 볼 수 있고 상호작용이 더 강하다.
반면 공개 글과 프로젝트가 많아지면 workspace에 무엇을 보여 줄지 선별하는
규칙이 필요하다.

## 공통 인터랙션과 접근성

- 테마 버튼과 `localStorage` 기반 다크·라이트 선택 유지
- 6개 카테고리의 실제 URL 이동
- A의 ARIA tab과 방향키 전환
- B의 창 선택 버튼과 모바일 세로 전환
- 스크롤 reveal, 큰 제목 등장, 링크 밑줄, 미세한 포인터 배경 반응
- `prefers-reduced-motion`에서 애니메이션 제거
- 게시글 목차, 읽기 진행 표시, 코드 복사, 키보드 접근 가능한 표 스크롤
- 모든 중요한 정보는 hover 없이도 표시

## 캡처

`design-previews/`에 각 시안의 데스크톱 다크·라이트, 모바일
다크·라이트, 인터랙션 상태와 게시글 전체·첫 화면 캡처가 있다.

파일명은 다음 규칙을 사용한다.

```text
prototype-{a|b}-{desktop|mobile}-{dark|light|interaction}.png
prototype-{a|b}-article-{desktop|mobile}.png
prototype-{a|b}-article-{desktop|mobile}-top.png
```

## 검증

```bash
npm run build
npm test
npm run test:content
LD_LIBRARY_PATH=/tmp/somani-playwright-libs/root/usr/lib/x86_64-linux-gnu npm run test:browser
```

Playwright 검사는 1440×1000 데스크톱과 390×844 모바일에서 실제 Chromium을
사용한다. 카테고리·프로필 이미지·테마 저장·탭과 창 전환·게시글 목차·코드
복사·가로 오버플로·콘솔 오류와 axe-core 접근성을 함께 확인한다.

이 브랜치의 프로토타입 URL에는 `noindex`가 적용돼 있으며, 현재 단계에서는
원격 push와 GitHub Pages 배포를 하지 않는다.
