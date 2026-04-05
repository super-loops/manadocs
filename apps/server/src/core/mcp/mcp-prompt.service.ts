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
    ];

    if (instructions) {
      lines.push('', instructions);
    }

    return lines.join('\n');
  }
}
