import { ReactNode } from 'react';

/**
 * 이 포크의 보안 토글은 EE stub 이라 아무것도 렌더하지 않는다.
 * Space 설정 페이지가 "보안" 제목+구분선만 남는 빈 섹션을 그리지 않도록
 * 이 플래그로 판단한다. 실제 EE 토글을 붙이면 true 로 바꾼다.
 */
export const SPACE_SECURITY_TOGGLES_ENABLED = false;

export interface SpaceSecurityToggleProps {
  space: any;
  children?: ReactNode;
}

export function SpacePublicSharingToggle({ space, children }: SpaceSecurityToggleProps) {
  return children;
}

export function SpaceViewerCommentsToggle({ space, children }: SpaceSecurityToggleProps) {
  return children;
}
