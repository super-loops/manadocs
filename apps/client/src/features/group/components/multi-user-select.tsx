import React, { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";

interface MultiUserSelectProps {
  onChange: (value: string[]) => void;
  label?: string;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm" wrap="nowrap">
    <CustomAvatar
      avatarUrl={option?.["avatarUrl"]}
      name={option.label}
      size={36}
    />
    <div>
      <Text size="sm" lineClamp={1}>{option.label}</Text>
      <Text size="xs" opacity={0.5}>
        {option?.["email"]}
      </Text>
    </div>
  </Group>
);

export function MultiUserSelect({ onChange, label }: MultiUserSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: users, isLoading } = useWorkspaceMembersQuery({
    query: debouncedQuery,
    limit: 50,
  });
  // 누적 유지 이유는 multi-group-select 와 같다 — hidePickedOptions 때문에
  // 목록에서 빠진 선택 항목의 라벨을 잃지 않으려면 지난 결과를 들고 있어야 한다.
  const [data, setData] = useState([]);
  const [lastUsers, setLastUsers] = useState(users);

  if (users !== lastUsers) {
    setLastUsers(users);
    setData((prevData) => {
      const fresh = (users?.items ?? [])
        .map((user: IUser) => ({
          value: user.id,
          label: user.name,
          avatarUrl: user.avatarUrl,
          email: user.email,
        }))
        .filter(
          (user) => !prevData.some((existing) => existing.value === user.value),
        );
      return fresh.length > 0 ? [...prevData, ...fresh] : prevData;
    });
  }

  return (
    <MultiSelect
      data={data}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label={label || t("Add members")}
      placeholder={t("Search for users")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable
      variant="filled"
      onChange={onChange}
      nothingFoundMessage={t("No user found")}
      maxValues={50}
    />
  );
}
