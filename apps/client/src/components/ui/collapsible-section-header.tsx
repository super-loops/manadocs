import { ReactNode } from "react";
import { Badge, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { useSectionCollapsed } from "@/components/ui/use-section-collapsed.ts";
import classes from "./collapsible-section-header.module.css";

interface Props {
  sectionKey: string;
  label: string;
  /** 접혀 있을 때 배지로, 펼쳐져 있을 때 흐린 숫자로 보인다 */
  count?: number | null;
  /** 머리줄 오른쪽 버튼(만들기 등) — 접힘 토글과 따로 눌린다 */
  actions?: ReactNode;
  className?: string;
}

/**
 * 접히는 사이드바 섹션 머리줄. 접혀도 개수가 남는다 — 무엇이 몇 개 있는지는
 * 펼치지 않아도 보여야 한다.
 */
export default function CollapsibleSectionHeader({
  sectionKey,
  label,
  count,
  actions,
  className,
}: Props) {
  const [collapsed, setCollapsed] = useSectionCollapsed(sectionKey);
  const hasCount = typeof count === "number";

  return (
    <Group
      className={`${classes.header} ${className ?? ""}`}
      justify="space-between"
      wrap="nowrap"
      gap={4}
    >
      <UnstyledButton
        className={classes.toggle}
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        <IconChevronRight
          size={12}
          stroke={2}
          className={classes.chevron}
          data-open={!collapsed || undefined}
        />
        <Text size="xs" fw={500} c="dimmed" className={classes.label}>
          {label}
        </Text>
        {hasCount &&
          (collapsed ? (
            <Badge size="xs" variant="filled" color="gray" radius="xl">
              {count}
            </Badge>
          ) : (
            <Text size="xs" c="dimmed">
              {count}
            </Text>
          ))}
      </UnstyledButton>
      {actions}
    </Group>
  );
}
