import { SpaceTreeNode } from "@/features/page/tree/types.ts";
import { IPage } from "@/features/page/types/page.types";
import {
  IReview,
  IReviewAnchor,
  IReviewHistory,
} from "@/features/review/types/review.types";

export type InvalidateEvent = {
  operation: "invalidate";
  spaceId: string;
  entity: Array<string>;
  id?: string;
};

export type UpdateEvent = {
  operation: "updateOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload: Partial<IPage>;
};

export type DeleteEvent = {
  operation: "deleteOne";
  spaceId: string;
  entity: Array<string>;
  id: string;
  payload?: Partial<IPage>;
};

export type AddTreeNodeEvent = {
  operation: "addTreeNode";
  spaceId: string;
  payload: {
    parentId: string;
    index: number;
    data: SpaceTreeNode;
  };
};

export type MoveTreeNodeEvent = {
  operation: "moveTreeNode";
  spaceId: string;
  payload: {
    id: string;
    parentId: string;
    oldParentId: string | null;
    index: number;
    position: string;
    pageData: Partial<IPage>;
  };
};

export type DeleteTreeNodeEvent = {
  operation: "deleteTreeNode";
  spaceId: string;
  payload: {
    node: SpaceTreeNode;
  };
};

export type RefetchRootTreeNodeEvent = {
  operation: "refetchRootTreeNodeEvent";
  spaceId: string;
};

export type ReviewCreatedEvent = {
  operation: "reviewCreated";
  pageId: string;
  review: IReview;
};

export type ReviewUpdatedEvent = {
  operation: "reviewUpdated";
  pageId: string;
  review: IReview;
};

export type ReviewDeletedEvent = {
  operation: "reviewDeleted";
  pageId: string;
  reviewId: string;
};

export type ReviewCommentAddedEvent = {
  operation: "reviewCommentAdded";
  pageId: string;
  reviewId: string;
  history: IReviewHistory;
};

export type ReviewAnchorCreatedEvent = {
  operation: "reviewAnchorCreated";
  pageId: string;
  anchor: IReviewAnchor & { reviewSequenceId: number | string; reviewStatus: string };
};

export type ReviewAnchorDeletedEvent = {
  operation: "reviewAnchorDeleted";
  pageId: string;
  anchorId: string;
  reviewId: string;
};

export type WebSocketEvent =
  | InvalidateEvent
  | UpdateEvent
  | DeleteEvent
  | AddTreeNodeEvent
  | MoveTreeNodeEvent
  | DeleteTreeNodeEvent
  | RefetchRootTreeNodeEvent
  | ReviewCreatedEvent
  | ReviewUpdatedEvent
  | ReviewDeletedEvent
  | ReviewCommentAddedEvent
  | ReviewAnchorCreatedEvent
  | ReviewAnchorDeletedEvent;
