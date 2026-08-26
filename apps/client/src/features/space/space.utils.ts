/** 스페이스 하위 화면 URL 헬퍼 — 사이드바·리다이렉트가 같은 문자열을 쓰게 */
export function getSpaceAssetsUrl(spaceSlug: string) {
  return `/s/${spaceSlug}/assets`;
}

export function getSpaceTrashUrl(spaceSlug: string) {
  return `/s/${spaceSlug}/trash`;
}

export function getSpaceSettingsUrl(
  spaceSlug: string,
  tab?: "members" | "maintenance",
) {
  return tab ? `/s/${spaceSlug}/settings/${tab}` : `/s/${spaceSlug}/settings`;
}
