import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  InfiniteData,
} from "@tanstack/react-query";
import {
  addReviewComment,
  changeReviewStatus,
  createReview,
  createReviewAnchor,
  deleteReview,
  deleteReviewAnchor,
  deleteReviewComment,
  getAssignedReviews,
  getReviewAnchorsByPage,
  getReviewById,
  getReviewsByPage,
  updateReview,
  updateReviewAssignees,
  updateReviewComment,
} from "@/features/review/services/review-service";
import {
  IReview,
  IReviewAnchor,
  IReviewHistory,
  ReviewStatus,
  ICreateReview,
  IChangeReviewStatus,
  IAddReviewComment,
  ICreateReviewAnchor,
  IDeleteReviewAnchor,
  IUpdateReviewAssignees,
  IUpdateReview,
  IUpdateReviewComment,
  IDeleteReviewComment,
} from "@/features/review/types/review.types";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";

export const RQ_REVIEW = (reviewId: string) => ["review", reviewId];
export const RQ_REVIEWS_BY_PAGE = (pageId: string, status?: ReviewStatus) => [
  "reviews",
  "page",
  pageId,
  status ?? "all",
];
export const RQ_ASSIGNED_REVIEWS = (statuses?: ReviewStatus[]) => [
  "reviews",
  "assigned",
  (statuses ?? []).slice().sort().join(",") || "default",
];
export const RQ_REVIEW_ANCHORS = (pageId: string) => [
  "review-anchors",
  pageId,
];

export function useReviewQuery(reviewId: string | undefined | null) {
  return useQuery<IReview>({
    queryKey: RQ_REVIEW(reviewId ?? ""),
    queryFn: () => getReviewById(reviewId as string),
    enabled: !!reviewId,
  });
}

export function useReviewsByPageQuery(
  pageId: string | undefined | null,
  status?: ReviewStatus,
) {
  const query = useInfiniteQuery({
    queryKey: RQ_REVIEWS_BY_PAGE(pageId ?? "", status),
    queryFn: ({ pageParam }) =>
      getReviewsByPage({
        pageId: pageId as string,
        status,
        cursor: pageParam,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
    enabled: !!pageId,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

  const data = useMemo<IPagination<IReview> | undefined>(() => {
    if (!query.data) return undefined;
    return {
      items: query.data.pages.flatMap((p) => p.items),
      meta: query.data.pages[query.data.pages.length - 1].meta,
    };
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading || query.hasNextPage,
    isError: query.isError,
  };
}

export function useAssignedReviewsQuery(statuses?: ReviewStatus[]) {
  const query = useInfiniteQuery({
    queryKey: RQ_ASSIGNED_REVIEWS(statuses),
    queryFn: ({ pageParam }) =>
      getAssignedReviews({ statuses, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
  });

  const data = useMemo<IPagination<IReview> | undefined>(() => {
    if (!query.data) return undefined;
    return {
      items: query.data.pages.flatMap((p) => p.items),
      meta: query.data.pages[query.data.pages.length - 1].meta,
    };
  }, [query.data]);

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

export function useReviewAnchorsQuery(pageId: string | undefined | null) {
  return useQuery<IReviewAnchor[]>({
    queryKey: RQ_REVIEW_ANCHORS(pageId ?? ""),
    queryFn: () => getReviewAnchorsByPage(pageId as string),
    enabled: !!pageId,
  });
}

function invalidatePageReviews(
  queryClient: ReturnType<typeof useQueryClient>,
  pageId?: string | null,
) {
  // refetchOnMount: false 기본값과 무관하게 즉시 다시 가져오도록 refetchQueries 강제 사용
  if (pageId) {
    queryClient.refetchQueries({ queryKey: ["reviews", "page", pageId] });
    queryClient.refetchQueries({ queryKey: RQ_REVIEW_ANCHORS(pageId) });
  }
  queryClient.refetchQueries({ queryKey: ["reviews", "assigned"] });
}

export function useCreateReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReview, Error, ICreateReview>({
    mutationFn: (data) => createReview(data),
    onSuccess: (review) => {
      invalidatePageReviews(queryClient, review.pageId);
      notifications.show({ message: t("Review created successfully") });
    },
    onError: () => {
      notifications.show({
        message: t("Error creating review"),
        color: "red",
      });
    },
  });
}

export function useChangeReviewStatusMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReview, Error, IChangeReviewStatus>({
    mutationFn: (data) => changeReviewStatus(data),
    onSuccess: (review) => {
      queryClient.setQueryData(RQ_REVIEW(review.id), (prev: IReview | undefined) =>
        prev ? { ...prev, ...review } : review,
      );
      invalidatePageReviews(queryClient, review.pageId);
      notifications.show({ message: t("Review status updated") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update review status"),
        color: "red",
      });
    },
  });
}

export function useAddReviewCommentMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReview, Error, IAddReviewComment>({
    mutationFn: (data) => addReviewComment(data),
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: RQ_REVIEW(review.id) });
      invalidatePageReviews(queryClient, review.pageId);
    },
    onError: () => {
      notifications.show({
        message: t("Failed to add review comment"),
        color: "red",
      });
    },
  });
}

export function useCreateReviewAnchorMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReviewAnchor, Error, ICreateReviewAnchor>({
    mutationFn: (data) => createReviewAnchor(data),
    onSuccess: (anchor) => {
      queryClient.invalidateQueries({
        queryKey: RQ_REVIEW_ANCHORS(anchor.pageId),
      });
      queryClient.invalidateQueries({ queryKey: RQ_REVIEW(anchor.reviewId) });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to create review anchor"),
        color: "red",
      });
    },
  });
}

export function useDeleteReviewAnchorMutation(pageId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IDeleteReviewAnchor>({
    mutationFn: (data) => deleteReviewAnchor(data),
    onSuccess: () => {
      if (pageId) {
        queryClient.invalidateQueries({ queryKey: RQ_REVIEW_ANCHORS(pageId) });
      }
      queryClient.invalidateQueries({ queryKey: ["review"] });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete review anchor"),
        color: "red",
      });
    },
  });
}

export function useUpdateReviewAssigneesMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReview, Error, IUpdateReviewAssignees>({
    mutationFn: (data) => updateReviewAssignees(data),
    onSuccess: (review) => {
      queryClient.setQueryData(RQ_REVIEW(review.id), (prev: IReview | undefined) =>
        prev ? { ...prev, ...review } : review,
      );
      invalidatePageReviews(queryClient, review.pageId);
      notifications.show({ message: t("Assignees updated") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update assignees"),
        color: "red",
      });
    },
  });
}

export function useUpdateReviewMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReview, Error, IUpdateReview>({
    mutationFn: (data) => updateReview(data),
    onSuccess: (review) => {
      queryClient.setQueryData(RQ_REVIEW(review.id), (prev: IReview | undefined) =>
        prev ? { ...prev, ...review } : review,
      );
      invalidatePageReviews(queryClient, review.pageId);
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update review"),
        color: "red",
      });
    },
  });
}

export function useUpdateReviewCommentMutation(reviewId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<IReviewHistory, Error, IUpdateReviewComment>({
    mutationFn: (data) => updateReviewComment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RQ_REVIEW(reviewId) });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to update comment"),
        color: "red",
      });
    },
  });
}

export function useDeleteReviewCommentMutation(reviewId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, IDeleteReviewComment>({
    mutationFn: (data) => deleteReviewComment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RQ_REVIEW(reviewId) });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete comment"),
        color: "red",
      });
    },
  });
}

export function useDeleteReviewMutation(pageId?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<void, Error, string>({
    mutationFn: (reviewId) => deleteReview(reviewId),
    onSuccess: (_data, reviewId) => {
      queryClient.removeQueries({ queryKey: RQ_REVIEW(reviewId) });
      invalidatePageReviews(queryClient, pageId);
      notifications.show({ message: t("Review deleted successfully") });
    },
    onError: () => {
      notifications.show({
        message: t("Failed to delete review"),
        color: "red",
      });
    },
  });
}
