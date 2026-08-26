import { Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { formattedDate } from "@/lib/time.ts";
import { useTimeAgo } from "@/hooks/use-time-ago.tsx";

const EPOCH = new Date(0);

/** 시각 계산의 입력 — 작업문서와 그 기준 버전의 원시 시각 */
export type EditingTimeSource = {
  workingDocCreatedAt: string | Date | null | undefined;
  workingDocUpdatedAt: string | Date | null | undefined;
  baseVersionCreatedAt: string | Date | null | undefined;
};

export type EditingTimestamps = {
  editingStartedAt: Date;
  lastEditedAt: Date;
};

/**
 * 수정 시작 — 전용 필드가 없어 두 시각 중 나중을 쓴다.
 * - 작업문서 생성 시각: "새 작업문서"로 만든 경우엔 이게 편집 시작이다.
 * - 기준 버전 확정 시각: Primary 작업문서는 페이지 생성 때 만들어져
 *   createdAt 이 편집 시작이 아니다. 확정할 때마다 base 가 옮겨가므로
 *   이 값이 현재 편집 사이클의 시작이다.
 * 두 후보의 약점이 서로 배타적이라 max 가 양쪽 경우 모두 맞는다.
 *
 * 시각을 못 만들면 null — 호출부는 툴팁 자체를 감춘다.
 */
export function resolveEditingTimestamps(
  source: EditingTimeSource | null | undefined,
): EditingTimestamps | null {
  if (!source?.workingDocCreatedAt || !source?.workingDocUpdatedAt) return null;

  const created = new Date(source.workingDocCreatedAt).getTime();
  const base = source.baseVersionCreatedAt
    ? new Date(source.baseVersionCreatedAt).getTime()
    : 0;

  return {
    editingStartedAt: new Date(Math.max(created, base)),
    lastEditedAt: new Date(source.workingDocUpdatedAt),
  };
}

/**
 * 「수정 시작 / 마지막 수정」 2줄 — footer pill 의 시계 툴팁, 사이드바 트리
 * hover 툴팁, 상단 브레드크럼 툴팁이 **같은 문구**를 쓰도록 한 곳에 모았다.
 * 세 곳이 각자 문자열을 만들면 그 자체가 다음 버그다.
 */
export function VersionTimeLines({
  editingStartedAt,
  lastEditedAt,
}: EditingTimestamps) {
  const { t } = useTranslation();
  const lastEditedAgo = useTimeAgo(lastEditedAt ?? EPOCH);

  return (
    <Stack gap={2}>
      <Text size="xs">
        {t("수정 시작")}: {formattedDate(editingStartedAt)}
      </Text>
      <Text size="xs">
        {t("마지막 수정")}: {formattedDate(lastEditedAt)} ({lastEditedAgo})
      </Text>
    </Stack>
  );
}
