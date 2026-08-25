/**
 * 버전 읽기 전용 화면 URL — `/s/:spaceSlug/p/:pageSlug/v/:versionNumber`.
 * uuid 대신 사람이 읽는 버전 번호를 싣는다(주소만 봐도 어느 확정본인지 안다).
 * 로그인 보호 라우트다 — 공개 공유 링크(`/share/...`)와는 다른 것.
 */
export function buildVersionViewUrl(
  spaceSlug: string,
  pageSlug: string,
  versionNumber: number,
): string {
  return `/s/${spaceSlug}/p/${pageSlug}/v/${versionNumber}`;
}

/** 새 창 화면에서 "이 버전 공유" 를 누를 때 돌아갈 편집 화면 주소 */
export function buildShareVersionUrl(
  spaceSlug: string,
  pageSlug: string,
  versionId: string,
): string {
  return `/s/${spaceSlug}/p/${pageSlug}?shareVersion=${encodeURIComponent(versionId)}`;
}
