import { ReactNode } from 'react';

export interface SsoCloudSignupProps {
  onSuccess?: () => void;
  children?: ReactNode;
}

export function SsoCloudSignup({ children }: SsoCloudSignupProps) {
  return children;
}
