export type MaintenanceIssueKind =
  | "empty"
  | "untitled"
  | "staleUncommitted"
  | "integrity";

export interface IMaintenancePage {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  detail?: string;
  /**
   * 이 페이지를 휴지통으로 보낼 때 함께 딸려가는 살아있는 하위 페이지 수.
   * 서버의 휴지통 이동은 하위 트리 전체를 캐스케이드한다.
   */
  descendantCount: number;
}

export interface IMaintenanceGroup {
  kind: MaintenanceIssueKind;
  count: number;
  items: IMaintenancePage[];
}

export interface ISpaceMaintenanceScan {
  groups: IMaintenanceGroup[];
  staleDays: number;
  scannedAt: string;
}
