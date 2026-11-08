import api from "@/lib/api-client";
import {
  IComponent,
  IComponentCollection,
  IComponentDetail,
  IComponentUsage,
} from "@/features/component/types/component.types";

export async function getComponentCollections(
  spaceId: string,
): Promise<IComponentCollection[]> {
  const req = await api.post("/components/collections", { spaceId });
  return req.data;
}

export async function createComponentCollection(data: {
  spaceId: string;
  name: string;
  description?: string;
}): Promise<IComponentCollection> {
  const req = await api.post("/components/collections/create", data);
  return req.data;
}

export async function updateComponentCollection(data: {
  collectionId: string;
  name?: string;
  description?: string;
}): Promise<IComponentCollection> {
  const req = await api.post("/components/collections/update", data);
  return req.data;
}

export async function deleteComponentCollection(collectionId: string) {
  const req = await api.post("/components/collections/delete", {
    collectionId,
  });
  return req.data;
}

export async function getComponents(params: {
  spaceId: string;
  collectionId?: string;
  query?: string;
  kind?: string;
  emptyOnly?: boolean;
}): Promise<IComponent[]> {
  const req = await api.post("/components/list", params);
  return req.data;
}

export async function getComponentsBulk(
  spaceId: string,
  componentIds: string[],
): Promise<IComponent[]> {
  const req = await api.post("/components/bulk", { spaceId, componentIds });
  return req.data;
}

export async function getComponentDetail(
  componentId: string,
): Promise<IComponentDetail> {
  const req = await api.post("/components/info", { componentId });
  return req.data;
}

export async function getComponentUsages(
  componentId: string,
): Promise<IComponentUsage[]> {
  const req = await api.post("/components/usages", { componentId });
  return req.data;
}

export async function createComponent(data: {
  spaceId: string;
  collection: string;
  slug: string;
  kind: string;
  description?: string;
}): Promise<IComponent> {
  const req = await api.post("/components/create", data);
  return req.data;
}

export async function updateComponent(data: {
  componentId: string;
  slug?: string;
  description?: string;
  collectionId?: string;
}): Promise<IComponent> {
  const req = await api.post("/components/update", data);
  return req.data;
}

export async function deleteComponent(componentId: string) {
  const req = await api.post("/components/delete", { componentId });
  return req.data;
}

export async function uploadComponentRevision(
  componentId: string,
  file: File,
  message?: string,
): Promise<{ component: IComponent; revision: number; filledInstances: number }> {
  const formData = new FormData();
  formData.append("componentId", componentId);
  if (message) formData.append("message", message);
  formData.append("file", file);
  const req = await api.post("/components/upload-revision", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return req.data;
}
