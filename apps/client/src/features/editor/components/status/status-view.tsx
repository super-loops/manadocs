import { useState, useEffect, useRef, useCallback } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, UnstyledButton, Group, Text, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import classes from "./status.module.css";
import type { StatusColor } from "@manadocs/editor-ext";

const STATUS_COLORS: StatusColor[] = [
  "gray",
  "purple",
  "blue",
  "yellow",
  "orange",
  "red",
  "green",
  "black",
];

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
  const { t } = useTranslation();

  const [opened, setOpened] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const storage = editor.storage?.status;
    if (storage?.autoOpen) {
      storage.autoOpen = false;
      setOpened(true);
    }
  }, []);

  // sync focusedIndex when dropdown opens
  useEffect(() => {
    if (opened) {
      const idx = STATUS_COLORS.indexOf(color);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [opened, color]);

  const label = t(`status.${color}`, color);
  const isEditable = editor.isEditable;

  const handleSelect = useCallback(
    (newColor: StatusColor) => {
      updateAttributes({ color: newColor, text: t(`status.${newColor}`, newColor) });
      setOpened(false);
      editor.commands.focus(getPos() + node.nodeSize);
    },
    [updateAttributes, editor, getPos, node.nodeSize, t],
  );

  const open = () => {
    if (!isEditable) return;
    clearTimeout(closeTimer.current);
    setOpened(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpened(false), 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditable) return;

    if (!opened) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        open();
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) =>
          i < STATUS_COLORS.length - 1 ? i + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) =>
          i > 0 ? i - 1 : STATUS_COLORS.length - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < STATUS_COLORS.length) {
          handleSelect(STATUS_COLORS[focusedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpened(false);
        break;
    }
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
      >
        <Popover.Target>
          <span
            ref={wrapperRef}
            className={clsx(
              "status-badge",
              classes.status,
              colorClassMap[color],
            )}
            onClick={open}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
            onKeyDown={handleKeyDown}
            role="listbox"
            tabIndex={0}
            aria-expanded={opened}
          >
            {label}
          </span>
        </Popover.Target>

        <Popover.Dropdown
          p={4}
          onMouseEnter={open}
          onMouseLeave={scheduleClose}
        >
          {STATUS_COLORS.map((presetColor, index) => (
            <UnstyledButton
              key={presetColor}
              className={clsx(
                classes.presetItem,
                index === focusedIndex && classes.presetItemFocused,
              )}
              onClick={() => handleSelect(presetColor)}
              onMouseEnter={() => setFocusedIndex(index)}
              role="option"
              aria-selected={color === presetColor}
            >
              <Group gap={8} wrap="nowrap">
                <Box
                  className={clsx(
                    classes.presetDot,
                    colorClassMap[presetColor],
                  )}
                />
                <Text size="sm" fw={color === presetColor ? 600 : 400}>
                  {t(`status.${presetColor}`, presetColor)}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Popover.Dropdown>
      </Popover>
    </NodeViewWrapper>
  );
}
