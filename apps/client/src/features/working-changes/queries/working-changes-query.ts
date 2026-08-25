import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getWorkingChanges } from "@/features/working-changes/services/working-changes-service";
import { IWorkingChange } from "@/features/working-changes/types/working-changes.types";

export const RQ_WORKING_CHANGES = (spaceId: string) => [
  "working-changes",
  spaceId,
];

export function useWorkingChangesQuery(
  spaceId: string | undefined | null,
): UseQueryResult<IWorkingChange[], Error> {
  return useQuery({
    queryKey: RQ_WORKING_CHANGES(spaceId ?? ""),
    queryFn: () => getWorkingChanges(spaceId as string),
    enabled: !!spaceId,
    // 협업 저장이 디바운스(10s)라 방금 떠난 페이지는 잠깐 뒤처질 수 있다.
    // 열려 있는 페이지는 라이브 에디터 통계로 덮으므로 체감되지 않는다.
    staleTime: 15 * 1000,
  });
}
