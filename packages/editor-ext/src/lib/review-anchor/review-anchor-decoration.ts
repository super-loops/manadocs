import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface ReviewAnchorDeco {
  anchorId: string;
  reviewId: string;
  blockId: string;
  /** 표시 라벨 (예: "💬 #1:2") — 클라이언트에서 계산해 주입 */
  label: string;
  /** 상태 색상 */
  bg: string;
  fg: string;
  status: string;
}

export interface ReviewAnchorDecorationOptions {
  /** 앵커 pill 클릭 시 호출 (reviewId 전달) */
  onAnchorClick?: (reviewId: string) => void;
}

export const reviewAnchorDecorationKey = new PluginKey('reviewAnchorDecoration');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    reviewAnchorDecoration: {
      setReviewAnchorDecorations: (anchors: ReviewAnchorDeco[]) => ReturnType;
    };
  }
}

/**
 * 리뷰 앵커를 문서 콘텐츠가 아니라 decoration 으로 오버레이한다.
 * 앵커는 DB 레지스트리(anchorId, reviewId, blockId)만 들고 있고, 여기서
 * blockId(=block 의 unique-id) 에 해당하는 노드를 찾아 그 블록 끝에 클릭
 * 가능한 pill 위젯을 그린다. 콘텐츠에 노드를 심지 않으므로 작업문서/버전
 * 전환에도 앵커가 소실되지 않는다.
 *
 * 레거시(인라인 reviewAnchor 노드로 냉동된 과거 버전)와의 이중 렌더를 막기
 * 위해, 문서에 이미 같은 anchorId 인라인 노드가 있으면 decoration 을 생략한다.
 */
export const ReviewAnchorDecoration =
  Extension.create<ReviewAnchorDecorationOptions>({
    name: 'reviewAnchorDecoration',

    addOptions() {
      return {
        onAnchorClick: undefined,
      };
    },

    addStorage() {
      return {
        anchors: [] as ReviewAnchorDeco[],
      };
    },

    addCommands() {
      return {
        setReviewAnchorDecorations:
          (anchors: ReviewAnchorDeco[]) =>
          ({ editor, dispatch, tr }) => {
            (editor.storage as any).reviewAnchorDecoration.anchors =
              anchors ?? [];
            if (dispatch) {
              dispatch(tr.setMeta(reviewAnchorDecorationKey, true));
            }
            return true;
          },
      };
    },

    addProseMirrorPlugins() {
      const extension = this;

      const buildDecorations = (doc: PMNode): DecorationSet => {
        const anchors: ReviewAnchorDeco[] =
          (extension.storage as any)?.anchors ?? [];
        if (anchors.length === 0) return DecorationSet.empty;

        // 1) block id → 문서 내 위치, 2) 이미 인라인 노드로 존재하는 anchorId 수집
        const blockPos = new Map<string, { pos: number; node: PMNode }>();
        const inlineAnchorIds = new Set<string>();

        doc.descendants((node, pos) => {
          const id = node.attrs?.id;
          if (id && !blockPos.has(id)) {
            blockPos.set(id, { pos, node });
          }
          if (node.type.name === 'reviewAnchor') {
            const aid = node.attrs?.anchorId;
            if (aid) inlineAnchorIds.add(aid);
          }
          return true;
        });

        const decorations: Decoration[] = [];

        for (const anchor of anchors) {
          if (!anchor.blockId) continue;
          if (inlineAnchorIds.has(anchor.anchorId)) continue; // 레거시 이중 렌더 방지
          const target = blockPos.get(anchor.blockId);
          if (!target) continue; // 이 문서/버전엔 그 블록이 없음 → 오버레이 생략

          // 블록 내부 끝 위치 (닫는 토큰 직전)
          const endInside = target.pos + target.node.nodeSize - 1;

          decorations.push(
            Decoration.widget(
              endInside,
              () => buildPill(anchor, extension.options.onAnchorClick),
              { side: 1, key: `review-anchor-${anchor.anchorId}` },
            ),
          );
        }

        return DecorationSet.create(doc, decorations);
      };

      return [
        new Plugin({
          key: reviewAnchorDecorationKey,
          state: {
            init: (_, { doc }) => buildDecorations(doc),
            apply(tr, old) {
              if (tr.docChanged || tr.getMeta(reviewAnchorDecorationKey)) {
                return buildDecorations(tr.doc);
              }
              return old;
            },
          },
          props: {
            decorations(state) {
              return this.getState(state);
            },
          },
        }),
      ];
    },
  });

function buildPill(
  anchor: ReviewAnchorDeco,
  onClick?: (reviewId: string) => void,
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'review-anchor-target';
  span.setAttribute('role', 'button');
  span.setAttribute('tabindex', '0');
  span.setAttribute('data-anchor-id', anchor.anchorId);
  span.setAttribute('data-review-id', anchor.reviewId);
  span.setAttribute('data-status', anchor.status);
  span.textContent = anchor.label;
  span.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'padding:0 6px',
    'margin:0 2px',
    'border-radius:4px',
    'font-size:0.85em',
    'font-weight:600',
    'line-height:1.6',
    'cursor:pointer',
    'user-select:none',
    'white-space:nowrap',
    'vertical-align:baseline',
    `background-color:${anchor.bg}`,
    `color:${anchor.fg}`,
  ].join(';');

  const fire = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(anchor.reviewId);
  };
  span.addEventListener('mousedown', (e) => e.preventDefault());
  span.addEventListener('click', fire);
  span.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fire(e);
  });
  return span;
}
