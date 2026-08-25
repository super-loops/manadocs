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
