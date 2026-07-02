import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import PageVersionTabs from "@/features/page/components/header/page-version-tabs.tsx";
import PreviewButton from "@/features/page/components/header/preview-button.tsx";
import { Group } from "@mantine/core";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import ShareModal from "@/features/share/components/share-modal.tsx";

interface Props {
  readOnly?: boolean;
}
export default function PageHeader({ readOnly }: Props) {
  return (
    <div className={classes.header}>
      <Group justify="space-between" h="100%" px="md" wrap="nowrap" className={classes.group}>
        <Group wrap="nowrap" gap="sm">
          <PageVersionTabs readOnly={readOnly} />
          <Breadcrumb />
        </Group>

        <Group justify="flex-end" h="100%" px="md" wrap="nowrap" gap="var(--mantine-spacing-xs)">
          <ShareModal readOnly={!!readOnly} />
          <PreviewButton />
          <PageHeaderMenu readOnly={readOnly} />
        </Group>
      </Group>
    </div>
  );
}
