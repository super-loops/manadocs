import React, { useState, useMemo, useEffect } from "react";
import {
  Button,
  Menu,
  Text,
  TextInput,
  Divider,
  ScrollArea,
  Avatar,
  Group,
  Switch,
  getDefaultZIndex,
} from "@mantine/core";
import {
  IconChevronDown,
  IconBuilding,
  IconFileDescription,
  IconSearch,
  IconCheck,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@mantine/hooks";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import classes from "./search-spotlight-filters.module.css";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

interface SearchSpotlightFiltersProps {
  onFiltersChange?: (filters: any) => void;
  spaceId?: string;
}

export function SearchSpotlightFilters({
  onFiltersChange,
  spaceId,
}: SearchSpotlightFiltersProps) {
  const { t } = useTranslation();
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(
    spaceId || null,
  );
  const [spaceSearchQuery, setSpaceSearchQuery] = useState("");
  const [debouncedSpaceQuery] = useDebouncedValue(spaceSearchQuery, 300);
  const [contentType, setContentType] = useState<string | null>("page");
  const [includeWorking, setIncludeWorking] = useState(false);
  const [workspace] = useAtom(workspaceAtom);

  const { data: spacesData } = useGetSpacesQuery({
    limit: 100,
    query: debouncedSpaceQuery,
  });

  const selectedSpaceData = useMemo(() => {
    if (!spacesData?.items || !selectedSpaceId) return null;
    return spacesData.items.find((space) => space.id === selectedSpaceId);
  }, [spacesData?.items, selectedSpaceId]);

  const availableSpaces = useMemo(() => {
    const spaces = spacesData?.items || [];
    if (!selectedSpaceId) return spaces;

    // Sort to put selected space first
    return [...spaces].sort((a, b) => {
      if (a.id === selectedSpaceId) return -1;
      if (b.id === selectedSpaceId) return 1;
      return 0;
    });
  }, [spacesData?.items, selectedSpaceId]);

  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        spaceId: selectedSpaceId,
        contentType,
        includeWorking,
      });
    }
  }, []);

  // 유형은 「페이지」 하나뿐이다. 예전에 있던 '첨부 파일'(disabled + 기업 배지)은
  // 제공하지 않기로 해 제거했다. 필터 버튼 자체는 남긴다.
  const contentTypeOptions = [{ value: "page", label: t("Pages") }];

  const handleSpaceSelect = (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);

    if (onFiltersChange) {
      onFiltersChange({
        spaceId: spaceId,
        contentType,
        includeWorking,
      });
    }
  };

  const handleIncludeWorkingChange = (value: boolean) => {
    setIncludeWorking(value);
    if (onFiltersChange) {
      onFiltersChange({
        spaceId: selectedSpaceId,
        contentType,
        includeWorking: value,
      });
    }
  };

  const handleFilterChange = (filterType: string, value: any) => {
    let newSelectedSpaceId = selectedSpaceId;
    let newContentType = contentType;

    switch (filterType) {
      case "spaceId":
        newSelectedSpaceId = value;
        setSelectedSpaceId(value);
        break;
      case "contentType":
        newContentType = value;
        setContentType(value);
        break;
    }

    if (onFiltersChange) {
      onFiltersChange({
        spaceId: newSelectedSpaceId,
        contentType: newContentType,
        includeWorking,
      });
    }
  };

  return (
    <div className={classes.filtersContainer}>

      <Menu
        shadow="md"
        width={220}
        position="bottom-start"
        zIndex={getDefaultZIndex("max")}
      >
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            rightSection={<IconChevronDown size={14} />}
            leftSection={<IconFileDescription size={16} />}
            className={classes.filterButton}
            fw={500}
          >
            {contentType
              ? `${t("Type")}: ${contentTypeOptions.find((opt) => opt.value === contentType)?.label ?? t("Pages")}`
              : t("Type")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {contentTypeOptions.map((option) => (
            <Menu.Item
              key={option.value}
              onClick={() =>
                contentType !== option.value &&
                handleFilterChange("contentType", option.value)
              }
            >
              <Group flex="1" gap="xs">
                <Text size="sm" style={{ flex: 1 }}>
                  {option.label}
                </Text>
                {contentType === option.value && <IconCheck size={20} />}
              </Group>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      <Menu
        shadow="md"
        width={250}
        position="bottom-start"
        zIndex={getDefaultZIndex("max")}
      >
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            rightSection={<IconChevronDown size={14} />}
            leftSection={<IconBuilding size={16} />}
            className={classes.filterButton}
            fw={500}
          >
            {selectedSpaceId
              ? `${t("Space")}: ${selectedSpaceData?.name || t("Unknown")}`
              : `${t("Space")}: ${t("All spaces")}`}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <TextInput
            placeholder={t("Find a space")}
            data-autofocus
            autoFocus
            leftSection={<IconSearch size={16} />}
            value={spaceSearchQuery}
            onChange={(e) => setSpaceSearchQuery(e.target.value)}
            size="sm"
            variant="filled"
            radius="sm"
            styles={{ input: { marginBottom: 8 } }}
          />

          <ScrollArea.Autosize mah={280}>
            <Menu.Item onClick={() => handleSpaceSelect(null)}>
              <Group flex="1" gap="xs">
                <Avatar
                  color="initials"
                  variant="filled"
                  name={t("All spaces")}
                  size={20}
                />
                <div style={{ flex: 1 }}>
                  <Text size="sm" fw={500}>
                    {t("All spaces")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("Search in all your spaces")}
                  </Text>
                </div>
                {!selectedSpaceId && <IconCheck size={20} />}
              </Group>
            </Menu.Item>

            <Divider my="xs" />

            {availableSpaces.map((space) => (
              <Menu.Item
                key={space.id}
                onClick={() => handleSpaceSelect(space.id)}
              >
                <Group flex="1" gap="xs">
                  <Avatar
                    color="initials"
                    variant="filled"
                    name={space.name}
                    size={20}
                  />
                  <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                    {space.name}
                  </Text>
                  {selectedSpaceId === space.id && <IconCheck size={20} />}
                </Group>
              </Menu.Item>
            ))}
          </ScrollArea.Autosize>
        </Menu.Dropdown>
      </Menu>

      <Switch
        size="sm"
        label={t("작업문서 포함")}
        description={t("확정 전 수정중 내용까지 검색")}
        checked={includeWorking}
        onChange={(e) => handleIncludeWorkingChange(e.currentTarget.checked)}
        className={classes.filterButton}
      />
    </div>
  );
}
