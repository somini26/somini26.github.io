---
title: "PAC 보호기법"
date: 2026-08-16
categories: ["블로그/기술문서"]
tags: ["ARM", "PAC", "System Security"]
description: "PAC(Pointer Authentication Code)는 ARM의 Pointer Authentication(포인터 인증) 기술에서 포인터의 무결성을 확인하기 위해 사용하는 인증 코드이다."
---
안녕하세요. ㅎㅎ 오늘은 ARM 아키텍처에서 사용되는 보안 기술 중 하나인 **PAC(Pointer Authentication Code)**&#8203;에 대해서

알아볼게요.  PAC가 어떤 기술인지, 왜 필요한지부터 실제로 포인터를 어떻게 보호하는지까지 차근차근 알아보았어요.ㅎㅎ

나름대로 정리해보았답니다.

---

## ARM의 PAC(Pointer Authentication Code) 보호기법

### 1. PAC란?

PAC(Pointer Authentication Code)는 ARM의 **Pointer Authentication(포인터 인증)** 기술에서 포인터의 무결성을 확인하기 위해 사용하는 인증 코드이다.

Pointer Authentication은 **Armv8.3-A의 AArch64 환경에서 도입된 보안 기능**&#8203;으로, 공격자가 프로그램에서 사용되는 포인터를 임의로 변조하여 프로그램의 실행 흐름을 바꾸는 것을 어렵게 만드는 것을 목적으로 한다.

프로그램에서는 함수의 **Return Address(반환 주소)**&#8203;, 함수 포인터 등 여러 중요한 포인터가 사용된다. 만약 메모리 취약점을 통해 이러한 값이 변조된다면 공격자가 프로그램의 제어 흐름을 탈취할 수 있다.

PAC는 중요한 포인터에 인증값을 추가하고, 포인터를 사용할 때 인증 과정을 거쳐 **포인터의 무결성을 확인한다.**

---

### 2. PAC는 왜 필요한가?

함수가 호출되면 함수 실행이 끝난 뒤 원래 코드로 돌아가기 위한 **Return Address**&#8203;가 필요하다.

AArch64에서는 함수 호출 시 Return Address가 **LR(Link Register, X30)**&#8203;에 저장되며, 함수 실행 과정에서 필요에 따라 스택에도 저장될 수 있다.

정상적인 실행 과정을 간단하게 표현하면 다음과 같다.

```text
함수 호출
   ↓
Return Address 저장
   ↓
함수 실행
   ↓
Return Address 복원
   ↓
원래 코드로 복귀
```

하지만 Buffer Overflow와 같은 메모리 취약점으로 스택에 저장된 Return Address가 변조된다면 문제가 발생할 수 있다.

```text
정상 Return Address
        ↓
공격자가 주소 변조
        ↓
공격자가 원하는 위치로 실행 흐름 변경
```

이러한 제어 흐름 변조는 **ROP(Return-Oriented Programming)**&#8203;와 같은 공격에 이용될 수 있다.

ROP는 프로그램 내부에 이미 존재하는 짧은 코드 조각인 **gadget**&#8203;을 연결하여 공격자가 원하는 동작을 수행하는 공격 기법이다.

PAC가 Return Address에 적용되어 있다면 공격자는 단순히 Return Address만 원하는 값으로 변경해서는 정상적인 인증을 통과하기 어렵다.

따라서 PAC는 이러한 **제어 흐름 탈취 공격을 어렵게 만드는 역할**&#8203;을 한다.

---

### 3. PAC의 동작 원리

PAC의 기본 원리는 **포인터에 암호학적인 인증값을 추가하는 것**&#8203;이다.

PAC를 생성할 때는 대표적으로 다음과 같은 값들이 사용된다.

```text
┌─────────────┐
│   Pointer   │ ──┐
└─────────────┘   │
                  │
┌─────────────┐   │
│ Secret Key  │ ──┼──→ PAC 생성 ──→ Signed Pointer
└─────────────┘   │
                  │
┌─────────────┐   │
│  Modifier   │ ──┘
└─────────────┘
```

#### Pointer

보호하려는 주소 값이다.

Return Address나 함수 포인터 등이 보호 대상이 될 수 있다.

#### Secret Key

PAC를 생성하고 인증할 때 사용되는 비밀 키이다.

공격자가 포인터 값을 변경하더라도 비밀 키를 알지 못한다면 변경한 포인터에 맞는 정상적인 PAC를 생성하기 어렵다.

AArch64의 Pointer Authentication에서는 명령어 주소와 데이터 주소 등을 인증하기 위한 여러 개의 키를 제공한다.

#### Modifier

포인터와 Secret Key 외에 PAC 계산에 추가로 사용되는 문맥 값이다.

대표적인 예로 **Stack Pointer(SP)**&#8203;를 사용할 수 있다.

Modifier를 함께 사용하기 때문에 동일한 포인터라도 다른 문맥에서는 다른 PAC가 생성될 수 있다.

---

### 4. PAC는 어디에 저장될까?

AArch64의 포인터는 64비트이지만 시스템이 항상 64비트 전체를 실제 가상 주소를 표현하는 데 사용하는 것은 아니다.

Pointer Authentication은 이러한 주소 구조를 활용하여 **포인터의 상위 비트 중 사용 가능한 영역에 PAC를 저장할 수 있다.**

간단하게 표현하면 다음과 같다.

```text
PAC 적용 전

┌──────────────────────────────────────┐
│               Address                │
└──────────────────────────────────────┘


PAC 적용 후

┌──────────┬───────────────────────────┐
│   PAC    │          Address          │
└──────────┴───────────────────────────┘
```

PAC가 사용할 수 있는 정확한 비트 수는 시스템의 가상 주소 크기나 주소 태깅 등의 설정에 따라 달라질 수 있다.

따라서 PAC의 크기가 항상 동일하다고 볼 수는 없다.

---

### 5. PAC 생성과 인증

PAC에서는 크게 **Signing(서명)**&#8203;과 **Authentication(인증)** 두 과정이 중요하다.

#### Signing

먼저 Pointer, Secret Key, Modifier를 이용하여 PAC를 생성한다.

```text
Pointer
   +
Secret Key
   +
Modifier
   ↓
PAC 생성
   ↓
Signed Pointer
```

이 과정을 포인터를 **Signing한다**&#8203;고 표현한다.

#### Authentication

나중에 해당 포인터를 사용할 때 PAC를 다시 검증한다.

```text
Signed Pointer
      ↓
PAC 인증
   /       \
성공        실패
 ↓           ↓
정상 사용   정상 포인터로
           사용할 수 없음
```

포인터가 중간에 변조되었다면 해당 포인터에서 기대되는 PAC와 기존 PAC가 일치하지 않게 된다.

이를 통해 변조된 포인터가 정상적인 포인터처럼 사용되는 것을 어렵게 만든다.

---

### 6. ARM에서는 PAC를 어떻게 사용할까?

AArch64에는 Pointer Authentication을 위한 여러 명령어가 존재한다.

Return Address 보호를 이해할 때 대표적으로 사용되는 명령어가 다음 두 가지이다.

```text
PACIASP
AUTIASP
```

PACIASP는 **LR(X30)에 저장된 Return Address를 A-key와 Stack Pointer(SP)를 이용하여 서명**&#8203;한다.

반대로 AUTIASP는 Return Address의 PAC를 인증하는 데 사용된다.

간단한 예시는 다음과 같다.

```text
foo:
    PACIASP

    // 함수 실행
    ...

    AUTIASP
    RET
```

실제 함수에서는 Return Address를 스택에 저장하고 다시 복원하는 과정 등이 함께 존재할 수 있다.

전체적인 과정을 단순화하면 다음과 같다.

```text
       함수 호출
           │
           ▼
     Return Address
           │
           ▼
       PACIASP
           │
           ▼
  Return Address 서명
           │
           ▼
   스택 등에 저장
           │
           ▼
      함수 코드 실행
           │
           ▼
  Return Address 복원
           │
           ▼
       AUTIASP
           │
           ▼
        PAC 인증
       /        \
    성공         실패
     │             │
     ▼             ▼
    RET       정상적인 주소로
     │         사용할 수 없음
     ▼
정상 위치 복귀
```

즉, 함수가 실행되는 동안 공격자가 보호된 Return Address를 임의로 변경했다면 정상적인 PAC 인증을 통과하기 어렵다.

---

### 7. PAC와 ROP 공격

ROP(Return-Oriented Programming)는 프로그램에 이미 존재하는 코드 조각인 gadget을 연결하여 공격자가 원하는 동작을 수행하는 **Code-Reuse Attack**&#8203;의 한 종류이다.

PAC가 적용되지 않은 환경에서 공격자가 Return Address를 조작할 수 있다면 원하는 gadget의 주소로 프로그램의 실행 흐름을 변경할 수 있다.

```text
[PAC가 없는 경우]

Return Address 변조
        ↓
공격자가 원하는 주소
        ↓
제어 흐름 변경
```

반면 Return Address에 PAC가 적용되어 있다면 다음과 같은 과정이 추가된다.

```text
[PAC가 적용된 경우]

Signed Return Address 변조
        ↓
PAC 인증
        ↓
인증 실패
        ↓
변조된 포인터의 정상적인 사용 방지
```

따라서 PAC는 **ROP나 JOP(Jump-Oriented Programming)와 같은 Code-Reuse Attack을 어렵게 만드는 보안 완화 기법**&#8203;으로 활용될 수 있다.

---

### 8. PAC 인증에 실패하면?

Pointer Authentication의 인증 과정에서 PAC가 일치하지 않으면 해당 포인터는 정상적인 포인터로 인증되지 않는다.

Armv8.3-A의 기본적인 Pointer Authentication에서는 인증에 실패했을 때 정상적인 주소 대신 **잘못된 주소(corrupt address)**&#8203;가 만들어질 수 있다.

이후 해당 주소를 indirect branch나 메모리 접근 등에 사용하면 예외가 발생한다.

```text
PAC 인증 실패
      ↓
정상적으로 사용할 수 없는 주소
      ↓
해당 주소를 Branch/Load 등에 사용
      ↓
Exception 발생
```

따라서 공격자가 Return Address를 임의로 변경하더라도 정상적인 PAC 인증을 통과하지 못하면 해당 주소를 정상적인 제어 흐름에 사용하기 어렵다.

※ 이후 ARM 아키텍처에서는 인증 실패를 처리하는 방식이 확장되었기 때문에 세부 동작은 아키텍처 버전과 사용되는 명령어에 따라 차이가 있을 수 있다.

---

### 9. PAC의 한계

PAC가 있다고 해서 모든 메모리 취약점이 사라지는 것은 아니다.

예를 들어 다음과 같은 취약점이 있다고 가정할 수 있다.

- Buffer Overflow
- Use-After-Free
- 기타 메모리 손상 취약점

PAC를 적용하더라도 이러한 **취약점 자체가 제거되는 것은 아니다.**

PAC의 역할은 이러한 취약점을 이용하여 공격자가 중요한 포인터를 변조하고 **프로그램의 제어 흐름을 탈취하는 것을 어렵게 만드는 것**&#8203;에 가깝다.

따라서 PAC는 완벽한 단독 방어 기술이라기보다는 공격 성공 가능성을 낮추는 **Mitigation(공격 완화 기법)**&#8203;으로 보는 것이 적절하다.

ARM에서는 PAC 외에도 **BTI(Branch Target Identification)**&#8203;와 같은 보호기법을 제공한다.

PAC는 포인터의 무결성을 인증하고, BTI는 간접 분기가 허용된 위치로 이동하도록 제한하는 방식으로 제어 흐름 공격에 대한 방어를 강화할 수 있다.

---

### 10. 정리

PAC(Pointer Authentication Code)는 ARM에서 **포인터의 무결성을 인증하여 포인터 변조를 이용한 공격을 어렵게 만드는 보안 기술**&#8203;이다.

AArch64에서는 Pointer, Secret Key, Modifier 등을 이용하여 PAC를 생성하고, 주소 구조에서 사용할 수 있는 포인터의 상위 비트에 PAC를 포함할 수 있다.

이후 포인터를 사용할 때 PAC를 인증하여 해당 포인터가 정상적인 값인지 확인한다.

특히 Return Address에 PAC를 적용하면 공격자가 단순히 반환 주소를 원하는 주소로 변경하여 프로그램의 실행 흐름을 탈취하는 것을 어렵게 만들 수 있다.

PAC의 핵심 동작을 간단하게 정리하면 다음과 같다.

**Pointer + Secret Key + Modifier → PAC 생성 → Signed Pointer → PAC 인증 → 포인터 사용**

PAC는 Buffer Overflow와 같은 메모리 취약점 자체를 제거하는 기술은 아니다.

하지만 메모리 취약점을 이용하여 중요한 포인터를 변조하고 프로그램의 제어 흐름을 장악하는 공격을 어렵게 만든다는 점에서 ARM 시스템의 중요한 보안 완화 기술이라고 할 수 있다.

---

이렇게 PAC 보호기법에 대해서 나름대로 정리해보았는데 어떠셨나요? ㅎㅎ
처음에는 생소하고 어려웠는데 하나씩 알아가다 보니 PAC가 왜 필요한지, 실제로 포인터를 어떤 방식으로 보호하는지 조금은 이해할 수 있었던 것 같아요. 저도 이번에 정리하면서 많이 배울 수 있었습니다.

그럼 PAC 보호기법에 대한 정리는 여기서 마무리하겠습미다. 읽어주셔서 감사합니다 ㅎㅎ ( 꾸벅 )

![다운로드 (1).jfif](/assets/images/tistory-pac-01.jpg)
