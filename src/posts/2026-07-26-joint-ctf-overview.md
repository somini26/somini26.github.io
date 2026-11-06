---
title: K.knock × D-Alpha × CAUtion 연합 CTF | 내가 푼 9문제
date: 2026-07-26T00:00:00.000Z
categories:
  - CTF/Wargame
tags:
  - HSPACE
  - 연합CTF
  - 대회후기
description: 경기대·국민대·중앙대 보안 동아리 연합 CTF에서 풀이한 아홉 문제 전체 정리.
---
2026년 7월 26일, 경기대 **K.knock**, 국민대 **D-Alpha**, 중앙대 **CAUtion** 연합 CTF에 참가했다! HSPACE 플랫폼에서 진행된 대회였다.

라이트업을 모아 보니 Reversing, Web, Pwnable, Crypto, AI까지 여러 분야를 넘나들었다. 이번 글에는 실제로 플래그가 확인된 **아홉 문제**를 한눈에 정리하고, 각 문제의 상세 분석은 별도 글로 남겼다.

## 문제별 기록

| 문제 | 분야 | 분석 포인트 |
|---|---|---|
| [Hollow Notes](/posts/hollow-notes/) | Reversing | Process Hollowing으로 실행되는 숨겨진 PE와 라이선스 검증 복원 |
| [Déjà Vu](/posts/deja-vu/) | Crypto | AES-GCM nonce 재사용을 이용한 알려진 평문 기반 로그 복원 |
| [Flower](/posts/flower/) | Reversing | 블록 단위 입력 검증 함수를 역분석한 문자열 복원 |
| [Notekeeper](/posts/notekeeper/) | Pwnable | Rust raw pointer 수명 관리 오류로 발생한 UAF와 ROP |
| [Stellar Salvage](/posts/stellar-salvage/) | Web/Crypto | 내부 API SSRF와 LCG 상태 역산을 이용한 좌표 복원 |
| [지그재그](/posts/zigzag/) | Crypto | RSA 소수의 교차 비트 유출로 p와 q 복원 |
| [답지유출](/posts/answer-leak/) | Web | Next.js middleware 우회를 통한 권한 검사 회피 |
| [환불해드립니다](/posts/refund-service/) | AI/Web | LLM 출력과 샌드박스 결과를 eval()하는 신뢰 경계 오류 |
| [APeows](/posts/apeows/) | AI/Pwnable | 스택 메모리 노출 및 AI 필터 토큰 구간 정렬 |

## 분야별로 달랐던 접근

리버싱 문제에서는 **실행 파일 내부의 검증 구조**를 파악하는 것이 중요했다. `Hollow Notes`는 겉에 보이는 미끼 데이터를 넘어 숨겨진 PE를 찾아야 했고, `Flower`는 블록 단위 검사 루틴을 풀어야 했다.

암호 문제에서는 **수학적 전제와 구현 조건**이 핵심이었다. `Déjà Vu`는 nonce 재사용, `지그재그`는 소수의 일부 비트 유출이 출발점이었다.

웹·시스템 문제에서는 단일 취약점만 보지 않고 여러 기능의 경계를 연결했다. `Notekeeper`의 UAF, `Stellar Salvage`의 SSRF와 난수 복원, `답지유출`의 미들웨어 검사 우회가 그 예다.

AI 관련 문제에서도 단순히 프롬프트 한 줄만 바꾸는 풀이가 아니었다. `환불해드립니다`는 코드 실행의 신뢰 경계를 분석했고, `APeows`는 메모리 유출과 토큰 수 정렬까지 함께 다뤘다.

## 마무리

웹, 리버싱, 포너블, 암호학, AI가 각각 따로 떨어진 분야는 아니라는 걸 다시 느꼈다. 한 문제에서 익힌 분석 습관이 다른 분야에서도 도움이 될 수 있었다.

다음에는 플래그뿐 아니라 **처음 발견한 단서, 실패했던 방법, 마지막에 검증한 내용**까지 남겨두고 싶다.

> 상세 라이트업은 대회 당시 자료를 근거로 정리했다. 대회 운영 중 사용된 서버 주소는 재접속 대상이 아니다.
