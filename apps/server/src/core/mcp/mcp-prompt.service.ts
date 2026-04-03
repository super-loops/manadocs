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
    ];

    if (instructions) {
      lines.push('', instructions);
    }

    return lines.join('\n');
  }
}
