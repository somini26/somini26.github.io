---
title: "BombLab 올클리어 & 바이너리 패치 수행"
date: 2026-08-16
recordOrder: 18
categories: ["CTF/Wargame"]
tags: ["BombLab", "GDB", "x86-64", "Binary Patch"]
description: "순정 GDB로 BombLab Phase 1~6의 조건을 분석하고 explode_bomb 함수의 바이너리 패치까지 진행했습니다."
---
안녕하세요. somani입니다!

이번에는 **BombLab을 직접 분석해서 Phase 1부터 Phase 6까지 모두 클리어하고, 마지막에는 바이너리 패치까지 진행해보았습니다.**

BombLab은 처음 접해보았습니다. GDB에 어셈블리 코드가 길게 출력되는 모습을 처음 봤을 때는 어디서부터 읽고 정답을 찾아야 할지 막막했습니다. 리버싱과 시스템 분야를 제대로 배워 본 적이 많지 않아 더 어렵게 느껴졌습니다.

그래서 바로 문제를 풀기보다는 먼저 필요한 **x86-64 어셈블리 명령어와 GDB 사용법부터 하나씩 공부한 뒤**&#8203;,

각 Phase가 어떤 조건을 검사하는지 직접 따라가면서 분석해보았습니다.

그리고 Phase를 전부 클리어하는 것에서 끝내지 않고, 마지막에는 explode\_bomb 함수의 실제 Opcode를 수정해 **Bomb이 터지지 않도록 바이너리의 동작 자체를 바꾸는 패치까지 진행해 보았습니다.**

그럼 어떤 방식으로 분석하고 올클리어까지 진행했는지 하나씩 정리해 보겠습니다!

### 1. 프로젝트 개요

이번 프로젝트에서는 **BombLab 바이너리를 오직 순정 GDB만을 이용하여 분석하고, 각 Phase가 어떤 조건에서 클리어되는지 직접 어셈블리 코드를 읽어 확인한 뒤 explode\_bomb 함수가 정상적으로 실행되지 않도록 바이너리 패치까지 진행했습니다.**

이번 프로젝트의 목적은 단순히 BombLab의 정답을 찾아 6개의 Phase를 통과하는 것이 아니라, 디컴파일러에 의존하지 않고 실제 바이너리의 어셈블리 코드를 읽으면서 프로그램의 동작을 추적해보는 것이었습니다.

따라서 **IDA는 사용하지 않았으며**&#8203;, GDB의 disassemble, 메모리 확인 명령 등을 이용하여 직접 분석했습니다.

진행 과정은 다음과 같습니다.

- BombLab 분석에 필요한 x86-64 어셈블리 명령어 학습
- GDB 기본 명령어 학습
- Phase 1 ~ Phase 6 어셈블리 분석
- 각 Phase의 클리어 조건 도출
- 실제 입력을 통한 Phase 1 ~ Phase 6 올클리어 확인
- explode\_bomb 함수 분석
- GDB를 이용한 실제 바이너리 바이트 수정
- 패치 전/후 동일한 오답을 입력하여 결과 비교

---

## 2. BombLab 분석 전 x86-64 어셈블리어 공부

BombLab을 GDB에서 disassemble하면 C 코드가 아니라 x86-64 어셈블리 코드가 출력되기 때문에, 바로 Phase 분석을 시작하기보다는 먼저 어셈블리어의 기본 개념과 분석에 필요한 명령어들을 공부했습니다.

처음에는 GDB에서 다음과 같은 코드가 출력되는 것을 보고 어디서부터 읽어야 할지 막막했습니다.

```text
mov $0x402400,%esi
```

이번 환경의 GDB에서는 **AT&amp;T 형식**&#8203;의 어셈블리가 출력되었으며, 기본적으로 다음과 같이 읽습니다.

```text
명령어 source, destination
```

즉 위 코드는 0x402400이라는 값을 %esi에 저장한다는 의미입니다.

BombLab 어셈블리 패치 참고 글에서도 순정 GDB로 각 Phase를 역어셈블하고, operand의 순서와 레지스터 및 메모리 값을 확인하며 분석하고 있었습니다.

따라서 BombLab을 분석하기 전에 어셈블리어 자체의 구조부터 하나씩 정리해보았습니다.

### 2.1 어셈블리어와 기계어

우리가 C나 Python과 같은 고급 언어로 작성한 코드는 CPU가 그대로 이해하여 실행하는 것이 아닙니다.

프로그램은 최종적으로 CPU가 이해할 수 있는 **기계어(Machine Code)** 형태로 변환되어 실행됩니다.

예를 들어 다음과 같은 기계어가 있다고 하면:

```text
48 83 ec 08
```

사람이 이 값을 그대로 보고 의미를 파악하기는 어렵습니다.

이 기계어를 사람이 조금 더 읽기 쉬운 형태로 표현한 것이 어셈블리어입니다.

위의 기계어는 x86-64 환경에서 다음과 같이 표현할 수 있습니다.

```text
sub $0x8,%rsp
```

즉 크게 보면 다음과 같은 관계를 가진다고 볼 수 있습니다.

```text
고급 언어
   ↓
컴파일
   ↓
기계어
   ↕
어셈블리어
```

이번 프로젝트에서는 마지막에 실제 Opcode를 수정하여 바이너리 패치를 진행했기 때문에, 어셈블리어와 기계어의 관계도 중요하게 느껴졌습니다.

### 2.2 Opcode와 Operand

어셈블리 명령은 크게 **Opcode와 Operand**&#8203;로 나눌 수 있습니다.

예를 들어:

```text
mov $10,%eax
```

에서:

```text
mov   → Opcode
$10   → Operand
%eax  → Operand
```

입니다.

Opcode는 CPU가 어떤 동작을 수행할지를 나타내고, Operand는 그 동작의 대상이 되는 값이나 레지스터, 메모리 위치를 의미합니다.

따라서 어셈블리 코드를 읽을 때는 먼저:

```text
어떤 명령인가?
   ↓
어떤 값을 대상으로 하는가?
```

를 나누어 보는 것이 도움이 되었습니다.

### 2.3 주요 레지스터

x86-64에서는 CPU 내부의 레지스터를 이용하여 값을 저장하거나 계산 결과를 보관하고, 함수 인자를 전달합니다.

이번 실습에서 자주 확인한 레지스터는 다음과 같습니다.

레지스터주요 용도

| %rax / %eax | 함수 반환값, 계산 결과 |
| --- | --- |
| %rbx | 반복문이나 메모리 위치 추적 |
| %rcx / %ecx | 계산값 및 함수 인자 |
| %rdx / %edx | 함수 인자 및 계산값 |
| %rsi / %esi | 함수의 두 번째 인자 |
| %rdi / %edi | 함수의 첫 번째 인자 |
| %rsp | 현재 스택 위치 |
| %rbp | 스택 또는 반복 범위 관리 |
| %rip | 현재 실행 흐름과 관련된 명령어 주소 |

처음에는 %rax, %eax, %ax, %al이 서로 다른 레지스터인 줄 알았는데, 같은 레지스터의 일부를 서로 다른 크기로 사용하는 것이라는 점도 공부했습니다.

```text
RAX = 64bit
EAX = 하위 32bit
AX  = 하위 16bit
AL  = 하위 8bit
```

따라서 어셈블리 코드를 볼 때는 단순히 어떤 레지스터를 사용하는지만 보는 것이 아니라 몇 bit 크기의 값을 사용하고 있는지도 함께 확인해야 했습니다.

### 2.4 x86-64 System V 함수 호출 규약

x86-64 Linux 환경에서는 함수 호출 시 앞쪽 인자들이 레지스터를 통해 전달됩니다.

대표적으로 다음과 같은 순서를 사용합니다.

```text
1번째 인자 → RDI
2번째 인자 → RSI
3번째 인자 → RDX
4번째 인자 → RCX
5번째 인자 → R8
6번째 인자 → R9
```

그리고 함수의 반환값은 일반적으로 %rax를 통해 전달됩니다.

이 부분은 이후 Phase 4의 func4를 분석할 때 특히 중요했습니다.

예를 들어:

```text
mov $0xe,%edx
mov $0x0,%esi
mov 0x8(%rsp),%edi
call func4
```

와 같은 코드가 있다면 함수 호출 직전 레지스터 값을 통해:

```text
func4(첫 번째 입력, 0, 14)
```

와 같은 형태로 함수 인자를 추적할 수 있었습니다.

### 2.5 AT&amp;T Syntax

이번 환경의 GDB에서는 AT&amp;T Syntax가 사용됐습니다.

AT&amp;T Syntax에서는 기본적으로:

```text
명령어 source, destination
```

순서로 읽습니다.

또한 기호에도 의미가 있습니다.

```text
%rax    → 레지스터
$10     → 즉시값
(%rax)  → rax가 가리키는 메모리
0x8(%rsp) → rsp + 0x8 위치의 메모리
```

특히 $의 유무가 중요했습니다.

예를 들어:

```text
mov $0x10,%eax
```

은 0x10이라는 값 자체를 %eax에 넣는 것이고,

```text
mov 0x10,%eax
```

은 메모리 위치와 관련된 형태가 될 수 있기 때문에 의미가 달라집니다.

### 2.6 메모리와 주소 참조

어셈블리에서는 레지스터뿐만 아니라 메모리에 직접 접근하는 코드도 많이 등장합니다.

예를 들어:

```text
mov (%rax),%edx
```

는 %rax 자체를 %edx에 넣는 것이 아니라:

```text
rax에 저장된 주소
   ↓
해당 주소의 메모리 접근
   ↓
그곳의 값을 edx에 저장
```

하는 구조입니다.

또한:

```text
mov 0x8(%rsp),%eax
```

는 %rsp + 0x8 위치의 메모리에 접근합니다.

이러한 표현은 이후 BombLab에서 스택에 저장된 입력값을 확인할 때 자주 등장했습니다.

### 2.7 주소 지정 방식

조금 더 복잡한 주소 표현은 다음과 같은 형태로 나타납니다.

```text
0x10(%rax,%rcx,4)
```

AT&amp;T Syntax에서 일반적으로:

```text
displacement(base, index, scale)
```

형태로 사용하며 실제 주소는:

```text
base + index × scale + displacement
```

로 계산할 수 있습니다.

따라서:

```text
0x10(%rax,%rcx,4)
```

는:

```text
rax + rcx × 4 + 0x10
```

주소에 접근한다는 의미입니다.

이 개념은 Phase 3의 Jump Table을 이해할 때 특히 중요했습니다.

실제로 다음과 같은 코드가 등장했습니다.

```text
jmp *0x402470(,%rax,8)
```

처음에는 일반적인 jmp와 달라서 이해하기 어려웠지만, %rax를 index로 사용하여 8바이트 단위의 주소를 선택한다는 것을 알 수 있었습니다.

---

## 3. 학습한 주요 어셈블리 명령어

### 3.1 mov

```text
mov source, destination
```

값을 다른 레지스터나 메모리 위치로 복사합니다.

예를 들어:

```text
mov $10,%eax
```

은 10이라는 값을 %eax에 저장합니다.

Phase 1에서는 다음 코드가 등장했습니다.

```text
mov $0x402400,%esi
```

이를 통해 문자열이 존재하는 0x402400 주소가 함수의 인자로 사용된다는 것을 확인할 수 있었습니다.

### 3.2 lea

lea는 메모리에 저장된 값을 읽는 것이 아니라 **주소 계산 결과**&#8203;를 레지스터에 저장합니다.

예를 들어:

```text
lea 0x18(%rsp),%rsi
```

는 %rsp + 0x18이라는 주소를 계산하여 %rsi에 저장합니다.

처음에는 mov와 비슷해 보여 헷갈렸지만:

```text
mov → 실제 값 이동
lea → 주소 계산
```

이라는 차이가 있었습니다.

Phase 6 등에서 배열이나 스택 내부의 특정 위치를 계산하는 데 사용됐습니다.

### 3.3 add

두 값을 더합니다.

```text
add source, destination
```

Phase 2에서는 다음 코드가 핵심이었습니다.

```text
mov -0x4(%rbx),%eax
add %eax,%eax
```

%eax에 자기 자신을 다시 더하므로 결과적으로:

```text
eax = eax × 2
```

가 됩니다.

이를 통해 Phase 2가 이전 숫자의 2배가 다음 숫자가 되는 수열을 검사한다는 것을 알아낼 수 있었습니다.

### 3.4 sub

값을 뺍니다.

Phase 6에서는 입력값을 변환하는 과정에서 다음 코드가 사용됐습니다.

```text
mov $0x7,%ecx
mov %ecx,%edx
sub (%rax),%edx
```

따라서 입력값에 대해:

```text
7 - 입력값
```

이라는 변환이 수행된다는 것을 확인할 수 있었습니다.

### 3.5 inc / dec

inc와 dec는 값을 각각 1 증가시키거나 감소시킵니다.

```text
inc %eax
dec %eax
```

반복문의 횟수를 증가시키거나 감소시키는 것과 같은 구조에서 사용할 수 있습니다.

### 3.6 imul

정수 곱셈에 사용되는 명령어입니다.

```text
imul $2,%eax
```

와 같이 사용하면 %eax의 값에 2를 곱할 수 있습니다.

BombLab에서는 모든 Phase에서 직접 핵심적으로 사용한 명령은 아니었지만, 산술 연산을 해석하기 위해 함께 공부했습니다.

### 3.7 cmp

```text
cmp A, B
```

두 값을 비교하고 결과에 따라 CPU의 Flag를 변경합니다.

실제로는 개념적으로:

```text
B - A
```

를 수행하여 Flag를 설정하지만 결과값 자체를 저장하지는 않습니다.

BombLab에서는 사실상 **가장 중요하게 사용한 명령어 중 하나였습니다.**

예를 들어 Phase 2에서:

```text
cmpl $0x1,(%rsp)
```

를 통해 첫 번째 입력이 1인지 확인했습니다.

또한 Phase 6에서는 연결 리스트 노드의 값을 서로 비교하는 과정에서도 사용됐습니다.

### 3.8 test

test는 두 값을 AND 연산한 것과 비슷하게 Flag를 설정하지만 결과값 자체를 저장하지는 않습니다.

Phase 1에서:

```text
test %eax,%eax
je ...
```

가 등장했습니다.

strings\_not\_equal()의 반환값이 0이면 %eax 역시 0이므로 Zero Flag가 설정되고 je가 실행됩니다.

---

## 4. CPU Flag와 조건 분기

BombLab을 분석하면서 가장 중요하게 본 부분은 **cmp 또는 test 다음에 나오는 조건 분기 명령어**&#8203;였습니다.

CPU는 비교 결과를 단순히 True/False로 저장하는 것이 아니라 여러 Flag를 변경합니다.

대표적으로:

```text
ZF → Zero Flag
CF → Carry Flag
SF → Sign Flag
OF → Overflow Flag
```

등이 있습니다.

이후의 조건 분기 명령은 이러한 Flag를 이용하여 점프 여부를 결정합니다.

### 4.1 je

```text
je address
```

조건 비교 결과가 같을 때 점프합니다.

Phase 1에서는 문자열이 같으면 explode\_bomb 호출을 건너뛰는 데 사용됐습니다.

### 4.2 jne

```text
jne address
```

조건이 같지 않을 때 점프합니다.

반복문의 계속 여부를 확인하거나 조건이 맞지 않는 경우 다른 위치로 이동할 때 사용됐습니다.

### 4.3 jbe

unsigned 기준으로 **작거나 같을 때** 점프합니다.

Phase 4에서는 첫 번째 숫자가 0~14 범위에 존재하는지를 확인하는 데 사용됐습니다.

### 4.4 ja

unsigned 기준으로 **큰 경우** 점프합니다.

Phase 3에서는 첫 번째 입력이 7보다 큰 경우 Bomb이 터지는 경로로 이동했습니다.

따라서 첫 번째 입력값이 0~7 범위여야 한다는 것을 알 수 있었습니다.

### 4.5 jge

signed 기준으로 크거나 같으면 점프합니다.

Phase 6의 마지막 부분에서는 연결 리스트의 현재 노드 값과 다음 노드의 값을 비교할 때 사용됐습니다.

이를 통해 노드의 값이 **내림차순으로 정렬되어야 한다는 조건**&#8203;을 찾을 수 있었습니다.

### 4.6 signed와 unsigned 조건 분기

조건 분기 명령은 signed와 unsigned 비교에 따라 다르게 사용됩니다.

대표적으로:

```text
jg   → signed >
jge  → signed >=
jl   → signed <
jle  → signed <=

ja   → unsigned >
jae  → unsigned >=
jb   → unsigned <
jbe  → unsigned <=
```

처음에는 모두 단순한 크기 비교라고 생각했지만, 같은 bit 값이라도 signed와 unsigned 중 어떤 방식으로 해석하는지에 따라 결과가 달라질 수 있다는 점을 알게 되었습니다.

### 4.7 jmp

```text
jmp address
```

조건 없이 지정한 주소로 이동합니다.

Phase 3에서는 조금 특별한 형태가 등장했습니다.

```text
jmp *0x402470(,%rax,8)
```

처음에는 일반적인 jmp와 다르게 보여서 어려웠는데, 이후 메모리를 확인하면서 **Jump Table을 이용한 switch 구조**&#8203;라는 것을 확인했습니다.

---

## 5. 함수 호출과 복귀

### 5.1 call

```text
call function
```

함수를 호출합니다.

이번 실습에서는 다음과 같은 함수들이 사용됐습니다.

```text
strings_not_equal
read_six_numbers
func4
string_length
explode_bomb
```

특히 모든 Phase에서 가장 중요하게 본 것은:

```text
call explode_bomb
```

였습니다.

Phase의 조건을 만족하지 못하면 이 함수가 호출되는 구조였습니다.

### 5.2 ret

```text
ret
```

호출한 함수의 다음 위치로 복귀합니다.

함수를 call하면 돌아올 위치가 저장되고, 함수 실행이 끝난 뒤 ret이 실행되면 다시 그 위치로 돌아갑니다.

처음 Phase 분석 과정에서는 함수가 끝날 때 등장하는 명령 정도로 보았지만, **바이너리 패치 단계에서 가장 중요하게 사용한 명령어가 되었습니다.**

최종적으로 explode\_bomb 함수의 첫 명령어를 ret로 변경하여 함수가 호출되더라도 즉시 복귀하도록 만들었습니다.

---

## 6. 비트 연산 관련 명령어

### 6.1 and

두 값을 AND 연산합니다.

Phase 5에서 다음 코드가 등장했습니다.

```text
and $0xf,%edx
```

0xf는 이진수로:

```text
1111
```

이므로 입력 문자의 값에서 **하위 4비트만 남기는 역할**&#8203;을 합니다.

하위 4비트로 만들 수 있는 값은 0~15이므로 총 16가지이며, 이후 Lookup Table의 index로 사용됐습니다.

### 6.2 or

두 값에 OR 연산을 진행합니다.

각 bit를 비교하여 둘 중 하나라도 1이면 결과가 1이 됩니다.

이번 BombLab에서는 핵심적인 분석에 직접 사용되지는 않았지만 기본적인 비트 연산으로 함께 공부했습니다.

### 6.3 xor

동일한 레지스터끼리 XOR 연산을 하면 결과가 0이 되기 때문에 레지스터 초기화에도 많이 사용됩니다.

예를 들어:

```text
xor %eax,%eax
```

은 %eax를 0으로 만드는 데 사용할 수 있습니다.

이번 BombLab의 함수 종료 부분이나 stack protector 관련 코드에서도 확인할 수 있었습니다.

### 6.4 shl / shr

비트를 왼쪽 또는 오른쪽으로 이동시키는 명령입니다.

```text
shl → Shift Left
shr → Shift Right
```

Phase 4의 func4에서는 shr이 중간값을 계산하는 과정에 사용됐습니다.

---

## 7. Stack 관련 학습

어셈블리에서는 함수가 실행되는 동안 Stack을 이용하여 데이터를 임시로 저장하거나 레지스터 값을 보관합니다.

Stack과 관련하여 가장 중요하게 확인한 레지스터는 %rsp였습니다.

%rsp는 현재 Stack의 Top 위치를 가리키는 Stack Pointer입니다.

### 7.1 push

레지스터 값을 Stack에 저장합니다.

```text
push %rbx
```

함수가 시작될 때 기존 레지스터 값을 보존하는 용도로 자주 사용됐습니다.

### 7.2 pop

```text
pop %rbx
```

Stack에 저장해둔 값을 다시 레지스터로 가져옵니다.

함수가 종료되기 전에 기존 값을 복원하는 용도로 사용됩니다.

### 7.3 rsp 조정

함수 시작 부분에서 다음과 같은 코드가 등장하기도 합니다.

```text
sub $0x18,%rsp
```

이는 Stack에 사용할 공간을 확보하기 위해 %rsp의 값을 조정하는 형태입니다.

함수가 종료될 때는 다시 %rsp 값을 되돌리는 코드가 나타날 수 있습니다.

---

## 8. 어셈블리에서 프로그램 구조 파악하기

개별 명령어를 공부한 뒤에는 여러 명령어가 함께 사용될 때 원래 프로그램의 어떤 구조에 해당하는지도 생각해보았습니다.

### 8.1 if문

예를 들어:

```text
cmp $10,%eax
jne fail
```

와 같은 코드가 있다면 개념적으로:

```text
if (eax != 10) {
    // fail
}
```

과 유사한 구조로 볼 수 있습니다.

### 8.2 반복문

어셈블리에는 C의 for나 while이라는 명령이 직접 존재하지 않습니다.

대신:

```text
값 비교
 ↓
조건 분기
 ↓
코드 실행
 ↓
이전 주소로 이동
```

와 같은 형태로 반복 구조가 만들어질 수 있습니다.

Phase 2와 Phase 6에서도 이러한 반복 구조를 확인할 수 있었습니다.

### 8.3 switch와 Jump Table

switch 문은 컴파일된 뒤 Jump Table 형태로 나타날 수 있습니다.

예를 들어:

```text
jmp *0x402470(,%rax,8)
```

처럼 index에 따라 서로 다른 주소로 이동하는 코드가 나타날 수 있습니다.

이 구조는 Phase 3에서 직접 확인했습니다.

### 8.4 재귀 함수

함수 내부에서 다시 자기 자신을 call하면 재귀 함수 구조가 만들어질 수 있습니다.

Phase 4의 func4에서는 범위를 줄여가며 자기 자신을 다시 호출하는 재귀 구조를 확인할 수 있었습니다.

---

## 9. 이번 BombLab에서 가장 유용했던 어셈블리 명령어

여러 명령어와 개념을 공부했지만 실제 Phase를 분석할 때 가장 많이 활용한 것은 다음과 같습니다.

```text
mov
lea
cmp
test
je / jne / jbe / ja / jge
jmp
call
ret
Stack
메모리 주소 계산
레지스터 값 확인
```

그중에서도 가장 중요했던 것은 **cmp 또는 test + 조건 분기 조합**&#8203;이었습니다.

BombLab은 대부분 다음과 같은 구조로 이루어져 있었습니다.

```text
입력값 또는 계산값
        ↓
레지스터 / 메모리
        ↓
cmp / test
        ↓
조건 분기
   ↙           ↘
정상 진행    explode_bomb
```

따라서 모든 어셈블리 코드를 처음부터 끝까지 완벽하게 해석하려고 하기보다는 먼저:

1. 어떤 값을 가져오는가?
2. 그 값을 무엇과 비교하는가?
3. 비교 직후 어떤 조건 분기가 실행되는가?
4. 어느 경우에 explode\_bomb가 호출되는가?

를 중심으로 확인하는 방식이 Phase 분석에 가장 유용했습니다.

또한 마지막 바이너리 패치에서는 **ret 명령어가 가장 직접적으로 사용됐습니다.**

처음에는 어셈블리 코드를 보면 명령어 하나하나가 모두 어렵게 느껴졌지만, 기본 구조를 먼저 공부하고 이러한 흐름을 중심으로 보니 조금씩 프로그램의 동작을 따라갈 수 있었습니다.

---

## 10. GDB에서 사용한 주요 명령어

어셈블리어의 기본적인 내용을 공부한 뒤에는 실제 BombLab 분석에 사용할 GDB 명령어도 함께 익혔습니다.

이번 실습에서는 IDA를 사용하지 않고 GDB에서 다음 명령들을 이용했습니다.

### 10.1 함수 어셈블리 확인

```text
disassemble phase_1
```

함수의 기계어를 어셈블리 형태로 확인합니다.

각 Phase를 분석할 때 가장 기본적으로 사용한 명령어입니다.

### 10.2 문자열 확인

```text
x/s 0x402400
```

특정 주소의 데이터를 문자열 형태로 출력합니다.

Phase 1의 비교 문자열과 Phase 5의 Lookup Table 및 최종 비교 문자열을 확인할 때 사용했습니다.

### 10.3 메모리를 8바이트 단위로 확인

```text
x/8gx 0x402470
```

메모리를 8바이트 단위로 여러 개 출력합니다.

Phase 3의 Jump Table 주소를 확인할 때 사용했습니다.

### 10.4 여러 개의 메모리 구조 확인

```text
x/12gx 0x6032d0
```

여러 개의 메모리 값을 연속적으로 확인할 수 있습니다.

Phase 6의 연결 리스트 Node 구조와 각 Node의 value 및 next pointer를 확인하는 데 사용했습니다.

### 10.5 실제 Opcode 확인

```text
x/8xb 0x40143a
```

메모리를 1바이트 단위의 16진수 값으로 확인합니다.

explode\_bomb 함수의 실제 기계어 Opcode를 확인하고 바이너리 패치 전후를 비교할 때 사용했습니다.

이 명령을 통해 패치 전에는:

```text
0x48 0x83 0xec 0x08 ...
```

이었던 첫 번째 바이트가 패치 후:

```text
0xc3 0x83 0xec 0x08 ...
```

로 변경된 것을 직접 확인할 수 있었습니다.

이렇게 x86-64 어셈블리의 기본 구조와 주요 명령어, Stack, 함수 호출, 조건 분기, 주소 지정 방식 등을 먼저 공부하고 GDB 명령어까지 익힌 뒤 본격적으로 Phase 1부터 분석을 시작했습니다.

---

## 11. BombLab 실행

BombLab은 WSL Ubuntu 환경에서 진행했습니다.

GDB가 정상적으로 설치되어 있는지 먼저 확인했습니다.

```text
gdb --version
```

사용한 버전은:

```text
GNU gdb 15.1
```

이었습니다.

BombLab 바이너리를 GDB에서 실행했습니다.

```text
gdb ./bomb
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 1](/assets/images/tistory-bomblab-01.png)

---

## 12. Phase 1 - 문자열 비교

먼저 Phase 1을 확인했습니다.

```text
disassemble phase_1
```

핵심 코드는 다음과 같았습니다.

```text
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

따라서 0x402400에 어떤 문자열이 저장되어 있는지 확인했습니다.

```text
x/s 0x402400
```

결과:

```text
"Border relations with Canada have never been better."
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 2](/assets/images/tistory-bomblab-02.png)

따라서 Phase 1 입력은:

```text
Border relations with Canada have never been better.
```

였습니다.

실제로 입력한 결과:

```text
Phase 1 defused. How about the next one?
```

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 3](/assets/images/tistory-bomblab-03.png)

---

## 13. Phase 2 - 수열 분석

Phase 2를 확인했습니다.

```text
disassemble phase_2
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 4](/assets/images/tistory-bomblab-04.png)

먼저:

```text
call read_six_numbers
```

가 존재했습니다.

정확한 입력 개수를 확인하기 위해 해당 함수도 분석했습니다.

```text
disassemble read_six_numbers
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 5](/assets/images/tistory-bomblab-05.png)

내부에는:

```text
call __isoc99_sscanf
cmp  $0x5,%eax
jg   ...
call explode_bomb
```

가 있었습니다.

따라서 sscanf()가 6개의 숫자를 정상적으로 읽지 못하면 Bomb이 터지는 구조였습니다.

Phase 2에서는 첫 번째 숫자를 다음과 같이 검사했습니다.

```text
cmpl $0x1,(%rsp)
```

따라서 첫 번째 숫자는 1입니다.

반복 부분에서는:

```text
mov -0x4(%rbx),%eax
add %eax,%eax
cmp %eax,(%rbx)
```

가 수행되었습니다.

이전 숫자를 %eax에 가져온 뒤 자기 자신을 더하고 현재 숫자와 비교하므로:

```text
현재 숫자 = 이전 숫자 × 2
```

조건임을 알 수 있었습니다.

따라서:

```text
1 2 4 8 16 32
```

를 입력했습니다.

실행 결과:

```text
That's number 2. Keep going!
```

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 6](/assets/images/tistory-bomblab-06.png)

---

## 14. Phase 3 - Jump Table 분석

```text
disassemble phase_3
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 7](/assets/images/tistory-bomblab-07.png)

먼저 sscanf()의 반환값을 확인하여 두 개의 값을 입력한다는 것을 알 수 있었습니다.

또한:

```text
cmpl $0x7,0x8(%rsp)
ja   ...
```

가 존재했습니다.

따라서 첫 번째 입력은 0~7 범위입니다.

가장 중요한 부분은:

```text
mov 0x8(%rsp),%eax
jmp *0x402470(,%rax,8)
```

였습니다.

첫 번째 입력값을 index로 사용하여 서로 다른 주소로 이동하는 **Jump Table** 구조였습니다.

Jump Table을 직접 확인했습니다.

```text
x/8gx 0x402470
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 8](/assets/images/tistory-bomblab-08.png)

결과를 분석하면:

첫 번째 입력 이동 주소 두 번째 값

| 0 | 0x400f7c | 207 |
| --- | --- | --- |
| 1 | 0x400f83 | 707 |
| 2 | 0x400f8a | 256 |
| 3 | 0x400f91 | 389 |
| 4 | 0x400f98 | 206 |
| 5 | 0x400f9f | 682 |
| 6 | 0x400fa6 | 327 |
| 7 | 0x400fb9 | 311 |

마지막에는:

```text
cmp 0xc(%rsp),%eax
je  ...
call explode_bomb
```

로 두 번째 입력과 %eax를 비교했습니다.

따라서 여러 가능한 조합 중:

```text
0 207
```

을 사용했습니다.

실행 결과:

```text
Halfway there!
```

가 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 9](/assets/images/tistory-bomblab-09.png)

---

## 15. Phase 4 - 재귀 함수 분석

```text
disassemble phase_4
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 10](/assets/images/tistory-bomblab-10.png)

Phase 4에서는 두 개의 숫자를 입력받았습니다.

또한:

```text
cmpl $0xe,0x8(%rsp)
jbe  ...
```

가 존재하여 첫 번째 입력은 0~14 범위였습니다.

그다음:

```text
mov $0xe,%edx
mov $0x0,%esi
mov 0x8(%rsp),%edi
call func4
```

가 실행됐습니다.

함수 호출 직전 레지스터 값을 기준으로 보면:

```text
func4(첫 번째 입력, 0, 14)
```

형태로 볼 수 있었습니다.

따라서 다음 함수를 추가 분석했습니다.

```text
disassemble func4
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 11](/assets/images/tistory-bomblab-11.png)

func4에서는 범위의 중간값을 계산한 뒤 입력값과 비교하고, 조건에 따라 다시 자기 자신을 호출했습니다.

즉 **이진 탐색과 유사한 재귀 구조**&#8203;였습니다.

초기 범위는:

```text
0 ~ 14
```

이므로 중간값은:

```text
7
```

입니다.

입력값과 중간값이 같으면:

```text
mov $0x0,%eax
```

로 0을 반환했습니다.

또한 phase\_4에서는:

```text
test %eax,%eax
jne explode_bomb
```

로 func4()의 반환값이 0인지 검사했습니다.

두 번째 입력 역시:

```text
cmpl $0x0,0xc(%rsp)
```

로 0인지 검사했습니다.

따라서 가장 간단하게:

```text
7 0
```

을 사용했습니다.

실행 결과:

```text
So you got that one. Try this one.
```

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 12](/assets/images/tistory-bomblab-12.png)

---

## 16. Phase 5 - Lookup Table과 비트 연산

```text
disassemble phase_5
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 13](/assets/images/tistory-bomblab-13.png)

처음에는:

```text
call string_length
cmp $0x6,%eax
```

가 있었습니다.

따라서 입력 문자열은 정확히 **6글자**&#8203;여야 합니다.

반복문에서는:

```text
and $0xf,%edx
movzbl 0x4024b0(%rdx),%edx
```

가 사용됐습니다.

즉 입력 문자의 ASCII 값 중 **하위 4비트만 가져온 뒤 이를 Lookup Table의 index로 사용**&#8203;합니다.

최종적으로 비교하는 문자열을 확인했습니다.

```text
x/s 0x40245e
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 14](/assets/images/tistory-bomblab-14.png)

결과:

```text
"flyers"
```

Lookup Table을 확인했습니다.

```text
x/s 0x4024b0
```

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 15](/assets/images/tistory-bomblab-15.png)

앞 16글자는:

```text
maduiersnfotvbyl
```

이었습니다.

> 앞서 and $0xf, %edx 연산을 통해 인덱스가 0~15 범위로 제한되므로, 0x4024b0부터 시작하는 문자열 중 실제 Lookup Table로 사용되는 앞 16글자만 확인했습니다.

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

이 되면 됩니다.

이를 만족하는 문자로:

```text
ionefg
```

를 선택했습니다.

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

가 됩니다.

실행 결과:

```text
Good work! On to the next...
```

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 16](/assets/images/tistory-bomblab-16.png)

---

## 17. Phase 6 - 연결 리스트 분석

마지막 Phase입니다. ㅎ.ㅎ

```text
disassemble phase_6
```

결과를 알려드리겠습니다. 좀 길어요.

```text
(gdb) disassemble phase_6
Dump of assembler code for function phase_6:
   0x00000000004010f4 <+0>:     push   %r14
   0x00000000004010f6 <+2>:     push   %r13
   0x00000000004010f8 <+4>:     push   %r12
   0x00000000004010fa <+6>:     push   %rbp
   0x00000000004010fb <+7>:     push   %rbx
   0x00000000004010fc <+8>:     sub    $0x50,%rsp
   0x0000000000401100 <+12>:    mov    %rsp,%r13
   0x0000000000401103 <+15>:    mov    %rsp,%rsi
   0x0000000000401106 <+18>:    call   0x40145c <read_six_numbers>
   0x000000000040110b <+23>:    mov    %rsp,%r14
   0x000000000040110e <+26>:    mov    $0x0,%r12d
   0x0000000000401114 <+32>:    mov    %r13,%rbp
   0x0000000000401117 <+35>:    mov    0x0(%r13),%eax
   0x000000000040111b <+39>:    sub    $0x1,%eax
   0x000000000040111e <+42>:    cmp    $0x5,%eax
   0x0000000000401121 <+45>:    jbe    0x401128 <phase_6+52>
   0x0000000000401123 <+47>:    call   0x40143a <explode_bomb>
   0x0000000000401128 <+52>:    add    $0x1,%r12d
   0x000000000040112c <+56>:    cmp    $0x6,%r12d
   0x0000000000401130 <+60>:    je     0x401153 <phase_6+95>
   0x0000000000401132 <+62>:    mov    %r12d,%ebx
   0x0000000000401135 <+65>:    movslq %ebx,%rax
   0x0000000000401138 <+68>:    mov    (%rsp,%rax,4),%eax
   0x000000000040113b <+71>:    cmp    %eax,0x0(%rbp)
   0x000000000040113e <+74>:    jne    0x401145 <phase_6+81>
   0x0000000000401140 <+76>:    call   0x40143a <explode_bomb>
   0x0000000000401145 <+81>:    add    $0x1,%ebx
   0x0000000000401148 <+84>:    cmp    $0x5,%ebx
   0x000000000040114b <+87>:    jle    0x401135 <phase_6+65>
   0x000000000040114d <+89>:    add    $0x4,%r13
   0x0000000000401151 <+93>:    jmp    0x401114 <phase_6+32>
   0x0000000000401153 <+95>:    lea    0x18(%rsp),%rsi
   0x0000000000401158 <+100>:   mov    %r14,%rax
   0x000000000040115b <+103>:   mov    $0x7,%ecx
--Type <RET> for more, q to quit, c to continue without paging--
   0x0000000000401160 <+108>:   mov    %ecx,%edx
   0x0000000000401162 <+110>:   sub    (%rax),%edx
   0x0000000000401164 <+112>:   mov    %edx,(%rax)
   0x0000000000401166 <+114>:   add    $0x4,%rax
   0x000000000040116a <+118>:   cmp    %rsi,%rax
   0x000000000040116d <+121>:   jne    0x401160 <phase_6+108>
   0x000000000040116f <+123>:   mov    $0x0,%esi
   0x0000000000401174 <+128>:   jmp    0x401197 <phase_6+163>
   0x0000000000401176 <+130>:   mov    0x8(%rdx),%rdx
   0x000000000040117a <+134>:   add    $0x1,%eax
   0x000000000040117d <+137>:   cmp    %ecx,%eax
   0x000000000040117f <+139>:   jne    0x401176 <phase_6+130>
   0x0000000000401181 <+141>:   jmp    0x401188 <phase_6+148>
   0x0000000000401183 <+143>:   mov    $0x6032d0,%edx
   0x0000000000401188 <+148>:   mov    %rdx,0x20(%rsp,%rsi,2)
   0x000000000040118d <+153>:   add    $0x4,%rsi
   0x0000000000401191 <+157>:   cmp    $0x18,%rsi
   0x0000000000401195 <+161>:   je     0x4011ab <phase_6+183>
   0x0000000000401197 <+163>:   mov    (%rsp,%rsi,1),%ecx
   0x000000000040119a <+166>:   cmp    $0x1,%ecx
   0x000000000040119d <+169>:   jle    0x401183 <phase_6+143>
   0x000000000040119f <+171>:   mov    $0x1,%eax
   0x00000000004011a4 <+176>:   mov    $0x6032d0,%edx
   0x00000000004011a9 <+181>:   jmp    0x401176 <phase_6+130>
   0x00000000004011ab <+183>:   mov    0x20(%rsp),%rbx
   0x00000000004011b0 <+188>:   lea    0x28(%rsp),%rax
   0x00000000004011b5 <+193>:   lea    0x50(%rsp),%rsi
   0x00000000004011ba <+198>:   mov    %rbx,%rcx
   0x00000000004011bd <+201>:   mov    (%rax),%rdx
   0x00000000004011c0 <+204>:   mov    %rdx,0x8(%rcx)
   0x00000000004011c4 <+208>:   add    $0x8,%rax
   0x00000000004011c8 <+212>:   cmp    %rsi,%rax
   0x00000000004011cb <+215>:   je     0x4011d2 <phase_6+222>
   0x00000000004011cd <+217>:   mov    %rdx,%rcx
   0x00000000004011d0 <+220>:   jmp    0x4011bd <phase_6+201>
   0x00000000004011d2 <+222>:   movq   $0x0,0x8(%rdx)
   0x00000000004011da <+230>:   mov    $0x5,%ebp
   0x00000000004011df <+235>:   mov    0x8(%rbx),%rax
   0x00000000004011e3 <+239>:   mov    (%rax),%eax
--Type <RET> for more, q to quit, c to continue without paging--
   0x00000000004011e5 <+241>:   cmp    %eax,(%rbx)
   0x00000000004011e7 <+243>:   jge    0x4011ee <phase_6+250>
   0x00000000004011e9 <+245>:   call   0x40143a <explode_bomb>
   0x00000000004011ee <+250>:   mov    0x8(%rbx),%rbx
   0x00000000004011f2 <+254>:   sub    $0x1,%ebp
   0x00000000004011f5 <+257>:   jne    0x4011df <phase_6+235>
   0x00000000004011f7 <+259>:   add    $0x50,%rsp
   0x00000000004011fb <+263>:   pop    %rbx
   0x00000000004011fc <+264>:   pop    %rbp
   0x00000000004011fd <+265>:   pop    %r12
   0x00000000004011ff <+267>:   pop    %r13
   0x0000000000401201 <+269>:   pop    %r14
   0x0000000000401203 <+271>:   ret
End of assembler dump.
```

먼저:

```text
call read_six_numbers
```

가 있으므로 숫자 6개를 입력합니다.

이후 반복적으로 입력값을 검사하는 부분을 확인한 결과:

```text
모든 숫자는 1~6
6개의 숫자는 서로 중복되면 안 됨
```

이라는 조건을 확인했습니다.

따라서 입력은 1~6의 순열입니다.

### 17.1 입력값 변환

중간에는 다음 코드가 있었습니다.

```text
mov $0x7,%ecx
mov %ecx,%edx
sub (%rax),%edx
mov %edx,(%rax)
```

즉 모든 입력값에:

```text
7 - 입력값
```

연산을 수행합니다.

따라서:

```text
1 → 6
2 → 5
3 → 4
4 → 3
5 → 2
6 → 1
```

로 변환됩니다.

### 17.2 연결 리스트 노드 확인

코드에서:

```text
mov $0x6032d0,%edx
```

가 사용되고 있었습니다.

실제 메모리를 확인했습니다.

```text
x/12gx 0x6032d0
```

결과:

Node Value Index

| node1 | 332 | 1 |
| --- | --- | --- |
| node2 | 168 | 2 |
| node3 | 924 | 3 |
| node4 | 691 | 4 |
| node5 | 477 | 5 |
| node6 | 443 | 6 |

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 17](/assets/images/tistory-bomblab-17.png)

마지막 부분에서는 현재 노드의 value와 다음 노드의 value를 비교합니다.

조건은:

```text
현재 노드 value ≥ 다음 노드 value
```

이므로 노드의 값이 **내림차순**&#8203;이 되어야 합니다.

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

입니다.

하지만 앞에서 입력값에 7-x가 적용되므로 역으로 계산했습니다.

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

가 됩니다.

---

## 18. BombLab 올클리어

최종적으로 사용한 입력값은 다음과 같습니다.

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

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 18](/assets/images/tistory-bomblab-18.png)

이를 통해 Phase 1부터 Phase 6까지 모든 통과 조건을 GDB로 분석하고 BombLab을 올클리어했습니다.

---

## 19. explode\_bomb 함수 분석

이제 프로젝트의 마지막 목표인 **바이너리 패치**&#8203;를 진행했습니다.

먼저 Bomb이 실제로 어떤 함수에서 동작하는지 확인했습니다.

```text
disassemble explode_bomb
```

원본 함수는 다음과 같은 구조였습니다.

```text
0x40143a <+0>:  sub  $0x8,%rsp
...
call puts@plt
...
call puts@plt
...
call exit@plt
```

즉 explode\_bomb가 호출되면 메시지를 출력한 뒤 최종적으로 exit()를 호출하여 프로그램을 종료합니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 19](/assets/images/tistory-bomblab-19.png)

---

## 20. 패치 전 정상 동작 확인

패치 효과를 확실하게 확인하기 위해 원본 BombLab을 별도의 디렉터리에 다시 압축 해제하여 테스트했습니다.

```text
mkdir -p ~/bomblab/original

tar -xf ~/bomblab/bomb.tar -C ~/bomblab/original
```

원본을 실행했습니다.

```text
cd ~/bomblab/original/bomb
./bomb
```

Phase 1에서 일부러 틀린 문자열을 입력했습니다.

```text
hello
```

결과:

```text
BOOM!!!
The bomb has blown up.
```

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 20](/assets/images/tistory-bomblab-20.png)

따라서 패치 전에는 잘못된 입력이 들어오면 정상적으로 explode\_bomb()가 실행된다는 것을 확인했습니다.

---

## 21. 바이너리 패치 방법 결정

여러 Phase를 확인하면서 곳곳에:

```text
call explode_bomb
```

가 존재한다는 것을 확인했습니다.

처음에는 각각의 call explode\_bomb를 수정하는 방법도 생각할 수 있었습니다.

하지만 그렇게 하면 수정해야 할 위치가 많습니다.

따라서 이번에는 **explode\_bomb 함수 자체의 시작 명령어를 ret로 변경하는 방법**&#8203;을 선택했습니다.

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

하도록 만드는 방식입니다.

BombLab 어셈블리 패치 참고 글에서는 call explode\_bomb를 NOP으로 채우는 방식도 사용하고 있었지만, 이번 실습에서는 여러 호출 지점을 각각 수정하지 않고 **함수의 진입점 자체를 ret로 변경하는 방식**&#8203;을 사용했습니다.

---

## 22. 원본 Opcode 확인

explode\_bomb의 시작 주소는:

```text
0x40143a
```

였습니다.

실제 기계어 바이트를 확인했습니다.

```text
x/8xb 0x40143a
```

결과:

```text
0x48 0x83 0xec 0x08 ...
```

가 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 21](/assets/images/tistory-bomblab-21.png)

앞의:

```text
48 83 ec 08
```

은 기존 첫 번째 명령:

```text
sub $0x8,%rsp
```

의 기계어였습니다.

---

## 23. GDB에서 바이너리 쓰기 허용

GDB에서 바이너리에 직접 쓰기 위해:

```text
set write on
```

을 실행했습니다.

그리고 실행 파일을 다시 로드했습니다.

```text
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

를 입력했습니다.

---

## 24. explode\_bomb를 ret로 패치

x86에서 ret의 Opcode는:

```text
0xC3
```

입니다.

따라서 explode\_bomb 시작 주소의 첫 바이트를 다음과 같이 수정했습니다.

```text
set {unsigned char}0x40143a = 0xc3
```

즉:

```text
패치 전 : 0x48
패치 후 : 0xC3
```

로 변경했습니다.

---

## 25. 패치된 바이트 확인

패치 이후 다시 메모리를 확인했습니다.

```text
x/8xb 0x40143a
```

결과:

```text
0xc3 0x83 0xec 0x08 ...
```

로 첫 바이트가 0xC3로 변경된 것을 확인할 수 있었습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 22](/assets/images/tistory-bomblab-22.png)

---

## 26. Disassembly를 이용한 패치 확인

실제 어셈블리도 변경되었는지 확인했습니다.

```text
disassemble explode_bomb
```

패치 전에는:

```text
0x40143a <+0>: sub $0x8,%rsp
```

였지만 패치 이후:

```text
0x40143a <+0>: ret
```

로 변경되어 있었습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 23](/assets/images/tistory-bomblab-23.png)

따라서 explode\_bomb가 호출되더라도 함수 내부의 메시지 출력이나 exit()까지 도달하지 않고 바로 호출한 위치로 복귀하게 됩니다.

---

## 27. 패치 과정 중 발생한 오류

패치를 완료한 뒤 같은 GDB 세션에서 바로:

```text
run
```

을 실행했습니다.

그런데 다음 오류가 발생했습니다.

```text
Text file busy
During startup program exited with code 126.
```

처음에는 바이너리 패치가 잘못된 것인지 생각했습니다.

하지만 GDB에서 바이너리를 쓰기 가능한 상태로 열어 수정한 직후 동일한 파일을 실행하려 했기 때문에 발생한 문제였습니다.

따라서:

```text
quit
```

으로 GDB를 완전히 종료했습니다.

그 후 다시:

```text
gdb ./bomb
```

으로 바이너리를 로드했습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 24](/assets/images/tistory-bomblab-24.png)

---

## 28. 실제 바이너리에 패치가 저장되었는지 확인

GDB를 완전히 종료한 뒤 새로 실행하면 메모리의 임시 변경사항이었다면 원본으로 돌아와야 합니다.

따라서 다시:

```text
disassemble explode_bomb
```

를 확인했습니다.

그런데 GDB를 새로 실행했음에도:

```text
0x40143a <+0>: ret
```

가 그대로 남아 있었습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 25](/assets/images/tistory-bomblab-25.png)

이를 통해 단순히 실행 중 메모리만 임시로 수정한 것이 아니라 **실제 bomb 바이너리에 패치가 저장되었다는 것을 확인했습니다.**

---

## 29. 패치 후 오답 입력 테스트

마지막으로 패치가 실제로 동작하는지 검증했습니다.

다시 프로그램을 실행했습니다.

```text
run
```

그리고 패치 전과 동일하게 Phase 1에 일부러:

```text
hello
```

를 입력했습니다.

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

이 출력됐습니다.

![BombLab 올클리어 &amp; 바이너리 패치 수행 원문 이미지 26](/assets/images/tistory-bomblab-26.png)

여기서 hello가 Phase 1의 새로운 정답이 된 것은 아닙니다.

실제 흐름은 다음과 같습니다.

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

따라서 explode\_bomb 함수가 제대로 무력화된 것을 확인할 수 있었습니다.

---

## 30. 패치 전후 비교

구분 패치 전 패치 후

| 입력 | hello | hello |
| --- | --- | --- |
| Phase 1 조건 | 실패 | 실패 |
| explode_bomb 호출 | O | O |
| 함수 첫 명령 | sub $0x8,%rsp | ret |
| BOOM!!! 출력 | O | X |
| exit() 실행 | O | X |
| 이후 코드 실행 | X | O |

결국 동일한 오답을 입력했지만 explode\_bomb 함수의 첫 바이트를 수정하는 것만으로 프로그램의 동작이 달라지는 것을 직접 확인했습니다.

---

## 31. Phase별 분석 결과 정리

Phase 주요 분석 내용 입력

| Phase 1 | 문자열 비교 | Border relations with Canada have never been better. |
| --- | --- | --- |
| Phase 2 | 이전 값의 2배가 다음 값인 수열 | 1 2 4 8 16 32 |
| Phase 3 | Jump Table / switch 구조 | 0 207 |
| Phase 4 | 재귀 함수 / 이진 탐색 형태 | 7 0 |
| Phase 5 | ASCII 하위 4비트 / Lookup Table | ionefg |
| Phase 6 | 연결 리스트 / 노드 value 내림차순 | 4 3 2 1 6 5 |

---

## 32. 실습하면서 어려웠던 점

처음에는 어셈블리 코드 자체가 익숙하지 않아 mov, cmp, jmp 같은 각각의 명령어가 무엇을 의미하는지 공부를 하고 보아도 확인하는 데 시간이 걸렸습니다.

하지만 Phase를 계속 분석하면서 모든 어셈블리 코드를 처음부터 끝까지 완벽하게 해석하려고 하기보다는

```text
어떤 값을 가져오는가?
        ↓
무엇과 비교하는가?
        ↓
어떤 조건에서 점프하는가?
        ↓
explode_bomb는 언제 실행되는가?
```

의 순서로 보는 것이 훨씬 이해하기 쉬웠습니다.

특히 Phase 3에서:

```text
jmp *0x402470(,%rax,8)
```

와 같은 코드를 처음 보았을 때는 일반적인 jmp와 달라 이해하기 어려웠지만, GDB로 0x402470 메모리를 직접 확인하면서 Jump Table이라는 것을 알 수 있었습니다.

Phase 5에서는 문자열 자체를 비교하는 것이 아니라 입력 문자의 하위 4비트만 사용한다는 점이 헷갈렸습니다.

Phase 6은 가장 복잡했는데:

```text
6개 숫자 입력
→ 범위 및 중복 검사
→ 7-x 변환
→ Node 선택
→ 연결 리스트 재구성
→ Node value 비교
```

까지 여러 과정을 연결해서 생각해야 했습니다.

그래서 GDB에서 실제 Node 메모리를 직접 출력하고 Value를 하나씩 확인한 뒤 정렬하여 입력값을 역산했습니다.

---

## 33. 바이너리 패치를 통해 알게 된 점

이번 프로젝트에서 가장 인상 깊었던 부분은 마지막 바이너리 패치였습니다.

처음에는 프로그램의 동작을 바꾸기 위해 많은 부분을 수정해야 할 것이라고 생각했지만, 실제로는 explode\_bomb 함수 시작 주소의 **단 1바이트**&#8203;를:

```text
0x48 → 0xC3
```

로 변경하여 함수의 동작 자체를 크게 바꿀 수 있었습니다.

특히 0xC3가 단순히 숫자가 아니라 CPU가 ret 명령으로 해석하는 실제 Opcode라는 점을 직접 확인할 수 있었습니다.

그리고 패치 후 disassemble을 다시 실행하자

```text
ret
```

가 실제로 출력되는 것을 보면서 소스 코드가 아니라 **기계어를 직접 수정하는 것이 바이너리 패치라는 점을 이해할 수 있었습니다.**

---

## 34. 실습을 통해 배운 점

이번 실습에서는 IDA 없이 순정 GDB만 사용했기 때문에 처음에는 분석이 어렵게 느껴졌습니다.

하지만 직접 레지스터와 메모리를 확인하면서 프로그램이 실제로 어떤 방식으로 동작하는지를 더 자세히 볼 수 있었습니다.

특히 다음 흐름을 반복적으로 확인하면서 어셈블리 코드를 읽는 감을 익힐 수 있었습니다.

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

Phase 6에서는 연결 리스트까지 서로 다른 형태의 로직을 어셈블리 수준에서 확인할 수 있었습니다.

또한 마지막에는 explode\_bomb의 Opcode를 직접 변경하여 **프로그램의 실행 흐름을 바이너리 수준에서 변경하는 경험**&#8203;도 할 수 있었습니다.

단순히 BombLab의 정답을 외워서 통과하는 것이 아니라, 왜 해당 값이 정답인지 직접 어셈블리와 메모리를 통해 확인했다는 점에서 의미가 있었습니다.

---

이렇게 BombLab의 Phase 1부터 Phase 6까지 직접 분석하여 올클리어하고,

마지막에는 explode\_bomb 함수의 Opcode를 수정하는 바이너리 패치까지 진행해 보았습니다.

처음에는 GDB에 나오는 어셈블리 코드를 어떻게 해석해서 정답을 찾아야 할지 막막했습니다. 필요한 명령어를 공부하고 cmp, test, 조건 분기 등을 따라가다 보니 프로그램의 흐름이 조금씩 보이기 시작했습니다.

각 Phase를 분석하면서 문자열 비교부터 수열, Jump Table, 재귀 함수, 비트 연산과 Lookup Table, 연결 리스트까지 정말 다양한 구조를 직접 확인해볼 수 있었고, 단순히 정답만 입력해서 통과하는 것이 아니라 **왜 이 값이 정답이 되는지를 어셈블리와 메모리를 통해 직접 찾아냈다는 점**&#8203;에서 더 의미 있었던 것 같아요.

가장 기억에 남았던 과정은 마지막 바이너리 패치였습니다.

explode\_bomb 함수의 첫 번째 Opcode를 0x48 → 0xC3 로 단 1바이트 변경했을 뿐인데,

함수의 첫 명령어가 ret로 바뀌면서 원래라면 BOOM!!!이 출력되고 프로그램이 종료되어야 하는 상황에서 바로 복귀하도록

프로그램의 동작 자체가 달라지는 것을 확인할 수 있었습니다.

특히 패치 전과 패치 후에 똑같이 hello라는 오답을 입력해보면서 실제 실행 결과가 달라지는 것까지 직접 확인할 수 있어서,

**바이너리 패치가 무엇인지 조금 더 확실하게 이해할 수 있었던 것 같습니다.**

중간중간 이해하기 어려운 어셈블리도 있었고 패치 과정에서 오류도 발생해 생각보다 쉽지만은 않았습니다.

하나씩 원인을 찾아가며 해결하다 보니 처음보다 GDB와 어셈블리 코드가 조금 덜 낯설어졌습니다.

이번 프로젝트에서는 x86-64 어셈블리를 실제 바이너리 분석에 적용하고, 프로그램의 실행 흐름을 직접 추적하는 과정부터 Opcode를 수정해 실행 흐름을 바꾸는 과정까지 경험할 수 있었습니다.

프로젝트를 마무리한 뒤에는 리버싱과 시스템 분야를 더 공부해 보고 싶다는 생각도 들었습니다.

BombLab을 공부하고 각 Phase를 클리어해 나간 과정은 여기서 마무리하겠습니다.


![다운로드.jfif](/assets/images/tistory-bomblab-27.jpg)

읽어주셔서 감사합니다. (꾸벅)
