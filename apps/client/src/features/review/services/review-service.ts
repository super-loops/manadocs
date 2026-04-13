import api from "@/lib/api-client";
import {
  IReview,
  IReviewAnchor,
  ICreateReview,
  IChangeReviewStatus,
  IAddReviewComment,
  ICreateReviewAnchor,
  IDeleteReviewAnchor,
  IUpdateReviewAssignees,
  IReviewsByPageParams,
  IAssignedReviewsParams,
} from "@/features/review/types/review.types";
import { IPagination } from "@/lib/types.ts";

export async function createReview(data: ICreateReview): Promise<IReview> {
  const req = await api.post<IReview>("/reviews/create", data);
  return req.data;
}

export async function getReviewsByPage(
  data: IReviewsByPageParams,
): Promise<IPagination<IReview>> {
  const req = await api.post("/reviews", data);
  return req.data;
}

export async function getReviewById(reviewId: string): Promise<IReview> {
  const req = await api.post<IReview>("/reviews/info", { reviewId });
  return req.data;
}

export async function changeReviewStatus(
  data: IChangeReviewStatus,
): Promise<IReview> {
  const req = await api.post<IReview>("/reviews/change-status", data);
  return req.data;
}

export async function addReviewComment(
  data: IAddReviewComment,
): Promise<IReview> {
  const req = await api.post<IReview>("/reviews/add-comment", data);
  return req.data;
}

export async function createReviewAnchor(
  data: ICreateReviewAnchor,
): Promise<IReviewAnchor> {
  const req = await api.post<IReviewAnchor>("/reviews/create-anchor", data);
  return req.data;
}

export async function deleteReviewAnchor(
  data: IDeleteReviewAnchor,
): Promise<void> {
  await api.post("/reviews/delete-anchor", data);
}

export async function updateReviewAssignees(
  data: IUpdateReviewAssignees,
): Promise<IReview> {
  const req = await api.post<IReview>("/reviews/update-assignees", data);
  return req.data;
}

export async function getAssignedReviews(
  data: IAssignedReviewsParams,
): Promise<IPagination<IReview>> {
  const req = await api.post("/reviews/assigned", data);
  return req.data;
}

export async function getReviewAnchorsByPage(
  pageId: string,
): Promise<IReviewAnchor[]> {
  const req = await api.post<IReviewAnchor[]>("/reviews/anchors", { pageId });
  return req.data;
}

export async function deleteReview(reviewId: string): Promise<void> {
  await api.post("/reviews/delete", { reviewId });
}
