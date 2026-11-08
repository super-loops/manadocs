import { Injectable, Logger } from '@nestjs/common';
import { Hocuspocus, Document } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  prosemirrorNodeToYElement,
  tiptapExtensions,
} from './collaboration.util';
import * as Y from 'yjs';
import { User } from '@manadocs/db/types/entity.types';

export type CollabEventHandlers = ReturnType<
  CollaborationHandler['getHandlers']
>;

@Injectable()
export class CollaborationHandler {
  private readonly logger = new Logger(CollaborationHandler.name);

  constructor() {}

  getHandlers(hocuspocus: Hocuspocus) {
    return {
      alterState: async (documentName: string, payload: { pageId: string }) => {
        // dummy
        // this.logger.log('Processing', documentName, payload);
        // await this.withYdocConnection(hocuspocus, documentName, {}, (doc) => {
        //   const fragment = doc.getXmlFragment('default');
        //});
      },
      patchPageBlocks: async (
        documentName: string,
        payload: {
          operations: Array<{
            op:
              | 'replace'
              | 'insertAfter'
              | 'insertBefore'
              | 'delete'
              | 'appendToEnd'
              | 'prependToStart';
            blockId?: string | null;
            blockIndex?: number | null;
            nodes?: any[];
          }>;
          user: User;
        },
      ) => {
        const { operations, user } = payload;
        this.logger.debug('Patching page blocks via yjs', documentName);
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');

            const resolveIndex = (
              blockId: string | null | undefined,
              blockIndex: number | null | undefined,
            ): number => {
              if (blockId) {
                const items = fragment.toArray();
                for (let i = 0; i < items.length; i++) {
                  const el = items[i] as Y.XmlElement;
                  if (
                    typeof (el as any).getAttribute === 'function' &&
                    el.getAttribute('id') === blockId
                  ) {
                    return i;
                  }
                }
                return -1;
              }
              if (
                typeof blockIndex === 'number' &&
                blockIndex >= 0 &&
                blockIndex < fragment.length
              ) {
                return blockIndex;
              }
              return -1;
            };

            for (const op of operations) {
              // appendToEnd / prependToStart do not require a target block
              if (op.op === 'appendToEnd') {
                const yEls = (op.nodes ?? []).map(prosemirrorNodeToYElement);
                if (yEls.length > 0) fragment.insert(fragment.length, yEls);
                continue;
              }
              if (op.op === 'prependToStart') {
                const yEls = (op.nodes ?? []).map(prosemirrorNodeToYElement);
                if (yEls.length > 0) fragment.insert(0, yEls);
                continue;
              }

              const idx = resolveIndex(op.blockId, op.blockIndex);
              if (idx === -1) continue;

              if (op.op === 'delete') {
                fragment.delete(idx, 1);
              } else if (op.op === 'replace') {
                const yEls = (op.nodes ?? []).map(prosemirrorNodeToYElement);
                fragment.delete(idx, 1);
                if (yEls.length > 0) fragment.insert(idx, yEls);
              } else if (op.op === 'insertAfter') {
                const yEls = (op.nodes ?? []).map(prosemirrorNodeToYElement);
                if (yEls.length > 0) fragment.insert(idx + 1, yEls);
              } else if (op.op === 'insertBefore') {
                const yEls = (op.nodes ?? []).map(prosemirrorNodeToYElement);
                if (yEls.length > 0) fragment.insert(idx, yEls);
              }
            }
          },
        );
      },
      /**
       * 컴포넌트 인스턴스의 사본 속성을 갈아 끼운다. onlyRevision 이 주어지면 그
       * 리비전의 인스턴스만(빈 자리 r0 자동 채움). 바꾼 개수를 돌려준다.
       */
      updateComponentInstances: async (
        documentName: string,
        payload: {
          componentId: string;
          attrs: Record<string, any>;
          onlyRevision?: number | null;
          user: User;
        },
      ): Promise<number> => {
        const { componentId, attrs, onlyRevision, user } = payload;
        let changed = 0;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');
            const walk = (parent: Y.XmlFragment | Y.XmlElement) => {
              for (const child of parent.toArray()) {
                if (!(child instanceof Y.XmlElement)) continue;
                if (
                  child.nodeName === 'componentInstance' &&
                  child.getAttribute('componentId') === componentId
                ) {
                  const rev = Number(child.getAttribute('revision') ?? 0);
                  if (
                    onlyRevision === undefined ||
                    onlyRevision === null ||
                    rev === onlyRevision
                  ) {
                    for (const [key, value] of Object.entries(attrs)) {
                      child.setAttribute(key, value as any);
                    }
                    changed++;
                  }
                }
                walk(child);
              }
            };
            walk(fragment);
          },
        );
        return changed;
      },
      updatePageContent: async (
        documentName: string,
        payload: {
          prosemirrorJson: any;
          operation: string;
          user: User;
        },
      ) => {
        const { prosemirrorJson, operation, user } = payload;
        this.logger.debug('Updating page content via yjs', documentName);
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');

            if (operation === 'replace') {
              if (fragment.length > 0) {
                fragment.delete(0, fragment.length);
              }

              const newDoc = TiptapTransformer.toYdoc(
                prosemirrorJson,
                'default',
                tiptapExtensions,
              );
              Y.applyUpdate(doc, Y.encodeStateAsUpdate(newDoc));
            } else {
              const newContent = prosemirrorJson.content || [];
              const yElements = newContent.map(prosemirrorNodeToYElement);
              const position = operation === 'prepend' ? 0 : fragment.length;
              fragment.insert(position, yElements);
            }
          },
        );
      },
    };
  }

  async withYdocConnection(
    hocuspocus: Hocuspocus,
    documentName: string,
    context: any = {},
    fn: (doc: Document) => void,
  ): Promise<void> {
    const connection = await hocuspocus.openDirectConnection(
      documentName,
      context,
    );
    try {
      await connection.transact(fn);
    } finally {
      await connection.disconnect();
    }
  }
}
