import {
  Anchor,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import {
  IconFileDescription,
  IconFolders,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSpaceOverviewQuery } from "@/features/space/queries/space-insight-query.ts";
import { getSpaceAssetsUrl } from "@/features/space/space.utils.ts";
import { formatBytes } from "@/lib/utils.tsx";
import { timeAgo } from "@/lib/time.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { ISpaceOverviewActor } from "@/features/space/types/space-overview.types.ts";

interface Props {
  spaceId: string;
  spaceSlug: string;
}

function StatCard({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Paper withBorder p="md" radius="sm">
      <Group gap={6} mb={2}>
        {icon}
        <Text size="xs" c="dimmed" fw={500}>
          {label}
        </Text>
      </Group>
      <Text component="div" fz={26} fw={600} lh={1.2}>
        {value}
      </Text>
      <Stack gap={2} mt={8}>
        {children}
      </Stack>
    </Paper>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" c="dimmed">
      {children}
    </Text>
  );
}

function actorActionLabel(kind: ISpaceOverviewActor["kind"], t: any) {
  if (kind === "commit") return t("확정");
  if (kind === "review") return t("리뷰");
  return t("편집");
}

export default function SpaceOverviewStats({ spaceId, spaceSlug }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useSpaceOverviewQuery(spaceId);

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Skeleton height={112} radius="sm" />
        <Skeleton height={112} radius="sm" />
        <Skeleton height={112} radius="sm" />
      </SimpleGrid>
    );
  }

  // 대시보드는 부가 정보라 실패해도 화면 나머지를 막지 않는다
  if (isError || !data) {
    return null;
  }

  const lastActiveAt = data.actors[0]?.lastActiveAt;

  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
      <StatCard
        icon={<IconFileDescription size={14} stroke={2} />}
        label={t("문서")}
        value={t("{{count}}개", { count: data.pages.total })}
      >
        <Line>
          {t("확정 {{committed}} · 미확정 {{uncommitted}}", {
            committed: data.pages.committed,
            uncommitted: data.pages.uncommitted,
          })}
        </Line>
        <Line>
          {t("최근 7일 수정 {{count}}건", {
            count: data.pages.recentlyUpdated,
          })}
        </Line>
      </StatCard>

      <StatCard
        icon={<IconFolders size={14} stroke={2} />}
        label={t("에셋")}
        value={t("{{count}}개", { count: data.assets.totalCount })}
      >
        <Line>
          {t("총 {{size}}", { size: formatBytes(data.assets.totalSize) })}
          {" · "}
          {t("최근 7일 {{count}}건 업로드", {
            count: data.assets.recentCount,
          })}
        </Line>
        <Anchor
          component={Link}
          to={getSpaceAssetsUrl(spaceSlug)}
          size="xs"
          underline="never"
        >
          {t("에셋 브라우저 열기")}
        </Anchor>
      </StatCard>

      <StatCard
        icon={<IconUsers size={14} stroke={2} />}
        label={t("활동")}
        value={
          data.actors.length > 0 ? (
            <Group gap={4}>
              {data.actors.map((actor) => (
                <Tooltip
                  key={actor.id}
                  withArrow
                  label={`${actor.name ?? ""} · ${actorActionLabel(
                    actor.kind,
                    t,
                  )} · ${timeAgo(new Date(actor.lastActiveAt))}`}
                >
                  <span>
                    <CustomAvatar
                      avatarUrl={actor.avatarUrl}
                      name={actor.name ?? ""}
                      size={28}
                    />
                  </span>
                </Tooltip>
              ))}
            </Group>
          ) : (
            <Text component="span" fz={26} fw={600} lh={1.2} c="dimmed">
              —
            </Text>
          )
        }
      >
        <Line>
          {lastActiveAt
            ? t("마지막 활동 {{when}}", {
                when: timeAgo(new Date(lastActiveAt)),
              })
            : t("아직 활동이 없습니다")}
        </Line>
        <Line>
          {t("최근 7일 확정 {{commits}} · 열린 리뷰 {{reviews}}", {
            commits: data.activity.recentCommits,
            reviews: data.activity.openReviews,
          })}
        </Line>
      </StatCard>
    </SimpleGrid>
  );
}
