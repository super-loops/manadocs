import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconFolder, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import CollapsibleSectionHeader from "@/components/ui/collapsible-section-header.tsx";
import { useSectionCollapsed } from "@/components/ui/use-section-collapsed.ts";
import {
  useComponentCollectionsQuery,
  useCreateCollectionMutation,
} from "@/features/component/queries/component-query.ts";
import { collectionPath } from "@/features/component/utils/instance-utils.ts";
import classes from "./components-section.module.css";

interface Props {
  spaceId: string;
  spaceSlug: string;
  canManage: boolean;
}

/**
 * 사이드바 Components 슬롯 — 컴포넌트 묶음 목록. 묶음을 누르면 그 안에서
 * 컴포넌트를 탐색·등록·편집한다.
 */
export default function ComponentsSection({
  spaceId,
  spaceSlug,
  canManage,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { collectionId } = useParams();
  const { data: collections } = useComponentCollectionsQuery(spaceId);
  const [collapsed] = useSectionCollapsed("components");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const createCollection = useCreateCollectionMutation();

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await createCollection.mutateAsync({
      spaceId,
      name: trimmed,
    });
    setCreateOpen(false);
    setName("");
    navigate(collectionPath(spaceSlug, created.id));
  };

  const list = collections ?? [];

  return (
    <div className={classes.section}>
      <CollapsibleSectionHeader
        sectionKey="components"
        label={t("Components")}
        count={list.length}
        actions={
          canManage && (
            <Tooltip label={t("새 묶음")} withArrow position="right">
              <ActionIcon
                variant="default"
                size={18}
                onClick={() => setCreateOpen(true)}
                aria-label={t("새 묶음")}
              >
                <IconPlus />
              </ActionIcon>
            </Tooltip>
          )
        }
      />

      <div className={classes.list} hidden={collapsed}>
        {list.length === 0 && (
          <Text size="xs" c="dimmed" className={classes.empty}>
            {t("묶음을 만들어 문서에 쓰는 이미지·파일을 모아두세요")}
          </Text>
        )}
        {list.map((c) => (
          <UnstyledButton
            key={c.id}
            component={Link}
            to={collectionPath(spaceSlug, c.id)}
            className={classes.row}
            data-current={collectionId === c.id || undefined}
          >
            <IconFolder size={15} stroke={1.6} className={classes.icon} />
            <Text size="sm" className={classes.title} truncate>
              {c.name}
            </Text>
            <Text size="xs" c="dimmed">
              {c.componentCount}
            </Text>
          </UnstyledButton>
        ))}
      </div>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("새 묶음")}
        centered
      >
        <Stack gap="sm">
          <TextInput
            label={t("이름")}
            placeholder={t("예: App Store 스크린샷")}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpen(false)}>
              {t("취소")}
            </Button>
            <Button
              onClick={submit}
              loading={createCollection.isPending}
              disabled={!name.trim()}
            >
              {t("만들기")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
