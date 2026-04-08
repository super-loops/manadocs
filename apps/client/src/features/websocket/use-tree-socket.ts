import { useEffect, useRef } from "react";
import { socketAtom } from "@/features/websocket/atoms/socket-atom.ts";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom.ts";
import { WebSocketEvent } from "@/features/websocket/types";
import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { useQueryClient } from "@tanstack/react-query";
import { SimpleTree } from "react-arborist";
import localEmitter from "@/lib/local-emitter.ts";

export const useTreeSocket = () => {
  const [socket] = useAtom(socketAtom);
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const queryClient = useQueryClient();
  const initialTreeData = useRef(treeData);

  useEffect(() => {
    initialTreeData.current = treeData;
  }, [treeData]);

  useEffect(() => {
    const updateNodeName = (event) => {
      const initialData = initialTreeData.current;
      const treeApi = new SimpleTree<SpaceTreeNode>(initialData);

      if (treeApi.find(event?.id)) {
        if (event.payload?.title !== undefined) {
          treeApi.update({
            id: event.id,
            changes: { name: event.payload.title },
          });
          setTreeData(treeApi.data);
        }
      }
    };

    localEmitter.on("message", updateNodeName);
    return () => {
      localEmitter.off("message", updateNodeName);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handler = (event: WebSocketEvent) => {
      const initialData = initialTreeData.current;
      const treeApi = new SimpleTree<SpaceTreeNode>(initialData);

      switch (event.operation) {
        case "updateOne":
          if (event.entity[0] === "pages") {
            if (treeApi.find(event.id)) {
              if (event.payload?.title !== undefined) {
                treeApi.update({
                  id: event.id,
                  changes: { name: event.payload.title },
                });
              }
              if (event.payload?.icon !== undefined) {
                treeApi.update({
                  id: event.id,
                  changes: { icon: event.payload.icon },
                });
              }
              setTreeData(treeApi.data);
            }
          }
          break;
        case "addTreeNode":
          if (treeApi.find(event.payload.data.id)) return;

          // Update parent's hasChildren flag
          if (event.payload.parentId) {
            const parentNode = treeApi.find(event.payload.parentId);
            if (parentNode && !parentNode.data.hasChildren) {
              treeApi.update({
                id: event.payload.parentId,
                changes: { hasChildren: true },
              });
            }
          }

          treeApi.create({
            parentId: event.payload.parentId,
            index: event.payload.index,
            data: event.payload.data,
          });
          setTreeData(treeApi.data);

          break;
        case "moveTreeNode":
          // move node
          if (treeApi.find(event.payload.id)) {
            const oldParentId = event.payload.oldParentId;

            treeApi.move({
              id: event.payload.id,
              parentId: event.payload.parentId,
              index: event.payload.index,
            });

            // update node position
            treeApi.update({
              id: event.payload.id,
              changes: {
                position: event.payload.position,
              },
            });

            // Update old parent's hasChildren if it lost its last child
            if (oldParentId && oldParentId !== event.payload.parentId) {
              const oldParent = treeApi.find(oldParentId);
              if (oldParent && oldParent.children?.length === 0) {
                treeApi.update({
                  id: oldParentId,
                  changes: { hasChildren: false },
                });
              }
            }

            // Update new parent's hasChildren
            if (event.payload.parentId) {
              const newParent = treeApi.find(event.payload.parentId);
              if (newParent && !newParent.data.hasChildren) {
                treeApi.update({
                  id: event.payload.parentId,
                  changes: { hasChildren: true },
                });
              }
            }

            setTreeData(treeApi.data);
          }

          break;
        case "deleteTreeNode":
          if (treeApi.find(event.payload.node.id)) {
            // Check parent before dropping to update hasChildren
            const deletedNode = treeApi.find(event.payload.node.id);
            const parentId = deletedNode?.parent?.id;

            treeApi.drop({ id: event.payload.node.id });

            // If parent has no more children, update hasChildren flag
            if (parentId) {
              const parentNode = treeApi.find(parentId);
              if (parentNode && parentNode.children?.length === 0) {
                treeApi.update({
                  id: parentId,
                  changes: { hasChildren: false },
                });
              }
            }

            setTreeData(treeApi.data);

            queryClient.invalidateQueries({
              queryKey: ["pages", event.payload.node.slugId].filter(Boolean),
            });
          }
          break;
      }
    };

    socket.on("message", handler);
    return () => {
      socket.off("message", handler);
    };
  }, [socket]);
};
