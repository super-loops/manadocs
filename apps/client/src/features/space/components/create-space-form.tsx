import { Group, Box, Button, TextInput, Stack, Textarea } from "@mantine/core";
import React, { useEffect, useMemo } from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useNavigate } from "react-router-dom";
import { useCreateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { computeSpaceSlug } from "@/lib";
import { getSpaceUrl } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

type FormValues = {
  name: string;
  slug: string;
  description: string;
};

export function CreateSpaceForm() {
  const { t } = useTranslation();
  const createSpaceMutation = useCreateSpaceMutation();
  const navigate = useNavigate();

  // Zod 기본 메시지("Too small: expected string to have >=2 characters")가
  // 그대로 노출되던 걸 막기 위해 스키마를 컴포넌트 안에서 t() 로 조립한다.
  const formSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(2, t("Space 이름은 2자 이상 입력해주세요."))
          .max(100, t("Space 이름은 100자까지 쓸 수 있어요.")),
        slug: z
          .string()
          .trim()
          .min(2, t("슬러그는 영문·숫자로 2자 이상 입력해주세요."))
          .max(100, t("슬러그는 100자까지 쓸 수 있어요."))
          .regex(
            /^[a-zA-Z0-9]+$/,
            t("슬러그에는 영문과 숫자만 쓸 수 있어요 (한글·공백·특수문자 불가)."),
          ),
        description: z
          .string()
          .max(500, t("Space 설명은 500자까지 쓸 수 있어요.")),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    // 이름을 치는 동안 슬러그가 자동으로 다시 계산되므로, 그때마다 검증하면
    // 첫 글자에서 뜬 에러가 그대로 굳어버린다(값이 그대로면 Mantine 이
    // 재검증을 건너뛴다). 슬러그 검증은 blur·제출 시점에만 하고, 값이 바뀌면
    // clearInputErrorOnChange 기본 동작으로 에러를 지운다.
    validateInputOnBlur: ["slug"],
    initialValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  useEffect(() => {
    const name = form.values.name;
    const words = name.trim().split(/\s+/);

    // Check if the last character is a space or if the last word is a single character (indicating it's in progress)
    const lastChar = name[name.length - 1];
    const lastWordIsIncomplete =
      words.length > 1 && words[words.length - 1].length === 1;

    if (lastChar !== " " || lastWordIsIncomplete) {
      const slug = computeSpaceSlug(name);
      form.setFieldValue("slug", slug);
    }
  }, [form.values.name]);

  const handleSubmit = async (data: {
    name?: string;
    slug?: string;
    description?: string;
  }) => {
    const spaceData = {
      name: data.name,
      slug: data.slug,
      description: data.description,
    };

    const createdSpace = await createSpaceMutation.mutateAsync(spaceData);
    navigate(getSpaceUrl(createdSpace.slug));
  };

  return (
    <>
      <Box maw="500" mx="auto">
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              withAsterisk
              id="name"
              label={t("Space name")}
              placeholder={t("e.g Product Team")}
              variant="filled"
              {...form.getInputProps("name")}
            />

            <TextInput
              withAsterisk
              id="slug"
              label={t("Space slug")}
              description={t(
                "주소에 쓰이는 값이라 영문·숫자만 가능해요. 이름의 한글·공백은 자동으로 빠지니 필요하면 직접 고쳐주세요.",
              )}
              placeholder={t("e.g product")}
              variant="filled"
              {...form.getInputProps("slug")}
            />

            <Textarea
              id="description"
              label={t("Space description")}
              placeholder={t("e.g Space for product team")}
              variant="filled"
              autosize
              minRows={2}
              maxRows={8}
              {...form.getInputProps("description")}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button type="submit">{t("Create")}</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}
