import { useParams, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import ReviewSidebar from "@/features/review/components/review-sidebar";
import FooterPill from "@/features/page-version/components/footer-pill";
import CommitDialog from "@/features/page-version/components/commit-dialog";
import PreviewModal from "@/features/page-version/components/preview-modal";
import DiffModal from "@/features/page-version/components/diff-modal";
import { activeWorkingDocAtom } from "@/features/page-version/atoms/page-version-atoms";
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
import React, { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { IconAlertTriangle, IconFileOff } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);

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

  // 앵커 decoration 주입 — 라이브(편집)와 읽기전용(확정본) 에디터 양쪽.
  // 앵커는 DB 레지스트리 기반이라 어느 에디터든 blockId 로 오버레이된다.
  const liveEditor = useAtomValue(pageEditorAtom);
  const readonlyEditor = useAtomValue(readOnlyEditorAtom);
  useReviewAnchorDecorations(canEdit ? liveEditor : readonlyEditor, page?.id);

  // 현재 편집 대상 작업문서 — 선택이 없으면 Primary 작업문서
  const workingDocId =
    page && activeWorkingDoc?.pageId === page.id
      ? activeWorkingDoc.workingDocId
      : (page?.primaryWorkingDocId ?? null);

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
          <ReadonlyPageEditor
            key={page.id}
            pageId={page.id}
            title={page.title}
            content={page.content}
          />
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
        <FooterPill page={page} />
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
