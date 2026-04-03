import { ReactNode } from 'react';

export interface SsoLoginProps {
  onSuccess?: () => void;
  children?: ReactNode;
}

export function SsoLogin({ children }: SsoLoginProps) {
  return children;
}
