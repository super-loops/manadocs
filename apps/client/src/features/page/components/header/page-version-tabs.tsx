import { ReactNode } from "react";
import { ActionIcon, Button, Group, Indicator, Tooltip } from "@mantine/core";
import { IconGitBranch, IconMessageCheck } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { reviewSidebarOpenAtom } from "@/features/review/atoms/review-atom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useDocInstances } from "@/features/component/hooks/use-doc-instances.ts";

function ComponentIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path d="M10 1.5l3 3-3 3-3-3z" />
      <path d="M4.5 7l3 3-3 3-3-3z" />
      <path d="M15.5 7l3 3-3 3-3-3z" />
      <path d="M10 12.5l3 3-3 3-3-3z" />
    </svg>
  );
}

interface TabProps {
  label: string;
  hint?: string;
  icon: ReactNode;
  active: boolean;
  color: string;
  dot?: boolean;
  onClick: () => void;
}

/** 아이콘만 — 이름은 호버(툴팁)와 활성일 때만 펼친다 */
function IconTab({ label, hint, icon, active, color, dot, onClick }: TabProps) {
  if (active) {
    return (
      <Button
        size="compact-sm"
        variant="light"
        color={color}
        leftSection={icon}
        onClick={onClick}
        aria-pressed
      >
        {label}
      </Button>
    );
  }
  return (
    <Tooltip label={hint ? `${label} · ${hint}` : label} withArrow openDelay={200}>
      <Indicator disabled={!dot} color="orange" size={7} offset={4} withBorder>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={28}
          onClick={onClick}
          aria-label={label}
        >
          {icon}
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}

/**
 * 페이지 툴바 좌측 탭 — 버전 / 리뷰 / 컴포넌트. 아이콘으로 줄이고, 열린 패널의
 * 탭만 이름을 펼친다. 버전 탭 하나가 확정 버전과 작업문서(분기)를 함께 보여주는
 * 결합 패널이라 작업문서 탭은 따로 없다. 리뷰는 리뷰 사이드바를 토글한다.
 */
export default function PageVersionTabs() {
  const { t } = useTranslation();
  const toggleAside = useToggleAside();
  const [asideState] = useAtom(asideStateAtom);
  const [reviewSidebarOpen, setReviewSidebarOpen] = useAtom(
    reviewSidebarOpenAtom,
  );
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const { needsAttention } = useDocInstances(space?.id);

  const isTab = (tab: string) =>
    asideState.isAsideOpen && asideState.tab === tab;

  return (
    <Group gap={2} wrap="nowrap">
      <IconTab
        label={t("버전")}
        icon={<IconGitBranch size={16} stroke={1.8} />}
        active={isTab("versions")}
        color="blue"
        onClick={() => toggleAside("versions")}
      />
      <IconTab
        label={t("리뷰")}
        icon={<IconMessageCheck size={16} stroke={1.8} />}
        active={reviewSidebarOpen}
        color="blue"
        onClick={() => setReviewSidebarOpen((open) => !open)}
      />
      <IconTab
        label={t("Components")}
        hint={needsAttention ? t("확인할 인스턴스가 있습니다") : undefined}
        icon={<ComponentIcon />}
        active={isTab("components")}
        color="violet"
        dot={needsAttention}
        onClick={() => toggleAside("components")}
      />
    </Group>
  );
}
