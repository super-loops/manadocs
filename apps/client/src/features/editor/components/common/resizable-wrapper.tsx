import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import classes from "./resizable-wrapper.module.css";

type Handle = "tl" | "tr" | "bl" | "br" | "bottom";

const HANDLE_SIGN: Record<Handle, { x: number; y: number }> = {
  br: { x: 1, y: 1 },
  bl: { x: -1, y: 1 },
  tr: { x: 1, y: -1 },
  tl: { x: -1, y: -1 },
  bottom: { x: 0, y: 1 },
};

const HANDLE_CURSOR: Record<Handle, string> = {
  br: "nwse-resize",
  tl: "nwse-resize",
  bl: "nesw-resize",
  tr: "nesw-resize",
  bottom: "ns-resize",
};

const CORNER_CLASSES: Record<string, string> = {
  tl: classes.cornerHandleTL,
  tr: classes.cornerHandleTR,
  bl: classes.cornerHandleBL,
  br: classes.cornerHandleBR,
};

interface ResizableWrapperProps {
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
  isEditable?: boolean;
  className?: string;
  selected?: boolean;
}

type DragState = {
  handle: Handle;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  children,
  initialWidth = 640,
  initialHeight = 480,
  minWidth = 200,
  maxWidth = 1200,
  minHeight = 200,
  maxHeight = 1200,
  onResize,
  isEditable = true,
  className,
  selected = false,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<DragState | null>(null);
  const widthRef = useRef(initialWidth);
  const heightRef = useRef(initialHeight);
  const onResizeRef = useRef(onResize);
  const constraintsRef = useRef({ minWidth, maxWidth, minHeight, maxHeight });

  // 갱신은 커밋 뒤에(react-hooks/refs). 읽는 쪽은 mousemove·mouseup 핸들러라
  // 전부 커밋 이후라서 값이 늦게 보이는 일이 없다.
  useEffect(() => {
    onResizeRef.current = onResize;
    constraintsRef.current = { minWidth, maxWidth, minHeight, maxHeight };
  });

  useEffect(() => {
    if (!dragRef.current && wrapperRef.current) {
      widthRef.current = initialWidth;
      heightRef.current = initialHeight;
      wrapperRef.current.style.width = `${initialWidth}px`;
      wrapperRef.current.style.height = `${initialHeight}px`;
    }
  }, [initialWidth, initialHeight]);

  // 이 핸들러는 document 에 addEventListener/removeEventListener 로 짝지어
  // 붙였다 뗀다. useRef(fn).current 는 identity 가 영원히 고정돼 그 짝이 항상
  // 맞는데, useCallback 으로 바꾸면 deps 가 바뀔 때 identity 가 달라져 드래그
  // 중 붙인 리스너를 못 뗀다.
  // eslint-disable-next-line react-hooks/refs
  const handleMouseMove = useRef((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag || !wrapperRef.current) return;

    const sign = HANDLE_SIGN[drag.handle];
    const { minWidth, maxWidth, minHeight, maxHeight } = constraintsRef.current;

    const deltaY = e.clientY - drag.startY;
    const newHeight = Math.min(Math.max(drag.startHeight + deltaY * sign.y, minHeight), maxHeight);
    heightRef.current = newHeight;
    wrapperRef.current.style.height = `${newHeight}px`;

    if (sign.x !== 0) {
      const deltaX = e.clientX - drag.startX;
      const newWidth = Math.min(Math.max(drag.startWidth + deltaX * sign.x, minWidth), maxWidth);
      widthRef.current = newWidth;
      wrapperRef.current.style.width = `${newWidth}px`;
    }
  }).current;

  // handleMouseMove 와 같은 이유 — 리스너 add/remove 짝을 맞추려면 identity 가
  // 고정이어야 한다.
  // eslint-disable-next-line react-hooks/refs
  const handleMouseUp = useRef(() => {
    dragRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    onResizeRef.current?.(widthRef.current, heightRef.current);
  }).current;

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: widthRef.current,
      startHeight: heightRef.current,
    };
    setIsResizing(true);
    document.body.style.cursor = HANDLE_CURSOR[handle];
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    // 위 두 핸들러는 고정 identity 라 이 deps 는 실제로 변하지 않는다.
    // 언마운트 때 떼는 대상이 붙였던 그 함수임을 보장하는 자리다.
    // eslint-disable-next-line react-hooks/refs
  }, [handleMouseMove, handleMouseUp]);

  const shouldShowHandles = isEditable && (isHovered || isResizing || selected);

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, className, {
        [classes.resizing]: isResizing,
      })}
      // 초기 크기만 여기서 준다. 드래그 중에는 일부러 리렌더 없이
      // wrapperRef.current.style 을 직접 써서 mousemove 마다 React 를 돌리지
      // 않는다. state 로 바꾸면 그 설계가 무너진다.
      // eslint-disable-next-line react-hooks/refs
      style={{ width: widthRef.current, height: heightRef.current }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isResizing && <div className={classes.overlay} />}
      {shouldShowHandles && (
        <>
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <div
              key={corner}
              className={clsx(classes.cornerHandle, CORNER_CLASSES[corner])}
              onMouseDown={(e) => handleResizeStart(e, corner)}
            />
          ))}
          <div
            className={classes.resizeHandleBottom}
            onMouseDown={(e) => handleResizeStart(e, "bottom")}
          >
            <div className={classes.resizeBar} />
          </div>
        </>
      )}
    </div>
  );
};
