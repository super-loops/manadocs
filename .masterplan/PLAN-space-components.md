---
title: 스페이스 컴포넌트 — 묶음·리비전·인스턴스와 에이전트 업로드 티켓
status: done
current_phase: 6
last_updated: 2026-11-09
designs:
  - https://claude.ai/artifact/5o4ug3EdicNd7fcDgcKscB
---

# PLAN — Space Components

## 의도 (유저 결정, 2026-11-09)

- 에이전트가 MCP로 사진·파일을 못 넣는다(업로드가 세션 JWT 전용). 플레이스홀더 → 티켓 → 업로드 → 치환 흐름이 필요.
- A(페이지 안 slug 인스턴스)를 건너뛰고 **바로 B: 스페이스 Component**. 마이그레이션 부담 회피.
- 컴포넌트는 **묶음(collection)** 에 산다. 사이드바 Components 슬롯 → 묶음 → 등록·편집. 그리드/목록 탐색.
- 컴포넌트는 **버전관리(리비전 r1, r2 … 불변)**. 예전 문서 버전은 예전 리비전을 가리킨다(인스턴스가 rev + 내용 사본을 든다).
- 인스턴스 이미지 교체 시 **«새 리비전으로 올릴지 / 이 문서에서만 바꿀지(연결 끊기)»** 를 묻는다. 대상은 경로(묶음 › 컴포넌트)로 보여준다. 리비전 덮어쓰기는 없다.
- 빈 컴포넌트(r0)는 «에셋 없음» 자리 + description. 사람이 끌어다 놓아 채운다. 첫 업로드는 수락 없이 채운다.
- 헤더 탭(버전·리뷰·Component)은 아이콘, 호버·활성 때 이름. 사이드바 섹션은 접히고 접히면 개수.
- 컴포넌트 상세는 연결된 문서와 대략 위치, 문서는 인스턴스의 컴포넌트 위치(묶음 경로)를 보여준다.
- 1차 범위: 이미지·파일 에셋만.
- 작업 후 MCP를 에이전트 입장에서 실측 검증.

## Phases

### Phase 1 — 서버 데이터 모델·API
- [x] 마이그레이션: component_collections · components · component_revisions · component_upload_tickets (usages 테이블은 두지 않음 — Deviations)
- [x] db.d.ts 타입, repo, ComponentService, REST 컨트롤러(세션 JWT)
- [x] 컴포넌트 첨부 저장(attachments.type='component', page_id NULL) · 서빙 권한(스페이스 열람) · 공개 공유 서명

### Phase 2 — 에디터 노드
- [x] editor-ext `componentInstance` 노드(서버·클라 확장 목록, HTML·마크다운 왕복)
- [x] NodeView: 이미지/파일/Empty 박스 · 연결 표시 · 끌어다 놓기 업로드 · 교체 선택 대화상자 · 연결 끊기 · 업데이트

### Phase 3 — 서버 측 동기화·사용처
- [x] 사용처는 작업문서·확정본 본문에서 온디맨드로 찾는다(위치 포함)
- [x] 새 리비전 업로드 → r0 인스턴스 자동 채움(Yjs, 업로더가 고칠 수 있는 페이지만), 나머지는 «업데이트 있음»

### Phase 4 — 클라이언트 UI
- [x] 사이드바 섹션 접기(개수 배지) + Components 묶음 슬롯
- [x] 묶음 화면(그리드/목록, 등록), 컴포넌트 상세(리비전, 연결된 문서·위치)
- [x] 헤더 아이콘 탭 + Component aside 패널(이 문서 인스턴스·미니맵·넣기)
- [x] ko-KR·en-US 동시, i18n:check

### Phase 5 — MCP
- [x] list_components · create_component(+묶음) · upload_ticket · 티켓 업로드 엔드포인트(MCP 토큰)
- [x] patch_page_blocks 의 componentInstance(slug 참조) 해석 + 응답에 인스턴스 목록
- [x] describe_content_schema · MCP 안내문

### Phase 6 — 실측 검증과 릴리스
- [x] 로컬 기동 → MCP 토큰으로 에이전트 흐름 실측(만들기→넣기→티켓→curl→채워짐) + 헤드리스 브라우저로 사람 흐름 확인
- [x] 타입·린트·i18n, 과제 단위 커밋
- [x] 푸시·minor bump — v0.20.0

## Deviations

- **사용처 색인 테이블을 두지 않았다.** 인스턴스는 pages 미러·작업문서·확정 버전 세 곳에 살고, 색인을 맞게 유지하려면 모든 저장 경로를 따라가야 한다. 작업문서·확정본 본문을 텍스트로 찾고 JSON 을 걸어 확인한다(스페이스 범위). — Fable 검토 #9
- **업로드 URL 은 티켓만으로 인증**(미리 서명된 URL처럼). 발급 토큰이 살아 있어야 하고, Authorization 을 보내면 같은 토큰이어야 한다. 에이전트가 MCP 토큰을 curl 에 적지 않게 하려고.
- **자동 채움은 업로더가 편집할 수 있는 페이지만.** 그 밖의 빈 인스턴스는 열렸을 때 최신 리비전 미리보기와 «채우기» 를 띄운다. — Fable 검토 #4
- **MCP 도구 오류를 isError 결과로** 돌려준다(전 도구 공통). code·hint·existing 같은 상세가 에이전트에게 닿게.
- **componentInstance 를 UniqueID 대상에 넣었다**(새 노드라 기존 문서 영향 없음) — diff 가 업데이트를 «수정»으로 잡게. 기존 image 는 넣지 않는다.

## 미룬 것 (알고서)

- 스페이스를 넘는 복제·이동·붙여넣기 시 연결 끊기 — 지금은 다른 스페이스 페이지가 컴포넌트를 참조할 수 있고, 그 스페이스 권한이 없으면 이미지가 안 보인다.
- 내보내기(zip)에 컴포넌트 파일 포함.
- 컴포넌트 상세의 «열기» 가 그 인스턴스 위치로 스크롤하기.
- 확정 버전에 남은 빈 자리(r0)는 확정본이므로 채우지 않는다 — 다음 확정 때 반영.
