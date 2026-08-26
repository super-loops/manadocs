import { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import {
  editorPageId,
  pageEditorAtom,
  pageEditorContentReadyAtom,
} from "@/features/editor/atoms/editor-atoms";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageVersionQuery } from "@/features/page-version/queries/page-version-query";
import { computeUncommittedStats } from "@/features/page-version/utils/working-diff";
import { extractPageSlugId } from "@/lib";

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
  const contentReady = useAtomValue(pageEditorContentReadyAtom);
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
      // contentReady 전에는 collab 에디터가 빈 문서라, 확정본과 비교하면
      // 아무것도 안 고친 페이지가 «−N» 유령으로 목록에 올라온다(N-8)
      if (!editor || editor.isDestroyed || !page || !contentReady) {
        setStats(null);
        return;
      }
      // 페이지를 옮기는 한 프레임 동안 atom 에는 아직 **앞 페이지의** 에디터가
      // 실려 있다(트리 hover prefetch 로 언마운트·마운트가 같은 커밋에 일어나면
      // contentReady 스냅샷도 아직 true 다). 에디터에 찍힌 pageId 를 호출 시점에
      // 대조해, 앞 페이지의 본문을 이 페이지의 통계로 내보내지 않는다.
      if (editorPageId(editor) !== page.id) {
        setStats(null);
        return;
      }
      if (primaryVersionId && !primaryContent) return; // Primary 로딩 중 — 직전 값 유지
      // footer pill·결합 패널 뱃지와 같은 함수 (F-1: 셋이 갈라지면 갓 만든 빈
      // 페이지가 사이드바에만 유령으로 남는다)
      setStats(
        computeUncommittedStats(
          editor,
          primaryVersionId ? primaryContent : null,
          editor.getJSON(),
        ),
      );
    },
    [editor, page, primaryVersionId, primaryContent, contentReady],
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
