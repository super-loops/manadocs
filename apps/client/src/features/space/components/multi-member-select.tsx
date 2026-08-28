import React, { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { IGroup } from "@/features/group/types/group.types.ts";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IUser } from "@/features/user/types/user.types.ts";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { useTranslation } from "react-i18next";

interface MultiMemberSelectProps {
  value?: string[];
  onChange: (value: string[]) => void;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm" wrap="nowrap">
    {option["type"] === "user" && (
      <CustomAvatar
        avatarUrl={option["avatarUrl"]}
        size={20}
        name={option.label}
      />
    )}
    {option["type"] === "group" && <IconGroupCircle />}
    <div>
      <Text size="sm" lineClamp={1}>{option.label}</Text>
      {option["type"] === "user" && option["email"] && (
        <Text size="xs" c="dimmed" lineClamp={1}>{option["email"]}</Text>
      )}
    </div>
  </Group>
);

export function MultiMemberSelect({ value, onChange }: MultiMemberSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: suggestion, isLoading } = useSearchSuggestionsQuery({
    query: debouncedQuery,
    includeUsers: true,
    includeGroups: true,
  });
  // 여기는 누적이 아니라 **교체**다(원래도 setData(newData) 였다). 다만
  // suggestion 이 undefined 인 동안(다음 검색 로딩 중)에는 손대지 않아야
  // 목록이 잠깐 비지 않는다 — 그 조건까지 그대로 옮긴다.
  const [data, setData] = useState([]);
  const [lastKey, setLastKey] = useState<unknown>(null);

  if (suggestion && suggestion !== lastKey) {
    setLastKey(suggestion);

    const userItems = suggestion?.users.map((user: IUser) => ({
      value: `user-${user.id}`,
      label: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      type: "user",
    }));

    const groupItems = suggestion?.groups.map((group: IGroup) => ({
      value: `group-${group.id}`,
      label: group.name,
      type: "group",
    }));

    const newData = [];

    if (userItems && userItems.length > 0) {
      newData.push({ group: t("Select a user"), items: userItems });
    }

    if (groupItems && groupItems.length > 0) {
      newData.push({ group: t("Select a group"), items: groupItems });
    }

    setData(newData);
  }

  return (
    <MultiSelect
      data={data}
      value={value}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label={t("Add members")}
      placeholder={t("Search for users and groups")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filter={({ options }) => options}
      clearable
      variant="filled"
      onChange={onChange}
      maxValues={50}
    />
  );
}
