---
title: "CodeQL 원리와 사용법 분석 및 취약점 탐지 실습"
date: 2026-08-16
recordOrder: 19
categories: ["Bug Bounty"]
tags: ["CodeQL", "SAST", "Python", "Security"]
description: "CodeQL의 동작 원리를 살펴보고 취약한 Python 코드의 Source → Sink 데이터 흐름을 탐지한 실습 기록입니다."
---
안녕하세요. somani입니다!

이번에는 정적 분석 도구인 CodeQL의 원리와 사용법을 살펴보고, 간단한 취약 코드를 작성해 취약점 탐지 실습을 진행해 보려고 합니다. 취약 예제 작성에는 도움을 일부 받았습니다.

처음에는 CodeQL을 단순히 코드에서 취약한 부분을 찾아주는 도구라고 생각했습니다. 실제로는 소스 코드를 데이터베이스로 만들고 쿼리를 작성해 코드 구조와 데이터 흐름을 분석한다는 점이 흥미로웠습니다. 기본 개념부터 Python Command Injection 예제의 **위험 함수 탐지와 Source → Sink 데이터 흐름 분석**까지 차례대로 살펴보겠습니다.

---

### 1. 프로젝트 개요

이번 프로젝트의 목표는 CodeQL의 기본적인 동작 원리를 이해하고, 직접 취약한 코드를 작성한 뒤 CodeQL을 이용하여 취약한 데이터 흐름을 탐지해보는 것입니다.

단순히 CodeQL을 설치하고 기본 쿼리를 실행하는 것에서 끝내지 않고 다음 과정을 직접 진행했습니다.

- CodeQL CLI 환경 구축
- 의도적으로 취약한 Python 코드 작성
- Command Injection 동작 확인
- CodeQL Database 생성
- 직접 QL Query 작성
- 위험 함수 탐지
- Source → Sink 데이터 흐름 분석
- 실습 중 발생한 오류 분석 및 해결
- 취약 코드 수정
- 수정 전/후 CodeQL 분석 결과 비교

---

## 2. CodeQL이란?

CodeQL은 소스 코드를 데이터처럼 질의할 수 있도록 만들어진 정적 분석 도구입니다.

일반적인 문자열 검색은 특정 함수나 문자열이 코드에 존재하는지만 찾을 수 있지만, CodeQL은 프로그램의 구조와 데이터 흐름 등을 분석해 보다 복잡한 보안 문제를 탐지할 수 있습니다.

기본적인 분석 과정은 다음과 같습니다.

```text
Source Code
    ↓
CodeQL Extractor
    ↓
CodeQL Database
    ↓
QL Query 실행
    ↓
분석 결과
```

즉, 분석할 소스 코드로부터 CodeQL Database를 생성하고, 해당 데이터베이스에 QL Query를 실행하여 원하는 코드 패턴이나 데이터 흐름을 탐색합니다.

---

## 3. CodeQL의 주요 개념

### 3.1 정적 분석

정적 분석은 프로그램을 실제로 실행하지 않고 소스 코드나 바이너리 등의 구조를 분석하는 방법입니다.

CodeQL은 소스 코드를 분석 가능한 데이터베이스 형태로 변환한 뒤 쿼리를 실행하여 취약한 코드 패턴이나 데이터 흐름을 찾을 수 있습니다.

### 3.2 CodeQL Database

CodeQL은 소스 코드에 직접 SQL을 실행하는 방식이 아닙니다.

언어별 Extractor가 소스 코드를 분석하여 프로그램에 대한 정보를 CodeQL Database에 저장합니다.

여기에는 코드의 구문 구조, 함수 호출 관계, 변수와 표현식, 데이터 흐름 분석에 필요한 정보 등이 포함될 수 있습니다.

이번 실습에서는 Python 코드를 대상으로 데이터베이스를 생성했습니다.

### 3.3 QL

QL은 CodeQL Database에 질의를 수행하기 위한 객체지향 쿼리 언어입니다.

예를 들어 특정 함수 호출을 찾거나, 특정한 Source에서 발생한 데이터가 위험한 Sink까지 전달되는지 분석하는 쿼리를 작성할 수 있습니다.

### 3.4 AST와 CFG

#### AST (Abstract Syntax Tree)

소스 코드의 문법적 구조를 트리 형태로 표현한 것입니다.

예를 들어 다음 코드가 존재한다고 가정해 보겠습니다.

```text
os.system(user_input)
```

이를 단순한 문자열로 보는 것이 아니라 함수 호출과 인자 등의 구조적인 요소로 분석할 수 있습니다.

#### CFG (Control Flow Graph)

프로그램의 실행 흐름을 그래프로 표현합니다.

조건문이나 반복문 등이 있을 때 어떤 코드가 다음에 실행될 수 있는지 분석하는 데 사용됩니다.

### 3.5 Data Flow

Data Flow 분석은 데이터가 프로그램 내부에서 어디에서 생성되고 어디로 이동하는지 분석하는 것입니다.

이번 실습에서는 다음과 같은 흐름을 분석했습니다.

```text
input()
   ↓
user_input
   ↓
os.system(user_input)
```

### 3.6 Source와 Sink

보안 분석에서는 데이터 흐름의 시작점과 위험한 도착점을 각각 Source와 Sink로 표현할 수 있습니다.

이번 실습에서는 다음과 같이 정의했습니다.

**Source**

```text
input()
```

사용자가 직접 데이터를 입력할 수 있으므로 공격자가 제어할 가능성이 있는 데이터의 시작점!

**Sink**

```text
os.system()
```

전달받은 문자열을 운영체제 명령으로 실행할 수 있기 때문에 신뢰할 수 없는 데이터가 전달될 경우 위험한 동작으로 이어질 수 있습니다.

따라서 이번 실습의 핵심 분석 대상은 다음과 같습니다.

```text
Source
input()
   ↓
Data Flow
   ↓
Sink
os.system()
```

---

## 4. CodeQL CLI 환경 구축

CodeQL CLI Windows 버전을 다운로드하고 압축을 해제했습니다.

압축을 해제하니 다음과 같이 여러 언어의 분석 도구와 `codeql.exe`를 확인할 수 있었습니다.

```text
codeql
├── cpp
├── csharp
├── go
├── java
├── javascript
├── python
├── ruby
├── rust
├── ...
└── codeql.exe
```

정상적으로 실행되는지 확인하기 위해 다음 명령을 사용했습니다.

```text
.\codeql.exe version
```

실행 결과 설치한 환경에서는 다음과 같이 CodeQL CLI 2.26.3이 확인되었습니다.

```text
CodeQL command-line toolchain release 2.26.3.
```

![스크린샷 2026-08-16 141927.png](/assets/images/tistory-codeql-01.png)

이를 통해 CodeQL CLI가 정상적으로 실행되는 것을 확인했습니다.

---

## 5. 실습 환경 구성

CodeQL 설치 디렉터리와 실습 디렉터리를 다음과 같이 분리했습니다.

```text
프젝
├── codeql
└── codeql-lab
```

codeql에는 CodeQL CLI가 존재하고, codeql-lab에는 분석 대상 코드와 직접 작성한 QL Query를 저장했습니다.

---

## 6. 취약한 Python 코드 작성

CodeQL의 데이터 흐름 분석을 확인하기 위해 의도적으로 Command Injection에 취약한 간단한 Python 프로그램을 작성했습니다. 이 예제를 작성할 때는 도움을 일부 받았습니다.

vulnerable.py

```text
import os

user_input = input("Enter command: ")
os.system(user_input)
```

### 왜 이런 코드를 작성했는가?

이번 실습의 목적은 복잡한 실제 프로그램을 분석하는 것이 아니라 CodeQL이 **사용자 입력에서 위험한 함수까지 이어지는 데이터 흐름을 어떻게 분석하는지 확인하는 것**&#8203;이었습니다.

따라서 Source와 Sink가 명확한 최소한의 코드를 작성했습니다.

#### input()을 사용한 이유

```text
input("Enter command: ")
```

input()의 반환값은 프로그램 외부의 사용자가 직접 결정할 수 있습니다.

따라서 이번 실습에서는 공격자가 제어할 수 있는 데이터가 발생하는 **Source**&#8203;로 사용했습니다.

#### user\_input 변수에 저장한 이유

```text
user_input = input(...)
```

입력값이 변수에 저장되고 다시 다른 함수로 전달되는 구조를 만들어 데이터가 프로그램 내부에서 이동하는 모습을 확인하기 위해 사용했습니다.

즉,

```text
input()
   ↓
user_input
```

이라는 데이터 흐름이 발생합니다.

#### os.system()을 사용한 이유

```text
os.system(user_input)
```

os.system()은 전달받은 문자열을 운영체제 명령으로 실행합니다.

따라서 사용자 입력을 검증하지 않은 채 직접 전달하면 임의의 명령을 실행할 수 있는 Command Injection 문제가 발생할 수 있습니다.

결과적으로 의도한 전체 흐름은 다음과 같습니다.

```text
사용자 입력
   ↓
input()            ← Source
   ↓
user_input
   ↓
os.system()        ← Sink
   ↓
OS 명령 실행
```

이처럼 Source와 Sink가 명확하기 때문에 CodeQL의 Data Flow 분석을 확인하기 위한 작은 예제로 적합하다고 판단했습니다.

---

## 7. Command Injection 동작 확인

작성한 코드가 실제로 입력값을 운영체제 명령으로 실행하는지 확인했습니다.

```text
python .\vulnerable.py
```

프로그램에서 명령을 입력하라는 메시지가 출력된 후 다음 값을 입력했습니다.

```text
whoami
```

실행 결과 Windows의 현재 사용자 정보가 출력됐습니다.

```text
Enter command: whoami
desktop-1b9or7i\minjun
```

출력에 `minjun`이라는 이름이 표시된 이유는 제 컴퓨터가 아니라 가족의 노트북에서 실습했기 때문입니다.

![스크린샷 2026-08-16 142524.png](/assets/images/tistory-codeql-02.png)

이는 사용자가 입력한 문자열이 다음 경로를 통해 운영체제 명령으로 실행되었다는 것을 보여줍니다.

```text
"whoami"
   ↓
input()
   ↓
user_input
   ↓
os.system(user_input)
   ↓
Windows에서 whoami 실행
```

---

## 8. CodeQL Database 생성

다음 단계에서는 vulnerable.py를 CodeQL로 분석하기 위한 데이터베이스를 생성했습니다.

```text
..\codeql\codeql.exe database create my-python-db --language=python --source-root=.
```

생성 과정에서 Python Extractor가 vulnerable.py를 추출하는 것을 확인할 수 있었습니다.

```text
Extracted file ...\codeql-lab\vulnerable.py
```

최종적으로 다음 메시지가 출력됐습니다.

```text
Successfully created database at ...\my-python-db.
```

![스크린샷 2026-08-16 142700.png](/assets/images/tistory-codeql-03.png)

스크린샷에는 메시지 일부가 잘려 있어 전체 출력도 함께 남겼습니다.

```text
PS C:\Users\MinJun\Desktop\프젝\codeql-lab> ..\codeql\codeql.exe database create my-python-db --language=python --source-root=.
Initializing database at C:\Users\MinJun\Desktop\프젝\codeql-lab\my-python-db.
Running build command: []
Running command in C:\Users\MinJun\Desktop\프젝\codeql-lab: [C:\Users\MinJun\Desktop\프젝\codeql\python\tools\autobuild.cmd]
[2026-08-16 14:26:37] [build-stdout] Python 3.13.13
[2026-08-16 14:26:37] [build-stderr] No suitable Python runtime found
[2026-08-16 14:26:37] [build-stderr] Pass --list (-0) to see all detected environments on your machine
[2026-08-16 14:26:37] [build-stderr] or set environment variable PYLAUNCHER_ALLOW_INSTALL to use winget
[2026-08-16 14:26:37] [build-stderr] or open the Microsoft Store to the requested version.
[2026-08-16 14:26:37] [build-stdout] No directories containing root identifiers were found. Returning working directory as root.
[2026-08-16 14:26:37] [build-stdout] Will try to guess Python version, as it was not specified in `lgtm.yml`
[2026-08-16 14:26:37] [build-stdout] Trying to guess Python version based on Trove classifiers in setup.py
[2026-08-16 14:26:37] [build-stdout] Did not find setup.py (expected it to be at C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab\setup.py)
[2026-08-16 14:26:37] [build-stdout] Trying to guess Python version based on travis file
[2026-08-16 14:26:37] [build-stdout] Did not find any travis files (expected them at either ['C:\\Users\\MinJun\\Desktop\\占쏙옙占쏙옙\\codeql-lab\\.travis.yml', 'C:\\Users\\MinJun\\Desktop\\占쏙옙占쏙옙\\codeql-lab\\travis.yml'])
[2026-08-16 14:26:37] [build-stdout] Trying to guess Python version based on installed versions
[2026-08-16 14:26:37] [build-stdout] Wanted to run Python 2, but it is not available. Using Python 3 instead
[2026-08-16 14:26:37] [build-stdout] This script is running Python 3, but Python 2 is also available (as 'py -3')
[2026-08-16 14:26:37] [build-stdout] Could not guess Python version, will use default: Python 3
[2026-08-16 14:26:37] [build-stdout] Calling py -3 -S C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql\python\tools\python_tracer.py --verbosity 3 -z all -c C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab\my-python-db\working\trap_cache -R C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab
[2026-08-16 14:26:38] [build-stdout] Python 3.13.13
[2026-08-16 14:26:38] [build-stdout] INFO: The Python extractor has recently stopped extracting the standard library by default. If you encounter problems, please let us know by submitting an issue to <https://github.com/github/codeql>. It is possible to re-enable extraction of the standard library by setting the environment variable CODEQL_EXTRACTOR_PYTHON_EXTRACT_STDLIB.
[2026-08-16 14:26:38] [build-stdout] [INFO] Extraction will use the Python 3 standard library.
[2026-08-16 14:26:38] [build-stdout] [INFO] sys_path is: ['C:\\Users\\MinJun\\Desktop\\?꾩젥\\codeql\\python\\tools', 'C:\\Users\\MinJun\\anaconda3\\python313.zip', 'C:\\Users\\MinJun\\anaconda3\\DLLs', 'C:\\Users\\MinJun\\anaconda3\\Lib', 'C:\\Users\\MinJun\\anaconda3']

[2026-08-16 14:26:38] [build-stdout] [INFO] Python version 3.13.13
[2026-08-16 14:26:38] [build-stdout] [INFO] Python extractor version 7.1.8
[2026-08-16 14:26:39] [build-stdout] [INFO] [2] Extracted file C:\Users\MinJun\Desktop\?꾩젥\codeql-lab\vulnerable.py in 24ms

[2026-08-16 14:26:39] [build-stdout] [INFO] [5] Skipped built-in file C:\Users\MinJun\anaconda3\Lib\os.py
[2026-08-16 14:26:39] [build-stdout] [INFO] Processed 2 modules in 0.98s
Finalizing database at C:\Users\MinJun\Desktop\프젝\codeql-lab\my-python-db.
Running pre-finalize script C:\Users\MinJun\Desktop\프젝\codeql\python\tools\pre-finalize.cmd in C:\Users\MinJun\Desktop\프젝\codeql-lab.
Running command in C:\Users\MinJun\Desktop\프젝\codeql-lab: [C:\Users\MinJun\Desktop\프젝\codeql\python\tools\pre-finalize.cmd]
[2026-08-16 14:26:40] [build-stderr] Scanning for files in C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab...
[2026-08-16 14:26:40] [build-stderr] C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab\my-python-db: Indexing files in in C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab...
[2026-08-16 14:26:40] [build-stderr] Running command in C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab: [C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql\yaml\tools\index-files.cmd, C:\Users\MinJun\Desktop\占쏙옙占쏙옙\codeql-lab\my-python-db\working\files-to-index15927755449293745022.list]
Pre-finalize script C:\Users\MinJun\Desktop\프젝\codeql\python\tools\pre-finalize.cmd completed in 1765 ms.
Running TRAP import for CodeQL database at C:\Users\MinJun\Desktop\프젝\codeql-lab\my-python-db...
Importing TRAP files
Merging relations
Finished writing database (relations: 41.96 KiB; string pool: 2.06 MiB).
TRAP import complete (2.8s).
Finished zipping source archive (931.00 B).
Successfully created database at C:\Users\MinJun\Desktop\프젝\codeql-lab\my-python-db.
```

중간에 Python runtime 탐색과 관련된 메시지가 출력되었지만, 최종적으로 Python 3 환경을 이용해 파일이 추출되고 데이터베이스 생성이 성공했으므로 DB 생성 자체는 정상적으로 완료된 것으로 판단했습니다.

---

## 9. 첫 번째 QL Query 작성 — os.system 탐지

먼저 복잡한 데이터 흐름 분석을 수행하기 전에 CodeQL Query를 직접 작성하여 os.system() 호출을 찾을 수 있는지 확인했습니다.

find\_os\_system.ql

```text
import python

from Call call, Attribute attr
where
  call.getFunc() = attr and
  attr.getName() = "system" and
  attr.getObject().toString() = "os"
select call, "os.system() call found"
```

이 쿼리는 Python 코드에서 함수 호출을 찾고, 그중 os.system() 형태의 호출을 선택하도록 작성했습니다.

---

## 10. 첫 번째 오류 발생

작성한 Query를 다음과 같이 실행했습니다.

```text
..\codeql\codeql.exe query run .\find_os_system.ql --database=.\my-python-db
```

하지만 처음 실행했을 때 다음 오류가 발생했습니다.

```text
ERROR: could not resolve module python
ERROR: could not resolve type Call
ERROR: could not resolve type Attribute
```

![스크린샷 2026-08-16 143448.png](/assets/images/tistory-codeql-04.png)

처음에는 Query 자체의 문법 문제일 가능성을 생각했지만, python 모듈 자체를 찾지 못하고 있다는 점을 확인했습니다.

커스텀 Query 프로젝트에 Python CodeQL 라이브러리에 대한 의존성 설정이 존재하지 않는 것이 문제였습니다.

---

## 11. qlpack.yml을 이용한 문제 해결

이를 해결하기 위해 실습 디렉터리에 qlpack.yml을 작성했습니다.

```text
name: codeql-lab
version: 0.0.1
dependencies:
  codeql/python-all: "*"
```

여기서

```text
codeql/python-all: "*"
```

은 현재 Query Pack에서 Python 분석에 필요한 CodeQL 라이브러리를 사용하겠다는 의미입니다.

이후 다음 명령을 실행했습니다.

```text
..\codeql\codeql.exe pack install
```

그 결과 codeql/python-all을 포함하여 Data Flow, Control Flow, SSA 등 여러 관련 라이브러리가 설치되었습니다.

![스크린샷 2026-08-16 143807.png](/assets/images/tistory-codeql-05.png)

---

## 12. 위험 함수 탐지 성공

Dependency 설치 후 처음 실행했던 Query를 다시 실행했습니다.

```text
..\codeql\codeql.exe query run .\find_os_system.ql --database=.\my-python-db
```

이번에는 Query가 정상적으로 컴파일 및 실행되었고 다음 결과를 얻었습니다.

```text
os.system() call found
```

![CodeQL 원리와 사용법 분석 및 취약점 탐지 실습 원문 이미지 6](/assets/images/tistory-codeql-06.png)

따라서 직접 작성한 QL Query를 이용하여 Python 코드에 존재하는 위험한 함수 호출을 CodeQL Database에서 찾아낼 수 있었습니다.

다만 여기까지의 분석은 **os.system()이라는 함수 호출이 존재한다는 사실을 탐지한 것입니다.**

os.system()의 존재만으로 모든 코드가 취약하다고 단정할 수는 없습니다.

따라서 다음 단계에서는 실제로 사용자가 제어할 수 있는 데이터가 해당 함수까지 전달되는지를 분석했습니다.

---

## 13. Source → Sink 분석으로 확장

분석하고자 하는 흐름은 다음과 같습니다.

```text
input()
   ↓
user_input
   ↓
os.system(user_input)
```

여기서 input()을 Source, os.system()에 전달되는 명령 인자를 Sink로 정의했습니다.

이를 위해 Global Data Flow를 사용하는 Query를 작성했습니다.

---

## 14. Source/Sink Query 작성 과정에서 발생한 오류

Source/Sink 분석 Query를 처음 작성했을 때 다음 오류가 발생했습니다.

```text
ERROR: DataFlowPublic::Node is incompatible with ApiGraphs::API::Node
```

![CodeQL 원리와 사용법 분석 및 취약점 탐지 실습 원문 이미지 7](/assets/images/tistory-codeql-07.png)

이는 API Graph에서 표현되는 Node와 Data Flow 분석에서 사용하는 Node를 직접 동일하게 사용할 수 없었기 때문에 발생한 문제였습니다.

Source 부분을 Data Flow에서 사용할 수 있도록 수정했습니다.

이후 Sink에도 같은 방식의 변환을 적용하려 했지만 다시 다음 오류가 발생했습니다.

```text
ERROR: asSink() cannot be resolved for type DataFlowPublic::Node
```

![CodeQL 원리와 사용법 분석 및 취약점 탐지 실습 원문 이미지 8](/assets/images/tistory-codeql-08.png)

확인 결과 getACall()을 통해 얻은 호출 노드를 DataFlow::CallCfgNode로 사용하고, 해당 호출의 첫 번째 인자를 getArg(0)으로 직접 Sink로 지정하는 방식으로 수정할 수 있었습니다.

이 과정에서 CodeQL의 API Graph와 Data Flow Graph에서 사용하는 노드가 항상 동일한 방식으로 처리되는 것은 아니라는 점을 확인할 수 있었습니다.

---

## 15. 최종 Source → Sink Query

최종적으로 다음 Query를 사용했습니다.

```text
import python
import semmle.python.dataflow.new.DataFlow
import semmle.python.ApiGraphs

module CommandInjectionConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source = API::builtin("input").getReturn().asSource()
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallCfgNode call |
      call = API::moduleImport("os").getMember("system").getACall() and
      sink = call.getArg(0)
    )
  }
}

module CommandInjectionFlow = DataFlow::Global<CommandInjectionConfig>;

from DataFlow::Node source, DataFlow::Node sink
where CommandInjectionFlow::flow(source, sink)
select source, sink, "User-controlled input flows into os.system()."
```

#### Source 정의

```text
source = API::builtin("input").getReturn().asSource()
```

Python의 input() 반환값을 Source로 정의했습니다.

즉, 사용자가 입력하여 프로그램 내부로 들어오는 데이터의 시작점입니다.

#### Sink 정의

```text
call = API::moduleImport("os").getMember("system").getACall()
```

os.system() 호출을 찾습니다.

그리고

```text
sink = call.getArg(0)
```

을 통해 os.system()에 전달되는 첫 번째 인자를 Sink로 설정했습니다.

실습 코드에서는 다음 부분입니다.

```text
os.system(user_input)
          ^^^^^^^^^^
          Sink
```

#### Global Data Flow

```text
CommandInjectionFlow::flow(source, sink)
```

Source에서 Sink까지 데이터가 전달될 수 있는지를 분석합니다.

---

## 16. Source → Sink 탐지 성공

수정한 Query를 실행했습니다.

```text
..\codeql\codeql.exe query run .\source_to_sink.ql --database=.\my-python-db
```

이번에는 정상적으로 Query가 실행되었습니다.

결과에는 다음과 같은 내용이 출력됐습니다.

```text
source:
ControlFlowNode for input()

sink:
ControlFlowNode for user_input

User-controlled input flows into os.system().
```

![CodeQL 원리와 사용법 분석 및 취약점 탐지 실습 원문 이미지 9](/assets/images/tistory-codeql-09.png)

따라서 CodeQL이 다음 흐름을 분석할 수 있음을 확인했습니다.

```text
input()
   │
   │ 사용자 제어 데이터
   ▼
user_input
   │
   │ Global Data Flow
   ▼
os.system(user_input)
```

단순히 os.system()이라는 함수가 존재한다는 사실을 찾는 것에서 더 나아가, **사용자가 제어하는 데이터가 해당 함수의 명령 인자까지 도달한다는 것을 분석한 것**&#8203;입니다.

---

## 17. 취약 코드 수정

탐지 결과를 확인한 후 취약한 코드를 수정했습니다.

기존 코드는 다음과 같았습니다.

```text
import os

user_input = input("Enter command: ")
os.system(user_input)
```

문제는 사용자 입력값을 검증하지 않고 그대로 OS 명령 실행 함수에 전달한다는 점입니다.

따라서 수정 버전에서는 os.system()을 제거하고 프로그램에서 허용하는 동작만 내부적으로 처리하도록 변경했습니다.

safe.py

```text
user_input = input("Enter action (whoami/date): ")

if user_input == "whoami":
    print("User information requested.")
elif user_input == "date":
    print("Date information requested.")
else:
    print("Invalid action.")
```

수정 전에는 다음과 같은 구조였습니다.

```text
사용자 입력
   ↓
os.system()
   ↓
임의 OS 명령 실행 가능
```

수정 후에는 다음과 같습니다.

```text
사용자 입력
   ↓
허용된 값 확인
   ↓
프로그램 내부 기능 수행
```

이번 예제에서는 특정 문자를 blacklist로 차단하는 방식이 아니라 **외부 입력을 shell 명령으로 실행하는 구조 자체를 제거**&#8203;했습니다.

---

## 18. 수정 코드 재분석

취약한 코드와 수정된 코드의 분석 결과를 정확히 비교하기 위해 safe.py만 포함하는 별도의 디렉터리를 만들었습니다.

```text
mkdir safe-version
copy .\safe.py .\safe-version\safe.py
```

그리고 새로운 CodeQL Database를 생성했습니다.

```text
..\codeql\codeql.exe database create safe-python-db --language=python --source-root=.\safe-version
```

데이터베이스 생성 후 **취약 버전에서 사용했던 것과 동일한 Source → Sink Query**&#8203;를 실행했습니다.

```text
..\codeql\codeql.exe query run .\source_to_sink.ql --database=.\safe-python-db
```

결과는 다음과 같이 헤더만 출력되고 탐지된 데이터 흐름은 존재하지 않았습니다.

```text
| source | sink | col2 |
+--------+------+------+
```

![CodeQL 원리와 사용법 분석 및 취약점 탐지 실습 원문 이미지 10](/assets/images/tistory-codeql-10.png)

---

## 19. 수정 전 / 수정 후 비교

| 항목 | 취약 버전 | 수정 버전 |
| --- | --- | --- |
| 사용자 입력 | input() | input() |
| OS 명령 실행 | os.system() 사용 | 사용하지 않음 |
| 사용자 입력 → OS 명령 | 존재 | 존재하지 않음 |
| CodeQL Source → Sink 결과 | 탐지됨 | 탐지되지 않음 |
| Command Injection 구조 | 존재 | 제거 |

분석 결과를 정리하면 다음과 같습니다.

```text
[Before]

input()
   ↓
user_input
   ↓
os.system(user_input)
   ↓
CodeQL 탐지
```

```text
[After]

input()
   ↓
조건 검사
   ↓
프로그램 내부 처리

os.system() 없음
   ↓
동일 Query에서 결과 없음
```

이를 통해 단순히 코드를 수정하는 데서 끝내지 않고, **동일한 CodeQL Query를 다시 실행하여 기존에 탐지되었던 Source → Sink 경로가 제거되었음을 확인했습니다.**

---

## 20. 트러블슈팅 정리

이번 실습에서는 여러 번의 오류가 발생했습니다.

### 문제 1. Python Module을 찾지 못함

오류:

```text
could not resolve module python
could not resolve type Call
could not resolve type Attribute
```

#### 원인

커스텀 QL Query에서 사용하는 Python CodeQL Library Dependency가 설정되지 않았습니다.

#### 해결

qlpack.yml 생성:

```text
name: codeql-lab
version: 0.0.1
dependencies:
  codeql/python-all: "*"
```

이후:

```text
..\codeql\codeql.exe pack install
```

을 실행하여 필요한 라이브러리를 설치했습니다.

---

### 문제 2. API Node와 DataFlow Node 타입 불일치

오류:

```text
DataFlowPublic::Node is incompatible with ApiGraphs::API::Node
```

#### 원인

API Graph에서 얻은 Node를 Data Flow 분석에서 요구하는 Node와 직접 동일하게 사용하려 했습니다.

#### 해결

Source를 Data Flow 분석에 사용할 수 있는 형태로 연결하도록 Query를 수정했습니다.

---

### 문제 3. asSink() 사용 오류

오류:

```text
asSink() cannot be resolved for type DataFlowPublic::Node
```

#### 원인

이미 Data Flow Node로 얻은 호출 인자에 적절하지 않은 변환을 다시 적용했습니다.

#### 해결

DataFlow::CallCfgNode로 os.system() 호출을 찾고,

```text
sink = call.getArg(0)
```

을 사용하여 첫 번째 인자를 직접 Sink로 지정했습니다.

---

## 21. 단순 문자열 검색과 CodeQL의 차이

이번 실습에서 가장 중요한 차이를 확인할 수 있었습니다.

단순한 문자열 검색을 사용한다면 다음 정도만 확인할 수 있습니다.

```text
"os.system"이라는 문자열이 존재하는가?
```

하지만 이것만으로 해당 코드가 실제로 외부 입력의 영향을 받는지는 판단하기 어렵습니다.

CodeQL에서는 다음과 같은 질문을 Query로 표현할 수 있습니다.

```text
사용자가 제어할 수 있는 데이터가
        ↓
프로그램 내부에서 이동하여
        ↓
위험한 함수의 인자까지 도달하는가?
```

이번 실습에서는 실제로 input()과 os.system() 사이의 데이터 흐름을 분석했습니다.

따라서 CodeQL의 장점은 단순한 텍스트 검색보다는 **프로그램의 구조와 데이터 흐름을 이용해 보안상 의미가 있는 관계를 분석할 수 있다는 점**&#8203;이라고 볼 수 있습니다.

---

## 22. CodeQL의 장점과 한계

### 장점

첫째, 대규모 코드에서 사람이 모든 파일을 직접 확인하지 않고도 특정 취약점 패턴을 자동으로 탐색할 수 있습니다.

둘째, 단순 함수 존재 여부뿐 아니라 Data Flow 분석을 통해 데이터가 어디에서 어디로 전달되는지 분석할 수 있습니다.

셋째, 원하는 보안 조건을 직접 QL Query로 정의하여 프로젝트에 맞는 분석을 수행할 수 있습니다.

넷째, 반복적인 보안 분석을 자동화하는 데 활용할 수 있습니다.

### 한계

CodeQL이 모든 취약점을 자동으로 완벽하게 판단하는 것은 아닙니다.

어떤 데이터를 Source로 볼 것인지, 어떤 동작을 Sink로 볼 것인지 등의 모델링이 중요합니다.

또한 직접 Query를 작성할 경우 대상 언어에 대한 이해뿐만 아니라 CodeQL의 라이브러리와 Data Flow 모델을 이해해야 합니다.

이번 실습에서도 API Node와 Data Flow Node의 차이를 제대로 이해하지 못했을 때 타입 오류가 발생했습니다.

따라서 분석 결과를 무조건 취약점이라고 판단하기보다는 개발자나 보안 분석가가 결과를 다시 검토하는 과정이 필요합니다.

---

## 23. 실습을 통해 알게 된 점

처음에는 CodeQL을 단순히 취약한 함수를 검색하는 도구 정도로 생각했습니다.

그러나 직접 실습하면서 CodeQL의 핵심은 단순 문자열 검색이 아니라 **소스 코드를 분석 가능한 데이터베이스로 변환하고, 프로그램의 구조와 데이터 흐름을 Query로 분석하는 것**&#8203;이라는 점을 알게 됐습니다.

특히 처음에는 단순히 os.system()을 찾는 Query를 작성했지만, 이후 Source와 Sink를 정의하여 input()의 반환값이 os.system()의 인자까지 전달되는지를 분석하면서 Data Flow 분석의 의미를 이해할 수 있었습니다.

또한 Query 작성 과정에서 여러 오류가 발생했습니다.

특히 API::Node와 DataFlow::Node 사이의 타입 문제와 asSink() 사용 오류를 해결하면서, CodeQL에서는 각 Node가 어떤 분석 모델에 속하는지 이해하는 것이 중요하다는 점을 확인했습니다.

마지막으로 취약 코드를 수정한 뒤 동일한 Query를 다시 실행했을 때 기존 Source → Sink 결과가 사라지는 것을 확인하면서, CodeQL을 취약점 발견뿐 아니라 **수정 전후 검증에도 활용할 수 있음**&#8203;을 확인했습니다.

---

## 24. 결론

이번 프로젝트에서는 CodeQL CLI를 직접 설치하고 Python 코드를 대상으로 CodeQL Database를 생성했습니다.

먼저 간단한 QL Query를 작성하여 os.system() 호출을 탐지하였으며, 이후 Global Data Flow 분석으로 확장하여 다음 경로를 탐지했습니다.

```text
input()
   ↓
user_input
   ↓
os.system(user_input)
```

이후 os.system()을 제거하고 허용된 기능만 프로그램 내부에서 처리하도록 코드를 수정했습니다.

수정된 코드로 새로운 CodeQL Database를 생성하고 동일한 Query를 실행한 결과 기존에 탐지되었던 Source → Sink 경로가 더 이상 나타나지 않았습니다.

또한 실습 과정에서 발생한 Dependency 설정 문제와 Data Flow 관련 타입 오류를 직접 수정하면서 CodeQL의 Query Pack, API Graph, Data Flow 분석 구조에 대해서도 확인할 수 있었습니다.

이번 실습을 통해 CodeQL은 단순히 코드에서 위험한 문자열을 검색하는 도구가 아니라, **코드를 데이터로 변환하고 Query를 이용해 프로그램의 구조와 데이터 흐름을 분석하는 정적 분석 도구**&#8203;라는 점을 이해할 수 있었습니다.

---

이번에는 CodeQL의 기본 원리부터 직접 취약한 코드를 작성하고,

데이터베이스 생성과 쿼리 실행, Source → Sink 데이터 흐름 분석까지 진행해 보았습니다.

처음에는 CodeQL이 그냥 코드를 넣으면 알아서 취약점을 찾아주는 도구라고 생각했는데,

직접 사용해보니 생각보다 훨씬 다양한 과정이 필요하더라고요. 특히 소스 코드를 데이터베이스화하고,

그 안에서 원하는 코드의 구조나 데이터 흐름을 쿼리로 찾아낸다는 점이 신기했습니다.

준비된 예제를 그대로 사용하지 않고, 도움을 받아 취약한 Python 코드를 직접 만들어 보았습니다.

직접 만든 코드를 분석해 볼 수 있다는 점이 흥미로웠습니다. 이번 실습은 한 번에 성공하지는 않았습니다.
Custom Query를 작성하는 과정에서 could not resolve module python, could not resolve type Call, could not resolve type Attribute 같은 오류가 계속 발생해서 처음에는 쿼리를 잘못 작성한 건가 싶었는데요.

오류를 하나씩 확인해보면서 qlpack.yml과 CodeQL의 dependency 설정이 중요하다는 것을 알게 되었고,

설정을 수정한 뒤에는 직접 작성한 쿼리가 정상적으로 실행되는 것까지 확인할 수 있었습니다.

오류가 계속 발생해 쉽지는 않았지만, 하나씩 해결해 보면서

CodeQL의 쿼리 구조와 설정 방식을 더 자세히 알게 됐습니다.

특히 이번에 직접 작성했던 Command Injection 예제를 통해

**사용자 입력(Source) → 데이터 흐름 → os.system()(Sink)**

으로 값이 이동하는 과정을 직접 확인해보면서, 단순히 "이 함수는 위험하다!"라고 찾는 것과

실제로 외부에서 들어온 데이터가 위험한 함수까지 도달하는지를 분석하는 것은 다르다는 점도 알 수 있었습니다.

처음에는 조금 복잡하고 오류도 많았지만 직접 취약한 코드도 만들어보고,

쿼리도 작성해보고, 오류도 해결해보면서 CodeQL이 어떤 방식으로 코드를 분석하는지 조금은 이해할 수 있었던 것 같아요!

처음에는 조금 복잡하고 오류도 많았지만, 직접 취약한 코드와 쿼리를 작성하고 오류를 해결하면서 CodeQL이 코드를 분석하는 방식을 구체적으로 확인할 수 있었습니다. 이번 기록은 여기서 마무리하겠습니다.

![CS CANVAS HEADER.jfif](/assets/images/tistory-codeql-11.jpg)

읽어주셔서 감사합니다. (꾸벅)
