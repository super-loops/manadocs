import { ReactNode } from 'react';

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
