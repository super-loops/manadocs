import { Box, ScrollArea, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import React, { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TableOfContents } from "@/features/editor/components/table-of-contents/table-of-contents.tsx";
import { useAtomValue } from "jotai";
import {
  pageEditorAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import VersionPanel from "@/features/page-version/components/version-panel.tsx";

export default function Aside() {
  const [{ tab }] = useAtom(asideStateAtom);
  const { t } = useTranslation();
  // 읽기전용 페이지는 PageEditor 를 마운트하지 않는다 — TocRail 과 같은 폴백을
  // 두어야 목차 탭이 비지 않는다.
  const pageEditor = useAtomValue(pageEditorAtom);
  const readOnlyEditor = useAtomValue(readOnlyEditorAtom);
  const editor = pageEditor ?? readOnlyEditor;

  let title: string;
  let component: ReactNode;

  switch (tab) {
    case "toc":
      component = <TableOfContents editor={editor} />;
      title = "Table of contents";
      break;
    case "versions":
      // 결합 패널 — 확정 버전 + 그 아래 작업문서(분기)를 한 화면에서 본다
      component = <VersionPanel />;
      title = "버전";
      break;
    default:
      component = null;
      title = null;
  }

  return (
    <Box p="md" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {component && (
        <>
          <Text mb="md" fw={500}>
            {t(title)}
          </Text>

          <ScrollArea
            style={{ height: "85vh" }}
            scrollbarSize={5}
            type="scroll"
          >
            <div style={{ paddingBottom: "200px" }}>{component}</div>
          </ScrollArea>
        </>
      )}
    </Box>
  );
}
