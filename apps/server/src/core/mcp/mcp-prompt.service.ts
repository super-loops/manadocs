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
      `This is the Manadocs repository for the "${workspaceName}" workspace at ${appUrl}.`,
      '',
      '**Language**: Write page content and user-facing output in the user\'s language. This prompt is English for precision; that does not constrain your output.',
      '',
      '## Content authoring',
      '- When editing existing nodes, preserve the original Tiptap JSON (type/attrs/marks) exactly — colors, alignment, and custom marks must stay.',
      '- For new blocks, prefer these token-saving nodes:',
      '  - `{"type":"auto","text":"markdown..."}` — expands to block-level nodes (heading, paragraph, list, ...)',
      '  - `{"type":"autoInline","text":"**md**"}` — inline text+marks only (inside callout/listItem)',
      '- Only write explicit Tiptap nodes for special cases (colors, columns, embeds). The server expands `auto`/`autoInline` at save time.',
      '- **Before writing JSON content, call `describe_content_schema` if unsure about a node type.** Wrong node shapes cause save failures or render errors. Use the `nodeType` param for per-node detail.',
      '',
      '## Identifiers',
      '- **slugId is always 10 chars, alphanumeric only (no dashes).** Take the **last 10 chars** of the segment after `/p/`.',
      '- If the segment starts with a dash (empty title), **drop the dash** before taking the last 10:',
      '  - `/p/-AyYJbu54nZ` → `AyYJbu54nZ`',
      '- `spaceId` and `pageId`/`parentPageId` params accept UUID, slug, or URL fragments — they are normalized server-side.',
      '',
      '## Editing tools',
      '**Content changes go through `patch_page_blocks` only.** `update_page` and `duplicate_page` modify metadata (title, icon) only.',
      '- Edit specific blocks: `search_in_page` → `patch_page_blocks` with `replace` / `insertAfter` / `insertBefore` / `delete`',
      '- Append/prepend: `appendToEnd` / `prependToStart` (no target needed)',
      '- Duplicate a page tree: `duplicate_page` (same or different space, optional title/icon override). Edit content afterward via `patch_page_blocks`.',
      '- Inspect structure: `get_page_tree` (metadata only, no content)',
      '- `blockId` exists only on heading/paragraph blocks. Reference other blocks (list, table, ...) by `blockIndex`.',
      '- Spaces may have `authoringRules` (returned by `list_spaces` and `get_page_tree`). Follow them when writing content in that space. Set `includeSpaceDetail: false` on subsequent calls to save tokens.',
      '',
      '## Images and files (space components)',
      'You cannot attach files through page content. Images and files live as **components** in the space (organized in collections) and appear in pages as `componentInstance` nodes.',
      '1. Find or create the component: `list_components` (search by slug/description) → reuse it, or `create_component` (collection + slug + description). A taken slug returns `SLUG_TAKEN` with the existing component — reuse it if it is the same asset.',
      '2. Place it: insert `{"type":"componentInstance","attrs":{"component":"<slug>"}}` with `patch_page_blocks` (format `json`). The server fills the rest; the response lists the instances.',
      '3. Upload: `upload_ticket` → run the returned `curl` once (multipart POST, no token needed — the ticket is single-use and valid 10 minutes). Empty instances fill automatically.',
      '- If you cannot produce the file, stop after step 2 and write in `description` exactly what should go there — a person can drop the file onto that placeholder.',
      '- Never paste image bytes or data: URLs into content; they are not rendered.',
    ];

    if (instructions) {
      lines.push('', instructions);
    }

    return lines.join('\n');
  }
}
