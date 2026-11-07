---
title: '[K.knock × D-Alpha × CAUtion CTF] Stellar Salvage | Web/Crypto Write-up'
date: 2026-07-26T00:00:00.000Z
recordOrder: 15
categories:
  - CTF/Wargame
tags:
  - HSPACE
  - 연합 CTF
  - Web/Crypto
  - Write-up
description: 내부 API SSRF와 LCG 상태 역산을 이용한 좌표 복원
---
안녕하세요. somani입니다!

이번 글에서는 내부 API SSRF와 LCG 상태 역산을 연결해 목표 좌표를 복원한 과정을 정리해 보겠습니다.

## Stellar Salvage Write-up

### 1. 문제 개요

서비스는 은하의 특정 섹터에 숨어 있는 목표물을 찾아 좌표를 제출하는 문제입니다.

제공된 주요 API는 다음과 같습니다.

```http
POST /register
POST /login
POST /salvage
POST /chart/import
GET  /relic?sx=&sz=
```

/salvage를 호출하면 잔해의 fragment\_id를 받을 수 있고, 해당 잔해의 정밀한 센서 정보는 내부 API에 저장됩니다. 목표는 센서값을 이용해 목표 섹터 (sx, sz)를 복구한 뒤 /relic에 제출하는 것입니다.

### 2. 취약점 분석

#### 2.1 /chart/import의 SSRF

/chart/import는 사용자가 입력한 URL을 검증하지 않고 서버에서 직접 요청합니다.

```python
@app.route("/chart/import", methods=["POST"])
def chart_import():
    data = request.get_json(silent=True) or request.form
    url = data.get("url") or ""
```

```text
    resp = requests.get(url, timeout=4)
    body = resp.text[:8192]
```

```python
    return jsonify(imported=body, status=resp.status_code, source=url)
```

호스트나 IP 주소에 대한 제한이 없으므로 다음과 같이 서버 내부 주소를 요청할 수 있습니다.

```text
http://127.0.0.1:9000/sensor?fragment_id=<fragment_id>
```

내부 센서 API는 요청자의 IP가 루프백 주소인지 확인합니다.

```python
@sensor_app.route("/sensor", methods=["GET"])
def sensor():
    if request.remote_addr not in ("127.0.0.1", "::1"):
        return jsonify(error="internal only"), 403
```

외부 사용자가 직접 접근하면 차단되지만, /chart/import가 대신 요청하면 요청 출발지가 127.0.0.1이 되므로 검사를 우회할 수 있습니다.

따라서 공격 흐름은 다음과 같습니다.

```http
공격자
  ↓
POST /chart/import
  ↓
서버가 127.0.0.1:9000에 요청
  ↓
내부 센서 데이터 반환
```

### 3. 난수 생성기 분석

은하의 상태값은 다음 64비트 LCG로 갱신됩니다.

```text
HORIZON = 1 << 64
```

```text
DRIFT  = 6364136223846793005
THRUST = 1442695040888963407
```

상태 갱신식은 다음과 같습니다.

```text
state[n+1] =
    state[n] × 6364136223846793005
    + 1442695040888963407
    mod 2^64
```

센서의 subcell() 함수는 상태를 한 번 갱신한 뒤 상위 16비트만 반환합니다.

```python
def subcell(self):
    return self.advance() >> 48
```

즉, 센서에서 유출되는 값은 다음과 같습니다.

```text
output[n] = state[n] >> 48
```

내부 API에서는 이 값을 65536으로 나누어 실수 형태로 반환합니다.

```python
subcell_fractions=[o / 65536.0 for o in offs]
```

따라서 원래 16비트 출력은 다음 연산으로 복구할 수 있습니다.

```text
output = round(subcell_fraction * 65536)
```

### 4. 출력 사이의 불규칙한 간격

/salvage의 코드를 보면 센서값을 생성하기 전에 임의 횟수만큼 상태를 진행합니다.

```python
for _ in range(random.randint(0, store.MAX_AMBIENT_STEPS)):
    gx.advance()
```

MAX\_AMBIENT\_STEPS는 16이므로 첫 번째 센서값은 섹터를 로드한 이후 총 5회에서 21회 사이에 등장합니다.

또한 각 센서 채널 사이에도 0회에서 2회의 추가 진행이 들어갑니다.

```python
for i in range(CHANNELS):
    if i > 0:
        for _ in range(random.randint(0, store.MAX_SCATTER)):
            gx.advance()
```

```text
    offsets.append(gx.subcell())
```

subcell() 자체도 한 번 상태를 진행하므로 각 출력 사이의 실제 간격은 다음 중 하나입니다.

1, 2, 3

출력은 총 6개이므로 가능한 간격 조합의 수는 다음과 같습니다.

```text
3^5 = 243
```

따라서 243개의 간격 조합을 모두 검사할 수 있습니다.

### 5. 잘린 LCG 상태 복구

각 센서값은 64비트 상태의 상위 16비트만 알려줍니다.

따라서 각 상태는 다음 범위에 있습니다.

```text
output[i] × 2^48
≤ state[i]
< (output[i] + 1) × 2^48
```

간격이 정해지면 각 상태는 최초 상태 state\[0\]에 대한 선형식으로 표현할 수 있습니다.

```text
state[i] =
    multiplier[i] × state[0]
    + increment[i]
    mod 2^64
```

이 조건들과 상위 16비트 출력 6개를 이용하여 격자 문제를 구성했습니다.

각 간격 조합에 대해 미리 LLL로 축약한 기저를 준비하고, Babai의 nearest-plane 알고리즘으로 가장 가까운 격자점을 계산해 최초 상태 후보를 찾았습니다.

복구된 상태 후보가 실제 출력과 일치하는지는 다음 조건으로 검증했습니다.

```python
if all(
    (state >> 48) == observed
    for state, observed in zip(generated, outputs)
):
    candidates.append(candidate)
```

실행 당시 유출된 센서 출력은 다음과 같았습니다.

```text
[11956, 13113, 36329, 15215, 8955, 43556]
```

### 6. 섹터 좌표 복구

섹터를 로드할 때의 초기 상태는 다음 코드로 생성됩니다.

```python
def load_sector(self, sx, sz):
    external = (
        AXIS_X * sx
        + AXIS_Z * sz
        + ORIGIN
    ) mod 2^64
```

```text
    self.cursor = external ^ DRIFT
```

상수는 다음과 같습니다.

```text
ORIGIN = 0x1F2E3D4C5B6A7988
AXIS_X = 0xD1342543DE82EF96
AXIS_Z = 0x9E3779B97F4A7C15
```

복구한 최초 센서 상태에서 LCG를 역으로 5회에서 21회 진행하면 load\_sector() 직후의 상태 후보를 구할 수 있습니다.

LCG의 곱셈 상수 DRIFT는 홀수이므로 mod 2^64에서 역원이 존재합니다.

```text
inverse = pow(DRIFT, -1, 1 << 64)
```

```text
previous = (
    (state - THRUST) * inverse
) % (1 << 64)
```

이후 XOR을 되돌리면 다음 식을 얻습니다.

```text
external = load_state XOR DRIFT
```

따라서 좌표는 아래 식을 만족해야 합니다.

```text
AXIS_X × sx
+ AXIS_Z × sz
+ ORIGIN
≡ external mod 2^64
```

좌표 범위는 각각 다음과 같습니다.

```text
-30000 ≤ sx ≤ 30000
-30000 ≤ sz ≤ 30000
```

모든 좌표 쌍을 직접 검사하면 약 36억 번의 연산이 필요합니다. 이를 줄이기 위해 sx 항을 미리 해시 테이블로 만들었습니다.

```python
x_lookup = {
    (AXIS_X * sx) % MOD: sx
    for sx in range(-30000, 30001)
}
```

그다음 모든 sz에 대해 필요한 sx 항을 계산합니다.

```text
needed_x = (
    external
    - ORIGIN
    - AXIS_Z * sz
) % MOD
```

```text
sx = x_lookup.get(needed_x)
```

이 방식으로 좌표를 약 6만 번의 탐색만으로 복구할 수 있습니다.

복구된 목표 섹터는 다음과 같았습니다.

```text
sx = -14445
sz = -19404
```

### 7. 플래그 획득

복구한 좌표를 /relic에 제출합니다.

```http
GET /relic?sx=-14445&sz=-19404
```

서버는 해당 좌표가 사용자의 목표 좌표와 일치하면 플래그를 반환합니다.

```python
if (sx, sz) == st["target"]:
    return jsonify(
        ok=True,
        flag=store.FLAG
    )
```

자동화 스크립트의 실행 결과는 다음과 같습니다.

```text
[*] attempt 1: fragment=757413df75ab23a9
    outputs=[11956, 13113, 36329, 15215, 8955, 43556]
```

```text
[*] candidate sector: (-14445, -19404)
```

```text
[+] FLAG: CTF{R3lic_H1diNg_1n_th3_lATtice_n0isE}
```

### 8. 최종 플래그

```text
CTF{R3lic_H1diNg_1n_th3_lATtice_n0isE}
```

> 각 상세 풀이의 서버 주소와 데이터는 당시 CTF 환경을 기준으로 기록했으며, 현재 운영 상태와는 다를 수 있습니다.

읽어주셔서 감사합니다. (꾸벅)
