const OPTIMISTIC_TTL_MS = 10_000;

export const optimisticallyCreatedPageIds = new Set<string>();

export function markOptimisticPageCreation(pageId: string): void {
  optimisticallyCreatedPageIds.add(pageId);
  setTimeout(() => {
    optimisticallyCreatedPageIds.delete(pageId);
  }, OPTIMISTIC_TTL_MS);
}
