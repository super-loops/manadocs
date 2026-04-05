import { Injectable, Logger } from '@nestjs/common';
import { Hocuspocus, Document } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import {
  prosemirrorNodeToYElement,
  tiptapExtensions,
} from './collaboration.util';
import { setYjsMark, updateYjsMarkAttribute, YjsSelection } from './yjs.util';
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
      setCommentMark: async (
        documentName: string,
        payload: {
          yjsSelection: YjsSelection;
          commentId: string;
          resolved: boolean;
          user: User;
        },
      ) => {
        const { yjsSelection, commentId, resolved, user } = payload;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');
            setYjsMark(doc, fragment, yjsSelection, 'comment', {
              commentId,
              resolved,
            });
          },
        );
      },
      resolveCommentMark: async (
        documentName: string,
        payload: {
          commentId: string;
          resolved: boolean;
          user: User;
        },
      ) => {
        const { commentId, resolved, user } = payload;
        await this.withYdocConnection(
          hocuspocus,
          documentName,
          { user },
          (doc) => {
            const fragment = doc.getXmlFragment('default');
            updateYjsMarkAttribute(
              fragment,
              'comment',
              { name: 'commentId', value: commentId },
              { resolved },
            );
          },
        );
      },
      patchPageBlocks: async (
        documentName: string,
        payload: {
          operations: Array<{
            op: 'replace' | 'insertAfter' | 'insertBefore' | 'delete';
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
