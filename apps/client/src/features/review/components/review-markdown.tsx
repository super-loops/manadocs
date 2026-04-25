import { useMemo } from "react";
import { TypographyStylesProvider } from "@mantine/core";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface ReviewMarkdownProps {
  /** Plain text + markdown 문법으로 저장된 본문/코멘트 문자열 */
  content: string | null | undefined;
}

const MARKED_OPTIONS = { gfm: true, breaks: true };

export default function ReviewMarkdown({ content }: ReviewMarkdownProps) {
  const html = useMemo(() => {
    if (!content) return "";
    const raw = marked.parse(content, MARKED_OPTIONS) as string;
    return DOMPurify.sanitize(raw);
  }, [content]);

  if (!html) return null;

  return (
    <TypographyStylesProvider
      style={{ fontSize: "0.9em" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
