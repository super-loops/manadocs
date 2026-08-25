import { useMemo } from "react";
import { Group, Text, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useWorkingChangesQuery } from "@/features/working-changes/queries/working-changes-query";
import { useLiveWorkingChange } from "@/features/working-changes/hooks/use-live-working-change";
import { IWorkingChange } from "@/features/working-changes/types/working-changes.types";
import { buildPageUrl } from "@/features/page/page.utils";
import classes from "./working-changes-section.module.css";

interface WorkingChangesSectionProps {
  spaceId: string;
  spaceSlug: string;
}

/**
 * 사이드바 페이지 트리 위 "수정중" 섹션.
 * 아직 확정하지 않은 수정이 남은 페이지를 `+N −N` 통계와 함께 보여준다.
 * 한 건도 없으면 섹션 자체가 렌더되지 않는다.
 */
export default function WorkingChangesSection({
  spaceId,
  spaceSlug,
}: WorkingChangesSectionProps) {
  const { t } = useTranslation();
  const { data } = useWorkingChangesQuery(spaceId);
  const live = useLiveWorkingChange();

  // 열려 있는 페이지는 라이브 통계로 덮는다 — 서버 목록은 협업 저장 디바운스만큼
  // 뒤처지고, footer pill 과 숫자가 어긋나 보이면 안 된다.
  const items = useMemo<IWorkingChange[]>(() => {
    const serverItems = data ?? [];
    // 다른 스페이스를 보고 있으면 라이브 값은 이 섹션과 무관하다
    if (!live || live.spaceId !== spaceId) return serverItems;

    const hasLiveChanges = live.added > 0 || live.deleted > 0;

    if (!hasLiveChanges) {
      // 방금 되돌려 변경이 없어졌다 — 서버가 따라오기 전에 목록에서 뺀다
      return serverItems.filter((item) => item.pageId !== live.pageId);
    }
    if (serverItems.some((item) => item.pageId === live.pageId)) {
      return serverItems.map((item) =>
        item.pageId === live.pageId
          ? { ...item, added: live.added, deleted: live.deleted }
          : item,
      );
    }
    // 방금 고치기 시작해 서버 목록에 아직 없다 (협업 저장 디바운스) — 먼저 얹는다
    return [
      {
        pageId: live.pageId,
        slugId: live.slugId,
        title: live.title,
        icon: live.icon,
        added: live.added,
        deleted: live.deleted,
      },
      ...serverItems,
    ];
  }, [data, live, spaceId]);

  if (items.length === 0) return null;

  return (
    <div className={classes.section}>
      <Group className={classes.header} justify="space-between">
        <Text size="xs" fw={500} c="dimmed">
          {t("수정중")}
        </Text>
        <Text size="xs" c="dimmed">
          {items.length}
        </Text>
      </Group>

      <div className={classes.list}>
        {items.map((item) => (
          <WorkingChangeRow
            key={item.pageId}
            item={item}
            spaceSlug={spaceSlug}
          />
        ))}
      </div>
    </div>
  );
}

interface WorkingChangeRowProps {
  item: IWorkingChange;
  spaceSlug: string;
}

function WorkingChangeRow({ item, spaceSlug }: WorkingChangeRowProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const isCurrent = !!pageSlug && pageSlug.endsWith(item.slugId);

  return (
    <UnstyledButton
      component={Link}
      to={buildPageUrl(spaceSlug, item.slugId, item.title ?? undefined)}
      className={classes.row}
      data-current={isCurrent || undefined}
    >
      <span className={classes.icon}>{item.icon || "📄"}</span>
      <Text size="sm" className={classes.title} truncate>
        {item.title || t("제목 없음")}
      </Text>
      <span className={classes.stats}>
        {item.added > 0 && (
          <Text component="span" size="xs" className={classes.added}>
            +{item.added}
          </Text>
        )}
        {item.deleted > 0 && (
          <Text component="span" size="xs" className={classes.deleted}>
            −{item.deleted}
          </Text>
        )}
      </span>
    </UnstyledButton>
  );
}
