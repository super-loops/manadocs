import { markdownToHtml } from '@manadocs/editor-ext';
import { htmlToJson } from '../../../collaboration/collaboration.util';

/**
 * MCP `auto` nodes let the LLM send markdown fragments inside a Tiptap doc
 * and have the server expand them to real Tiptap nodes at save-time.
 *
 *   { type: 'auto', text: '# heading\n\n- item' }       → block-level expansion
 *   { type: 'autoInline', text: '**bold** and `code`' }  → inline-only expansion
 *
 * Both accept an optional `attrs.format` of 'markdown' (default) or 'html'.
 */

type AnyNode = {
  type?: string;
  content?: AnyNode[];
  text?: string;
  attrs?: Record<string, any>;
  marks?: any[];
  [key: string]: any;
};

async function expandText(
  text: string,
  format: 'markdown' | 'html',
): Promise<AnyNode> {
  const html =
    format === 'html' ? text : (await markdownToHtml(text)) as string;
  return htmlToJson(html) as AnyNode;
}

async function expandAutoBlock(node: AnyNode): Promise<AnyNode[]> {
  const text = typeof node.text === 'string' ? node.text : '';
  if (!text.trim()) return [];
  const format = (node.attrs?.format as 'markdown' | 'html') ?? 'markdown';
  const doc = await expandText(text, format);
  return Array.isArray(doc.content) ? doc.content : [];
}

async function expandAutoInline(node: AnyNode): Promise<AnyNode[]> {
  const text = typeof node.text === 'string' ? node.text : '';
  if (!text) return [];
  const format = (node.attrs?.format as 'markdown' | 'html') ?? 'markdown';
  const doc = await expandText(text, format);
  // Flatten: collect inline nodes from every paragraph/heading child.
  const inline: AnyNode[] = [];
  const visit = (n: AnyNode) => {
    if (!n) return;
    if (n.type === 'text') {
      inline.push(n);
      return;
    }
    if (Array.isArray(n.content)) n.content.forEach(visit);
  };
  (doc.content ?? []).forEach(visit);
  return inline;
}

export async function expandAutoNodes(doc: any): Promise<any> {
  if (!doc || typeof doc !== 'object') return doc;

  const walk = async (node: AnyNode): Promise<AnyNode | AnyNode[]> => {
    if (!node || typeof node !== 'object') return node;

    if (node.type === 'auto') {
      try {
        return await expandAutoBlock(node);
      } catch {
        // fallback: plain paragraph with the raw text
        return [
          {
            type: 'paragraph',
            content: node.text ? [{ type: 'text', text: node.text }] : [],
          },
        ];
      }
    }

    if (node.type === 'autoInline') {
      try {
        return await expandAutoInline(node);
      } catch {
        return node.text ? [{ type: 'text', text: node.text }] : [];
      }
    }

    if (Array.isArray(node.content)) {
      const next: AnyNode[] = [];
      for (const child of node.content) {
        const out = await walk(child);
        if (Array.isArray(out)) next.push(...out);
        else if (out) next.push(out);
      }
      return { ...node, content: next };
    }

    return node;
  };

  const result = await walk(doc);
  return Array.isArray(result) ? { type: 'doc', content: result } : result;
}

export function docContainsAutoNodes(doc: any): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (doc.type === 'auto' || doc.type === 'autoInline') return true;
  if (Array.isArray(doc.content)) {
    return doc.content.some(docContainsAutoNodes);
  }
  return false;
}
