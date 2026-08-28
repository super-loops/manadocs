import React, { useMemo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Group, Select, SelectProps, Text } from "@mantine/core";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { ISpace } from "../../types/space.types";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

interface SpaceSelectProps {
  onChange: (value: ISpace) => void;
  value?: string;
  label?: string;
  width?: number;
  opened?: boolean;
  clearable?: boolean;
}

const renderSelectOption: SelectProps["renderOption"] = ({ option }) => (
  <Group gap="sm" wrap="nowrap">
    <CustomAvatar
      name={option.label}
      avatarUrl={option?.["icon"]}
      type={AvatarIconType.SPACE_ICON}
      color="initials"
      variant="filled"
      size={20}
    />
    <div>
      <Text size="sm" lineClamp={1}>
        {option.label}
      </Text>
    </div>
  </Group>
);

export function SpaceSelect({
  onChange,
  label,
  value,
  width,
  opened,
  clearable,
}: SpaceSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: spaces, isLoading } = useGetSpacesQuery({
    query: debouncedQuery,
    limit: 50,
  });
  // 검색 결과를 state 에 쌓지 않는다 — 쌓으면 지난 질의 결과가 영영 남아
  // 목록이 무한히 자란다. 현재 결과에서 바로 만든다(현재 스페이스는 제외).
  const data = useMemo(
    () =>
      (spaces?.items ?? [])
        .filter((space: ISpace) => space.slug !== value)
        .map((space: ISpace) => ({
          label: space.name,
          value: space.slug,
          icon: space.logo,
        })),
    [spaces, value],
  );

  return (
    <Select
      data={data}
      renderOption={renderSelectOption}
      maxDropdownHeight={300}
      //label={label || 'Select space'}
      placeholder={t("Search for spaces")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable={clearable}
      variant="filled"
      onChange={(slug) =>
        onChange(spaces.items?.find((item) => item.slug === slug))
      }
      onClick={(e) => e.stopPropagation()}
      nothingFoundMessage={t("No space found")}
      limit={50}
      checkIconPosition="right"
      comboboxProps={{ width, withinPortal: true, position: "bottom", keepMounted: false, dropdownPadding: 0 }}
      dropdownOpened={opened}
    />
  );
}
