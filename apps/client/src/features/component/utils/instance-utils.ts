import { Editor } from "@tiptap/core";
import { IComponentInstanceAttrs } from "@/features/component/types/component.types.ts";

export const COMPONENT_INSTANCE = "componentInstance";

export function componentPath(spaceSlug: string, componentId: string) {
  return `/s/${spaceSlug}/components/c/${componentId}`;
}

export function collectionPath(spaceSlug: string, collectionId: string) {
  return `/s/${spaceSlug}/components/${collectionId}`;
}

/** 사본 속성만 — 정렬·너비 같은 문서 쪽 속성은 건드리지 않는다 */
function copyAttrs(next: IComponentInstanceAttrs) {
  return {
    componentId: next.componentId,
    slug: next.slug,
    kind: next.kind,
    description: next.description,
    revision: next.revision,
    src: next.src,
    attachmentId: next.attachmentId,
    fileName: next.fileName,
    fileSize: next.fileSize,
    mimeType: next.mimeType,
  };
}

/**
 * 이 문서 안 같은 컴포넌트의 인스턴스를 한 트랜잭션으로 바꾼다 — 리비전이
 * 섞이지 않게(«업데이트» 한 번 = 문서 수정 한 건).
 */
export function updateInstancesInDoc(
  editor: Editor,
  componentId: string,
  next: IComponentInstanceAttrs,
) {
  if (!editor.isEditable) return;
  const { state } = editor;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (
      node.type.name === COMPONENT_INSTANCE &&
      node.attrs.componentId === componentId
    ) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...copyAttrs(next) });
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

/**
 * 연결 끊기 — 인스턴스를 일반 이미지(또는 첨부)로 바꾼다. replacement 가 주어지면
 * 그 파일로(«이 문서에서만 바꾸기»), 아니면 지금 사본 그대로.
 */
export function detachInstanceNode(
  editor: Editor,
  getPos: (() => number | undefined) | boolean,
  replacement: { id: string; fileName: string; fileSize?: number; mimeType?: string } | null,
  attrs: IComponentInstanceAttrs & { width?: any; align?: string },
) {
  if (!editor.isEditable || typeof getPos !== "function") return;
  const pos = getPos();
  if (typeof pos !== "number") return;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;

  const src = replacement
    ? `/api/files/${replacement.id}/${encodeURIComponent(replacement.fileName)}`
    : attrs.src;
  const attachmentId = replacement ? replacement.id : attrs.attachmentId;
  const fileName = replacement ? replacement.fileName : attrs.fileName;
  if (!src) return;

  const isImage = replacement
    ? (replacement.mimeType ?? "").startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(replacement.fileName)
    : attrs.kind === "image";

  const schema = editor.state.schema;
  const newNode = isImage
    ? schema.nodes.image.create({
        src,
        attachmentId,
        alt: attrs.description ?? undefined,
        align: attrs.align ?? "center",
        size: replacement?.fileSize ?? attrs.fileSize ?? null,
      })
    : schema.nodes.attachment.create({
        url: src,
        name: fileName,
        mime: replacement?.mimeType ?? attrs.mimeType ?? undefined,
        size: replacement?.fileSize ?? attrs.fileSize ?? null,
        attachmentId,
      });
  editor.view.dispatch(
    editor.state.tr.replaceWith(pos, pos + node.nodeSize, newNode),
  );
}

export interface DocInstance {
  componentId: string;
  slug: string | null;
  revision: number;
  pos: number;
  /** 0~1 — 문서 안 대략 위치 */
  ratio: number;
  heading: string | null;
}

/** 지금 에디터 문서의 인스턴스와 위치(미니맵·패널) */
export function collectDocInstances(editor: Editor | null): DocInstance[] {
  if (!editor || editor.isDestroyed) return [];
  const doc = editor.state.doc;
  const size = Math.max(doc.content.size, 1);
  const out: DocInstance[] = [];
  let heading: string | null = null;
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      heading = node.textContent.trim() || heading;
    }
    if (node.type.name === COMPONENT_INSTANCE && node.attrs.componentId) {
      out.push({
        componentId: node.attrs.componentId,
        slug: node.attrs.slug,
        revision: Number(node.attrs.revision ?? 0),
        pos,
        ratio: pos / size,
        heading,
      });
    }
  });
  return out;
}
