import { saveAs } from "file-saver";
import { generateHTML } from "@tiptap/html";
import { htmlToMarkdown } from "@manadocs/editor-ext";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { IPageVersion } from "@/features/page-version/types/page-version.types";

function safeName(version: IPageVersion): string {
  const title = (version.title || "untitled").replace(/[^\p{L}\p{N}\-_]+/gu, "-");
  return `${title}-v${version.version}`;
}

export function downloadVersionJson(version: IPageVersion) {
  const blob = new Blob([JSON.stringify(version.content ?? {}, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  saveAs(blob, `${safeName(version)}.json`);
}

export function downloadVersionMarkdown(version: IPageVersion) {
  const content = version.content ?? { type: "doc", content: [] };
  const html = generateHTML(content, mainExtensions);
  const markdown = htmlToMarkdown(html);
  const title = version.title ? `# ${version.title}\n\n` : "";
  const blob = new Blob([`${title}${markdown}`], {
    type: "text/markdown;charset=utf-8",
  });
  saveAs(blob, `${safeName(version)}.md`);
}
