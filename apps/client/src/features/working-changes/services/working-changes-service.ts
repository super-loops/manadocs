import api from "@/lib/api-client";
import { IWorkingChange } from "@/features/working-changes/types/working-changes.types";

export async function getWorkingChanges(
  spaceId: string,
): Promise<IWorkingChange[]> {
  const req = await api.post<IWorkingChange[]>("/pages/working-changes", {
    spaceId,
  });
  return req.data ?? [];
}
