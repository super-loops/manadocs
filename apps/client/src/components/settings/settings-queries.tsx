import { queryClient } from "@/main.tsx";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroups } from "@/features/group/services/group-service.ts";
import { QueryParams } from "@/lib/types.ts";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service.ts";
import { getShares } from "@/features/share/services/share-service.ts";

export const prefetchWorkspaceMembers = () => {
  const params: QueryParams = { limit: 100, query: "" };
  queryClient.prefetchQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
};

export const prefetchSpaces = () => {
  queryClient.prefetchQuery({
    queryKey: ["spaces", {}],
    queryFn: () => getSpaces({}),
  });
};

export const prefetchGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ["groups", {}],
    queryFn: () => getGroups({}),
  });
};

export const prefetchBilling = () => {
  // Billing feature removed - not needed in open source
};

export const prefetchLicense = () => {
  // License feature removed - not needed in open source
};

export const prefetchSsoProviders = () => {
  // SSO feature removed - not available in open source
};

export const prefetchShares = () => {
  queryClient.prefetchQuery({
    queryKey: ["share-list", {}],
    queryFn: () => getShares({}),
  });
};

export const prefetchApiKeys = () => {
  // API Keys feature available - implement when needed
};

export const prefetchApiKeyManagement = () => {
  // API Key management feature available - implement when needed
};

export const prefetchAuditLogs = () => {
  // Audit logs feature available - implement when needed
};
