---
title: 보안 세미나 12개 통합 정리 | 암호학에서 SecOps까지
date: '2026-11-06'
categories:
  - 논문/컨퍼런스
tags:
  - Security Seminar
  - Cryptography
  - PQC
  - SecOps
  - PHY Security
description: >-
  티스토리에 기록한 12개 보안 세미나의 실제 강의명과 학습 내용을 암호학, 자동차 보안, SecOps, AI와 블록체인 흐름으로 묶어
  정리했습니다.
---
보안 세미나 글을 다시 읽어 보니 암호학에서 시작한 내용이 자동차·운영·AI 에이전트·블록체인까지 이어져 있었다. 개별 글을 그대로 옮기기보다, 티스토리에 공개한 12개 강의 기록에서 확인한 범위만 한 번에 찾을 수 있도록 묶었다. 발표자 정보는 원문에 기록되어 있지 않아 별도로 적지 않았다.

## 1~3강: 암호학과 양자내성암호

### 1강 — 깨지는 암호의 해부학

[티스토리 원문](https://vegetable-m.tistory.com/2)에서는 대칭키·공개키·해시가 TLS 안에서 맡는 역할부터 ECB, CBC, CTR, GCM 운영 모드를 정리했다. 특히 nonce 재사용, CBC 패딩 오라클, RSA PKCS#1 v1.5의 Bleichenbacher 공격처럼 안전한 알고리즘도 구현과 오류 응답에 따라 깨질 수 있다는 점을 살펴봤다.

### 2강 — 양자 시대의 공개키 암호

[티스토리 원문](https://vegetable-m.tistory.com/3)은 격자와 LWE, Ring-LWE·Module-LWE를 거쳐 ML-KEM의 기반을 따라간다. 다항식 곱셈을 빠르게 만드는 NTT, 난수와 압축이 성능 및 복호화 정확도에 주는 영향도 함께 정리했다.

### 3강 — PQC II

[티스토리 원문](https://vegetable-m.tistory.com/4)에서는 ML-KEM과 ML-DSA의 역할을 구분했다. KEM은 공유 비밀을 합의하고 전자서명은 신원을 검증한다. 인증서 체인, 캡슐화·역캡슐화, 서명 검증과 TLS 핸드셰이크에서 두 표준이 들어가는 위치를 연결해 봤다.

## 4~6강: 자동차 보안, 시큐어 코딩, 검증 제도

### 4강 — 자동차 보안 이해

[티스토리 원문](https://vegetable-m.tistory.com/5)에서는 Tesla Model 3, 전기차 충전기, Android Automotive, Kia 모바일 API와 스마트키 사례를 출발점으로 ECU·AUTOSAR·CAN·Central Gateway 구조를 공부했다. 차량 보안은 한 취약점만 보는 것이 아니라 긴 수명, 업데이트 경로, 도메인 간 통신을 함께 봐야 한다는 점이 남았다.

### 5강 — 시큐어코딩: 임베디드/자동차 코딩 표준

[티스토리 원문](https://vegetable-m.tistory.com/6)은 MISRA C/C++, AUTOSAR C++14, SEI CERT C와 ISO 26262·ISO/SAE 21434를 다룬다. 메모리를 직접 다루는 C/C++의 정의되지 않은 동작과 제한된 자원, 긴 제품 수명 때문에 코딩 규칙과 TARA, Shift Left가 왜 필요한지 정리했다.

### 6강 — 보안적합성 검사

[티스토리 원문](https://vegetable-m.tistory.com/7)에서는 보안적합성 검증, 보안기능 시험제도와 KCMVP의 관계를 살펴봤다. 구현이 기술적으로 맞는 것과 검증필 제품인 것은 다르며, 요구사항·구현·시험 결과를 추적 가능하게 연결해야 한다는 점이 핵심이었다.

## 7~8강: 물리계층 보안

### 7강 — PHY-Security 입문

[티스토리 원문](https://vegetable-m.tistory.com/8)에서는 변조, I/Q 신호, AWGN, 다중경로와 페이딩 같은 무선 통신의 기초부터 Bob과 Eve의 SNR, Wiretap Channel, Secrecy Capacity까지 이어 갔다. 상위 계층 암호와 달리 채널 특성의 차이를 이용해 도청 가능성을 낮추는 관점이 새로웠다.

### 8강 — PHY-Security 최적화 문제

[티스토리 원문](https://vegetable-m.tistory.com/13)에서는 제한된 전력을 신호와 인공잡음에 어떻게 배분할지 최적화 문제로 표현했다. 경사법, 라그랑지안, KKT 조건을 바탕으로 secrecy rate를 높이는 전력 배분을 살펴보고, 채널 추정 오차 같은 물리계층 보안의 한계도 확인했다.

## 9~10강: SecOps와 사고 대응

### 9강 — Why Ops?

[티스토리 원문](https://vegetable-m.tistory.com/9)에서는 SecOps를 사람·절차·기술이 연결된 운영 체계로 정리했다. SOC와 CSIRT, NIST CSF 2.0, MITRE ATT&CK, IOC와 TTP를 구분하고, 좋은 로그·시간 정규화·baseline·탐지 가설이 실제 판단에 어떤 역할을 하는지 살펴봤다.

### 10강 — SecOps

[티스토리 원문](https://vegetable-m.tistory.com/10)은 Defense in Depth와 SOC 운영 사이클을 이메일·ID, EDR·랜섬웨어, SOAR, CTEM으로 확장한다. 자동화의 목적은 모든 판단을 대신하는 것이 아니라 반복 작업을 줄이고 분석가가 중요한 판단에 집중하게 하는 데 있다는 점을 정리했다.

## 11~12강: 연결되는 서비스의 보안

### 11강 — MCP

[티스토리 원문](https://vegetable-m.tistory.com/11)에서는 챗봇과 달리 도구를 호출하고 외부 자원에 접근하는 AI Agent의 신뢰 경계를 살펴봤다. 프롬프트 인젝션뿐 아니라 과도한 권한, 도구 입력 검증, 비밀정보 노출과 실행 결과 검증을 함께 설계해야 한다.

### 12강 — 블록체인

[티스토리 원문](https://vegetable-m.tistory.com/12)은 지갑, 개인키와 복구 구문, 지갑 연결과 거래 승인의 차이를 정리한 뒤 스마트 컨트랙트 취약점과 Ronin Bridge 사례를 다룬다. Remix에서 컨트랙트와 ERC-20 토큰을 배포하는 흐름도 확인했다.

## 다시 묶어 보며

주제는 달랐지만 공통적으로 남은 질문은 "어디까지 신뢰할 수 있는가"였다. 암호 알고리즘과 nonce 관리, 차량 ECU와 업데이트 경로, SecOps의 로그 품질, AI Agent의 도구 권한, 스마트 컨트랙트의 승인 흐름은 모두 경계와 검증 조건을 정확히 정해야 했다.

앞으로 세미나를 정리할 때는 용어를 많이 옮기는 데서 끝내지 않고, 직접 확인할 수 있는 작은 실습과 아직 모르는 부분을 함께 남기려고 한다. 원문에 없는 발표자나 활동 결과는 덧붙이지 않았고, 세부 내용은 각 티스토리 기록에서 계속 확인할 수 있다.
