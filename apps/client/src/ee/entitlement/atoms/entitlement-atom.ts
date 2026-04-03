import { atom } from 'jotai';

export interface Entitlements {
  features?: string[];
  tier?: string;
  [key: string]: any;
}

export const entitlementAtom = atom<Entitlements>({
  features: [],
  tier: 'free',
});

export function useEntitlements() {
  return {
    data: {
      features: [],
      tier: 'free',
    },
  };
}
