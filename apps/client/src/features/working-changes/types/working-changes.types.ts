/** 아직 확정하지 않은 수정이 남아 있는 페이지 한 건 */
export interface IWorkingChange {
  pageId: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  added: number;
  deleted: number;
}
