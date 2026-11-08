import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import {
  pageEditorAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import {
  collectDocInstances,
  DocInstance,
} from "@/features/component/utils/instance-utils.ts";
import { useComponentsBulkQuery } from "@/features/component/queries/component-query.ts";
import { IComponent } from "@/features/component/types/component.types.ts";

export interface DocInstanceStatus extends DocInstance {
  component?: IComponent;
  empty: boolean;
  stale: boolean;
  canFill: boolean;
}

/**
 * 지금 열린 문서의 인스턴스와 각 컴포넌트의 현재 상태.
 * 헤더 Component 아이콘의 점, 오른쪽 패널 목록·미니맵이 같은 값을 쓴다.
 */
export function useDocInstances(spaceId: string | undefined) {
  const pageEditor = useAtomValue(pageEditorAtom);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);
  const editor = pageEditor ?? readOnlyEditor;
  const [instances, setInstances] = useState<DocInstance[]>([]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      // 에디터가 사라지면 목록도 비운다 — 앞 페이지 인스턴스를 들고 있지 않게
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstances([]);
      return;
    }
    const recompute = () => setInstances(collectDocInstances(editor));
    recompute();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, 300);
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
  }, [editor]);

  const { data: components } = useComponentsBulkQuery(
    spaceId,
    instances.map((i) => i.componentId),
  );

  const statuses: DocInstanceStatus[] = instances.map((i) => {
    const component = components?.find((c) => c.id === i.componentId);
    const empty = i.revision === 0;
    return {
      ...i,
      component,
      empty,
      stale: !!component && !empty && component.currentRevision > i.revision,
      canFill: !!component && empty && component.currentRevision > 0,
    };
  });

  return {
    editor,
    instances: statuses,
    needsAttention: statuses.some((s) => s.empty || s.stale),
  };
}
