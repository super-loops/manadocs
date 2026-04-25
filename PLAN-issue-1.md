---
status: done
current_phase: 6
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

- [x] **2-1. 페이지 뱃지 새 형식** — `💬 RE_{seq}-A_{seq} <emoji>` (review-anchor-view.tsx)
- [x] **2-2. 상태 이모지 매핑** — `REVIEW_STATUS_EMOJI` 공통 상수 (open ⏳ / progress 🔧 / resolved ✅)
- [x] **2-3. "Resolved." 오타 정정** — en-US 로케일 점 제거
- [x] **2-4. Assignees "없음" 표시** — 빈 배열일 때 dimmed text
- [x] **2-5. Add assignees `+` 펼침 패턴** — `assigneePickerOpen` state로 토글
- [x] **2-6. History "변경 숨기기" 체크박스** — `hideStatusChanges` 기본 true, `type==='status'` 필터링

**Phase 2 완료 기준:** 모달을 열었을 때 위 6개 변경이 모두 보이고, 콘솔 에러 없음. 모달은 아직 그대로지만 모든 작은 디테일이 정돈됨.

**Phase 2 셀프체크:** 빈 assignees / 비어있는 history / 다양한 상태 조합으로 시각 확인.

**Phase 2 롤백 계획:** 컴포넌트 단위 git revert.

---

### Phase 3 — 코멘트 말풍선 + 수정/삭제

**목적:** 코멘트 영역의 시각·기능을 한 번에 끌어올린다. 모달이든 사이드바든 같은 컴포넌트가 들어가도록 컴포넌트화한다 (Phase 4를 의식한 분리).

**작업:**

- [x] **3-1. ReviewCommentBubble 컴포넌트** — 말풍선 + 인라인 편집 + 수정/삭제 (`review-comment-bubble.tsx`)
- [x] **3-2. markdown 렌더 헬퍼** — `review-markdown.tsx` (marked + DOMPurify + TypographyStylesProvider)
- [x] **3-3. 수정/삭제 연결** — Phase 1 API 호출 + editedAt/deletedAt 마커 + 마스킹
- [x] **3-4. 코멘트 입력창 정돈** — Textarea (plain text + markdown 안내), Cmd/Ctrl+Enter 전송
- [x] **회귀 정리** — review-sidebar `ReviewCard.preview` 가 string content도 처리, review-select-popup의 `content: null` 제거

**Phase 3 완료 기준:** 코멘트가 말풍선 줄로 깔끔하게 보이고, 본인 코멘트는 수정/삭제 가능하며, 그 흔적이 명시적으로 남는다.

**Phase 3 셀프체크:** 본인/타인 코멘트, 수정 후 재수정, 삭제 후 표시 확인. markdown 렌더 XSS 위험 (DOMPurify 또는 Tiptap 파이프라인의 안전성 확인).

---

### Phase 4 — 사이드바 인스펙터 (모달 → 사이드바 디테일 패널)

**목적:** 개별 리뷰 디테일을 사이드바 안에서 보여주는 인스펙터 패널로 통합. 본문 타이틀/내용을 함께 표시한다.

**작업:**

- [x] **4-1. 디테일 선택 atom** — `selectedReviewIdAtom` + `openReviewModalAtom` 을 derived로 (외부 진입점 자동 호환)
- [x] **4-2. ReviewDetailPanel 컴포넌트** — 사이드바 안 풀 패널, "← 목록으로" 헤더, ScrollArea
- [x] **4-3. 본문 타이틀/내용 인라인 편집** — TextInput / Textarea + Save/Cancel + ReviewMarkdown 렌더
- [x] **4-4. 모달 deprecate** — `review-modal.tsx` 삭제 + `page.tsx` 정리 (외부 호출은 atom 기반이라 변경 불필요)

**Phase 4 완료 기준:** 모달이 사라지고 사이드바 인스펙터로 모든 리뷰 디테일이 다뤄진다. 시나리오 ①(가독성)이 충족됨.

**Phase 4 셀프체크:** 디테일 패널 안의 모든 섹션이 모달 시절과 동등하거나 더 나은 동작을 보임. 사이드바를 닫았다 다시 열었을 때 선택 상태 유지/초기화 정책 (다음 에이전트 판단).

---

### Phase 5 — Multi-anchor 인터랙션 (드래그 + 스크롤 + 하이라이트)

**목적:** 시나리오 ②(multi-anchor) 충족. 사이드바에서 앵커를 끌어 문서에 추가하고, 목록 클릭으로 해당 위치를 명확히 강조.

**작업:**

- [x] **5-1. 앵커 드래그 핸들** — Detail panel의 Anchors 헤더에 draggable Badge ("Drag to add")
- [x] **5-2. 에디터 드롭 + API 연동** — `review-anchor-drop-zone.tsx` (REVIEW_DRAG_MIME, posAtCoords, createAnchor → insertReviewAnchor)
- [x] **5-3. 앵커 목록 클릭 → 스크롤 + 하이라이트** — `scrollToReviewAnchor` util + `review-anchor.css` 펄스 애니메이션 + page.tsx의 location.state 기반 라우팅 후 자동 스크롤

**Phase 5 완료 기준:** 시나리오 ②가 그대로 동작. 한 리뷰에 N개의 앵커를 드래그로 추가/이동/클릭으로 점프할 수 있다.

**Phase 5 셀프체크:** 앵커 N개 추가, 페이지 간 이동, 드래그 취소(드롭 영역 밖에 놓기), 하이라이트가 다른 클릭과 충돌하지 않음.

---

### Phase 6 — E2E + 0.12.0 bump

**목적:** 종단간 시나리오 검증, 자잘한 버그 수정, 릴리스.

**작업:**

- [~] **6-1. Playwright 시나리오 작성** — *환경 미비: 레포에 Playwright 셋업이 없음. 신설은 별도 작업으로 분리. 대신 각 Phase마다 신선한 Evaluator 서브에이전트가 코드 검증을 수행했고, 빌드 통과로 정합성 확인. 수동 검증 시나리오는 이슈 #1 코멘트로 안내 권장.*
- [x] **6-2. 자잘한 버그 수정** — Evaluator 보충의견에서 짚인 회귀 위험(review-sidebar preview, popup의 null content)은 Phase 3 안에서 함께 처리됨
- [x] **6-3. 0.12.0 bump** — root + apps/client + apps/server package.json
- [x] **6-4. main에 직접 push** — bump 커밋 후 push (PR 없음)

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
