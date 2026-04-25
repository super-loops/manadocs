import { useMemo, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Modal,
  TextInput,
  Stack,
  UnstyledButton,
  Text,
  Group,
  Button,
  ScrollArea,
  Loader,
  MantineProvider,
} from "@mantine/core";
import { IconPlus, IconAnchor } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { Editor, Range } from "@tiptap/core";
import { queryClient } from "@/main";
import {
  useCreateReviewAnchorMutation,
  useCreateReviewMutation,
  useReviewsByPageQuery,
} from "@/features/review/queries/review-query";
import {
  IReview,
  reviewSidebarLabel,
} from "@/features/review/types/review.types";

type Props = {
  editor: Editor;
  range: Range;
  pageId: string;
  onClose: () => void;
};

function ReviewSelectPopupInner({ editor, range, pageId, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<"list" | "create">("list");
  const [newTitle, setNewTitle] = useState("");
  const { data } = useReviewsByPageQuery(pageId, "open");
  const createReview = useCreateReviewMutation();
  const createAnchor = useCreateReviewAnchorMutation();

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    // `#1`, `1`, `untitled`, title 모두 매칭
    const raw = search.trim().toLowerCase();
    const numeric = raw.replace(/^#/, "");
    return items.filter((r) => {
      const titleMatch = (r.title ?? "").toLowerCase().includes(raw);
      const seqMatch = String(r.sequenceId).includes(numeric);
      const untitledMatch =
        !r.title && "untitled".includes(raw); // 타이틀 없으면 "untitled" 키워드로도
      return titleMatch || seqMatch || untitledMatch;
    });
  }, [data, search]);

  const insertAnchor = (review: IReview, anchor: { id: string; sequenceId: number | string }) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertReviewAnchor({
        anchorId: anchor.id,
        reviewId: review.id,
        sequenceId: Number(anchor.sequenceId),
        reviewSequenceId: Number(review.sequenceId),
        status: review.status,
      })
      .run();
    onClose();
  };

  const handleSelectExisting = async (review: IReview) => {
    const anchor = await createAnchor.mutateAsync({ reviewId: review.id, pageId });
    insertAnchor(review, anchor);
  };

  const handleCreateConfirm = async () => {
    const review = await createReview.mutateAsync({
      pageId,
      title: newTitle.trim() || undefined,
    });
    const anchor = await createAnchor.mutateAsync({
      reviewId: review.id,
      pageId,
    });
    insertAnchor(review, anchor);
  };

  const busy = createReview.isPending || createAnchor.isPending;

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        phase === "create" ? t("Create new review") : t("Insert review anchor")
      }
      size="md"
      centered
    >
      {phase === "create" ? (
        <Stack gap="sm">
          <TextInput
            label={t("Title")}
            placeholder={t("Title (optional)")}
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateConfirm();
            }}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              onClick={() => {
                setPhase("list");
                setNewTitle("");
              }}
              disabled={busy}
            >
              {t("Cancel")}
            </Button>
            <Button
              leftSection={<IconPlus size={14} />}
              onClick={handleCreateConfirm}
              loading={busy}
            >
              {t("Create")}
            </Button>
          </Group>
        </Stack>
      ) : (
      <Stack gap="sm">
        <Button
          leftSection={<IconPlus size={16} />}
          variant="light"
          onClick={() => setPhase("create")}
          loading={busy}
          fullWidth
        >
          {t("Create new review")}
        </Button>
        <TextInput
          placeholder={t("Search reviews...")}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          autoFocus
        />
        <ScrollArea.Autosize mah={320}>
          <Stack gap={4}>
            {!data ? (
              <Group justify="center" p="md">
                <Loader size="sm" />
              </Group>
            ) : filtered.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="md">
                {t("No reviews found")}
              </Text>
            ) : (
              filtered.map((review) => (
                <UnstyledButton
                  key={review.id}
                  onClick={() => handleSelectExisting(review)}
                  disabled={busy}
                  p="xs"
                  style={{ borderRadius: 6 }}
                >
                  <Group gap={8} wrap="nowrap">
                    <IconAnchor size={16} />
                    <Text size="sm" fw={500}>
                      {reviewSidebarLabel(review.sequenceId)}
                    </Text>
                    <Text size="sm" c="dimmed" truncate>
                      {review.title ?? t("Untitled review")}
                    </Text>
                  </Group>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Stack>
      )}
    </Modal>
  );
}

let mountEl: HTMLDivElement | null = null;
let mountRoot: Root | null = null;

export function openReviewSelectPopup(
  editor: Editor,
  range: Range,
  pageId: string,
) {
  if (mountRoot) closeReviewSelectPopup();
  mountEl = document.createElement("div");
  document.body.appendChild(mountEl);
  mountRoot = createRoot(mountEl);
  mountRoot.render(
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <ReviewSelectPopupInner
          editor={editor}
          range={range}
          pageId={pageId}
          onClose={closeReviewSelectPopup}
        />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

export function closeReviewSelectPopup() {
  mountRoot?.unmount();
  mountRoot = null;
  if (mountEl?.parentNode) mountEl.parentNode.removeChild(mountEl);
  mountEl = null;
}

export default ReviewSelectPopupInner;
