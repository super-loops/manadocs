import { Injectable } from '@nestjs/common';
import { WorkspaceRepo } from '@manadocs/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';

@Injectable()
export class McpPromptService {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  async buildSystemPrompt(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    const appUrl = this.environmentService.getAppUrl();
    const workspaceName = workspace?.name ?? '';
    const instructions = (workspace?.mcpInstructions ?? '').trim();

    const lines = [
      '이곳은 Manadocs 문서 저장소입니다.',
      `${appUrl}에 위치한 ${workspaceName} 워크스페이스의 문서입니다.`,
      '',
      '## 컨텐츠 작성 가이드',
      '기존 문서를 수정할 때는 가능한 한 원본 문서의 Tiptap JSON 포맷(노드 type, attrs, marks)을 유지하세요. 색상, 정렬, 커스텀 마크 등은 원본 노드 그대로 보존해야 합니다.',
      '',
      '새로 추가하는 블록은 토큰 절약을 위해 `auto` 노드를 사용할 수 있습니다:',
      '- `{"type":"auto","text":"markdown..."}` → 블록 레벨로 확장 (heading, paragraph, list 등)',
      '- `{"type":"autoInline","text":"inline **md**"}` → 인라인 text+marks만 생성 (callout/listItem 안에서 사용)',
      '',
      '특수 노드(색상, 컬럼, embed 등)를 정확히 지정해야 할 때만 명시적 Tiptap 노드를 작성하고, 일반 텍스트는 `auto`를 사용하세요. update_page/create_page의 format=json에서 서버가 저장 직전에 자동 파싱합니다.',
      '',
      '## URL에서 식별자 추출',
      '사용자가 `/s/<space-slug>/p/<title-slug>-<page-slug-id>` 형식의 링크를 첨부할 수 있습니다.',
      '',
      '**page slug ID 추출 규칙 (중요)**:',
      '- slugId는 **항상 10자 고정**이고, **영문 대소문자+숫자만** 포함합니다 (대시/언더스코어 없음).',
      '- `/p/` 뒤 세그먼트의 **마지막 10자**가 slugId입니다.',
      '- title이 비어있으면 세그먼트가 `-<slugId>`처럼 대시로 시작할 수 있습니다. 이때 **대시는 slugId의 일부가 아닙니다** — 반드시 제외하고 마지막 10자만 사용하세요.',
      '',
      '예시:',
      '- `/s/docs/p/getting-started-AyYJbu54nZ` → spaceSlug=`docs`, pageId=`AyYJbu54nZ`',
      '- `/s/ops/p/-AyYJbu54nZ` → spaceSlug=`ops`, pageId=`AyYJbu54nZ` (앞 대시 제거, 마지막 10자)',
      '- `/p/AyYJbu54nZ` (드문 케이스) → pageId=`AyYJbu54nZ`',
      '',
      '식별자 파라미터는 모두 관대하게 처리됩니다:',
      '- `spaceId` 파라미터 → UUID 또는 space slug 둘 다 가능',
      '- `pageId` / `parentPageId` 파라미터 → UUID, 10자 slugId, 또는 URL 일부(`title-AyYJbu54nZ`, `-AyYJbu54nZ`, `/s/docs/p/title-AyYJbu54nZ`)까지 자동 추출',
      '',
      '## 편집 도구 선택 가이드',
      '- **특정 블록만 수정**: search_in_page로 위치 찾기 → patch_page_blocks로 블록 단위 replace/insertAfter/insertBefore/delete (토큰 절약, 추천)',
      '- **페이지 끝에 내용 추가**: update_page에 operation=append, format=markdown (간단)',
      '- **페이지 전체 교체**: update_page에 operation=replace (신중히, 원본 포맷 손실 위험)',
      '- **페이지 구조 파악/목차 생성**: get_page_tree로 트리 조회 (content 없이 메타데이터만)',
      'blockId는 heading/paragraph 블록에만 붙습니다. 그 외 블록(list, table 등)은 blockIndex로 참조하세요.',
      '',
      'JSON 컨텐츠 작성 중 노드 타입/attrs가 헷갈리면 `describe_content_schema`를 호출하세요. nodeType 파라미터로 개별 노드(callout, taskItem, link 등) 상세 예시를 얻을 수 있습니다.',
    ];

    if (instructions) {
      lines.push('', instructions);
    }

    return lines.join('\n');
  }
}
