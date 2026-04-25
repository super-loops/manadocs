import { useMemo } from "react";
import { TypographyStylesProvider } from "@mantine/core";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface ReviewMarkdownProps {
  /** Plain text + markdown 문법으로 저장된 본문/코멘트 문자열 */
  content: string | null | undefined;
}

const MARKED_OPTIONS = { gfm: true, breaks: true };

// 외부 링크는 새 탭으로 열도록 a 태그에 target/rel 추가.
// module-level에서 한 번만 등록 (DOMPurify hook은 글로벌).
if (typeof window !== "undefined") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName !== "A") return;
    const href = node.getAttribute("href");
    if (!href) return;
    let isExternal = false;
    try {
      // protocol-relative 또는 절대 URL만 외부로 판정. 상대 경로는 내부.
      if (/^https?:\/\//i.test(href) || href.startsWith("//")) {
        const url = new URL(
          href.startsWith("//") ? `https:${href}` : href,
          window.location.origin,
        );
        isExternal = url.origin !== window.location.origin;
      }
    } catch {
      // URL parse 실패하면 보수적으로 내부로 둔다
    }
    if (isExternal) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export default function ReviewMarkdown({ content }: ReviewMarkdownProps) {
  const html = useMemo(() => {
    if (!content) return "";
    const raw = marked.parse(content, MARKED_OPTIONS) as string;
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ["target", "rel"],
    });
  }, [content]);

  if (!html) return null;

  return (
    <TypographyStylesProvider
      style={{ fontSize: "0.9em" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
