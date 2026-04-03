import { ReactNode } from 'react';

export interface PosthogUserProps {
  userId: string;
  userData?: Record<string, any>;
  children?: ReactNode;
}

export function PosthogUser({ children }: PosthogUserProps) {
  return children;
}
