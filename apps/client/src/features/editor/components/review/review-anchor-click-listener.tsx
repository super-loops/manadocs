import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { openReviewModalAtom } from "@/features/review/atoms/review-atom";

/**
 * decoration pill(문서 콘텐츠 밖 오버레이) 클릭 시 발생하는 전역 이벤트를 받아
 * 리뷰 모달을 연다. 에디터 확장은 React 컨텍스트가 없어 이벤트로 위임한다.
 */
export default function ReviewAnchorClickListener() {
  const setOpenReviewModal = useSetAtom(openReviewModalAtom);

  useEffect(() => {
    const handler = (e: Event) => {
      const reviewId = (e as CustomEvent).detail?.reviewId;
      if (reviewId) setOpenReviewModal(reviewId);
    };
    window.addEventListener("manadocs:review-anchor-click", handler);
    return () =>
      window.removeEventListener("manadocs:review-anchor-click", handler);
  }, [setOpenReviewModal]);

  return null;
}
