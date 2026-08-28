import { useCallback } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { WebSocketEvent } from "@/features/websocket/types";

/**
 * 소켓이 바뀔 때만 새로 만든다. 예전엔 매 렌더 새 함수를 돌려줘서, 이걸 deps 에
 * 넣는 순간 그 메모가 통째로 무의미해졌다(useCallback/useMemo 가 매번 재생성).
 */
export const useQueryEmit = () => {
  const [socket] = useAtom(socketAtom);

  return useCallback(
    (input: WebSocketEvent) => {
      socket?.emit("message", input);
    },
    [socket],
  );
};
