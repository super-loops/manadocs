import { ComponentWithCollection } from '@manadocs/db/repos/component/component.repo';

export const COMPONENT_INSTANCE_NODE = 'componentInstance';

/** 인스턴스 노드가 들고 다니는 컴포넌트 사본 — 확정 버전·공유·내보내기가 조회 없이 그린다 */
export interface ComponentInstanceAttrs {
  componentId: string;
  slug: string;
  kind: string;
  description: string | null;
  revision: number;
  src: string | null;
  attachmentId: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
}

export function fileSrc(attachmentId: string, fileName: string) {
  return `/api/files/${attachmentId}/${encodeURIComponent(fileName)}`;
}

export function instanceAttrsFor(
  component: Pick<
    ComponentWithCollection,
    | 'id'
    | 'slug'
    | 'kind'
    | 'description'
    | 'currentRevision'
    | 'latestAttachmentId'
    | 'latestFileName'
    | 'latestFileSize'
    | 'latestMimeType'
  >,
): ComponentInstanceAttrs {
  const hasAsset =
    component.currentRevision > 0 &&
    !!component.latestAttachmentId &&
    !!component.latestFileName;
  return {
    componentId: component.id,
    slug: component.slug,
    kind: component.kind,
    description: component.description ?? null,
    revision: hasAsset ? component.currentRevision : 0,
    src: hasAsset
      ? fileSrc(component.latestAttachmentId, component.latestFileName)
      : null,
    attachmentId: hasAsset ? component.latestAttachmentId : null,
    fileName: hasAsset ? component.latestFileName : null,
    fileSize:
      hasAsset && component.latestFileSize != null
        ? Number(component.latestFileSize)
        : null,
    mimeType: hasAsset ? component.latestMimeType : null,
  };
}

export interface InstanceLocation {
  componentId: string;
  revision: number;
  /** 최상위 블록 순번(0부터) */
  blockIndex: number;
  /** 최상위 블록 수 */
  blockCount: number;
  /** 문서 안 대략 위치 0~1 */
  ratio: number;
  /** 바로 앞 제목(없으면 null = 도입부) */
  heading: string | null;
}

function textOf(node: any): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

/**
 * 문서 JSON 에서 인스턴스와 대략 위치를 찾는다. 컬럼·콜아웃 같은 컨테이너 안에
 * 있어도 그 컨테이너의 최상위 블록 위치로 잡는다.
 */
export function findInstances(doc: any): InstanceLocation[] {
  const top: any[] = Array.isArray(doc?.content) ? doc.content : [];
  const out: InstanceLocation[] = [];
  let heading: string | null = null;

  const walk = (node: any, blockIndex: number) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === COMPONENT_INSTANCE_NODE && node.attrs?.componentId) {
      out.push({
        componentId: node.attrs.componentId,
        revision: Number(node.attrs.revision ?? 0),
        blockIndex,
        blockCount: top.length,
        ratio: top.length > 1 ? blockIndex / (top.length - 1) : 0,
        heading,
      });
    }
    for (const child of node.content ?? []) walk(child, blockIndex);
  };

  top.forEach((block, i) => {
    if (block?.type === 'heading') {
      heading = textOf(block).trim() || heading;
    }
    walk(block, i);
  });
  return out;
}

/**
 * MCP 가 넣는 `{type:"componentInstance", attrs:{component:"<slug>"}}` 를 실제
 * 사본 속성으로 바꾼다. resolver 가 slug/id 로 컴포넌트를 찾아 준다.
 */
export async function resolveInstanceNodes(
  content: any,
  resolve: (ref: string) => Promise<ComponentWithCollection | undefined>,
): Promise<{ content: any; instances: ComponentInstanceAttrs[] }> {
  const instances: ComponentInstanceAttrs[] = [];
  const visit = async (node: any): Promise<any> => {
    if (Array.isArray(node)) return Promise.all(node.map(visit));
    if (!node || typeof node !== 'object') return node;
    if (node.type === COMPONENT_INSTANCE_NODE) {
      const ref = String(
        node.attrs?.component ?? node.attrs?.componentId ?? node.attrs?.slug ?? '',
      ).trim();
      if (!ref) {
        const err: any = new Error(
          'componentInstance needs attrs.component (slug or id)',
        );
        err.code = 'COMPONENT_REF_REQUIRED';
        throw err;
      }
      const component = await resolve(ref);
      if (!component) {
        const err: any = new Error(
          `Component "${ref}" not found in this space. Create it first with create_component, or check list_components.`,
        );
        err.code = 'COMPONENT_NOT_FOUND';
        throw err;
      }
      const attrs = instanceAttrsFor(component);
      instances.push(attrs);
      return { type: COMPONENT_INSTANCE_NODE, attrs };
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: await visit(node.content) };
    }
    return node;
  };
  const next = await visit(content);
  return { content: next, instances };
}

export function containsInstanceNodes(content: any): boolean {
  if (!content) return false;
  if (typeof content === 'string') return false;
  return JSON.stringify(content).includes(`"${COMPONENT_INSTANCE_NODE}"`);
}
