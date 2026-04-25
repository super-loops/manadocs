/**
 * 페이지 본문에서 특정 review anchor 노드를 찾아 가운데로 스크롤하고
 * 잠깐 펄스 하이라이트한다. 노드를 찾지 못하면 false 반환.
 */
export function scrollToReviewAnchor(anchorId: string): boolean {
  const el = document.querySelector<HTMLElement>(
    `[data-anchor-id="${anchorId}"]`,
  );
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("review-anchor-highlight");
  // force reflow so animation restarts on repeated clicks
  void el.offsetWidth;
  el.classList.add("review-anchor-highlight");
  window.setTimeout(() => {
    el.classList.remove("review-anchor-highlight");
  }, 1500);
  return true;
}

/**
 * 노드가 아직 마운트되지 않았을 가능성에 대비해 짧게 재시도한다.
 * 페이지 라우팅 직후 호출되는 경우 유용.
 */
export function scrollToReviewAnchorWithRetry(
  anchorId: string,
  attempts = 6,
  intervalMs = 120,
): void {
  let tries = 0;
  const tick = () => {
    if (scrollToReviewAnchor(anchorId)) return;
    tries += 1;
    if (tries < attempts) {
      window.setTimeout(tick, intervalMs);
    }
  };
  tick();
}
