import { ReactNode } from 'react';

export interface EditorAiMenuProps {
  editor: any;
  children?: ReactNode;
}

export function EditorAiMenu({ editor, children }: EditorAiMenuProps) {
  return children;
}
