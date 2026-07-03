---
title: 문서 형상관리 — commit·history·diff·공개 링크 버전 선택 (구현 계약)
status: in_progress
current_phase: 7
last_updated: 2026-07-03
slug: enhancement-202605-01
priority: high
source_idea: IDEA-enhancement-202605-01.md
figma: https://www.figma.com/design/HUZt8KbhXW2GPZAjE7Rciu/Manadocs?node-id=16-2
---

# PLAN — 문서 형상관리

페이지를 git처럼 다룬다: 작업문서(working) ↔ 확정 버전(committed) 분리, 명시적 `문서확정`(commit), 버전 히스토리·diff·공개 링크 버전 선택. 문서 작성 패러다임 자체가 바뀌는 릴리스이며 **마이그레이션 무결성이 최우선 품질 기준**.

## 확정된 결정 (호정, 2026-07-02~03)

| # | 결정 | 내용 |
|---|---|---|
| D1 | 마이그레이션 | 기존 페이지: 버전 0(생성 마커) + 현재 본문 → **버전 1 자동 확정**(Primary). 메시지 "기존 문서 자동 확정" |
| D2 | 공유 게이트 | **확정 버전이 없으면 공유(외부 링크) 불가** |
| D3 | 폐기 링크 정책 | 특정버전 고정 링크는 **링크별 선택**(fallback/404), 기본 fallback(가장 가까운 비폐기 버전 + 안내) |
| D4 | diff 범위 | **버전간 + 문서간(다른 페이지의 버전과) 모두** — 같은 클라이언트 diff 엔진 재사용 |
| D5 | 작업문서 | **다중 작업문서 풀 스펙(UI 포함)** 이번 릴리스에 |
| D6 | 내부 Reader | 작업문서 접근 불가 — **확정본(Primary) + 버전 히스토리만** 열람. 확정본 없으면 플레이스홀더 |
| D7 | Primary 정책 | **문서확정 시 항상 자동 Primary**. 과거 버전 복귀는 ⋯ 메뉴 "Primary로 변경" |
| D8 | 자동 스냅샷 | **기능 제거**(enqueue/processor/UI). `page_history` 테이블·데이터는 봉인 유지(파괴적 삭제 없음) |
| D9 | MCP | **조회(list_versions/get_version) + commit_version(문서확정)까지** 에이전트에 개방 |
| D10 | 검색 이원화 | **기본 = 확정본 인덱스**. 편집 권한자에게만 "작업문서 포함" 옵션. Reader는 확정본만 |
| D11 | 이모지 1급 | 사이드바 트리·breadcrumb·푸터 pill 노출 + 픽커 **포함** |

파생 규칙:
- 새 페이지 = 버전 0(빈 콘텐츠 마커) + Primary 작업문서 1개. 첫 문서확정 전엔 공유 불가(D2)·Reader 플레이스홀더(D6).
- 문서 Duplicate(버전 ⋯ 메뉴) = 스냅샷을 작업문서로 갖는 새 페이지, 버전 0부터 시작(버전 체인 미승계, IDEA 원안).
- 리뷰는 버전(committed)에만 귀속. 기존 리뷰는 마이그레이션 시 버전 1 귀속.
- 수정취소 = 작업문서를 base 버전 콘텐츠로 리셋(서버 ydoc transact).
- 푸터 pill diff stats = 작업문서 ↔ base 버전(클라이언트 계산).

## 아키텍처 (정찰 3건 기반)

### 데이터 모델
- **`page_versions`** (신설): id, page_id(FK cascade), `version` int(페이지 내 단조증가, unique(page_id,version)), title/icon/cover_photo 스냅샷 메타, `content` jsonb 스냅샷, `message`, creator_id, contributor_ids uuid[], `working_doc_id`(출처, nullable), `discarded_at`/`discarded_by_id`, space_id, workspace_id, created_at/updated_at. ydoc 불필요(frozen).
- **`page_working_docs`** (신설): id, page_id(FK cascade), `name`(nullable, 기본 표시 "버전 N에서 시작"), `base_version_id`(FK), `content` jsonb, `ydoc` bytea, `text_content`, creator_id, contributor_ids, timestamps.
- **`pages`** 확장: `primary_version_id`(nullable FK), `primary_working_doc_id`(FK), `committed_text_content` text + `committed_tsv` tsvector(GIN) — 검색 이원화(D10)용, 커밋/Primary 변경 시 갱신.
  - 기존 content/ydoc/text_content/tsv = **Primary 작업문서 미러 유지**(기존 소비자 — MCP get_page, 검색 작업문서 옵션, export — 무변경 호환).
- **`reviews`** 확장: `version_id`(FK nullable — 레거시 구분). 신규 리뷰는 필수.
- **`shares`** 확장: `version_mode`('primary'|'fixed'), `fixed_version_id`(FK nullable), `on_discard`('fallback'|'404', fixed 전용).

### 협업 room
- 신규 규칙 `page.<pageId>.<workingDocId>`, 레거시 `page.<pageId>` = Primary 작업문서로 해석(하위호환: MCP patch_page_blocks·REST updatePageContent 무변경).
- persistence.extension: 대상 작업문서 row에 저장. Primary 작업문서면 pages.content/ydoc 미러 동시 갱신(단일 트랜잭션).
- authentication.extension: Reader(canEdit=false)는 작업문서 room 접속 거부(D6).
- `enqueuePageHistory`·HISTORY_QUEUE·history.processor 제거(D8).

### 서빙 경로
- 내부 Reader: `/pages/info`가 canEdit=false면 Primary 버전 content 반환(없으면 placeholder 신호). 클라이언트는 ReadonlyPageEditor.
- 공유: share.service가 version_mode에 따라 page_versions.content 서빙. fixed+폐기 시 on_discard 분기(fallback = version 거리 최소 비폐기, 안내 배너).
- 미리보기 모달: 임의 버전 reader 시점(ReadonlyPageEditor 재사용).

### diff
- 기존 클라이언트 엔진 재사용: `recreateTransform` + `@tiptap/pm/changeset` (history-editor.tsx 계보). 저장 diff 없음, 두 content 런타임 비교.
- 비교 대상 선택기: 같은 페이지 버전(기본) + 다른 페이지→버전 선택(D4).

### 리뷰 앵커 (위험 지점)
- 기존: 인라인 anchor 노드가 라이브 문서에 삽입. 신규 패러다임: frozen 버전 위 리뷰.
- 방침: 마이그레이션된 v1 콘텐츠 내 기존 anchor 노드는 그대로 렌더(스키마 유지). 신규 앵커는 (version_id, block_id) 참조 + decoration 방식으로 전환(unique-id 인프라 재사용). 구현 중 폭발 시 객관식 질의로 회귀.

## Phases

### Phase 1 — DB 스키마 + 데이터 마이그레이션 ★최우선 품질
- Kysely 마이그레이션: page_versions·page_working_docs 신설, pages/reviews/shares 컬럼 추가, committed_tsv 인덱스.
- 데이터 마이그레이션(같은 마이그레이션 내): 전 페이지(휴지통 포함) → Primary 작업문서 생성(content/ydoc 복사), v0 마커, v1 = 현재 본문(D1), primary FK 세팅, committed 검색 미러, 기존 리뷰 version_id=v1, 기존 shares version_mode='primary'.
- db.d.ts / entity.types.ts 타입 반영.
- 자동 스냅샷 코드 제거(D8).
- 검증: 마이그레이션 카운트 정합(pages=working_docs=v1), down() 왕복, 도커 재빌드 후 기존 데이터 무손실 확인.

### Phase 2 — 서버 코어 API
- commit(문서확정): direct ydoc flush → 스냅샷 → version N+1 → 자동 Primary(D7) → committed 검색 미러 → 이벤트. 트랜잭션.
- versions list/info(content 포함), discard/undiscard, Primary swap, working doc CRUD(버전 N에서 생성·삭제·Primary 지정), 수정취소(리셋).
- room 규칙 확장 + persistence/auth extension 개편.
- Reader 서빙 분기(D6).

### Phase 3 — 공유·검색
- share version_mode/fixed/on_discard 서빙 + 생성 게이트(D2) + fallback 로직(D3).
- 검색 이원화(D10): committed 인덱스 기본, includeWorking 옵션(편집 권한자).

### Phase 4 — 클라이언트 코어 UI (Figma 16-2 시안 기준)
- 툴바 좌측 탭 작업문서/버전/리뷰 → AppShell.Aside 스위치 확장(리뷰 Drawer→aside 탭 이관).
- 버전 패널(카드: Primary 뱃지·폐기 strikethrough·⋯ 메뉴), 작업문서 패널(다중·아바타 스택·swap/생성/삭제).
- 푸터 floating pill(이모지+문서버전 N+diff stats+DIFF/수정취소/문서확정) + 확정 다이얼로그.
- 헤더 우측 Share 카운트 칩+미리보기, Edit/Read 토글 제거. breadcrumb.

### Phase 5 — diff 뷰·미리보기·공유 모달
- diff 뷰(버전간·작업문서↔base·문서간 D4), 미리보기 모달, 공유 모달 개편(새로 만들기/공유된 링크 탭·공유타입·폐기 시 동작).

### Phase 6 — 이모지 1급 + MCP
- 이모지 노출 3처 + 픽커(D11).
- MCP tool: list_versions·get_version·commit_version(D9). 기존 19개 tool 회귀 무결.

### Phase 7 — E2E 회귀 (.claude/rules/e2e_local.md)
- docker compose 재빌드, admin-e2e/user-e2e 계정, E2E- prefix 리소스.
- 핵심 시나리오: 마이그레이션 무손실 → 편집→확정→Primary→공유(고정/최신)→폐기 fallback → 다중 작업문서 → Reader 차단 → diff(버전간·문서간) → MCP commit.

## 진행 현황 (2026-07-03)

- **0.14.0**: Phase 1~7 완료. 실DB·엣지·신규설치 3중 마이그레이션 검증 + 실프로덕션(DHI 구버전 체인·LDMANA) dump 마이그레이션 통과. E2E 10/10.
- **0.14.1 (후속 갭 메우기)**:
  - A1 검색 "작업문서 포함" 토글 UI, A3 버전→새 페이지 Duplicate, A4 버전 다운로드(JSON·MD), A5 MCP 버전 tool 실검증(에이전트 편집→확정→냉동), A6 줄바꿈=버그 아님 확정.
  - **A2 리뷰 앵커 버전 귀속 (완전 개편)**: 앵커를 문서 콘텐츠에서 분리 → DB `(version_id, block_id, selected_text)` + decoration 오버레이. 노드 소멸 기반 GC 제거. **작업문서 전환·수정취소·버전 전환에도 앵커 무손실**(0.14.0에서 나간 회귀 수정). E2E: 전환/수정취소/미리보기/삭제/회귀 PASS. 레거시 인라인 노드는 하위호환 렌더 유지.

### 시안 대비 의도적 편차 (검토 요망)
- breadcrumb 를 본문 상단으로 옮기지 않고 헤더 좌측(탭 옆)에 유지 — 공유/휴지통 화면 회귀 위험 회피. 코스메틱이라 후속 조정 가능.
- 리뷰 패널은 기존 Drawer 유지(헤더 "리뷰" 탭이 토글). aside 통합·버전별 그룹핑("모든 리뷰 보기")은 후속.
- 이모지 픽커는 기존 사이드바 트리 픽커 재사용(표시 3처 + 기본 📄 반영). breadcrumb/pill 직접 클릭 변경은 후속.
- **리뷰 생성 진입점은 에디터 슬래시 "Review"만** — 리뷰 사이드바엔 생성 버튼 없음(기존 설계). 사이드바 "새 리뷰" 버튼은 후속 UX 후보.

## 비범위 (후속)
- page_history 데이터 물리 삭제, 작업문서 이력 복구 UI, 확정본 인덱스 고도화(스니펫 하이라이트), Artifacts(IDEA-02)·MCP upload(IDEA-03).
- 리뷰 패널 버전별 그룹핑 + "모든 리뷰 보기" 체크박스 (version_id 데이터는 이번에 기록됨).
