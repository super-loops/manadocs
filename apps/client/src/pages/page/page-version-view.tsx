import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Badge, Button, Container, Group, Text } from "@mantine/core";
import { IconFileOff, IconWorld } from "@tabler/icons-react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageVersionByNumberQuery } from "@/features/page-version/queries/page-version-query";
import { buildShareVersionUrl } from "@/features/page-version/utils/version-view-url";
import { useTimeAgo } from "@/hooks/use-time-ago";
import classes from "./page-version-view.module.css";

/** 시각이 아직 없을 때 훅에 넘길 고정 값 — 매 렌더 new Date() 를 만들지 않는다 */
const EPOCH = new Date(0);

/**
 * 확정 버전 읽기 전용 화면 — `/s/:spaceSlug/p/:pageSlug/v/:versionNumber`.
 * 미리보기 모달의 "새 창에서 보기" 가 여는 화면이다. 헤더·사이드바·편집 UI
 * 없이 본문과 버전 뱃지만 둔 "공유 페이지 느낌" 이지만 **공개 링크가 아니다** —
 * 로그인 + 페이지 열람 권한이 있어야 서버가 내려준다.
 */
export default function PageVersionView() {
  const { t } = useTranslation();
  const { spaceSlug, pageSlug, versionNumber } = useParams();

  const parsedVersion = Number(versionNumber);
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const {
    data: version,
    isLoading,
    isError,
  } = usePageVersionByNumberQuery(
    page?.id,
    Number.isFinite(parsedVersion) ? parsedVersion : null,
  );

  const createdAtAgo = useTimeAgo(version?.createdAt ?? EPOCH);

  if (isLoading || !page) {
    return <></>;
  }

  if (isError || !version) {
    return (
      <EmptyState
        icon={IconFileOff}
        title={t("이 버전을 찾을 수 없습니다")}
        description={t("폐기되었거나 아직 확정되지 않은 버전일 수 있습니다.")}
      />
    );
  }

  const title = version.title || page.title || t("untitled");

  return (
    <div className={classes.shell}>
      <Helmet>
        <title>{`${title} · ${t("버전 {{n}}", { n: version.version })}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className={classes.bar}>
        <Container size={900} p={0}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <Badge size="sm" variant="light" color="blue" radius="sm">
                {t("버전 {{n}}", { n: version.version })}
              </Badge>
              {version.message && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {version.message}
                </Text>
              )}
              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                {createdAtAgo}
              </Text>
            </Group>

            {/* 공유 팝오버는 편집 화면 헤더에 있다 — 프리필을 실어 그쪽을 연다 */}
            <Button
              size="compact-xs"
              variant="default"
              component="a"
              href={buildShareVersionUrl(spaceSlug, pageSlug, version.id)}
              leftSection={<IconWorld size={14} />}
            >
              {t("이 버전 공유")}
            </Button>
          </Group>
        </Container>
      </div>

      <Container size={900} p={0} pt="lg">
        <ReadonlyPageEditor
          key={version.id}
          title={version.title ?? ""}
          content={version.content}
        />
      </Container>
    </div>
  );
}
