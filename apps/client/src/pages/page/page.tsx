import { useParams, useLocation } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import ReviewSidebar from "@/features/review/components/review-sidebar";
import FooterPill from "@/features/page-version/components/footer-pill";
import CommitDialog from "@/features/page-version/components/commit-dialog";
import PreviewModal from "@/features/page-version/components/preview-modal";
import DiffModal from "@/features/page-version/components/diff-modal";
import { activeWorkingDocAtom } from "@/features/page-version/atoms/page-version-atoms";
import { resolveActiveWorkingDocId } from "@/features/page-version/hooks/use-active-working-doc";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import ReviewAnchorDropZone from "@/features/editor/components/review/review-anchor-drop-zone";
import ReviewAnchorClickListener from "@/features/editor/components/review/review-anchor-click-listener";
import { useReviewAnchorDecorations } from "@/features/editor/components/review/use-review-anchor-decorations";
import { pageEditorAtom, readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { scrollToReviewAnchorWithRetry } from "@/features/review/utils/review-anchor-scroll";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useTranslation } from "react-i18next";
import React, { useEffect, useRef } from "react";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { IconAlertTriangle, IconFileOff } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import TocRail from "@/features/editor/components/table-of-contents/toc-rail";
import classes from "./page.module.css";
const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
// 편집 중 페이지 쿼리 리페치가 pill 까지 타고 내려오지 않게 한다
const MemoizedFooterPill = React.memo(FooterPill);

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();

  return (
    <ErrorBoundary
      resetKeys={[pageSlug]}
      fallbackRender={({ resetErrorBoundary }) => (
        <EmptyState
          icon={IconAlertTriangle}
          title={t("Failed to load page. An error occurred.")}
          action={
            <Button variant="default" size="sm" mt="xs" onClick={resetErrorBoundary}>
              {t("Try again")}
            </Button>
          }
        />
      )}
    >
      <PageContent pageSlug={pageSlug} />
    </ErrorBoundary>
  );
}

function PageContent({ pageSlug }: { pageSlug: string | undefined }) {
  const { t } = useTranslation();
  const location = useLocation();

  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const canEdit = page?.permissions?.canEdit ?? false;
  const activeWorkingDoc = useAtomValue(activeWorkingDocAtom);
  const setAsideState = useSetAtom(asideStateAtom);

  // 다른 페이지로 **옮겼을 때만** 우측 패널을 닫는다(앞 페이지의 버전 목록이
  // 남지 않게). 두 가지를 피하려고 이 모양이다:
  //  - 에디터 쪽에 두면 같은 페이지 안에서 작업문서(분기)를 갈아탈 때도 에디터가
  //    remount 되면서 패널이 닫힌다 — 결합 패널의 원클릭 전환이 자기가 서 있는
  //    패널을 접어버린다.
  //  - 첫 로드에도 닫으면, 페이지 쿼리가 늦게 도착하는 사이 유저가 이미 연 패널을
  //    뒤늦게 걷어차간다. 어차피 atom 기본값이 닫힘이라 첫 로드는 건드릴 게 없다.
  const lastPageIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = page?.id ?? null;
    if (!id || lastPageIdRef.current === id) return;
    const isFirstPage = lastPageIdRef.current === null;
    lastPageIdRef.current = id;
    if (!isFirstPage) setAsideState({ tab: "", isAsideOpen: false });
  }, [page?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 앵커 decoration 주입 — 라이브(편집)와 읽기전용(확정본) 에디터 양쪽.
  // 앵커는 DB 레지스트리 기반이라 어느 에디터든 blockId 로 오버레이된다.
  const liveEditor = useAtomValue(pageEditorAtom);
  const readonlyEditor = useAtomValue(readOnlyEditorAtom);
  useReviewAnchorDecorations(canEdit ? liveEditor : readonlyEditor, page?.id);

  // 현재 편집 대상 작업문서 — 선택이 없으면 Primary 작업문서.
  // 버전 패널의 선택 하이라이트와 **같은 함수**를 써야 둘이 어긋나지 않는다.
  const workingDocId = resolveActiveWorkingDocId(
    activeWorkingDoc,
    page?.id,
    page?.primaryWorkingDocId,
  );

  useEffect(() => {
    if (!page) return;
    const state = location.state as { anchorId?: string } | null;
    const anchorId = state?.anchorId;
    if (!anchorId) return;
    // 못 찾아도 삭제하지 않는다 — 앵커는 레지스트리에 남고, 다른 버전/작업문서를
    // 보는 중이라 렌더되지 않았을 수 있다(파괴적 orphan 정리 제거).
    scrollToReviewAnchorWithRetry(anchorId, 8, 150);
  }, [page?.id, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return (
        <EmptyState
          icon={IconFileOff}
          title={t("Page not found")}
          description={t(
            "This page may have been deleted, moved, or you may not have access.",
          )}
          action={
            <Button component={Link} to="/home" variant="default" size="sm" mt="xs">
              {t("Go to homepage")}
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={IconFileOff}
        title={t("Error fetching page data.")}
      />
    );
  }

  if (!space) {
    return <></>;
  }

  // D6 — 읽기 전용 사용자는 협업 room 에 접속하지 않고
  // 서버가 내려준 Primary 확정본(committed)만 정적으로 렌더한다.
  if (!canEdit) {
    const hasCommitted = page.versionContext?.hasCommitted ?? !!page.content;
    return (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <MemoizedPageHeader readOnly />

        {hasCommitted ? (
          <div className={classes.body}>
            <div className={classes.main}>
              <ReadonlyPageEditor
                key={page.id}
                pageId={page.id}
                title={page.title}
                content={page.content}
              />
            </div>
            <TocRail />
          </div>
        ) : (
          <EmptyState
            icon={IconFileOff}
            title={t("아직 확정된 버전이 없습니다")}
            description={t(
              "이 페이지는 작성 중입니다. 문서확정이 이루어지면 열람할 수 있습니다.",
            )}
          />
        )}
        <ReviewSidebar />
        <ReviewAnchorClickListener />
        <PreviewModal />
        <DiffModal />
      </div>
    );
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <MemoizedPageHeader readOnly={!canEdit} />

        <div className={classes.body}>
          <div className={classes.main}>
            <MemoizedFullEditor
              key={`${page.id}:${workingDocId ?? "primary"}`}
              pageId={page.id}
              title={page.title}
              content={page.content}
              slugId={page.slugId}
              spaceSlug={page?.space?.slug}
              editable={canEdit}
              workingDocId={workingDocId}
            />
          </div>
          <TocRail />
        </div>
        <MemoizedFooterPill page={page} />
        <CommitDialog pageId={page.id} />
        <PreviewModal />
        <DiffModal />
        <ReviewSidebar />
        <ReviewAnchorClickListener />
        {canEdit && <ReviewAnchorDropZone />}
      </div>
    )
  );
}
