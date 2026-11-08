import { useRef, useState } from "react";
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Image,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconFile } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { getFileUrl } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils";
import {
  useComponentCollectionsQuery,
  useComponentDetailQuery,
  useComponentUsagesQuery,
  useDeleteComponentMutation,
  useUpdateComponentMutation,
  useUploadRevisionMutation,
} from "@/features/component/queries/component-query.ts";
import { IComponentUsage } from "@/features/component/types/component.types.ts";
import { collectionPath } from "@/features/component/utils/instance-utils.ts";
import classes from "./component-detail-view.module.css";

interface Props {
  spaceId: string;
  spaceSlug: string;
  componentId: string;
  canManage: boolean;
}

/** 문서 안 대략 위치 — 막대는 문서 길이, 칸은 인스턴스 */
function PositionBar({
  locations,
  current,
}: {
  locations: IComponentUsage["workingDocs"][number]["locations"];
  current: number;
}) {
  return (
    <Box className={classes.bar} aria-hidden="true">
      {locations.map((l, i) => (
        <span
          key={i}
          className={classes.marker}
          data-stale={l.revision < current || undefined}
          data-empty={l.revision === 0 || undefined}
          style={{ left: `calc(${(l.ratio * 100).toFixed(1)}% - 4px)` }}
        />
      ))}
    </Box>
  );
}

export default function ComponentDetailView({
  spaceId,
  spaceSlug,
  componentId,
  canManage,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: detail } = useComponentDetailQuery(componentId);
  const { data: usages } = useComponentUsagesQuery(componentId);
  const { data: collections } = useComponentCollectionsQuery(spaceId);
  const upload = useUploadRevisionMutation();
  const update = useUpdateComponentMutation();
  const remove = useDeleteComponentMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  if (!detail) return null;
  const c = detail.component;
  const latest = detail.revisions[0];

  const openEdit = () => {
    setSlug(c.slug);
    setDescription(c.description ?? "");
    setCollectionId(c.collectionId);
    setEditError(null);
    setEditOpen(true);
  };

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: t("컴포넌트 지우기"),
      children: (
        <Text size="sm">
          {t(
            "{{slug}} 를 지웁니다. 문서에 놓인 인스턴스는 지금 모습(사본)으로 남고, 더는 업데이트를 받지 않습니다.",
            { slug: c.slug },
          )}
        </Text>
      ),
      labels: { confirm: t("지우기"), cancel: t("취소") },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await remove.mutateAsync(c.id);
        navigate(collectionPath(spaceSlug, c.collectionId));
      },
    });

  const pendingPages = (usages ?? []).filter((u) =>
    u.workingDocs.some((w) =>
      w.locations.some((l) => l.revision < c.currentRevision),
    ),
  ).length;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        <Anchor component={Link} to={collectionPath(spaceSlug, c.collectionId)} c="dimmed" size="sm">
          {t("Components")} / {c.collectionName}
        </Anchor>{" "}
        / {c.slug}
      </Text>

      <Group align="flex-end" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={600} c="violet.7">
            ◆ {c.kind === "image" ? t("이미지 컴포넌트") : t("파일 컴포넌트")}
            {c.empty ? " · Empty" : ` · r${c.currentRevision}`}
          </Text>
          <Title order={3}>{c.slug}</Title>
          {c.description && (
            <Text size="sm" c="dimmed">
              {c.description}
            </Text>
          )}
        </Stack>
        {canManage && (
          <>
            <Button variant="default" onClick={openEdit}>
              {t("편집")}
            </Button>
            <Button variant="default" color="red" onClick={confirmDelete}>
              {t("지우기")}
            </Button>
            <Button
              onClick={() => fileRef.current?.click()}
              loading={upload.isPending}
            >
              {c.empty ? t("파일 올리기") : t("새 리비전 올리기")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept={c.kind === "image" ? "image/*" : undefined}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate({ componentId: c.id, file });
              }}
            />
          </>
        )}
      </Group>

      <div className={classes.columns}>
        <Stack gap="sm" className={classes.left}>
          <Paper withBorder radius="md" className={classes.preview}>
            {c.empty ? (
              <Stack align="center" justify="center" h={240} className={classes.empty}>
                <Text fw={600}>{t("에셋 없음")}</Text>
                <Text size="sm" c="dimmed" ta="center" px="md">
                  {c.description}
                </Text>
              </Stack>
            ) : c.kind === "image" && latest?.src ? (
              <Image src={getFileUrl(latest.src)} fit="contain" mah={300} />
            ) : (
              <Group p="lg" gap="sm">
                <IconFile size={22} />
                <Anchor href={latest?.src ? getFileUrl(latest.src) : undefined} target="_blank">
                  {latest?.fileName}
                </Anchor>
              </Group>
            )}
          </Paper>

          <Text size="sm" fw={700} mt="xs">
            {t("리비전")}
          </Text>
          {detail.revisions.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("아직 올라온 파일이 없습니다")}
            </Text>
          ) : (
            <Paper withBorder radius="md">
              {detail.revisions.map((r, i) => (
                <Group
                  key={r.id}
                  gap="sm"
                  px="sm"
                  py={8}
                  wrap="nowrap"
                  className={i > 0 ? classes.revRow : undefined}
                >
                  <Text size="sm" fw={700} w={30}>
                    r{r.revision}
                  </Text>
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                    {r.message || r.fileName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {r.creatorName ?? ""} · {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                  {r.src && (
                    <Anchor href={getFileUrl(r.src)} target="_blank" size="xs">
                      {t("열기")}
                    </Anchor>
                  )}
                </Group>
              ))}
            </Paper>
          )}
        </Stack>

        <Stack gap="sm" className={classes.right}>
          <Group justify="space-between">
            <Text size="sm" fw={700}>
              {t("연결된 문서 · {{n}}", { n: usages?.length ?? 0 })}
            </Text>
            {pendingPages > 0 && (
              <Text size="xs" c="orange.8">
                {t("업데이트 대기 {{n}}곳", { n: pendingPages })}
              </Text>
            )}
          </Group>
          {(usages ?? []).length === 0 && (
            <Text size="sm" c="dimmed">
              {t("아직 이 컴포넌트를 쓰는 문서가 없습니다")}
            </Text>
          )}
          {(usages ?? []).map((u) => {
            const primary = u.workingDocs.find((w) => w.primary) ?? u.workingDocs[0];
            const locs = primary?.locations ?? [];
            const revs = Array.from(new Set(locs.map((l) => l.revision)));
            const stale = revs.some((r) => r < c.currentRevision);
            return (
              <Paper key={u.pageId} withBorder radius="md" p="sm" className={stale ? classes.stale : undefined}>
                <Stack gap={6}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} style={{ flex: 1, minWidth: 0 }} truncate>
                      {u.icon || "📄"} {u.title || t("untitled")}
                    </Text>
                    {locs.length > 0 ? (
                      <Badge
                        size="sm"
                        variant="light"
                        color={revs.includes(0) ? "orange" : stale ? "orange" : "teal"}
                      >
                        {revs.map((r) => (r === 0 ? "Empty" : `r${r}`)).join(" · ")}
                        {stale ? ` → r${c.currentRevision}` : ""}
                      </Badge>
                    ) : (
                      <Badge size="sm" variant="light" color="gray">
                        {t("확정본에만")}
                      </Badge>
                    )}
                    <Anchor
                      component={Link}
                      to={buildPageUrl(spaceSlug, u.slugId, u.title ?? undefined)}
                      size="xs"
                    >
                      {t("열기")}
                    </Anchor>
                  </Group>
                  {locs.length > 0 && (
                    <>
                      <PositionBar locations={locs} current={c.currentRevision} />
                      <Text size="xs" c="dimmed">
                        {locs
                          .map(
                            (l) =>
                              `§ ${l.heading ?? t("도입부")} · ${t("약 {{p}}%", {
                                p: Math.round(l.ratio * 100),
                              })}`,
                          )
                          .join("  ·  ")}
                      </Text>
                    </>
                  )}
                  {u.committed && (
                    <Text size="xs" c="dimmed">
                      {t("확정본 v{{v}}: {{revs}}", {
                        v: u.committed.version,
                        revs: u.committed.revisions
                          .map((r) => (r === 0 ? "Empty" : `r${r}`))
                          .join(", "),
                      })}
                    </Text>
                  )}
                  {u.workingDocs.length > 1 && (
                    <Tooltip label={t("다른 작업문서(분기)에도 놓여 있습니다")}>
                      <Text size="xs" c="dimmed">
                        {t("분기 {{n}}개", { n: u.workingDocs.length })}
                      </Text>
                    </Tooltip>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </div>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title={t("컴포넌트 편집")} centered>
        <Stack gap="sm">
          <TextInput label="slug" value={slug} onChange={(e) => setSlug(e.currentTarget.value)} />
          <Textarea
            label={t("설명")}
            autosize
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Select
            label={t("묶음")}
            data={(collections ?? []).map((col) => ({ value: col.id, label: col.name }))}
            value={collectionId}
            onChange={setCollectionId}
            allowDeselect={false}
          />
          {editError && (
            <Text size="sm" c="red">
              {editError}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpen(false)}>
              {t("취소")}
            </Button>
            <Button
              loading={update.isPending}
              onClick={async () => {
                setEditError(null);
                try {
                  await update.mutateAsync({
                    componentId: c.id,
                    slug: slug.trim(),
                    description,
                    collectionId: collectionId ?? undefined,
                  });
                  setEditOpen(false);
                } catch (err: any) {
                  setEditError(err?.response?.data?.message ?? t("저장하지 못했습니다"));
                }
              }}
            >
              {t("저장")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
