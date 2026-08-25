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
import classes from "./toc-rail.module.css";

/** 이 폭 미만에서는 레일 대신 헤더 목차 버튼(우측 aside)을 쓴다 */
export const TOC_RAIL_BREAKPOINT = "(min-width: 75em)";

/**
 * 본문 우측 상시 목차 레일.
 * 우측 aside(버전/작업문서)와 달리 슬롯을 다투지 않도록 본문 옆 flex 형제로
 * 두고 sticky 로 따라다닌다. 리뷰 Drawer 는 오버레이 없이 우측에 떠서 레일을
 * 덮으므로, 열려 있는 동안에는 자리를 내준다.
 */
export default function TocRail() {
  const { t } = useTranslation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);
  const reviewSidebarOpen = useAtomValue(reviewSidebarOpenAtom);
  const isWideEnough = useMediaQuery(TOC_RAIL_BREAKPOINT);

  const editor = pageEditor ?? readOnlyEditor;

  if (!isWideEnough || reviewSidebarOpen || !editor) return null;

  return (
    <Box component="aside" className={classes.rail}>
      <Text size="xs" fw={600} c="dimmed" mb="xs">
        {t("이 페이지 목차")}
      </Text>
      <TableOfContents editor={editor} />
    </Box>
  );
}
