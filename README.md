# Bosses of Our World

얼굴 매치3 프로토타입. 애니팡식 스왑, 실패 조건 없음, 터질 때의 쾌감이 유일한 보상.
순수 HTML/CSS/JS + Canvas 2D, 프레임워크·빌드 없음. PWA.

## 실행

정적 서버가 필요하다 (`file://`로 열면 `characters.json`을 못 읽음).

```sh
npx http-server -c-1 .     # 또는 python3 -m http.server
```

폰 크기 확인: 브라우저 개발자 도구 기기 모드 360px 폭.

테스트용 URL 파라미터:

| 파라미터 | 효과 |
|---|---|
| `?level=3` | 3판부터 시작 |
| `?juice=0.5` | 연출 강도 (0이면 전부 꺼짐) |
| `?alt=1` | 인물에 `colorAlt`가 있으면 그 색으로 (색 비교 테스트용) |

## GitHub Pages 배포

1. 이 브랜치를 `main`에 병합.
2. 저장소 Settings → Pages → Source: **Deploy from a branch**, Branch: `main` / `/ (root)`.
3. `https://<계정>.github.io/bosses-of-our-world/` 접속. 모든 경로가 상대 경로라 하위 경로에서 그대로 동작한다.

서비스 워커는 stale-while-revalidate라서 새로 배포한 내용은 **두 번째 실행부터** 보인다.
바로 반영하려면 `sw.js`의 `VERSION`을 올린다. JS 파일을 추가하면 `sw.js`의 `SHELL` 목록에도 넣는다.

## 설정 (코드 수정 없이)

- `config.js`
  - `JUICE`: 연출 전체 배율. 0이면 히트스톱·파티클·흔들림·스쿼시·오버슈트·진동 전부 꺼짐.
  - `TARGET_SCORES`: 판별 목표 점수 `[1500, 2500, 4000, 6000]`, 이후는 `TARGET_GROWTH`(1.3)배씩 (소수점 버림).
  - `HINT_DELAY_MS`, `FALL_GRAVITY`, `SOUND_ENABLED`, `SOUNDS`, `USE_ALT_COLORS`.
- `characters.json`
  - `characters`: id, 표시명, 그룹, 배경색, 이니셜, 얼굴 이미지, 특수타일 이미지, 특수타일 플레이스홀더 글자.
  - `levels.order`: 인물이 추가되는 순서. `levels.counts`: 판별 활성 인물 수 (`[4, 5, 6]`, 마지막 값 유지).
  - `levels.rotateFrom`: 이 판부터는 `order` 전체(8명)에서 무작위로 `counts`명을 뽑는다 (교대 출연).

## 원화 교체

### 얼굴 (표정별)

`assets/faces/<id>/<표정>.webp` — 256px WebP(장당 약 13KB). 원본(정사각, 인물 고유색 배경)을 변환 도구로 넣는다:

```sh
node tools/import-face.mjs trump smirk=원본1.png shock=원본2.png scream=원본3.png fall=원본4.png
```

배경이 원하는 색이 아니면 `--bg=#7CCBF5`를 붙이면 모서리에서 이어진 단색 배경을 그 색으로 다시 칠한다.

게임에서 타일 모양(`config.js`의 `TILE_SHAPE`, 기본 둥근 사각형)으로 잘라 쓴다. `characters.json`의 `faceScale`(기본 1.0)로 얼굴 크기를 조절한다: 1보다 크면 확대해 타일을 꽉 채우고(가장자리 약간 잘림), 1보다 작으면 축소하고 빈 테두리를 원화 모서리 색으로 채운다.

원화는 인물당 **7컷**:

| 파일명 | 표정 | 언제 나오나 |
|---|---|---|
| `smirk` | 얄밉게 웃음 (**기본, 필수**) | 평소, 새 판 환호, 깜빡임 대신 |
| `shock` | 깜짝 놀람 | 매치 확정 순간, 폭발 범위에 들었을 때, 큰 연쇄, 손가락으로 집었을 때 |
| `scream` | 비명 | 터지는 순간, 착지 순간 |
| `fall` | 겁먹음 | 떨어지는 중 |
| `sulk` | 삐짐 | 헛스왑(매치 실패) 후, 가끔 딴짓 |
| `glance` | 곁눈질 → (화면 오른쪽을 봄) | 옆에서 터질 때, 힌트, 딴짓, 눈 굴리기 대신 |
| `glance_left` | 곁눈질 ← (화면 왼쪽을 봄) | 위와 같음, 반대 방향 |

- 코드에는 표정 상태가 더 있다(eyeroll, blink, nervous, squish, cheer). 원화가 있으면 `characters.json`의
  `expressionFallback`을 따라 위 7컷 중 하나로 보이고, 플레이스홀더에서만 따로 그려진다.
  나중에 그 이름의 PNG를 추가하면 바로 그 그림이 쓰인다.
- 원화는 좌우 반전하지 않는다 (가르마·앞머리 방향이 뒤집히므로). 그래서 곁눈질은 좌우 두 장.
- `smirk.webp`가 없으면 그 인물은 전부 코드로 그린 플레이스홀더 얼굴을 쓴다.
- **`faces.html`** 에서 전 인물 × 전 표정을 실제 게임 크기로 한눈에 볼 수 있다.

### 특수 타일

인물 배경색에 금색 테두리. 정치인은 가운데에 동그라미 국기, 기업인은 아이콘. 판 위에서는 빛이 사선으로 훑고 지나간다.

| 인물 | 그림 | 효과 (`effect`, 없으면 `group` 기본값) |
|---|---|---|
| 트럼프·김정은·푸틴 | 성조기·인공기·러시아 국기 | 3×3 폭탄 |
| 빈 살만 | 금빛 석유 방울 | 3×3 폭탄 |
| 머스크 | 사이버트럭 | 가로 한 줄 |
| 베조스 | 우주선 | 세로 한 줄 (로켓 발사) |
| 저커버그 | SNS | 가로 한 줄 |
| 알트만 | AI 로봇 | 판 위의 같은 인물 전부 (번개) |

- 효과 범위 안의 다른 특수 타일은 부르르 떨다가(0.11초) 연쇄로 터진다.
- 국기·아이콘은 `characters.json`의 `emblem` 값으로 `js/emblems.js`에서 그린다 (`us`, `nk`, `ru`, `oil`, `car`, `rocket`, `sns`, `robot`).
- `assets/special/<id>.png`(정사각)를 넣으면 배경색 대신 그 그림을 쓴다.

## 표정 연출 조절

- `config.js`의 `IDLE_ACTIVITY`: 평소 딴짓 빈도 배율 (0이면 가만히, 2면 두 배로 정신없음).
- `IDLE_MIN_MS` / `IDLE_MAX_MS`: 타일마다 딴짓 간격.
- 몸짓(깡충, 움찔, 도리도리, 들썩임)은 `JUICE`에 비례하고 reduced-motion에서는 꺼진다. 표정 전환 자체는 항상 동작.
- 표정 규칙은 `js/faces.js`(딴짓·반응)와 `js/game.js`(상황별 전환)에 있다.

## 사운드

기본으로 켜져 있고, 화면 오른쪽 위 🔊 버튼으로 끈다(선택은 폰에 저장).
`assets/sounds/`에 `match.mp3`, `special.mp3`, `clear.mp3`, `chain.mp3`를 넣으면 그 파일을, 없으면 Web Audio로 합성한 효과음을 쓴다.
`chain`은 연쇄 단계마다 반음씩 높아진다 (x2 = 원음, x3 = +1반음 ...).

## 특수 효과 추가

`js/effects.js`의 `EFFECTS`에 `이름: { area, play }`를 추가하고 `characters.json`에서 인물의 `effect`로 그 이름을 쓰면 된다.

## 구조

| 파일 | 역할 |
|---|---|
| `js/board.js` | 보드 순수 로직 (생성·매치·낙하·셔플·가능한 수) |
| `js/game.js` | 턴 진행, 연출 타이밍, 렌더링, HUD |
| `js/effects.js` | 특수 효과 (bomb, row, column, sameType, diagonal) |
| `js/emblems.js` | 특수 타일 국기·아이콘 그림 |
| `js/fx.js` | 파티클·링·빛줄기·연쇄 텍스트·화면 흔들림 |
| `js/sprites.js` | 타일 스프라이트 (표정별 이미지 / 플레이스홀더 얼굴) |
| `js/faces.js` | 표정 우선순위, 평소 딴짓, 움찔·쳐다보기 반응, 몸짓 |
| `faces.html` | 표정 갤러리 |
| `js/tween.js` | 게임 루프 기반 트윈·타이머 |
| `js/input.js` | 드래그·탭-탭 입력 |
| `js/audio.js` | 사운드 슬롯 |
| `sw.js`, `manifest.json`, `icons/` | PWA (아이콘·파비콘은 `node tools/make-icons.mjs <얼굴.png>`로 생성) |

로직 테스트: `node --test tests/*.test.mjs`
