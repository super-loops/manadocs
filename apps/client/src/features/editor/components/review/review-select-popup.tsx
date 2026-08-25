import { useMemo, useRef, useState } from "react";
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
  Alert,
  MantineProvider,
} from "@mantine/core";
import { IconPlus, IconAnchor, IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { Editor, Range } from "@tiptap/core";
import { queryClient } from "@/main";
import {
  resolveBlockAtPos,
  type ResolvedBlock,
} from "@/features/editor/components/review/review-anchor-util";
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

/**
 * 서버 에러를 사용자가 행동할 수 있는 문장으로 옮긴다.
 * 리뷰 생성 400 의 대부분은 "확정 버전 없음" 이라 그 경우를 특별히 안내한다.
 */
function reviewErrorMessage(
  err: any,
  t: (key: string) => string,
  fallback: string,
): string {
  const raw = err?.response?.data?.message;
  const message = Array.isArray(raw) ? raw.join(" ") : raw;
  if (typeof message === "string" && message.includes("committed version")) {
    return t(
      "이 페이지에는 아직 확정된 버전이 없어요. 먼저 문서를 확정한 뒤 리뷰를 만들 수 있어요.",
    );
  }
  if (typeof message === "string" && message.trim()) return message;
  return t(fallback);
}

function ReviewSelectPopupInner({ editor, range, pageId, onClose }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<"list" | "create">("list");
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data } = useReviewsByPageQuery(pageId, "open");
  const createReview = useCreateReviewMutation();
  const createAnchor = useCreateReviewAnchorMutation();

  // 앵커가 붙을 블록은 팝업이 열리는 순간(=트리거 텍스트가 아직 살아있을 때)
  // 한 번만 해석한다. 삭제를 먼저 하면 위치가 밀려 빈 문단에서는 해석이
  // 실패했고(문서 레벨을 가리킴), 실패 후 재시도도 불가능했다.
  const [block] = useState<ResolvedBlock | null>(() =>
    resolveBlockAtPos(editor, range.from),
  );
  // 성공 확정 후에만 지우기 위해, 트리거 텍스트를 그대로 들고 있는다.
  const triggerText = useRef<string>(
    (() => {
      try {
        return editor.state.doc.textBetween(range.from, range.to);
      } catch {
        return "";
      }
    })(),
  );
  // 앵커 생성만 실패한 재시도에서 리뷰가 중복 생성되지 않도록 보관
  const createdReview = useRef<IReview | null>(null);

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

  const busy = createReview.isPending || createAnchor.isPending;

  /**
   * 슬래시 트리거 텍스트(range)를 지운다 — 리뷰·앵커가 모두 성공한 뒤에만 호출.
   * 모달이 떠 있는 동안 협업 편집으로 위치가 밀렸을 수 있으므로, 그 자리에
   * 원래 트리거 텍스트가 그대로 있을 때만 지운다.
   */
  const consumeTriggerRange = () => {
    try {
      if (editor.isDestroyed) return;
      const current = editor.state.doc.textBetween(range.from, range.to);
      if (current !== triggerText.current) {
        editor.chain().focus().run();
        return;
      }
      editor.chain().focus().deleteRange(range).run();
    } catch {
      // 위치가 이미 유효하지 않으면 본문은 건드리지 않는다
    }
  };

  const handleSelectExisting = async (review: IReview) => {
    if (!block) return;
    setError(null);
    try {
      await createAnchor.mutateAsync({
        reviewId: review.id,
        pageId,
        blockId: block.blockId,
        selectedText: block.text,
      });
    } catch (err) {
      setError(
        reviewErrorMessage(err, t, "앵커를 추가하지 못했어요. 다시 시도해주세요."),
      );
      return;
    }
    consumeTriggerRange();
    onClose();
  };

  const handleCreateConfirm = async () => {
    if (!block || busy) return;
    setError(null);
    try {
      const review =
        createdReview.current ??
        (await createReview.mutateAsync({
          pageId,
          title: newTitle.trim() || undefined,
        }));
      createdReview.current = review;
      await createAnchor.mutateAsync({
        reviewId: review.id,
        pageId,
        blockId: block.blockId,
        selectedText: block.text,
      });
    } catch (err) {
      setError(
        reviewErrorMessage(err, t, "리뷰를 만들지 못했어요. 다시 시도해주세요."),
      );
      return;
    }
    consumeTriggerRange();
    onClose();
  };

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
      {!block ? (
        // 해석 가능한 블록이 없는 자리(코드블럭·이미지·구분선 등).
        // 예전에는 조용히 닫히면서 본문의 트리거 텍스트만 사라졌다.
        <Stack gap="sm">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
          >
            {t(
              "이 위치에는 리뷰를 달 수 없어요. 문단이나 제목 위에서 다시 시도해주세요. (리스트·표·콜아웃 안의 문단도 괜찮아요)",
            )}
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              {t("Close")}
            </Button>
          </Group>
        </Stack>
      ) : phase === "create" ? (
        <Stack gap="sm">
          {error && (
            <Alert
              icon={<IconAlertTriangle size={16} />}
              color="red"
              variant="light"
            >
              {error}
            </Alert>
          )}
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
                setError(null);
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
              {error ? t("Retry") : t("Create")}
            </Button>
          </Group>
        </Stack>
      ) : (
      <Stack gap="sm">
        {error && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}
        <Button
          leftSection={<IconPlus size={16} />}
          variant="light"
          onClick={() => {
            setError(null);
            setPhase("create");
          }}
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
