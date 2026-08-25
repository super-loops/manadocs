import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React, { useMemo } from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useTranslation } from "react-i18next";

type FormValues = {
  name: string;
  description: string;
  slug: string;
  authoringRules?: string;
};

interface EditSpaceFormProps {
  space: ISpace;
  readOnly?: boolean;
}
export function EditSpaceForm({ space, readOnly }: EditSpaceFormProps) {
  const { t } = useTranslation();
  const updateSpaceMutation = useUpdateSpaceMutation();

  // 생성 폼과 동일하게 Zod 기본 영문 메시지 대신 t() 문구를 쓴다.
  const formSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(2, t("Space 이름은 2자 이상 입력해주세요."))
          .max(100, t("Space 이름은 100자까지 쓸 수 있어요.")),
        description: z
          .string()
          .max(500, t("Space 설명은 500자까지 쓸 수 있어요.")),
        slug: z
          .string()
          .min(2, t("슬러그는 영문·숫자로 2자 이상 입력해주세요."))
          .max(100, t("슬러그는 100자까지 쓸 수 있어요."))
          .regex(
            /^[a-zA-Z0-9]+$/,
            t("슬러그에는 영문과 숫자만 쓸 수 있어요 (한글·공백·특수문자 불가)."),
          ),
        authoringRules: z.string().max(5000).optional(),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      name: space?.name,
      description: space?.description || "",
      slug: space.slug,
      authoringRules: space?.authoringRules || "",
    },
  });

  const handleSubmit = async (values: FormValues) => {
    const spaceData: Partial<ISpace> = {
      spaceId: space.id,
    };
    if (form.isDirty("name")) {
      spaceData.name = values.name;
    }
    if (form.isDirty("description")) {
      spaceData.description = values.description;
    }

    if (form.isDirty("authoringRules")) {
      spaceData.authoringRules = values.authoringRules;
    }

    if (form.isDirty("slug")) {
      spaceData.slug = values.slug;
    }

    await updateSpaceMutation.mutateAsync(spaceData);
    form.resetDirty();
  };

  return (
    <>
      <Box>
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              id="name"
              label={t("Name")}
              placeholder={t("e.g Sales")}
              variant="filled"
              readOnly={readOnly}
              {...form.getInputProps("name")}
            />

            <TextInput
              id="slug"
              label={t("Slug")}
              variant="filled"
              readOnly={readOnly}
              {...form.getInputProps("slug")}
            />

            <Textarea
              id="description"
              label={t("Description")}
              placeholder={t("e.g Space for sales team to collaborate")}
              variant="filled"
              readOnly={readOnly}
              autosize
              minRows={1}
              maxRows={3}
              {...form.getInputProps("description")}
            />

            <Textarea
              id="authoringRules"
              label={t("Authoring rules")}
              description={t(
                "Guidelines for content creation in this space. Visible to writers and referenced by AI.",
              )}
              placeholder={t(
                "e.g. Use formal tone, always include a summary section at the top...",
              )}
              variant="filled"
              readOnly={readOnly}
              autosize
              minRows={2}
              maxRows={8}
              maxLength={5000}
              {...form.getInputProps("authoringRules")}
            />
          </Stack>

          {!readOnly && (
            <Group justify="flex-end" mt="md">
              <Button type="submit" disabled={!form.isDirty()}>
                {t("Save")}
              </Button>
            </Group>
          )}
        </form>
      </Box>
    </>
  );
}
