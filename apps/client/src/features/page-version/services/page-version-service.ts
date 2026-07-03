import api from "@/lib/api-client";
import { IPagination } from "@/lib/types.ts";
import {
  ICommitVersionInput,
  ICreateWorkingDocInput,
  IPageVersion,
  IPageWorkingDoc,
} from "@/features/page-version/types/page-version.types";

export async function getPageVersions(
  pageId: string,
  cursor?: string,
): Promise<IPagination<IPageVersion>> {
  const req = await api.post("/pages/versions", { pageId, cursor });
  return req.data;
}

export async function getPageVersionInfo(
  versionId: string,
): Promise<IPageVersion> {
  const req = await api.post<IPageVersion>("/pages/versions/info", {
    versionId,
  });
  return req.data;
}

export async function commitVersion(
  data: ICommitVersionInput,
): Promise<IPageVersion> {
  const req = await api.post<IPageVersion>("/pages/versions/commit", data);
  return req.data;
}

export async function discardVersion(versionId: string): Promise<void> {
  await api.post("/pages/versions/discard", { versionId });
}

export async function undiscardVersion(versionId: string): Promise<void> {
  await api.post("/pages/versions/undiscard", { versionId });
}

export async function setPrimaryVersion(versionId: string): Promise<void> {
  await api.post("/pages/versions/set-primary", { versionId });
}

export async function duplicateVersionAsPage(
  versionId: string,
): Promise<{ id: string; slugId: string; title: string }> {
  const req = await api.post("/pages/versions/duplicate-page", { versionId });
  return req.data;
}

export async function getWorkingDocs(
  pageId: string,
): Promise<IPageWorkingDoc[]> {
  const req = await api.post("/pages/working-docs", { pageId });
  return req.data;
}

export async function createWorkingDoc(
  data: ICreateWorkingDocInput,
): Promise<IPageWorkingDoc> {
  const req = await api.post<IPageWorkingDoc>(
    "/pages/working-docs/create",
    data,
  );
  return req.data;
}

export async function deleteWorkingDoc(workingDocId: string): Promise<void> {
  await api.post("/pages/working-docs/delete", { workingDocId });
}

export async function setPrimaryWorkingDoc(
  workingDocId: string,
): Promise<void> {
  await api.post("/pages/working-docs/set-primary", { workingDocId });
}

export async function resetWorkingDoc(workingDocId: string): Promise<void> {
  await api.post("/pages/working-docs/reset", { workingDocId });
}
