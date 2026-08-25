import { Box, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "./table-of-contents";
import {
  pageEditorAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import { reviewSidebarOpenAtom } from "@/features/review/atoms/review-atom";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import classes from "./toc-rail.module.css";

/** 이 폭 미만에서는 레일 대신 헤더 목차 버튼(우측 aside)을 쓴다 */
export const TOC_RAIL_BREAKPOINT = "(min-width: 75em)";

/**
 * 본문 우측 상시 목차 레일.
 * 우측 aside(버전/작업문서)와 슬롯을 다투지 않도록 본문 옆 flex 형제로 두고
 * sticky 로 따라다닌다. 다만 우측에 다른 패널이 열려 있으면 본문이 과하게
 * 좁아지므로(제목이 두 줄로 깨진다) 그동안은 레일이 자리를 내준다 —
 * 리뷰 Drawer(오버레이 없이 레일을 덮는다)와 aside 둘 다.
 */
export default function TocRail() {
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);
  const reviewSidebarOpen = useAtomValue(reviewSidebarOpenAtom);
  const { isAsideOpen } = useAtomValue(asideStateAtom);
  const isWideEnough = useMediaQuery(TOC_RAIL_BREAKPOINT);

  const editor = pageEditor ?? readOnlyEditor;

  if (!isWideEnough || reviewSidebarOpen || isAsideOpen || !editor) return null;

  return (
    <Box component="aside" className={classes.rail}>
      <Text size="xs" fw={600} c="dimmed" mb="xs">
        {t("이 페이지 목차")}
      </Text>
      <TableOfContents editor={editor} />
    </Box>
  );
}
