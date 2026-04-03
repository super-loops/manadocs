import { ReactNode } from 'react';

export const Feature = {
  API_KEYS: 'api_keys',
  SECURITY_SETTINGS: 'security_settings',
  AUDIT_LOGS: 'audit_logs',
};

export interface FeatureProps {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function useFeature(name: string) {
  return {
    isAvailable: false,
    upgradeRequired: false,
  };
}
