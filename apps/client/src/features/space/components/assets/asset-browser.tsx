import { useCallback, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Group,
  Image,
  Loader,
  Select,
  Table,
  Tabs,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowsSort,
  IconFile,
  IconFileText,
  IconFileZip,
  IconFolders,
  IconPhoto,
  IconSortAscending,
  IconSortDescending,
  IconVideo,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SearchInput } from "@/components/common/search-input.tsx";
import Paginate from "@/components/common/paginate.tsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { formatBytes } from "@/lib/utils.tsx";
import { formattedDate } from "@/lib/time.ts";
import { getFileUrl } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import {
  useSpaceAssetsQuery,
  useSpaceAssetStatsQuery,
} from "@/features/space/queries/space-insight-query.ts";
import {
  AssetCategory,
  AssetSortField,
  ISpaceAsset,
} from "@/features/space/types/space-assets.types.ts";

interface Props {
  spaceId: string;
  spaceSlug: string;
}

const PER_PAGE = 30;

/** 파일 하나의 화면 표시용 분류 — 서버 분류와 같은 기준을 클라에서 아이콘용으로만 다시 판단 */
function categoryOf(asset: ISpaceAsset): AssetCategory {
  const mime = asset.mimeType ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("text/")) return "text";
  const ext = (asset.fileExt ?? "").toLowerCase();
  if (
    /pdf|json|xml|rtf|msword|wordprocessingml|spreadsheetml|presentationml|ms-excel|ms-powerpoint|opendocument/.test(
      mime,
    ) ||
    [".txt", ".md", ".csv", ".tsv", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].includes(ext)
  ) {
    return "text";
  }
  if (
    /zip|7z|rar|tar|gzip|bzip2/.test(mime) ||
    [".zip", ".7z", ".rar", ".tar", ".gz", ".tgz", ".bz2", ".xz"].includes(ext)
  ) {
    return "archive";
  }
  return "other";
}

function CategoryIcon({ category }: { category: AssetCategory }) {
  const size = 18;
  if (category === "image") return <IconPhoto size={size} stroke={1.8} />;
  if (category === "video") return <IconVideo size={size} stroke={1.8} />;
  if (category === "text") return <IconFileText size={size} stroke={1.8} />;
  if (category === "archive") return <IconFileZip size={size} stroke={1.8} />;
  return <IconFile size={size} stroke={1.8} />;
}

function AssetThumb({ asset }: { asset: ISpaceAsset }) {
  const category = categoryOf(asset);

  if (category === "image") {
    return (
      <Image
        w={32}
        h={32}
        radius="sm"
        fit="cover"
        src={getFileUrl(`/files/${asset.id}/${encodeURIComponent(asset.fileName)}`)}
        alt={asset.fileName}
      />
    );
  }

  return (
    <div
      style={{
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--mantine-color-dimmed)",
      }}
    >
      <CategoryIcon category={category} />
    </div>
  );
}

export default function AssetBrowser({ spaceId, spaceSlug }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"all" | AssetCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AssetSortField>("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const { data: stats } = useSpaceAssetStatsQuery(spaceId);

  const { data, isLoading, isFetching } = useSpaceAssetsQuery({
    spaceId,
    category: tab === "all" ? undefined : tab,
    query: search || undefined,
    sort,
    direction,
    page,
    limit: PER_PAGE,
  });

  const tabs = useMemo(
    () =>
      [
        { value: "all", label: t("전체"), count: stats?.totalCount },
        { value: "image", label: t("이미지"), count: stats?.byCategory?.image },
        { value: "video", label: t("비디오"), count: stats?.byCategory?.video },
        { value: "text", label: t("텍스트"), count: stats?.byCategory?.text },
        {
          value: "archive",
          label: t("압축"),
          count: stats?.byCategory?.archive,
        },
        { value: "other", label: t("기타"), count: stats?.byCategory?.other },
      ] as const,
    [stats, t],
  );

  const items = data?.items ?? [];

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const resetPage = () => setPage(1);

  return (
    <>
      <Tabs
        value={tab}
        onChange={(value) => {
          setTab((value as "all" | AssetCategory) ?? "all");
          resetPage();
        }}
        mb="md"
      >
        <Tabs.List>
          {tabs.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
                {typeof item.count === "number" && (
                  <Badge size="xs" variant="light" color="gray" circle={false}>
                    {item.count}
                  </Badge>
                )}
              </Group>
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Group justify="space-between" mb="sm" wrap="nowrap" align="flex-end">
        <SearchInput placeholder={t("파일명 검색")} onSearch={handleSearch} />

        <Group gap="xs" wrap="nowrap">
          <Select
            size="xs"
            w={110}
            data={[
              { value: "date", label: t("날짜순") },
              { value: "name", label: t("이름순") },
              { value: "size", label: t("크기순") },
            ]}
            value={sort}
            onChange={(value) => {
              setSort((value as AssetSortField) ?? "date");
              setDirection(value === "name" ? "asc" : "desc");
              resetPage();
            }}
            leftSection={<IconArrowsSort size={14} />}
            allowDeselect={false}
            aria-label={t("정렬")}
          />
          <Tooltip
            label={direction === "asc" ? t("오름차순") : t("내림차순")}
            withArrow
          >
            <ActionIcon
              variant="default"
              size="input-xs"
              onClick={() => {
                setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                resetPage();
              }}
              aria-label={t("정렬 방향 바꾸기")}
            >
              {direction === "asc" ? (
                <IconSortAscending size={16} />
              ) : (
                <IconSortDescending size={16} />
              )}
            </ActionIcon>
          </Tooltip>
          {isFetching && <Loader size={16} />}
        </Group>
      </Group>

      {!isLoading && items.length === 0 ? (
        <EmptyState
          icon={IconFolders}
          title={t("에셋이 없습니다")}
          description={t(
            "페이지에 업로드한 이미지·파일이 이곳에 모입니다.",
          )}
        />
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={48}></Table.Th>
                <Table.Th>{t("이름")}</Table.Th>
                <Table.Th w={100}>{t("크기")}</Table.Th>
                <Table.Th w={170}>{t("만든 시간")}</Table.Th>
                <Table.Th w={160}>{t("만든이")}</Table.Th>
                <Table.Th w={200}>{t("소속 페이지")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((asset) => (
                <Table.Tr key={asset.id}>
                  <Table.Td>
                    <AssetThumb asset={asset} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500} lineClamp={1} title={asset.fileName}>
                      {asset.fileName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {asset.mimeType || asset.fileExt || t("알 수 없음")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {asset.fileSize ? formatBytes(Number(asset.fileSize)) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {formattedDate(new Date(asset.createdAt))}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {asset.creator ? (
                      <Group gap={6} wrap="nowrap">
                        <CustomAvatar
                          avatarUrl={asset.creator.avatarUrl}
                          name={asset.creator.name ?? ""}
                          size={22}
                        />
                        <Text size="xs" lineClamp={1}>
                          {asset.creator.name}
                        </Text>
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {asset.page ? (
                      <UnstyledButton
                        component={Link}
                        to={buildPageUrl(
                          spaceSlug,
                          asset.page.slugId,
                          asset.page.title,
                        )}
                      >
                        <Text size="xs" c="blue" lineClamp={1}>
                          {asset.page.title || t("untitled")}
                        </Text>
                      </UnstyledButton>
                    ) : (
                      <Text size="xs" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Paginate
        hasPrevPage={!!data?.meta?.hasPrevPage}
        hasNextPage={!!data?.meta?.hasNextPage}
        onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => prev + 1)}
      />
    </>
  );
}
