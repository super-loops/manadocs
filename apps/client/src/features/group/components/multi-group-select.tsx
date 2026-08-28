import React, { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query.ts";
import { IGroup } from "@/features/group/types/group.types.ts";
import { IconUsersGroup } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface MultiGroupSelectProps {
  onChange: (value: string[]) => void;
  label?: string;
  description?: string;
  mt?: string;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm">
    {<IconUsersGroup size={18} />}
    <div>
      <Text size="sm">{option.label}</Text>
    </div>
  </Group>
);

export function MultiGroupSelect({
  onChange,
  label,
  description,
  mt,
}: MultiGroupSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: groups, isLoading } = useGetGroupsQuery({
    query: debouncedQuery,
    limit: 25,
  });
  // 검색 결과는 **누적해야 한다** — hidePickedOptions 로 이미 고른 항목이
  // 목록에서 빠지므로, 다음 검색에서 그 항목이 사라지면 선택 칩의 라벨을
  // 잃는다. effect 대신 "질의 결과가 바뀌면 렌더 중 조정" 으로 옮긴다.
  // 겸사겸사 예전의 스테일 클로저(effect 가 옛 data 로 중복 검사하던 것)도 없앤다.
  const [data, setData] = useState([]);
  const [lastGroups, setLastGroups] = useState(groups);

  if (groups !== lastGroups) {
    setLastGroups(groups);
    setData((prevData) => {
      const fresh = (groups?.items ?? [])
        .filter((group: IGroup) => group.name.toLowerCase() !== "everyone")
        .map((group: IGroup) => ({ value: group.id, label: group.name }))
        .filter(
          (group) =>
            !prevData.some((existing) => existing.value === group.value),
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
      description={description}
      label={label || t("Add groups")}
      placeholder={t("Search for groups")}
      mt={mt}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable
      variant="filled"
      onChange={onChange}
      nothingFoundMessage={t("No group found")}
      maxValues={50}
    />
  );
}
