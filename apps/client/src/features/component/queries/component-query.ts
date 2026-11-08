import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  createComponent,
  createComponentCollection,
  deleteComponent,
  deleteComponentCollection,
  getComponentCollections,
  getComponentDetail,
  getComponents,
  getComponentsBulk,
  getComponentUsages,
  updateComponent,
  updateComponentCollection,
  uploadComponentRevision,
} from "@/features/component/services/component-service";

/** 컴포넌트가 바뀌면 이 접두어로 한꺼번에 무효화한다 */
export const COMPONENTS_KEY = "components";

export function useComponentCollectionsQuery(spaceId: string | undefined) {
  return useQuery({
    queryKey: [COMPONENTS_KEY, "collections", spaceId],
    queryFn: () => getComponentCollections(spaceId!),
    enabled: !!spaceId,
  });
}

export function useComponentsQuery(params: {
  spaceId?: string;
  collectionId?: string;
  query?: string;
  kind?: string;
  emptyOnly?: boolean;
}) {
  return useQuery({
    queryKey: [COMPONENTS_KEY, "list", params],
    queryFn: () => getComponents(params as any),
    enabled: !!params.spaceId,
    placeholderData: keepPreviousData,
  });
}

export function useComponentsBulkQuery(
  spaceId: string | undefined,
  componentIds: string[],
) {
  const ids = Array.from(new Set(componentIds)).sort();
  return useQuery({
    queryKey: [COMPONENTS_KEY, "bulk", spaceId, ids],
    queryFn: () => getComponentsBulk(spaceId!, ids),
    enabled: !!spaceId && ids.length > 0,
    staleTime: 30_000,
  });
}

export function useComponentDetailQuery(componentId: string | undefined) {
  return useQuery({
    queryKey: [COMPONENTS_KEY, "detail", componentId],
    queryFn: () => getComponentDetail(componentId!),
    enabled: !!componentId,
  });
}

export function useComponentUsagesQuery(componentId: string | undefined) {
  return useQuery({
    queryKey: [COMPONENTS_KEY, "usages", componentId],
    queryFn: () => getComponentUsages(componentId!),
    enabled: !!componentId,
  });
}

function useInvalidateComponents() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [COMPONENTS_KEY] });
}

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.message ?? fallback;
}

export function useCreateCollectionMutation() {
  const invalidate = useInvalidateComponents();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: createComponentCollection,
    onSuccess: () => invalidate(),
    onError: (err) =>
      notifications.show({
        color: "red",
        message: errorMessage(err, t("묶음을 만들지 못했습니다")),
      }),
  });
}

export function useUpdateCollectionMutation() {
  const invalidate = useInvalidateComponents();
  return useMutation({
    mutationFn: updateComponentCollection,
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCollectionMutation() {
  const invalidate = useInvalidateComponents();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: deleteComponentCollection,
    onSuccess: () => invalidate(),
    onError: (err) =>
      notifications.show({
        color: "red",
        message: errorMessage(err, t("묶음을 지우지 못했습니다")),
      }),
  });
}

export function useCreateComponentMutation() {
  const invalidate = useInvalidateComponents();
  return useMutation({
    mutationFn: createComponent,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateComponentMutation() {
  const invalidate = useInvalidateComponents();
  return useMutation({
    mutationFn: updateComponent,
    onSuccess: () => invalidate(),
  });
}

export function useDeleteComponentMutation() {
  const invalidate = useInvalidateComponents();
  return useMutation({
    mutationFn: deleteComponent,
    onSuccess: () => invalidate(),
  });
}

export function useUploadRevisionMutation() {
  const invalidate = useInvalidateComponents();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (vars: { componentId: string; file: File; message?: string }) =>
      uploadComponentRevision(vars.componentId, vars.file, vars.message),
    onSuccess: () => invalidate(),
    onError: (err) =>
      notifications.show({
        color: "red",
        message: errorMessage(err, t("파일을 올리지 못했습니다")),
      }),
  });
}
