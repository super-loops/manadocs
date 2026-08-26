import { atom } from "jotai";
import { ISharedPageTree } from "@/features/share/types/share.types";
import { SharedPageTreeNode } from "@/features/share/utils";

export const sharedPageTreeAtom = atom(null as ISharedPageTree | null);
export const sharedTreeDataAtom = atom(null as SharedPageTreeNode[] | null);