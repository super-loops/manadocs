import { useState } from "react";
import {
  Button,
  FileInput,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useCreateComponentMutation,
  useUploadRevisionMutation,
} from "@/features/component/queries/component-query.ts";
import { IComponent } from "@/features/component/types/component.types.ts";

interface Props {
  opened: boolean;
  onClose: () => void;
  spaceId: string;
  collectionId: string;
  initialFile?: File | null;
  onCreated?: (component: IComponent) => void;
}

function slugFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** 컴포넌트 등록 — 파일 없이 만들면 «에셋 없음» 자리부터 시작한다 */
export default function RegisterComponentModal(props: Props) {
  const { t } = useTranslation();
  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={t("컴포넌트 등록")}
      centered
    >
      {/* 열 때마다 새로 마운트 — 지난번 입력이 남지 않는다 */}
      {props.opened && <RegisterForm {...props} />}
    </Modal>
  );
}

function RegisterForm({
  onClose,
  spaceId,
  collectionId,
  initialFile,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const [slug, setSlug] = useState(() =>
    initialFile ? slugFromFileName(initialFile.name) : "",
  );
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"image" | "file">(() =>
    initialFile && !initialFile.type.startsWith("image/") ? "file" : "image",
  );
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateComponentMutation();
  const upload = useUploadRevisionMutation();

  const submit = async () => {
    setError(null);
    try {
      const created = await create.mutateAsync({
        spaceId,
        collection: collectionId,
        slug: slug.trim(),
        kind,
        description: description.trim() || undefined,
      });
      if (file) {
        await upload.mutateAsync({ componentId: created.id, file });
      }
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t("등록하지 못했습니다"));
    }
  };

  return (
    <Stack gap="sm">
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as "image" | "file")}
        data={[
          { value: "image", label: t("이미지") },
          { value: "file", label: t("파일") },
        ]}
      />
      <TextInput
        label="slug"
        description={t("스페이스 안에서 고유 — 소문자·숫자·. _ -")}
        placeholder="login-dashboard"
        value={slug}
        onChange={(e) => setSlug(e.currentTarget.value)}
        data-autofocus
      />
      <Textarea
        label={t("설명")}
        description={t("비어 있는 동안 자리에 보이는 안내 — 무엇을 넣어야 하는지")}
        autosize
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      <FileInput
        label={t("파일 (선택)")}
        placeholder={t("나중에 올려도 됩니다")}
        value={file}
        onChange={setFile}
        clearable
        accept={kind === "image" ? "image/*" : undefined}
      />
      {error && (
        <Text size="sm" c="red" aria-live="polite">
          {error}
        </Text>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {t("취소")}
        </Button>
        <Button
          onClick={submit}
          loading={create.isPending || upload.isPending}
          disabled={!slug.trim()}
        >
          {t("등록")}
        </Button>
      </Group>
    </Stack>
  );
}
