---
title: '[K.knock × D-Alpha × CAUtion CTF] Hollow Notes | Reversing Write-up'
date: 2026-07-26T00:00:00.000Z
categories:
  - CTF/Wargame
tags:
  - HSPACE
  - 연합 CTF
  - Reversing
  - Write-up
description: Process Hollowing으로 실행되는 숨겨진 PE와 라이선스 검증 복원
---
`Hollow Notes`에서는 실행 파일에서 플래그처럼 생긴 문자열을 금방 발견했다. 그런데 문자열에 `decoy`라는 단어가 있었다. 그대로 정답이라고 생각하기보다는 왜 이런 문구가 들어 있는지 먼저 살펴봤다.

실제 플래그는 부모 프로그램 밖, **Process Hollowing으로 실행되는 숨겨진 PE**의 검증 로직에 있었다. 페이로드를 복원하고 입력값을 역산한 과정을 남긴다.

---

## 1. 문제 개요

* 분야: Reversing
* 점수: 500점
* 문제 설명:

> 실행해보면 평범한 프로그램처럼 보이지만, 어딘가 이상하다.
> 숨겨진 payload를 추적하여 flag를 찾아라.

제공된 파일은 다음과 같다.

```text
hollow_notes.exe
```

문제의 목표는 실행 파일 내부에 숨겨진 payload를 찾아 복원하고, payload의 검증 로직을 분석하여 올바른 flag를 구하는 것이다.

---

## 2. 파일 기본 정보 확인

먼저 `file` 명령으로 실행 파일의 형식을 확인하였다.

```bash
file hollow_notes.exe
```

실행 결과:

```text
hollow_notes.exe: PE32 executable for MS Windows, Intel i386, 8 sections
```

따라서 해당 파일은 32비트 Windows PE 실행 파일임을 알 수 있다.

문자열도 함께 확인하였다.

```bash
strings -a -n 6 hollow_notes.exe
```

확인된 문자열 중 다음과 같은 flag 형태의 문자열이 존재했다.

```text
CTF{this_parent_process_is_only_a_decoy}
```

그러나 문자열에 `decoy`, 즉 미끼라는 표현이 포함되어 있었기 때문에 실제 flag가 아니라 분석을 방해하기 위해 삽입된 가짜 flag라고 판단하였다.

---

## 3. 프로그램 실행 흐름 분석

프로그램은 겉으로 보기에는 단순한 콘솔 프로그램처럼 동작한다.

하지만 정적 분석을 진행한 결과, 일반적인 프로그램 실행 흐름과 달리 내부 데이터를 복호화한 뒤 별도의 실행 파일을 메모리에 올리는 구조가 존재했다.

Import Table에서는 다음 API를 확인할 수 있었다.

```text
GetProcAddress
LoadLibraryA
VirtualProtect
```

프로그램은 일부 Windows API를 Import Table에 직접 등록하지 않고, `LoadLibraryA`와 `GetProcAddress`를 사용해 실행 중 동적으로 가져오도록 구성되어 있었다.

이는 실제 동작을 정적 분석만으로 쉽게 파악하지 못하게 하기 위한 방식이다.

문제 제목과 실행 흐름을 종합하면 부모 프로세스는 실제 기능을 수행하는 프로그램이 아니라, 숨겨진 payload를 실행하기 위한 로더 역할을 한다.

---

## 4. 숨겨진 payload 발견

실행 파일의 섹션과 내부 데이터를 분석하던 중 일반적인 코드나 문자열이 아닌 큰 데이터 블록을 확인하였다.

해당 데이터의 크기는 약 다음과 같았다.

```text
0x4E00 bytes
```

이 데이터는 처음에는 정상적인 PE 파일 형태가 아니었지만, 프로그램 내부의 복호화 루틴을 적용하자 데이터의 시작 부분이 다음과 같이 변하였다.

```text
4D 5A
```

ASCII로 해석하면 다음과 같다.

```text
MZ
```

`MZ`는 Windows PE 실행 파일의 DOS Header Signature이다.

따라서 부모 실행 파일 내부에 암호화된 또 다른 PE 파일이 포함되어 있었음을 알 수 있었다.

복호화된 데이터를 별도의 파일로 저장하였다.

```text
payload_decrypted.bin
```

파일 형식을 다시 확인하였다.

```bash
file payload_decrypted.bin
```

결과:

```text
payload_decrypted.bin: PE32 executable for MS Windows, Intel i386, 8 sections
```

즉 복호화된 데이터는 정상적인 32비트 Windows 실행 파일이었다.

---

## 5. Process Hollowing 동작

부모 프로그램은 내부 payload를 단순히 파일로 생성하고 실행하지 않는다.

대신 정상적인 프로세스를 생성한 뒤, 해당 프로세스의 메모리 영역을 숨겨진 payload의 코드로 교체하여 실행하는 방식이 사용되었다.

이러한 기법을 **Process Hollowing**이라고 한다.

전체 동작 과정은 다음과 같이 정리할 수 있다.

```text
1. 부모 실행 파일 실행
2. 내부의 암호화된 payload 데이터 복호화
3. 정상 프로세스를 일시 정지 상태로 생성
4. 대상 프로세스의 기존 이미지 영역 변경
5. 복호화한 payload의 PE Header와 Section을 메모리에 삽입
6. 실행 시작 주소를 payload의 Entry Point로 변경
7. 정지된 스레드를 다시 실행
```

따라서 사용자는 정상 프로그램이 실행되는 것처럼 보지만, 실제로는 메모리에 삽입된 숨겨진 payload가 실행된다.

부모 파일에서 발견된 다음 문자열은 이러한 구조를 암시하는 미끼였다.

```text
CTF{this_parent_process_is_only_a_decoy}
```

여기서 `parent process`는 숨겨진 payload를 실행하는 부모 프로세스를 의미한다.

---

## 6. 복호화된 payload 분석

복호화한 payload의 문자열을 확인하였다.

```bash
strings -a -n 6 payload_decrypted.bin
```

주요 문자열은 다음과 같았다.

```text
license>
Access granted.
The hidden payload was recovered.
Access denied.
```

payload는 사용자에게 라이선스 값을 입력받은 뒤, 내부 검증 로직을 통해 정답 여부를 판단하는 프로그램이었다.

입력값이 올바르면 다음 문자열이 출력된다.

```text
Access granted.
The hidden payload was recovered.
```

입력값이 올바르지 않으면 다음 문자열이 출력된다.

```text
Access denied.
```

따라서 최종 flag를 구하기 위해서는 payload 내부의 라이선스 검증 함수를 분석해야 한다.

---

## 7. 입력 검증 로직 분석

검증 함수에서는 먼저 입력값의 길이를 검사한다.

올바른 입력값은 총 43바이트이며, 각 문자는 내부 키와 인덱스에 따라 변환된 뒤 미리 저장된 검증 배열과 비교된다.

검증 과정은 개념적으로 다음과 같은 형태였다.

```c
for (int i = 0; i < input_length; i++) {
    value = input[i] ^ key[i % key_length];
    value = value + rolling_value;
    value = rol(value, (i % 5) + 1);

    if (value != encrypted_check[i]) {
        return FAIL;
    }
}
```

주요 특징은 다음과 같다.

```text
입력 길이       : 43바이트
반복 키 길이    : 9바이트
사용 연산       : XOR, 덧셈, 비트 회전
회전 횟수       : (인덱스 % 5) + 1
```

검증 과정은 입력값을 변환하여 정답 배열과 비교하는 구조이므로, 각 연산을 반대로 적용하면 원래 입력값을 복구할 수 있다.

역연산은 다음 순서로 수행하였다.

```text
1. 저장된 검증값을 오른쪽으로 비트 회전
2. rolling value를 뺄셈
3. 반복 키와 XOR
4. 원래 입력 문자 복원
```

이를 Python 코드로 표현하면 다음과 같은 형태이다.

```python
def ror8(value, count):
    count %= 8
    return ((value >> count) | (value << (8 - count))) & 0xFF


flag = []

for i, target in enumerate(check_values):
    value = ror8(target, (i % 5) + 1)
    value = (value - rolling_values[i]) & 0xFF
    value ^= key[i % len(key)]

    flag.append(chr(value))

print("".join(flag))
```

검증 배열 전체에 역연산을 적용하자 다음 문자열이 복구되었다.

```text
CTF{pr0cess_h0ll0w1ng_repl4ces_the_reality}
```

---

## 8. 정답 검증

복구한 문자열을 payload에 입력하였다.

```text
license> CTF{pr0cess_h0ll0w1ng_repl4ces_the_reality}
```

프로그램은 다음과 같은 성공 메시지를 출력하였다.

```text
Access granted.
The hidden payload was recovered.
```

따라서 복원한 문자열이 payload의 검증 로직을 통과하는 올바른 입력값임을 확인할 수 있었다.

---

## 9. 최종 Flag

```text
CTF{pr0cess_h0ll0w1ng_repl4ces_the_reality}
```

---

## 10. 풀이 요약

이 문제의 핵심은 부모 실행 파일에서 바로 보이는 문자열을 정답으로 착각하지 않고, 내부에 숨겨진 payload를 추적하는 것이었다.

전체 분석 흐름은 다음과 같다.

```text
hollow_notes.exe 분석
        ↓
가짜 flag 문자열 발견
        ↓
암호화된 데이터 블록 발견
        ↓
복호화 루틴 분석
        ↓
숨겨진 PE payload 복원
        ↓
Process Hollowing 동작 확인
        ↓
payload의 라이선스 검증 함수 분석
        ↓
검증 연산 역산
        ↓
최종 flag 복구
```

부모 프로세스에서 발견되는 flag 형태의 문자열은 미끼였으며, 실제 flag는 Process Hollowing으로 실행되는 숨겨진 payload의 검증 로직 안에 존재했다.

문제의 최종 flag 문구 역시 문제에서 사용된 기법을 직접적으로 나타낸다.

```text
process hollowing replaces the reality
```

즉 정상 프로세스의 실행 이미지를 다른 payload로 교체하는 Process Hollowing의 특징을 표현한 flag이다.

---

## 풀고 나서

이 문제는 `strings`에 정답처럼 보이는 값이 있다고 바로 믿으면 안 된다는 걸 보여줬다. 실행 파일이 실제로 어떤 페이로드를 실행하는지 따라가 보니 정답을 찾을 수 있었다.

다음에 비슷한 문제를 만나면 보이는 문자열과 **실제로 실행되는 코드**를 구분해서 확인할 것 같다.

---

[← K.knock × D-Alpha × CAUtion 연합 CTF 종합 글로 돌아가기](/posts/joint-ctf-overview/)
