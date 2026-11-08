export type ComponentKind = "image" | "file";

export interface IComponentInstanceAttrs {
  componentId: string;
  slug: string;
  kind: ComponentKind | string;
  description: string | null;
  revision: number;
  src: string | null;
  attachmentId: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
}

export interface IComponent {
  id: string;
  slug: string;
  kind: ComponentKind;
  description: string | null;
  collectionId: string;
  collectionName: string;
  currentRevision: number;
  empty: boolean;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  instanceAttrs: IComponentInstanceAttrs;
  spaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IComponentCollection {
  id: string;
  name: string;
  description: string | null;
  position: number;
  spaceId: string;
  componentCount: number;
}

export interface IComponentRevision {
  id: string;
  revision: number;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  message: string | null;
  creatorName: string | null;
  createdAt: string;
  src: string | null;
}

export interface IComponentDetail {
  component: IComponent;
  revisions: IComponentRevision[];
}

export interface IInstanceLocation {
  componentId: string;
  revision: number;
  blockIndex: number;
  blockCount: number;
  ratio: number;
  heading: string | null;
}

export interface IComponentUsage {
  pageId: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  workingDocs: Array<{
    workingDocId: string;
    name: string | null;
    primary: boolean;
    locations: IInstanceLocation[];
  }>;
  committed: null | { version: number; revisions: number[] };
}
