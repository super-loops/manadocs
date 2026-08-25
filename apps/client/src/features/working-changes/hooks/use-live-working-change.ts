import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageVersionQuery } from "@/features/page-version/queries/page-version-query";
import { computeDiffStats } from "@/features/page-version/utils/working-diff";
import { extractPageSlugId } from "@/lib";

/** 미확정 문서의 통계 기준 — footer pill 과 동일 */
const EMPTY_DOC = { type: "doc", content: [] };

export interface LiveWorkingChange {
  pageId: string;
  spaceId: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  added: number;
  deleted: number;
}

/**
 * 지금 열려 있는 페이지의 미확정 수정 통계를 라이브 에디터에서 계산한다.
 *
 * 서버 목록(working-changes)은 협업 저장 디바운스만큼 뒤처지므로, 열려 있는
 * 페이지만큼은 이 값으로 덮어써서 사이드바와 footer pill 의 +N -N 이 절대
 * 어긋나지 않게 한다 — footer 와 **같은 훅·같은 diff 엔진·같은 입력**을 쓴다.
 *
 * 열린 페이지가 없거나 아직 계산 전이면 null.
 */
export function useLiveWorkingChange(): LiveWorkingChange | null {
  const { pageSlug } = useParams();
  const editor = useAtomValue(pageEditorAtom);
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const primaryVersionId = page?.primaryVersionId ?? null;
  const { data: primaryVersion } = usePageVersionQuery(primaryVersionId);
  const primaryContent = primaryVersion?.content ?? null;

  const [stats, setStats] = useState<{ added: number; deleted: number } | null>(
    null,
  );

  const recompute = useMemo(
    () => () => {
      if (!editor || editor.isDestroyed || !page) {
        setStats(null);
        return;
      }
      // 확정본이 없으면 빈 문서 대비로 낸다 (footer pill 과 동일 규칙)
      if (!primaryVersionId) {
        setStats(computeDiffStats(editor, EMPTY_DOC, editor.getJSON()));
        return;
      }
      if (!primaryContent) return; // Primary 로딩 중 — 직전 값 유지
      setStats(computeDiffStats(editor, primaryContent, editor.getJSON()));
    },
    [editor, page, primaryVersionId, primaryContent],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      setStats(null);
      return;
    }
    recompute();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, 400);
    };
    editor.on("update", onUpdate);
    return () => {
      if (timer) clearTimeout(timer);
      try {
        editor.off("update", onUpdate);
      } catch {
        // editor 정리됨
      }
    };
  }, [editor, recompute]);

  if (!page || !stats) return null;
  return {
    pageId: page.id,
    spaceId: page.spaceId,
    slugId: page.slugId,
    title: page.title ?? null,
    icon: page.icon ?? null,
    added: stats.added,
    deleted: stats.deleted,
  };
}
