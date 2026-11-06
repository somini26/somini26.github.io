---
title: BombLab 올클리어 & GDB 바이너리 패치
date: '2026-08-16'
categories:
  - CTF/Wargame
tags:
  - BombLab
  - Reversing
  - GDB
  - Binary Patch
description: 순정 GDB를 이용한 Phase 1~6 분석 및 explode_bomb 함수 1바이트 패치.
---
> 이 글은 기존 [티스토리 기록](https://vegetable-m.tistory.com/16)과 작업 자료의 원본을 대조해 GitHub Pages용으로 다시 정리했다.

BombLab은 답을 맞히는 것에서 멈추지 않고, **왜 그 답이 맞는지 실제 어셈블리로 확인하고 싶었던** 실습이었다. 이번 기록은 6개 Phase를 모두 분석한 뒤 `explode_bomb`의 기계어를 직접 바꿔 결과를 비교한 과정까지 담았다.

---

## 1. 프로젝트 개요

이번 프로젝트에서는 **BombLab 바이너리를 오직 순정 GDB만을 이용하여 분석하고, 각 Phase가 어떤 조건에서 클리어되는지 직접 어셈블리 코드를 읽어 확인한 뒤 `explode_bomb` 함수가 정상적으로 실행되지 않도록 바이너리 패치까지 진행하였다.**

이번 프로젝트의 목적은 단순히 BombLab의 정답을 찾아 6개의 Phase를 통과하는 것이 아니라, 디컴파일러에 의존하지 않고 실제 바이너리의 어셈블리 코드를 읽으면서 프로그램의 동작을 추적해보는 것이었다.

따라서 **IDA는 사용하지 않았으며**, GDB의 `disassemble`, 메모리 확인 명령 등을 이용하여 직접 분석하였다.

진행 과정은 다음과 같다.

- BombLab 분석에 필요한 x86-64 어셈블리 명령어 학습
- GDB 기본 명령어 학습
- Phase 1 ~ Phase 6 어셈블리 분석
- 각 Phase의 클리어 조건 도출
- 실제 입력을 통한 Phase 1 ~ Phase 6 올클리어 확인
- `explode_bomb` 함수 분석
- GDB를 이용한 실제 바이너리 바이트 수정
- 패치 전/후 동일한 오답을 입력하여 결과 비교

---

## 2. BombLab 분석 전 어셈블리어 공부

BombLab을 GDB에서 `disassemble`하면 C 코드가 아니라 x86-64 어셈블리 코드가 출력되기 때문에, 먼저 분석에 필요한 명령어들을 공부하였다.

이번 환경의 GDB에서는 다음과 같은 AT&T 형식의 어셈블리가 출력되었다.

```asm
mov $0x402400,%esi
```

이 형식에서는 일반적으로 다음과 같이 읽었다.

```text
명령어 source, destination
```

즉 위 명령은 `0x402400`을 `%esi`에 저장한다는 의미이다.

제공된 참고 자료 역시 순정 GDB를 사용하여 Phase를 역어셈블하고 operand 순서에 주의하며 분석하는 방식으로 진행하고 있었다.

## 2.1 주요 레지스터

x86-64에서는 CPU 내부의 레지스터를 이용하여 값을 저장하거나 함수 인자를 전달한다.

이번 실습에서 자주 확인한 레지스터는 다음과 같다.

| 레지스터 | 이번 실습에서 확인한 주요 용도 |
|---|---|
| `%rax` / `%eax` | 함수 반환값, 계산 결과 |
| `%rbx` | 반복문이나 메모리 위치 추적 |
| `%rcx` / `%ecx` | 계산값 및 함수 인자 |
| `%rdx` / `%edx` | 함수 인자 및 계산값 |
| `%rsi` / `%esi` | 함수의 두 번째 인자 |
| `%rdi` / `%edi` | 함수의 첫 번째 인자 |
| `%rsp` | 현재 스택 위치 |
| `%rbp` | 스택 또는 반복 범위 관리 |

특히 x86-64 System V 환경에서는 함수 호출 시 앞쪽 인자들이 `%rdi`, `%rsi`, `%rdx` 등의 레지스터를 통해 전달되는 것을 Phase 4의 `func4` 분석에서 확인할 수 있었다.

---

## 3. 학습한 주요 어셈블리 명령어

## 3.1 `mov`

```asm
mov source, destination
```

값을 다른 레지스터나 메모리 위치로 복사한다.

Phase 1에서는 다음 코드가 등장하였다.

```asm
mov $0x402400,%esi
```

이를 통해 문자열이 존재하는 `0x402400` 주소가 함수 인자로 사용된다는 것을 확인할 수 있었다.

---

## 3.2 `lea`

`lea`는 메모리에 저장된 값을 읽는 것이 아니라 **주소 계산 결과**를 레지스터에 저장할 때 사용된다.

예를 들어 Phase 6 등에서 배열이나 스택 내부의 특정 위치를 계산하는 데 사용되었다.

```asm
lea 0x18(%rsp),%rsi
```

처음에는 `mov`와 비슷해 보여 헷갈렸지만, 실제 데이터를 가져오는 것이 아니라 주소를 계산한다는 차이가 있었다.

---

## 3.3 `add`

두 값을 더한다.

Phase 2에서는 다음 코드가 핵심이었다.

```asm
mov -0x4(%rbx),%eax
add %eax,%eax
```

`%eax`에 자기 자신을 다시 더하므로 결과적으로:

```text
eax = eax × 2
```

가 된다.

이를 통해 Phase 2가 이전 숫자의 2배가 다음 숫자가 되는 수열을 검사한다는 것을 알아낼 수 있었다.

---

## 3.4 `sub`

값을 뺀다.

Phase 6에서는 입력값을 변환하는 과정에서 다음 코드가 사용되었다.

```asm
mov $0x7,%ecx
mov %ecx,%edx
sub (%rax),%edx
```

따라서 입력값에 대해:

```text
7 - 입력값
```

이라는 변환이 수행된다는 것을 알 수 있었다.

---

## 3.5 `cmp`

```asm
cmp A, B
```

두 값을 비교하고 결과에 따라 CPU의 Flag를 변경한다.

BombLab에서는 사실상 **가장 중요하게 사용한 명령어 중 하나였다.**

예를 들어 Phase 2에서:

```asm
cmpl $0x1,(%rsp)
```

를 통해 첫 번째 입력이 `1`인지 확인하였다.

또한 Phase 6에서는 연결 리스트 노드의 값을 서로 비교하는 과정에서도 사용되었다.

---

## 3.6 `test`

두 값을 AND 연산한 것과 비슷하게 Flag를 설정하지만 결과값 자체를 저장하지는 않는다.

Phase 1에서:

```asm
test %eax,%eax
je ...
```

가 등장하였다.

`strings_not_equal()`의 반환값이 `0`이면 `%eax` 역시 `0`이므로 Zero Flag가 설정되고 `je`가 실행된다.

---

## 4. 조건 분기 명령어

BombLab을 분석하면서 가장 중요하게 본 부분은 **`cmp` 또는 `test` 다음에 나오는 조건 분기 명령어**였다.

## 4.1 `je`

```asm
je address
```

조건 비교 결과가 같을 때 점프한다.

Phase 1에서는 문자열이 같으면 `explode_bomb` 호출을 건너뛰는 데 사용되었다.

---

## 4.2 `jne`

```asm
jne address
```

조건이 같지 않을 때 점프한다.

반복문의 계속 여부를 확인하거나 조건이 맞지 않는 경우 다른 위치로 이동할 때 사용되었다.

---

## 4.3 `jbe`

unsigned 기준으로 **작거나 같을 때** 점프한다.

Phase 4에서는 첫 번째 숫자가 `0~14` 범위에 존재하는지를 확인하는 데 사용되었다.

---

## 4.4 `ja`

unsigned 기준으로 **큰 경우** 점프한다.

Phase 3에서는 첫 번째 입력이 `7`보다 큰 경우 Bomb이 터지는 경로로 이동하였다.

따라서 첫 번째 입력값이 `0~7` 범위여야 한다는 것을 알 수 있었다.

---

## 4.5 `jge`

크거나 같으면 점프한다.

Phase 6의 마지막 부분에서는 연결 리스트의 현재 노드 값과 다음 노드의 값을 비교할 때 사용되었다.

이를 통해 노드의 값이 **내림차순으로 정렬되어야 한다는 조건**을 찾을 수 있었다.

---

## 4.6 `jmp`

```asm
jmp address
```

조건 없이 지정한 주소로 이동한다.

Phase 3에서는 조금 특별한 형태가 등장하였다.

```asm
jmp *0x402470(,%rax,8)
```

처음에는 일반적인 `jmp`와 다르게 보여서 어려웠는데, 이후 메모리를 확인하면서 **Jump Table을 이용한 switch 구조**라는 것을 확인하였다.

---

## 5. 함수 호출과 복귀

## 5.1 `call`

```asm
call function
```

함수를 호출한다.

이번 실습에서는 다음과 같은 함수들이 사용되었다.

```text
strings_not_equal
read_six_numbers
func4
string_length
explode_bomb
```

특히 모든 Phase에서 가장 중요하게 본 것은:

```asm
call explode_bomb
```

였다.

Phase의 조건을 만족하지 못하면 이 함수가 호출되는 구조였다.

---

## 5.2 `ret`

```asm
ret
```

호출한 함수의 다음 위치로 복귀한다.

처음 Phase 분석 과정에서는 함수가 끝날 때 등장하는 명령 정도로 보았지만, **바이너리 패치 단계에서 가장 중요하게 사용한 명령어가 되었다.**

최종적으로 `explode_bomb` 함수의 첫 명령어를 `ret`로 변경하여 함수가 호출되더라도 즉시 복귀하도록 만들었다.

---

## 6. 비트 연산 관련 명령어

## 6.1 `and`

Phase 5에서 다음 코드가 등장하였다.

```asm
and $0xf,%edx
```

`0xf`는 이진수로:

```text
1111
```

이므로 입력 문자의 값에서 **하위 4비트만 남기는 역할**을 한다.

이를 통해 0~15 범위의 값을 만들어 Lookup Table의 index로 사용하였다.

---

## 6.2 `shr`

비트를 오른쪽으로 이동시키는 명령이다.

Phase 4의 `func4`에서 중간값을 계산하는 과정에 사용되었다.

---

## 6.3 `xor`

동일한 레지스터끼리 XOR 연산을 하면 결과가 0이 되기 때문에 레지스터 초기화에도 많이 사용된다.

이번 BombLab의 함수 종료 부분이나 stack protector 관련 코드에서도 확인할 수 있었다.

---

## 7. Stack 관련 명령어

## 7.1 `push`

레지스터 값을 스택에 저장한다.

```asm
push %rbx
```

함수가 시작될 때 기존 레지스터 값을 보존하는 용도로 자주 사용되었다.

## 7.2 `pop`

```asm
pop %rbx
```

함수가 종료되기 전에 저장해둔 레지스터 값을 다시 복원한다.

---

## 8. 이번 BombLab에서 가장 유용했던 어셈블리 명령어

여러 명령어를 공부했지만 실제 Phase를 분석할 때 가장 많이 활용한 것은 다음 명령어들이었다.

```text
mov
cmp
test
je / jne / jbe / ja / jge
jmp
call
ret
```

그중에서도 가장 중요했던 것은 **`cmp + 조건 분기` 조합**이었다.

BombLab은 대부분:

```text
입력값 또는 계산값
        ↓
cmp / test
        ↓
조건 분기
   ↙           ↘
정상 진행    explode_bomb
```

형태로 구성되어 있었다.

따라서 모든 어셈블리 코드를 완벽하게 이해하려고 하기보다는 먼저:

1. 어떤 값을 비교하는가?
2. 비교 직후 어떤 조건 분기가 실행되는가?
3. 어느 경우에 `explode_bomb`가 호출되는가?

를 확인하는 방식이 Phase 분석에 가장 유용하였다.

또한 마지막 바이너리 패치에서는 **`ret` 명령어가 가장 직접적으로 사용되었다.**

---

## 9. GDB에서 사용한 주요 명령어

이번 실습에서는 IDA를 사용하지 않고 GDB에서 다음 명령을 이용하였다.

## 함수 어셈블리 확인

```gdb
disassemble phase_1
```

함수의 기계어를 어셈블리 형태로 확인한다.

---

## 문자열 확인

```gdb
x/s 0x402400
```

특정 주소의 데이터를 문자열 형태로 출력한다.

Phase 1과 Phase 5에서 사용하였다.

---

## 메모리를 8바이트 단위로 확인

```gdb
x/8gx 0x402470
```

Phase 3의 Jump Table을 확인할 때 사용하였다.

---

## 여러 개의 메모리 구조 확인

```gdb
x/12gx 0x6032d0
```

Phase 6의 연결 리스트 노드 구조를 확인하는 데 사용하였다.

---

## 실제 opcode 확인

```gdb
x/8xb 0x40143a
```

`explode_bomb` 함수의 기계어를 1바이트 단위로 확인하였다.

바이너리 패치 전후를 비교할 때 사용하였다.

---

## 10. BombLab 실행

BombLab은 WSL Ubuntu 환경에서 진행하였다.

GDB가 정상적으로 설치되어 있는지 먼저 확인하였다.

```bash
gdb --version
```

사용한 버전은:

```text
GNU gdb 15.1
```

이었다.

BombLab 바이너리를 GDB에서 실행하였다.

```bash
gdb ./bomb
```

> [캡처 - GDB 15.1 실행 및 bomb 바이너리 로드]

---

## 11. Phase 1 - 문자열 비교

먼저 Phase 1을 확인하였다.

```gdb
disassemble phase_1
```

핵심 코드는 다음과 같았다.

```asm
mov    $0x402400,%esi
call   strings_not_equal
test   %eax,%eax
je     0x400ef7
call   explode_bomb
```

흐름을 정리하면:

```text
사용자 입력
    ↓
strings_not_equal()
    ↓
0x402400의 문자열과 비교
    ↓
동일 → 반환값 0
    ↓
test %eax,%eax
    ↓
je 실행
    ↓
explode_bomb 건너뜀
```

따라서 `0x402400`에 어떤 문자열이 저장되어 있는지 확인하였다.

```gdb
x/s 0x402400
```

결과:

```text
"Border relations with Canada have never been better."
```

> [캡처 - `x/s 0x402400` 결과]

따라서 Phase 1 입력은:

```text
Border relations with Canada have never been better.
```

였다.

실제로 입력한 결과:

```text
Phase 1 defused. How about the next one?
```

이 출력되었다.

> [캡처 - Phase 1 통과]

---

## 12. Phase 2 - 수열 분석

Phase 2를 확인하였다.

```gdb
disassemble phase_2
```

먼저:

```asm
call read_six_numbers
```

가 존재하였다.

정확한 입력 개수를 확인하기 위해 해당 함수도 분석하였다.

```gdb
disassemble read_six_numbers
```

내부에는:

```asm
call __isoc99_sscanf
cmp  $0x5,%eax
jg   ...
call explode_bomb
```

가 있었다.

따라서 `sscanf()`가 6개의 숫자를 정상적으로 읽지 못하면 Bomb이 터지는 구조였다.

Phase 2에서는 첫 번째 숫자를 다음과 같이 검사하였다.

```asm
cmpl $0x1,(%rsp)
```

따라서 첫 번째 숫자는 `1`이다.

반복 부분에서는:

```asm
mov -0x4(%rbx),%eax
add %eax,%eax
cmp %eax,(%rbx)
```

가 수행되었다.

이전 숫자를 `%eax`에 가져온 뒤 자기 자신을 더하고 현재 숫자와 비교하므로:

```text
현재 숫자 = 이전 숫자 × 2
```

조건임을 알 수 있었다.

따라서:

```text
1 2 4 8 16 32
```

를 입력하였다.

실행 결과:

```text
That's number 2. Keep going!
```

이 출력되었다.

> [캡처 - Phase 2 통과]

---

## 13. Phase 3 - Jump Table 분석

```gdb
disassemble phase_3
```

먼저 `sscanf()`의 반환값을 확인하여 두 개의 값을 입력한다는 것을 알 수 있었다.

또한:

```asm
cmpl $0x7,0x8(%rsp)
ja   ...
```

가 존재하였다.

따라서 첫 번째 입력은 `0~7` 범위이다.

가장 중요한 부분은:

```asm
mov 0x8(%rsp),%eax
jmp *0x402470(,%rax,8)
```

였다.

첫 번째 입력값을 index로 사용하여 서로 다른 주소로 이동하는 **Jump Table** 구조였다.

Jump Table을 직접 확인하였다.

```gdb
x/8gx 0x402470
```

결과를 분석하면:

| 첫 번째 입력 | 이동 주소 | 두 번째 값 |
|---:|---|---:|
| 0 | `0x400f7c` | 207 |
| 1 | `0x400f83` | 707 |
| 2 | `0x400f8a` | 256 |
| 3 | `0x400f91` | 389 |
| 4 | `0x400f98` | 206 |
| 5 | `0x400f9f` | 682 |
| 6 | `0x400fa6` | 327 |
| 7 | `0x400fb9` | 311 |

> [캡처 - Jump Table 메모리]

마지막에는:

```asm
cmp 0xc(%rsp),%eax
je  ...
call explode_bomb
```

로 두 번째 입력과 `%eax`를 비교하였다.

따라서 여러 가능한 조합 중:

```text
0 207
```

을 사용하였다.

실행 결과:

```text
Halfway there!
```

가 출력되었다.

> [캡처 - Phase 3 통과]

---

## 14. Phase 4 - 재귀 함수 분석

```gdb
disassemble phase_4
```

Phase 4에서는 두 개의 숫자를 입력받았다.

또한:

```asm
cmpl $0xe,0x8(%rsp)
jbe  ...
```

가 존재하여 첫 번째 입력은 `0~14` 범위였다.

그다음:

```asm
mov $0xe,%edx
mov $0x0,%esi
mov 0x8(%rsp),%edi
call func4
```

가 실행되었다.

함수 호출 직전 레지스터 값을 기준으로 보면:

```text
func4(첫 번째 입력, 0, 14)
```

형태로 볼 수 있었다.

따라서 다음 함수를 추가 분석하였다.

```gdb
disassemble func4
```

`func4`에서는 범위의 중간값을 계산한 뒤 입력값과 비교하고, 조건에 따라 다시 자기 자신을 호출하였다.

즉 **이진 탐색과 유사한 재귀 구조**였다.

초기 범위는:

```text
0 ~ 14
```

이므로 중간값은:

```text
7
```

이다.

입력값과 중간값이 같으면:

```asm
mov $0x0,%eax
```

로 0을 반환하였다.

또한 `phase_4`에서는:

```asm
test %eax,%eax
jne explode_bomb
```

로 `func4()`의 반환값이 0인지 검사하였다.

두 번째 입력 역시:

```asm
cmpl $0x0,0xc(%rsp)
```

로 0인지 검사하였다.

따라서 가장 간단하게:

```text
7 0
```

을 사용하였다.

실행 결과:

```text
So you got that one. Try this one.
```

이 출력되었다.

> [캡처 - `func4` 어셈블리]
>
> [캡처 - Phase 4 통과]

---

## 15. Phase 5 - Lookup Table과 비트 연산

```gdb
disassemble phase_5
```

처음에는:

```asm
call string_length
cmp $0x6,%eax
```

가 있었다.

따라서 입력 문자열은 정확히 **6글자**여야 한다.

반복문에서는:

```asm
and $0xf,%edx
movzbl 0x4024b0(%rdx),%edx
```

가 사용되었다.

즉 입력 문자의 ASCII 값 중 **하위 4비트만 가져온 뒤 이를 Lookup Table의 index로 사용**한다.

최종적으로 비교하는 문자열을 확인하였다.

```gdb
x/s 0x40245e
```

결과:

```text
"flyers"
```

Lookup Table을 확인하였다.

```gdb
x/s 0x4024b0
```

앞 16글자는:

```text
maduiersnfotvbyl
```

이었다.

index를 붙이면:

```text
0  → m
1  → a
2  → d
3  → u
4  → i
5  → e
6  → r
7  → s
8  → n
9  → f
10 → o
11 → t
12 → v
13 → b
14 → y
15 → l
```

목표 문자열:

```text
flyers
```

에 필요한 index는:

```text
f → 9
l → 15
y → 14
e → 5
r → 6
s → 7
```

따라서 입력 문자의 하위 4비트가:

```text
9 15 14 5 6 7
```

이 되면 된다.

이를 만족하는 문자로:

```text
ionefg
```

를 선택하였다.

ASCII 값으로 보면:

```text
i = 0x69 → 9
o = 0x6f → 15
n = 0x6e → 14
e = 0x65 → 5
f = 0x66 → 6
g = 0x67 → 7
```

따라서:

```text
ionefg
   ↓
9 F E 5 6 7
   ↓
Lookup Table
   ↓
flyers
```

가 된다.

실행 결과:

```text
Good work! On to the next...
```

이 출력되었다.

> [캡처 - `"flyers"` 및 Lookup Table 확인]
>
> [캡처 - Phase 5 통과]

---

## 16. Phase 6 - 연결 리스트 분석

마지막 Phase이다.

```gdb
disassemble phase_6
```

먼저:

```asm
call read_six_numbers
```

가 있으므로 숫자 6개를 입력한다.

이후 반복적으로 입력값을 검사하는 부분을 확인한 결과:

```text
모든 숫자는 1~6
6개의 숫자는 서로 중복되면 안 됨
```

이라는 조건을 확인하였다.

따라서 입력은 `1~6`의 순열이다.

## 16.1 입력값 변환

중간에는 다음 코드가 있었다.

```asm
mov $0x7,%ecx
mov %ecx,%edx
sub (%rax),%edx
mov %edx,(%rax)
```

즉 모든 입력값에:

```text
7 - 입력값
```

연산을 수행한다.

따라서:

```text
1 → 6
2 → 5
3 → 4
4 → 3
5 → 2
6 → 1
```

로 변환된다.

## 16.2 연결 리스트 노드 확인

코드에서:

```asm
mov $0x6032d0,%edx
```

가 사용되고 있었다.

실제 메모리를 확인하였다.

```gdb
x/12gx 0x6032d0
```

결과:

| Node | Value | Index |
|---|---:|---:|
| node1 | 332 | 1 |
| node2 | 168 | 2 |
| node3 | 924 | 3 |
| node4 | 691 | 4 |
| node5 | 477 | 5 |
| node6 | 443 | 6 |

> [캡처 - 6개의 Node 메모리]

마지막 부분에서는 현재 노드의 value와 다음 노드의 value를 비교한다.

조건은:

```text
현재 노드 value ≥ 다음 노드 value
```

이므로 노드의 값이 **내림차순**이 되어야 한다.

Value 기준으로 정렬하면:

```text
node3 = 924
node4 = 691
node5 = 477
node6 = 443
node1 = 332
node2 = 168
```

따라서 필요한 Node index 순서는:

```text
3 4 5 6 1 2
```

이다.

하지만 앞에서 입력값에 `7-x`가 적용되므로 역으로 계산하였다.

```text
7 - 4 = 3
7 - 3 = 4
7 - 2 = 5
7 - 1 = 6
7 - 6 = 1
7 - 5 = 2
```

따라서 실제 입력은:

```text
4 3 2 1 6 5
```

가 된다.

---

## 17. BombLab 올클리어

최종적으로 사용한 입력값은 다음과 같다.

```text
Phase 1
Border relations with Canada have never been better.

Phase 2
1 2 4 8 16 32

Phase 3
0 207

Phase 4
7 0

Phase 5
ionefg

Phase 6
4 3 2 1 6 5
```

실제로 모든 값을 입력하자:

```text
Congratulations! You've defused the bomb!
```

이 출력되었다.

> [캡처 - Phase 1~6 입력 및 `Congratulations! You've defused the bomb!`]

이를 통해 Phase 1부터 Phase 6까지 모든 통과 조건을 GDB를 통해 분석하고 BombLab을 올클리어하였다.

---

## 18. `explode_bomb` 함수 분석

이제 프로젝트의 마지막 목표인 **바이너리 패치**를 진행하였다.

먼저 Bomb이 실제로 어떤 함수에서 동작하는지 확인하였다.

```gdb
disassemble explode_bomb
```

원본 함수는 다음과 같은 구조였다.

```asm
0x40143a <+0>:  sub  $0x8,%rsp
...
call puts@plt
...
call puts@plt
...
call exit@plt
```

즉 `explode_bomb`가 호출되면 메시지를 출력한 뒤 최종적으로 `exit()`를 호출하여 프로그램을 종료한다.

> [캡처 - 패치 전 `explode_bomb` disassembly]

---

## 19. 패치 전 정상 동작 확인

패치 효과를 확실하게 확인하기 위해 원본 BombLab을 별도의 디렉터리에 다시 압축 해제하여 테스트하였다.

```bash
mkdir -p ~/bomblab/original

tar -xf ~/bomblab/bomb.tar -C ~/bomblab/original
```

원본을 실행하였다.

```bash
cd ~/bomblab/original/bomb
./bomb
```

Phase 1에서 일부러 틀린 문자열을 입력하였다.

```text
hello
```

결과:

```text
BOOM!!!
The bomb has blown up.
```

이 출력되었다.

> [캡처 - 패치 전 `hello` 입력 → `BOOM!!!`]

따라서 패치 전에는 잘못된 입력이 들어오면 정상적으로 `explode_bomb()`가 실행된다는 것을 확인하였다.

---

## 20. 바이너리 패치 방법 결정

여러 Phase를 확인하면서 곳곳에:

```asm
call explode_bomb
```

가 존재한다는 것을 확인하였다.

처음에는 각각의 `call explode_bomb`를 수정하는 방법도 생각할 수 있었다.

하지만 그렇게 하면 수정해야 할 위치가 많다.

따라서 이번에는 **`explode_bomb` 함수 자체의 시작 명령어를 `ret`로 변경하는 방법**을 선택하였다.

즉:

```text
[패치 전]

조건 실패
   ↓
call explode_bomb
   ↓
puts()
   ↓
exit()
```

를:

```text
[패치 후]

조건 실패
   ↓
call explode_bomb
   ↓
ret
   ↓
호출한 위치로 즉시 복귀
```

하도록 만드는 방식이다.

제공된 참고 글에서는 `call explode_bomb`를 NOP으로 채우는 방식도 사용하고 있었지만, 이번 실습에서는 여러 호출 지점을 각각 수정하지 않고 **함수의 진입점 자체를 `ret`로 변경하는 방식**을 사용하였다.

---

## 21. 원본 Opcode 확인

`explode_bomb`의 시작 주소는:

```text
0x40143a
```

였다.

실제 기계어 바이트를 확인하였다.

```gdb
x/8xb 0x40143a
```

결과:

```text
0x48 0x83 0xec 0x08 ...
```

가 출력되었다.

> [캡처 - 패치 전 Opcode]

앞의:

```text
48 83 ec 08
```

은 기존 첫 번째 명령:

```asm
sub $0x8,%rsp
```

의 기계어였다.

---

## 22. GDB에서 바이너리 쓰기 허용

GDB에서 바이너리에 직접 쓰기 위해:

```gdb
set write on
```

을 실행하였다.

그리고 실행 파일을 다시 로드하였다.

```gdb
file ./bomb
```

GDB에서:

```text
Load new symbol table from "./bomb"? (y or n)
```

이라고 물어보면:

```text
y
```

를 입력하였다.

---

## 23. `explode_bomb`를 `ret`로 패치

x86에서 `ret`의 Opcode는:

```text
0xC3
```

이다.

따라서 `explode_bomb` 시작 주소의 첫 바이트를 다음과 같이 수정하였다.

```gdb
set {unsigned char}0x40143a = 0xc3
```

즉:

```text
패치 전 : 0x48
패치 후 : 0xC3
```

로 변경하였다.

---

## 24. 패치된 바이트 확인

패치 이후 다시 메모리를 확인하였다.

```gdb
x/8xb 0x40143a
```

결과:

```text
0xc3 0x83 0xec 0x08 ...
```

로 첫 바이트가 `0xC3`로 변경된 것을 확인할 수 있었다.

> [캡처 - `0x48` → `0xC3` 패치 결과]

---

## 25. Disassembly를 이용한 패치 확인

실제 어셈블리도 변경되었는지 확인하였다.

```gdb
disassemble explode_bomb
```

패치 전에는:

```asm
0x40143a <+0>: sub $0x8,%rsp
```

였지만 패치 이후:

```asm
0x40143a <+0>: ret
```

로 변경되어 있었다.

> [캡처 - 패치 이후 첫 명령어가 `ret`로 변경]

따라서 `explode_bomb`가 호출되더라도 함수 내부의 메시지 출력이나 `exit()`까지 도달하지 않고 바로 호출한 위치로 복귀하게 된다.

---

## 26. 패치 과정 중 발생한 오류

패치를 완료한 뒤 같은 GDB 세션에서 바로:

```gdb
run
```

을 실행하였다.

그런데 다음 오류가 발생하였다.

```text
Text file busy
During startup program exited with code 126.
```

처음에는 바이너리 패치가 잘못된 것인지 생각하였다.

하지만 GDB에서 바이너리를 쓰기 가능한 상태로 열어 수정한 직후 동일한 파일을 실행하려 했기 때문에 발생한 문제였다.

따라서:

```gdb
quit
```

으로 GDB를 완전히 종료하였다.

그 후 다시:

```bash
gdb ./bomb
```

으로 바이너리를 로드하였다.

---

## 27. 실제 바이너리에 패치가 저장되었는지 확인

GDB를 완전히 종료한 뒤 새로 실행하면 메모리의 임시 변경사항이었다면 원본으로 돌아와야 한다.

따라서 다시:

```gdb
disassemble explode_bomb
```

를 확인하였다.

그런데 GDB를 새로 실행했음에도:

```asm
0x40143a <+0>: ret
```

가 그대로 남아 있었다.

> [캡처 - GDB 재실행 이후에도 `ret` 유지]

이를 통해 단순히 실행 중 메모리만 임시로 수정한 것이 아니라 **실제 `bomb` 바이너리에 패치가 저장되었다는 것을 확인하였다.**

---

## 28. 패치 후 오답 입력 테스트

마지막으로 패치가 실제로 동작하는지 검증하였다.

다시 프로그램을 실행하였다.

```gdb
run
```

그리고 패치 전과 동일하게 Phase 1에 일부러:

```text
hello
```

를 입력하였다.

원본에서는:

```text
hello

BOOM!!!
The bomb has blown up.
```

이 출력되었지만,

패치 이후에는:

```text
hello
Phase 1 defused. How about the next one?
```

이 출력되었다.

> [캡처 - 패치 후 `hello` 입력에도 Bomb이 터지지 않는 결과]

여기서 `hello`가 Phase 1의 새로운 정답이 된 것은 아니다.

실제 흐름은 다음과 같다.

```text
hello 입력
   ↓
strings_not_equal()
   ↓
문자열 불일치
   ↓
call explode_bomb
   ↓
0x40143a의 ret 실행
   ↓
즉시 호출 위치로 복귀
   ↓
explode_bomb 내부의 puts / exit 실행 X
   ↓
이후 코드 계속 실행
```

따라서 `explode_bomb` 함수가 제대로 무력화된 것을 확인할 수 있었다.

---

## 29. 패치 전후 비교

| 구분 | 패치 전 | 패치 후 |
|---|---|---|
| 입력 | `hello` | `hello` |
| Phase 1 조건 | 실패 | 실패 |
| `explode_bomb` 호출 | O | O |
| 함수 첫 명령 | `sub $0x8,%rsp` | `ret` |
| `BOOM!!!` 출력 | O | X |
| `exit()` 실행 | O | X |
| 이후 코드 실행 | X | O |

결국 동일한 오답을 입력했지만 `explode_bomb` 함수의 첫 바이트를 수정하는 것만으로 프로그램의 동작이 달라지는 것을 직접 확인하였다.

---

## 30. Phase별 분석 결과 정리

| Phase | 주요 분석 내용 | 입력 |
|---|---|---|
| Phase 1 | 문자열 비교 | `Border relations with Canada have never been better.` |
| Phase 2 | 이전 값의 2배가 다음 값인 수열 | `1 2 4 8 16 32` |
| Phase 3 | Jump Table / switch 구조 | `0 207` |
| Phase 4 | 재귀 함수 / 이진 탐색 형태 | `7 0` |
| Phase 5 | ASCII 하위 4비트 / Lookup Table | `ionefg` |
| Phase 6 | 연결 리스트 / 노드 value 내림차순 | `4 3 2 1 6 5` |

---

## 31. 실습하면서 어려웠던 점

처음에는 어셈블리 코드 자체가 익숙하지 않아 `mov`, `cmp`, `jmp` 같은 각각의 명령어가 무엇을 의미하는지 확인하는 데 시간이 걸렸다.

하지만 Phase를 계속 분석하면서 모든 어셈블리 코드를 처음부터 끝까지 완벽하게 해석하려고 하기보다:

```text
어떤 값을 가져오는가?
        ↓
무엇과 비교하는가?
        ↓
어떤 조건에서 점프하는가?
        ↓
explode_bomb는 언제 실행되는가?
```

의 순서로 보는 것이 훨씬 이해하기 쉬웠다.

특히 Phase 3에서:

```asm
jmp *0x402470(,%rax,8)
```

와 같은 코드를 처음 보았을 때는 일반적인 `jmp`와 달라 이해하기 어려웠지만, GDB로 `0x402470` 메모리를 직접 확인하면서 Jump Table이라는 것을 알 수 있었다.

Phase 5에서는 문자열 자체를 비교하는 것이 아니라 입력 문자의 하위 4비트만 사용한다는 점이 헷갈렸다.

Phase 6은 가장 복잡했는데:

```text
6개 숫자 입력
→ 범위 및 중복 검사
→ 7-x 변환
→ Node 선택
→ 연결 리스트 재구성
→ Node value 비교
```

까지 여러 과정을 연결해서 생각해야 했다.

그래서 GDB에서 실제 Node 메모리를 직접 출력하고 Value를 하나씩 확인한 뒤 정렬하여 입력값을 역산하였다.

---

## 32. 바이너리 패치를 통해 알게 된 점

이번 프로젝트에서 가장 인상 깊었던 부분은 마지막 바이너리 패치였다.

처음에는 프로그램의 동작을 바꾸기 위해 많은 부분을 수정해야 할 것이라고 생각했지만, 실제로는 `explode_bomb` 함수 시작 주소의 **단 1바이트**를:

```text
0x48 → 0xC3
```

로 변경하여 함수의 동작 자체를 크게 바꿀 수 있었다.

특히 `0xC3`가 단순히 숫자가 아니라 CPU가 `ret` 명령으로 해석하는 실제 Opcode라는 점을 직접 확인할 수 있었다.

그리고 패치 후 `disassemble`을 다시 실행하자:

```asm
ret
```

가 실제로 출력되는 것을 보면서 소스 코드가 아니라 **기계어를 직접 수정하는 것이 바이너리 패치라는 점을 이해할 수 있었다.**

---

## 33. 실습을 통해 배운 점

이번 실습에서는 IDA 없이 순정 GDB만 사용하였기 때문에 처음에는 분석이 어렵게 느껴졌다.

하지만 직접 레지스터와 메모리를 확인하면서 프로그램이 실제로 어떤 방식으로 동작하는지를 더 자세히 볼 수 있었다.

특히 다음 흐름을 반복적으로 확인하면서 어셈블리 코드를 읽는 감을 익힐 수 있었다.

```text
입력값
   ↓
레지스터 / 메모리에 저장
   ↓
계산
   ↓
cmp 또는 test
   ↓
조건 분기
   ↓
정상 진행 또는 explode_bomb
```

Phase 1에서는 문자열 비교,

Phase 2에서는 반복문과 수열,

Phase 3에서는 Jump Table,

Phase 4에서는 재귀 함수,

Phase 5에서는 비트 연산과 Lookup Table,

Phase 6에서는 연결 리스트까지 서로 다른 형태의 로직을 어셈블리 수준에서 확인할 수 있었다.

또한 마지막에는 `explode_bomb`의 Opcode를 직접 변경하여 **프로그램의 실행 흐름을 바이너리 수준에서 변경하는 경험**도 할 수 있었다.

단순히 BombLab의 정답을 외워서 통과하는 것이 아니라, 왜 해당 값이 정답인지 직접 어셈블리와 메모리를 통해 확인했다는 점에서 의미가 있었다.

---

## 34. 결론

이번 프로젝트에서는 순정 GDB만을 이용하여 BombLab의 Phase 1부터 Phase 6까지 분석하였다.

각 Phase마다 `explode_bomb`가 실행되지 않는 조건을 어셈블리 코드를 통해 추적하고 실제 입력값을 도출하였으며, 최종적으로:

```text
Congratulations! You've defused the bomb!
```

메시지를 확인하였다.

이후 `explode_bomb` 함수 자체를 분석하고 첫 번째 기계어 바이트를:

```text
0x48 → 0xC3
```

로 변경하였다.

이를 통해:

```asm
explode_bomb:
    ret
```

형태로 함수가 즉시 복귀하도록 만들었다.

마지막으로 원본과 패치된 바이너리에 동일하게 `hello`라는 오답을 입력하였다.

원본에서는:

```text
BOOM!!!
The bomb has blown up.
```

이 출력되었지만,

패치된 바이너리에서는 Bomb이 실행되지 않고 다음 단계로 넘어가는 것을 확인하였다.

이번 실습을 통해 **x86-64 어셈블리의 기본적인 데이터 이동, 비교, 조건 분기, 함수 호출, 비트 연산 등을 실제 바이너리 분석에 적용해볼 수 있었으며, GDB를 이용하여 Opcode를 직접 확인하고 수정하는 바이너리 패치 과정까지 경험할 수 있었다.**

---

## 참고 자료

- BombLab 어셈블리 패치 참고 글 — 제공된 Tistory 자료
- x86 / x86-64 Instruction Reference — Felix Cloutier

---

## 한 번 더 돌아보며

`0x48`이라는 한 바이트를 `0xC3`으로 바꾸자 `explode_bomb`가 곧바로 반환하도록 바뀌는 순간이 특히 기억에 남았다. 앞으로는 GDB에서 확인한 증거를 더 짧고 명확한 라이트업으로 정리하는 연습도 해보려고 한다.
