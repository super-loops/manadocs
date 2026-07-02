import { Button, Group } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { reviewSidebarOpenAtom } from "@/features/review/atoms/review-atom";

interface PageVersionTabsProps {
  readOnly?: boolean;
}

/**
 * 페이지 툴바 좌측 탭 — 작업문서 / 버전 / 리뷰.
 * 작업문서·버전은 우측 aside 패널, 리뷰는 리뷰 사이드바를 토글한다.
 * 읽기 전용 사용자에게 작업문서 탭은 숨긴다(D6).
 */
export default function PageVersionTabs({ readOnly }: PageVersionTabsProps) {
  const { t } = useTranslation();
  const toggleAside = useToggleAside();
  const [asideState] = useAtom(asideStateAtom);
  const [reviewSidebarOpen, setReviewSidebarOpen] = useAtom(
    reviewSidebarOpenAtom,
  );

  const isTab = (tab: string) => asideState.isAsideOpen && asideState.tab === tab;

  return (
    <Group gap={4} wrap="nowrap">
      {!readOnly && (
        <Button
          size="compact-sm"
          variant={isTab("working-docs") ? "light" : "subtle"}
          color={isTab("working-docs") ? "blue" : "gray"}
          onClick={() => toggleAside("working-docs")}
        >
          {t("작업문서")}
        </Button>
      )}
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
