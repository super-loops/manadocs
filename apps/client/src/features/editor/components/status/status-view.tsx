import { useState, useEffect } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, UnstyledButton, Group, Text, Box } from "@mantine/core";
import clsx from "clsx";
import classes from "./status.module.css";
import { STATUS_PRESETS, type StatusColor } from "@manadocs/editor-ext";

const PRESET_ENTRIES = Object.entries(STATUS_PRESETS) as [
  StatusColor,
  string,
][];

const colorClassMap: Record<StatusColor, string> = {
  gray: classes.colorGray,
  purple: classes.colorPurple,
  blue: classes.colorBlue,
  yellow: classes.colorYellow,
  orange: classes.colorOrange,
  red: classes.colorRed,
  green: classes.colorGreen,
  black: classes.colorBlack,
};

export default function StatusView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const { color } = node.attrs as { text: string; color: StatusColor };

  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const storage = editor.storage?.status;
    if (storage?.autoOpen) {
      storage.autoOpen = false;
      setOpened(true);
    }
  }, []);

  const label = STATUS_PRESETS[color as StatusColor] ?? color;
  const isEditable = editor.isEditable;

  const handleSelect = (newColor: StatusColor) => {
    updateAttributes({ color: newColor, text: STATUS_PRESETS[newColor] });
    setOpened(false);
    editor.commands.focus(getPos() + node.nodeSize);
  };

  return (
    <NodeViewWrapper style={{ display: "inline" }} data-drag-handle>
      <Popover
        opened={opened}
        onChange={setOpened}
        width={160}
        position="bottom"
        withArrow
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <span
            className={clsx(
              "status-badge",
              classes.status,
              colorClassMap[color],
            )}
            onClick={() => isEditable && setOpened(true)}
            role="button"
            tabIndex={0}
          >
            {label}
          </span>
        </Popover.Target>

        <Popover.Dropdown p={4}>
          {PRESET_ENTRIES.map(([presetColor, presetLabel]) => (
            <UnstyledButton
              key={presetColor}
              className={classes.presetItem}
              onClick={() => handleSelect(presetColor)}
            >
              <Group gap={8} wrap="nowrap">
                <Box
                  className={clsx(
                    classes.presetDot,
                    colorClassMap[presetColor],
                  )}
                />
                <Text size="sm" fw={color === presetColor ? 600 : 400}>
                  {presetLabel}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Popover.Dropdown>
      </Popover>
    </NodeViewWrapper>
  );
}
