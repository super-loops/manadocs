---
status: in-progress
current_phase: 2
issue: 1
slug: review-visual-improvement
last_updated: 2026-04-25
---

# 📋 Review 시각 개선 (이슈 #1 → 0.12.0)

> 원본 이슈: https://github.com/super-loops/manadocs/issues/1

## 1. 나의 의도 (Intent)

- **한 줄 요약:** 리뷰 시스템을 "모달 단건 흐름"에서 "사이드바 다중 앵커 흐름"으로 전환하고, 그 김에 뱃지·코멘트·assignees·history 가독성을 한 번에 정돈한다.
- **왜 지금:** (1) 가독성 문제, (2) 본래 기획에 있던 multi-anchor가 UI에 반영되지 않은 채로 남아있음.
- **현재 workaround:** Manadocs는 알파 버전이라 프로토타입을 일단 적용해두고 직관적으로 다듬는 정돈 단계. 따로 우회는 하지 않고 본격 사용 전에 기능을 잠그는 중.
- **성공 장면:**
  - **시나리오 ① 가독성** — 사이드바를 열어 'Open' 탭의 리뷰 카드를 클릭하면, 같은 사이드바 안에서 디테일 패널로 전환된다. 메인 타이틀(굵게)과 본문이 보이고, 그 아래 코멘트들이 카톡처럼 말풍선으로 줄지어 있다. 뱃지에는 `💬 RE_5-A_3 ✅` 같이 식별자와 상태가 한 줄로 보인다.
  - **시나리오 ② multi-anchor** — 사이드바 디테일 패널에서 앵커 아이콘을 잡고 문서 영역으로 드래그하면, 드롭한 위치에 새 앵커가 추가되고 사이드바의 'Anchors' 목록에도 즉시 나타난다. 목록에서 앵커를 클릭하면 그 위치로 스크롤되며 잠깐 하이라이트된다.
- **대상자:** 본인 + MCP 에이전트. Manadocs는 기존 Docmost 기반이지만 "AI 에이전트와 함께 하는 LiveDocs"로 진화 중이며, 특히 Review 기능은 **유저s ↔ 에이전트s 협업 채널**이 본질이다.
- **차별점:** 기존 협업 도구의 코멘트 패러다임을 빌리지 않고, 유저s ↔ 에이전트s가 문서 위에서 다중 앵커로 협업하는 채널을 제로베이스 직관으로 설계한다.

## 2. 비즈니스 feature

- **BF-1**: 한 리뷰에 여러 앵커를 묶어 컨텍스트 단위로 피드백할 수 있다. (multi-anchor)
- **BF-2**: 리뷰는 인스펙터처럼 사이드바에서 열려, 문서 작업 흐름이 모달로 끊기지 않는다.
- **BF-3**: 리뷰는 단순 코멘트가 아니라 **타이틀+본문**을 가진 토픽이다 — 컨텍스트를 한 자리에 잠글 수 있다.
- **BF-4**: 코멘트가 수정/삭제되면 그 사실이 명시적으로 기록·표시된다(감사 가능).
- **BF-5**: 뱃지만 봐도 식별자(`RE_5-A_3`)와 상태(이모지)가 한 번에 읽힌다.
- **BF-6**: AI 에이전트도 MCP를 통해 리뷰 본문/코멘트를 작성·수정할 수 있다.

## 3. 기능적 feature

- **FF-1** (← BF-3): `reviews` 테이블에 `title`, `content` 컬럼 추가 + DTO 확장
- **FF-2** (← BF-4): `review_histories` 의 `type='comment'` 항목에 대한 수정/삭제 서비스 (테이블에 `editedAt`/`deletedAt` 이미 존재 → 마이그레이션 불필요)
- **FF-3** (← BF-6): MCP review tool 신설 — list/get/create/update + comment CRUD
- **FF-4** (← BF-5): `ReviewStatusBadge` 새 형식 + 상태별 이모지 매핑
- **FF-5** (← BF-5): 상태 셀렉트 라벨 "Resolved." 오타 정정
- **FF-6** (← BF-2 보조): Assignees 비어있을 때 "없음" 표시
- **FF-7** (← BF-2 보조): "Add assignees"를 `+` 버튼 + 펼침 패턴으로 변경
- **FF-8** (← BF-2 보조): History "변경 숨기기" 체크박스 (`type='status_change'` 토글, 기본 숨김)
- **FF-9** (← BF-4): 코멘트 말풍선 레이아웃 + 수정/삭제 버튼 + "수정됨"/"삭제됨" 표시
- **FF-10** (← BF-2, BF-3): Review 디테일을 `ReviewSidebar` 내부 인스펙터 패널로 통합 (모달 deprecation)
- **FF-11** (← BF-1): 사이드바 앵커 아이콘 드래그 → 에디터에 새 `review_anchor` 노드 삽입 + 백엔드 anchor 생성
- **FF-12** (← BF-1): 앵커 목록 클릭 → 페이지 이동(필요 시) + 해당 위치로 스크롤 + 하이라이트 펄스

## 4. 기술적 경계 조건 (Technical Boundaries)

> 다음 에이전트가 이 섹션을 반드시 읽고 따라야 합니다.

- **언어/런타임:** TypeScript, Node 20+
- **모노레포:** pnpm + Nx
- **백엔드:** NestJS + Kysely (CamelCasePlugin) + Postgres
  - 위치: `apps/server/src/`
  - 리뷰 도메인: `apps/server/src/core/review/` (service, dto, controller)
  - 리뷰 리포지토리: `apps/server/src/database/repos/review/` (review.repo, review-anchor.repo, review-assignee.repo, review-history.repo, sequence.repo)
  - 마이그레이션: `apps/server/src/database/migrations/` — 명명 규칙 `YYYYMMDDTHHMMSS-<slug>.ts` (예: `20260425T120000-add-review-content.ts`)
  - 엔티티 타입: `apps/server/src/database/types/db.d.ts` 는 자동생성 — 마이그레이션 후 갱신
  - MCP tools: `apps/server/src/core/mcp/tools/` — 패턴은 기존 `*.tool.ts` 참고 (예: `get-page.tool.ts`)
- **프론트엔드:** Vite + React + Mantine + jotai + Tiptap
  - 위치: `apps/client/src/`
  - 리뷰 도메인: `apps/client/src/features/review/{components,atoms,types,hooks}` 하위에 신규 파일 추가
  - 신규 컴포넌트 예: `review-detail-panel.tsx`, `review-comment-bubble.tsx`, `anchor-drag-handle.tsx`
- **에디터 확장:** `packages/editor-ext/src/lib/review-anchor/review-anchor.ts` — 기존 Tiptap Node에 드래그/스크롤/하이라이트 동작 보강 (새 Node 추가 지양)
- **데이터:**
  - 새 컬럼: `reviews.title` (varchar), `reviews.content` (text — markdown 문자열 그대로 저장)
  - `review_histories` / `review_anchors` / `review_assignees` 는 스키마 변경 없음 — UI/서비스만 수정
- **본문/코멘트 콘텐츠 정책:**
  - 쓰기: plain text 입력 + 사용자가 친 markdown 문법(`**굵게**` 등)을 그대로 저장
  - 읽기: 저장된 문자열을 markdown 파싱 → Tiptap 렌더링 파이프라인을 재사용해 표시 (페이지 본문과 같은 렌더 톤)
  - 본문(`reviews.content`)과 코멘트(`review_histories.content`) 둘 다 동일 정책. 코멘트의 `content`는 jsonb이지만 `{ text: "..." }` 같은 단일 필드 wrapper로 plain string을 담아도 됨 (다음 에이전트 판단)
- **인증:** 기존 쿠키 세션 그대로 (`@lib/auth` 재사용)
- **스타일:** Mantine 컴포넌트 + 기존 review 컴포넌트의 스타일 컨벤션 따름 (새 디자인 시스템 도입 금지)
- **테스트:** Phase 6에서 Playwright E2E. 단위 테스트는 새 백엔드 서비스(코멘트 수정/삭제, MCP tool)에 한해 추가
- **하지 말아야 할 것:** (유저가 명시적으로 위임 — "기존 개발 방식을 바꾸려는 게 아닙니다")
  - 기존 페이지 본문 에디터/Tiptap 코어 설정 변경 금지
  - Reviews 외 다른 도메인 테이블 스키마 변경 금지
  - Mantine 외 새 UI 라이브러리 도입 금지
  - 새 npm 의존성 추가 시 한 번 더 자문 (markdown 파서 등 꼭 필요한 경우만)

## 5. Phase별 작업 사항

> **Phase 작성 원칙:** 무엇을 / 어느 경계 안에서 / 어떤 완료 기준으로. **어떻게 짤지(코드 스니펫·SQL 본문·함수 본문)는 다음 에이전트의 재량**이며 PLAN에 박지 않는다.

---

### Phase 1 — 백엔드 토대 + MCP

**목적:** 사이드바·코멘트 UI 작업이 시작되기 전, 데이터/서비스/MCP 레이어를 완성해 프론트가 호출할 모양을 잠근다.

**작업:**

- [x] **1-1. Reviews 컬럼 추가 마이그레이션** (FF-1) — *no-op: `title`/`content` 컬럼이 첫 마이그레이션에 이미 존재*
- [x] **1-2. ReviewService/Repo: title/content 처리** (FF-1) — `updateReview` 메서드 신규 추가
- [x] **1-3. DTO 확장** (FF-1) — `UpdateReviewDto` 신규, `content` 타입 `object → string` (markdown)
- [x] **1-4. 코멘트 수정/삭제 서비스** (FF-2) — `updateComment`/`deleteComment` 본인 권한 체크
- [x] **1-5. MCP review tool 신설** (FF-3) — 7개 tool 신규 + registry/module 등록

**Phase 1 완료 기준:** REST + MCP 양쪽에서 새 필드(title/content)와 코멘트 수정/삭제가 동작한다. 프론트 변경 없음 — Phase 2~5가 호출할 표면이 잠긴 상태.

**Phase 1 셀프체크:** 마이그레이션 up/down 양방향, DTO 검증, 권한 분기 (본인만 수정/삭제), MCP 워크스페이스 격리.

**Phase 1 롤백 계획:** 마이그레이션 down() + 새 tool 파일 제거.

---

### Phase 2 — 작은 시각 수정

**목적:** 모달 안에서 동작하는 채로, 사용자가 즉시 체감하는 작은 가독성 개선들을 한 번에 처리. (사이드바 인스펙터 전환은 Phase 4)

**작업:**

- [ ] **2-1. ReviewStatusBadge 새 형식** (FF-4)
  - 출력: 뱃지가 `<status icon> RE_5-A_3 <status emoji>` 형식으로 표시. 앵커가 여러 개일 때의 표기는 다음 에이전트 판단 (예: 첫 앵커만 표기, 또는 `RE_5-A_3 외 N`)
  - 파일 경계: `apps/client/src/features/review/components/review-status-badge.tsx` (또는 동일 위치의 신/구 컴포넌트)
  - 완료 기준: Storybook 또는 페이지 상에서 세 가지 상태(open/progress/resolved) 각각 식별자 + 이모지가 보임

- [ ] **2-2. 상태 이모지 매핑** (FF-4)
  - 출력: open / progress / resolved 각각에 직관적 이모지 1개씩 (예: ⏳ / 🔧 / ✅ — 정확한 선정은 다음 에이전트 판단)
  - 파일 경계: 2-1과 동일 컴포넌트 또는 인접 상수 모듈
  - 완료 기준: 2-1과 함께 검증

- [ ] **2-3. 상태 셀렉트 옵션 라벨 정정** (FF-5)
  - 출력: "Resolved." → "Resolved"
  - 파일 경계: 셀렉트 옵션이 정의된 위치 (review-modal.tsx 또는 별도 enum/labels 파일 — 다음 에이전트가 grep으로 확인)
  - 완료 기준: UI 상에서 옵션 텍스트 점 제거 확인

- [ ] **2-4. Assignees "없음" 표시** (FF-6)
  - 출력: assignees 배열이 비어있을 때 "없음" (또는 "Assignees 없음" 등 — 톤은 다음 에이전트 판단) placeholder 노출
  - 파일 경계: review-modal 내 Assignees 섹션 (~라인 186~225) — Phase 4에서 사이드바 디테일 패널로 옮길 예정이므로 컴포넌트화 권장
  - 완료 기준: 빈 배열 케이스에서 텍스트 노출

- [ ] **2-5. Add assignees → `+` 펼침 패턴** (FF-7)
  - 출력: 평소엔 Assignees 우측에 작은 `+` 버튼만 보이고, 클릭 시 사용자 선택 인풋이 펼쳐짐
  - 파일 경계: 2-4와 동일 섹션
  - 완료 기준: 기본 상태에서 인풋이 보이지 않고 `+` 클릭 시 펼침 / 선택 후 자동 접힘 (또는 명시적 닫기 버튼)

- [ ] **2-6. History "변경 숨기기" 체크박스** (FF-8)
  - 출력: History 영역 우측 상단에 체크박스. 기본 체크(=숨김) 상태에서 `type='status_change'` 항목 비표시. 체크 해제 시 모두 표시.
  - 파일 경계: review-modal 내 History 섹션 (`HistoryEntry` 함수 ~라인 304~348)
  - 의존: 없음 (체크박스 상태는 로컬 useState 또는 atom — 다음 에이전트 판단)
  - 완료 기준: 토글 시 status_change 행이 즉시 숨김/노출

**Phase 2 완료 기준:** 모달을 열었을 때 위 6개 변경이 모두 보이고, 콘솔 에러 없음. 모달은 아직 그대로지만 모든 작은 디테일이 정돈됨.

**Phase 2 셀프체크:** 빈 assignees / 비어있는 history / 다양한 상태 조합으로 시각 확인.

**Phase 2 롤백 계획:** 컴포넌트 단위 git revert.

---

### Phase 3 — 코멘트 말풍선 + 수정/삭제

**목적:** 코멘트 영역의 시각·기능을 한 번에 끌어올린다. 모달이든 사이드바든 같은 컴포넌트가 들어가도록 컴포넌트화한다 (Phase 4를 의식한 분리).

**작업:**

- [ ] **3-1. ReviewCommentBubble 컴포넌트** (FF-9)
  - 출력: 다음 레이아웃 — `[유저 아바타] [말풍선(content)]` / 말풍선 하단에 작은 글씨로 `유저명 · 수정시간 · [수정][삭제]`
  - 파일 경계: `apps/client/src/features/review/components/review-comment-bubble.tsx` 신규
  - 완료 기준: 말풍선 톤이 카톡/슬랙처럼 둥근 풍선, 본인 코멘트와 타인 코멘트의 정렬/색조 차이 (필요 시), 본인 코멘트만 수정/삭제 버튼 표시

- [ ] **3-2. 코멘트 markdown 렌더링** (FF-9)
  - 출력: 저장된 markdown 문자열을 Tiptap 렌더 파이프라인으로 표시 (페이지 본문 렌더와 같은 톤). 본문(`reviews.content`)도 동일 컴포넌트 사용
  - 파일 경계: 신규 markdown→Tiptap 렌더 헬퍼 — 위치는 `apps/client/src/features/review/components/` 또는 공용으로 `apps/client/src/lib/markdown-render/` 다음 에이전트 판단
  - 의존: 3-1
  - 완료 기준: `**굵게**` `*기울임*` `[링크](url)` `\`code\`` 정도가 잘 렌더링됨

- [ ] **3-3. 수정/삭제 동작 연결** (FF-9)
  - 출력: 수정 버튼 → 인라인 편집 모드(말풍선 자리에 textarea), 저장 시 1-4 API 호출 / 삭제 버튼 → 확인 후 1-4 API 호출
  - 파일 경계: 3-1
  - 의존: 1-4, 3-1
  - 완료 기준: 수정/삭제 후 화면이 즉시 갱신, `editedAt` 있는 코멘트는 "(수정됨)" 마커, `deletedAt` 있는 코멘트는 본문이 "(삭제됨)" 으로 마스킹되고 수정 버튼 비표시

- [ ] **3-4. 코멘트 입력창** (FF-9 보조)
  - 출력: 기존 코멘트 입력창(`ReviewCommentInput`)도 plain text + markdown 입력에 맞게 정돈 (이미 그렇다면 손대지 않음)
  - 파일 경계: 기존 `ReviewCommentInput`
  - 완료 기준: 입력 → 전송 → 새 말풍선이 즉시 추가

**Phase 3 완료 기준:** 코멘트가 말풍선 줄로 깔끔하게 보이고, 본인 코멘트는 수정/삭제 가능하며, 그 흔적이 명시적으로 남는다.

**Phase 3 셀프체크:** 본인/타인 코멘트, 수정 후 재수정, 삭제 후 표시 확인. markdown 렌더 XSS 위험 (DOMPurify 또는 Tiptap 파이프라인의 안전성 확인).

---

### Phase 4 — 사이드바 인스펙터 (모달 → 사이드바 디테일 패널)

**목적:** 개별 리뷰 디테일을 사이드바 안에서 보여주는 인스펙터 패널로 통합. 본문 타이틀/내용을 함께 표시한다.

**작업:**

- [ ] **4-1. 디테일 선택 atom** (FF-10)
  - 출력: 현재 선택된 reviewId atom (예: `selectedReviewIdAtom`). 사이드바가 열려있을 때 카드 클릭 시 이 atom 갱신
  - 파일 경계: `apps/client/src/features/review/atoms/review-atom.ts`
  - 완료 기준: atom 상태 변화에 따라 디테일 패널이 토글

- [ ] **4-2. ReviewDetailPanel 컴포넌트** (FF-10)
  - 출력: 사이드바 안에서 카드 목록을 가리고/덮고 디테일을 보여주는 패널. 헤더에 "목록으로" 버튼. 내용:
    - 상단: 뱃지(2-1) + 상태 셀렉트(2-3) + Assignees(2-4, 2-5)
    - 중단: 본문 타이틀(굵게) + 본문(markdown 렌더, 3-2)
    - 하단: Anchors 목록 + 코멘트 목록(3-1) + 코멘트 입력(3-4) + History(2-6)
  - 파일 경계: `apps/client/src/features/review/components/review-detail-panel.tsx` 신규
  - 의존: 4-1, Phase 2·3 컴포넌트
  - 완료 기준: 카드 → 디테일 → 뒤로가기 흐름이 매끄러움. 사이드바 width 안에서 스크롤이 자연스러움

- [ ] **4-3. 본문 타이틀/내용 입력 폼** (FF-1, FF-10)
  - 출력: Review 생성 시 타이틀/내용 입력 가능 (생성 폼이 어디에 있는지 다음 에이전트가 확인 — 사이드바에 신규 버튼이거나 페이지 우클릭 메뉴 등). 디테일 패널에서는 작성자가 타이틀/내용을 인라인 편집 가능
  - 파일 경계: 생성 폼 위치 + `review-detail-panel.tsx`
  - 의존: 1-2, 1-3
  - 완료 기준: 새 리뷰 생성 시 타이틀/내용 입력 → 저장 → 디테일에서 그대로 보임

- [ ] **4-4. 모달 deprecate** (FF-10)
  - 출력: 기존 `review-modal.tsx` 의 진입점(`openReviewModalAtom`)을 사이드바 디테일 패널로 모두 리다이렉트. 코드는 일단 남겨두되 호출되는 곳이 없음을 확인 후 제거 (한 PR에서 제거해도 OK)
  - 파일 경계: `review-modal.tsx`, 호출하는 모든 지점
  - 완료 기준: 어떤 흐름에서도 모달이 뜨지 않음. 카드 클릭은 모두 디테일 패널로 연결

**Phase 4 완료 기준:** 모달이 사라지고 사이드바 인스펙터로 모든 리뷰 디테일이 다뤄진다. 시나리오 ①(가독성)이 충족됨.

**Phase 4 셀프체크:** 디테일 패널 안의 모든 섹션이 모달 시절과 동등하거나 더 나은 동작을 보임. 사이드바를 닫았다 다시 열었을 때 선택 상태 유지/초기화 정책 (다음 에이전트 판단).

---

### Phase 5 — Multi-anchor 인터랙션 (드래그 + 스크롤 + 하이라이트)

**목적:** 시나리오 ②(multi-anchor) 충족. 사이드바에서 앵커를 끌어 문서에 추가하고, 목록 클릭으로 해당 위치를 명확히 강조.

**작업:**

- [ ] **5-1. 앵커 드래그 핸들 컴포넌트** (FF-11)
  - 출력: 디테일 패널 Anchors 섹션의 각 앵커(또는 별도 "새 앵커 추가" 핸들)에 드래그 가능한 핸들. HTML5 drag-and-drop 또는 라이브러리 사용 (다음 에이전트 판단, 새 의존성은 자제)
  - 파일 경계: `apps/client/src/features/review/components/anchor-drag-handle.tsx` 신규
  - 완료 기준: 핸들을 잡고 끌면 ghost가 보이고, 드롭 가능 영역이 시각적으로 표시

- [ ] **5-2. 에디터 드롭 처리 + 앵커 생성 API 연동** (FF-11)
  - 입력: 드롭 이벤트(에디터 좌표, reviewId)
  - 출력: 드롭 위치에 새 `review_anchor` Tiptap 노드 삽입 + 백엔드 anchor 생성 API 호출 → 성공 시 사이드바 Anchors 목록 갱신
  - 파일 경계: `packages/editor-ext/src/lib/review-anchor/review-anchor.ts` (드롭 핸들러 추가), 클라이언트 측 anchor mutation hook
  - 의존: 5-1
  - 완료 기준: 한 리뷰에 앵커 2개 이상을 드래그로 추가, 새로고침 후에도 보존

- [ ] **5-3. 앵커 목록 클릭 → 스크롤 + 하이라이트** (FF-12)
  - 출력: Anchors 목록의 항목 클릭 시 — (a) 해당 페이지가 다르면 라우터로 이동, (b) 같은 페이지면 즉시 해당 앵커 노드로 스크롤, (c) 1~2초간 하이라이트 펄스 애니메이션 (CSS keyframes 또는 Mantine `Transition`)
  - 파일 경계: review-anchor Tiptap 확장 (포커스/스크롤 메서드), 디테일 패널 Anchors 섹션
  - 의존: 없음 (5-1·5-2와 독립적으로 진행 가능)
  - 완료 기준: 클릭 시 스크롤 위치가 정확하고 하이라이트가 명확히 인지됨

**Phase 5 완료 기준:** 시나리오 ②가 그대로 동작. 한 리뷰에 N개의 앵커를 드래그로 추가/이동/클릭으로 점프할 수 있다.

**Phase 5 셀프체크:** 앵커 N개 추가, 페이지 간 이동, 드래그 취소(드롭 영역 밖에 놓기), 하이라이트가 다른 클릭과 충돌하지 않음.

---

### Phase 6 — E2E + 0.12.0 bump

**목적:** 종단간 시나리오 검증, 자잘한 버그 수정, 릴리스.

**작업:**

- [ ] **6-1. Playwright 시나리오 작성**
  - 시나리오 목록 (각각 별도 spec):
    - 사이드바 디테일 패널 진입/뒤로가기
    - 새 리뷰 생성 (타이틀 + 본문 + 앵커 1개)
    - 코멘트 작성 → 수정 → 삭제 → 마커 확인
    - History 변경 숨기기 토글
    - Assignees `+` 펼침 + 추가
    - 앵커 드래그로 추가 → Anchors 목록 갱신
    - 앵커 클릭 → 스크롤 + 하이라이트 검증
    - MCP review tool 호출 (가능하면 — 어렵다면 백엔드 통합 테스트로 대체)
  - 파일 경계: `apps/client/e2e/` 또는 기존 e2e 위치 (다음 에이전트 확인)
  - 완료 기준: 모든 시나리오 통과, CI 환경에서도 동작 확인 가능 (필수는 아님 — 알파라 로컬 패스만으로 OK)

- [ ] **6-2. 자잘한 버그 수정**
  - E2E 중 발견된 버그 처리. 발견 → 수정 → 재실행 사이클

- [ ] **6-3. 0.12.0 bump**
  - 파일: `package.json` (root) — `"version": "0.12.0"`
  - 워크스페이스 하위 package.json도 버전을 맞추는 게 관행이라면 함께 (기존 0.11.x 버전들이 어떻게 처리됐는지 git log 확인)
  - 변경 로그: 별도 CHANGELOG가 있다면 기록, 없다면 생략

- [ ] **6-4. main에 직접 push**
  - 마지막 커밋: `chore: bump version to 0.12.0`
  - `git push origin main` (PR 없음 — 유저 명시)

**Phase 6 완료 기준:** 모든 E2E 통과, 버전 0.12.0, main에 push 완료.

---

## 6. 의도적으로 하지 않는 것 (Non-goals)

- 리뷰 카테고리/태그 시스템
- 리뷰 검색/필터(상태 탭 외)
- 리뷰 알림 채널 다양화 (이메일, 슬랙 등)
- AI 에이전트가 자동으로 리뷰를 생성하는 트리거 자동화
- 리뷰 export / 외부 공유 링크
- 리뷰 본문에서 페이지 본문 수준의 풀 리치 에디터 (현 단계는 markdown 문자열 충분)
- 모바일 전용 인터랙션 (반응형은 기존 컨벤션 따름)
- ReviewHistories 스키마 재설계 (이미 `editedAt`/`deletedAt`/`type` 갖춘 통합 모델)

## 7. 다음 에이전트를 위한 메모

> 이 문서를 받은 다음 에이전트가 첫 번째로 할 일:
> 1. **섹션 4 "기술적 경계 조건"을 먼저 숙지할 것**
> 2. Phase 1부터 순서대로 진행할 것 (백엔드 표면이 잠겨야 프론트가 호출할 모양이 명확함)
> 3. 불명확한 구현 세부사항은 에이전트 재량으로 결정하되, 경계 조건을 위반하지 말 것
> 4. 경계 조건과 충돌하는 상황이 생기면 유저에게 먼저 확인할 것

**유저의 진행/마무리 선호:**
- **Phase별 진행 방식:** 각 Phase 작업 완료 후 코드 수준 셀프체크 → 한 Phase 단위로 커밋 (Phase 안에서 작은 단위 커밋은 다음 에이전트 재량)
- **마무리 방식:** 모든 Phase 완료 후 → 최종 E2E 진행(Phase 6) → 자잘한 버그 수정 → `0.12.0` 버전 bump → **main에 직접 push (PR 없음)**
- **아키텍처 위임:** 유저가 "기획이 명확하면 아키텍처는 당신이 담당"이라고 명시. 컴포넌트 분리, 파일 위치 미세 조정, 라이브러리 선택 등은 다음 에이전트가 자유롭게 판단할 것

**의식할 점 (LiveDocs 컨셉):**
- Review 기능은 유저-유저가 아니라 **유저s ↔ 에이전트s** 채널이다. UI는 사람을 위해, API/MCP는 에이전트가 동등한 1급 시민으로 다룰 수 있게 만들 것
- 백엔드 변경(title/content, 코멘트 수정/삭제)은 반드시 MCP에도 함께 노출 (Phase 1에서 묶어서 처리하는 이유)
