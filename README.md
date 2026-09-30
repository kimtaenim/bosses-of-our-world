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
| `?alt=1` | `colorAlt` 사용 (시진핑 노랑 `#FFD700` 테스트) |

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
  - `levels.order`: 인물이 추가되는 순서. `levels.counts`: 판별 활성 인물 수 (`[4, 5, 6, 7]`, 마지막 값 유지).

## 원화 교체

- 얼굴: `assets/faces/<id>.png` — 512×512 PNG, 투명 배경, 머리가 캔버스 85% 이상. 배경색 원 위에 그려진다.
- 특수 타일: `assets/special/<id>.png` — 정사각 PNG. 둥근 사각형으로 잘려 그려진다.
- 파일이 없으면 자동으로 플레이스홀더(원+이니셜 / 사각형+글자)로 그린다. 파일만 넣으면 끝.

## 사운드

`assets/sounds/`에 `match.mp3`, `special.mp3`, `clear.mp3`, `chain.mp3`를 넣고 `config.js`의 `SOUND_ENABLED: true`.
`chain`은 연쇄 단계마다 반음씩 높아진다 (x2 = 원음, x3 = +1반음 ...).

## 특수 효과 추가

`js/effects.js`의 `EFFECTS`에 `그룹명: { area, play }`를 추가하고 `characters.json`에서 그 그룹을 쓰면 된다.

## 구조

| 파일 | 역할 |
|---|---|
| `js/board.js` | 보드 순수 로직 (생성·매치·낙하·셔플·가능한 수) |
| `js/game.js` | 턴 진행, 연출 타이밍, 렌더링, HUD |
| `js/effects.js` | group → 특수 효과 맵 |
| `js/fx.js` | 파티클·링·빛줄기·연쇄 텍스트·화면 흔들림 |
| `js/sprites.js` | 타일 스프라이트 (이미지 / 플레이스홀더) |
| `js/tween.js` | 게임 루프 기반 트윈·타이머 |
| `js/input.js` | 드래그·탭-탭 입력 |
| `js/audio.js` | 사운드 슬롯 |
| `sw.js`, `manifest.json`, `icons/` | PWA |

로직 테스트: `node --test tests/*.test.mjs`
