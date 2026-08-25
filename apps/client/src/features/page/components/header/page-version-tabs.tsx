import { Button, Group } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { reviewSidebarOpenAtom } from "@/features/review/atoms/review-atom";

/**
 * 페이지 툴바 좌측 탭 — 버전 / 리뷰.
 * 버전 탭 하나가 확정 버전과 그 아래 작업문서(분기)를 함께 보여주는 결합
 * 패널이라 작업문서 탭은 없앴다. 리뷰는 리뷰 사이드바를 토글한다.
 */
export default function PageVersionTabs() {
  const { t } = useTranslation();
  const toggleAside = useToggleAside();
  const [asideState] = useAtom(asideStateAtom);
  const [reviewSidebarOpen, setReviewSidebarOpen] = useAtom(
    reviewSidebarOpenAtom,
  );

  const isTab = (tab: string) => asideState.isAsideOpen && asideState.tab === tab;

  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-sm"
        variant={isTab("versions") ? "light" : "subtle"}
        color={isTab("versions") ? "blue" : "gray"}
        onClick={() => toggleAside("versions")}
      >
        {t("버전")}
      </Button>
      <Button
        size="compact-sm"
        variant={reviewSidebarOpen ? "light" : "subtle"}
        color={reviewSidebarOpen ? "blue" : "gray"}
        onClick={() => setReviewSidebarOpen((open) => !open)}
      >
        {t("리뷰")}
      </Button>
    </Group>
  );
}
