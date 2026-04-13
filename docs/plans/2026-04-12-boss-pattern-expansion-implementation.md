# Boss Pattern Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 보스 구간에 14종 랜덤 패턴 풀과 절반 화면을 덮는 대왕똥 패턴을 추가해 보스 전투를 덜 단조롭고 더 전략적으로 만든다.

**Architecture:** `bossPatterns.ts`를 패턴 엔진과 시퀀서로 분리하고, `GameState`에 보스 패턴 큐/현재 패턴 상태를 저장한다. 대왕똥은 기존 `Hazard` 흐름을 재사용하되 크기/동작 분기와 렌더 분기를 추가한다. 일반/하드는 동일한 엔진을 공유하고 패턴 풀, 반응 시간, 안전 폭만 다르게 준다.

**Tech Stack:** React, TypeScript, Vitest, canvas renderer

---

### Task 1: Extend Boss State

**Files:**
- Modify: `frontend/src/game/state.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
패턴 큐와 현재 패턴 상태가 없어서 보스 시퀀스를 저장할 수 없다는 전제를 테스트에 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: state shape 관련 실패 또는 미구현 오류

**Step 3: Write minimal implementation**
`GameState`에 보스 패턴 큐, 현재 패턴 id, 패턴 단계 타이머, 패턴 인덱스를 추가한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: state 관련 테스트 PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 2: Create Boss Pattern Catalog

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
일반/하드 모드에서 서로 다른 패턴 풀을 선택하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: pattern catalog 관련 실패

**Step 3: Write minimal implementation**
14종 패턴 메타데이터와 normal/hard 패턴 허용 목록을 정의한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 3: Implement Boss Sequence Builder

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Modify: `frontend/src/game/systems/rounds.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
보스 시작 시 패턴 3~5개가 선택되고 같은 패턴 계열이 과도하게 반복되지 않는 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: sequence builder 관련 실패

**Step 3: Write minimal implementation**
보스 진입 시 패턴 큐를 생성하고, 종료 시 큐를 비우는 시퀀서를 구현한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 4: Add Giant Hazard Support

**Files:**
- Modify: `frontend/src/game/state.ts`
- Modify: `frontend/src/game/entities/poop.ts`
- Modify: `frontend/src/game/systems/collision.ts`
- Test: `frontend/src/game/rendering/pixelSprites.test.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
대왕똥 크기/히트박스/안전 폭 검증 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: collision or sprite mismatch failure

**Step 3: Write minimal implementation**
대왕똥 크기 정의, 생성 헬퍼, 충돌 inset 규칙을 추가한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 5: Implement Core Pressure Patterns

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
절반 막기, 양문 닫기, 중앙 압착, 외곽 압착, 연속 덮기에서 최소 안전 폭이 유지되는 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: pattern execution failure

**Step 3: Write minimal implementation**
대왕똥 스폰 로직과 좌우 절반 교대 실행을 구현한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 6: Implement Lane Variant Patterns

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
통로 흔들기, 지그재그 통로, 스위치 압박, 교차 낙하가 안전 통로를 유지하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: failure

**Step 3: Write minimal implementation**
레인 이동/교차/스위치 패턴 실행기를 추가한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 7: Implement Trap Patterns

**Files:**
- Modify: `frontend/src/game/systems/bossPatterns.ts`
- Modify: `frontend/src/routes/GamePage.tsx`
- Modify: `frontend/src/styles/base.css`
- Test: `frontend/src/game/engine.test.ts`

**Step 1: Write the failing test**
가짜 안전지대, 잔류 함정, 페이크 전조, 지연 폭주, 막타 함정이 normal/hard 정책대로 다르게 동작하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: failure

**Step 3: Write minimal implementation**
함정 패턴과 전조 텍스트/타이밍 로직을 추가한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 8: Update Renderer For Giant Boss Hazards

**Files:**
- Modify: `frontend/src/game/rendering/pixelSprites.ts`
- Modify: `frontend/src/game/rendering/canvasRenderer.ts`
- Test: `frontend/src/game/rendering/pixelSprites.test.ts`

**Step 1: Write the failing test**
대왕똥 스프라이트 치수와 선택 로직 테스트를 추가한다.

**Step 2: Run test to verify it fails**
Run: `npm test --workspace frontend`
Expected: sprite test failure

**Step 3: Write minimal implementation**
대왕똥 전용 스프라이트와 렌더 분기를 추가한다.

**Step 4: Run test to verify it passes**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 5: Commit**
Git 저장소가 아니므로 생략

### Task 9: Final Verification

**Files:**
- Verify only

**Step 1: Run focused frontend tests**
Run: `npm test --workspace frontend`
Expected: PASS

**Step 2: Run full project tests**
Run: `npm test`
Expected: PASS

**Step 3: Run production build**
Run: `npm run build`
Expected: PASS

**Step 4: Manual check**
Run local app and confirm normal/hard both show varied boss patterns with readable telegraphs.

**Step 5: Commit**
Git 저장소가 아니므로 생략
