import {
  IconBlockquote,
  IconCaretRightFilled,
  IconCheckbox,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconInfoCircle,
  IconList,
  IconListNumbers,
  IconMath,
  IconMathFunction,
  IconMovie,
  IconMusic,
  IconPaperclip,
  IconFileTypePdf,
  IconPhoto,
  IconTable,
  IconTypography,
  IconMenu4,
  IconCalendar,
  IconAppWindow,
  IconSitemap,
  IconColumns3,
  IconColumns2,
  IconTag,
  IconAnchor,
} from "@tabler/icons-react";
import { openReviewSelectPopup } from "@/features/editor/components/review/review-select-popup-mount";
import {
  CommandProps,
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
} from "@/features/editor/components/slash-menu/types";
import i18n from "@/i18n.ts";
import { uploadImageAction } from "@/features/editor/components/image/upload-image-action.tsx";
import { uploadVideoAction } from "@/features/editor/components/video/upload-video-action.tsx";
import { uploadAudioAction } from "@/features/editor/components/audio/upload-audio-action.tsx";
import { uploadAttachmentAction } from "@/features/editor/components/attachment/upload-attachment-action.tsx";
import { uploadPdfAction } from "@/features/editor/components/pdf/upload-pdf-action.tsx";
import IconMermaid from "@/components/icons/icon-mermaid";
import { IconColumns4 } from "@/components/icons/icon-columns-4";
import { IconColumns5 } from "@/components/icons/icon-columns-5";
import {
  AirtableIcon,
  FigmaIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  LoomIcon,
  TypeformIcon,
  VimeoIcon,
  YoutubeIcon,
} from "@/components/icons";

const CommandGroups: SlashMenuGroupedItemsType = {
  basic: [
    {
      title: "Text",
      description: "Just start typing with plain text.",
      searchTerms: ["p", "paragraph", "문단", "본문"],
      icon: IconTypography,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .toggleNode("paragraph", "paragraph")
          .run();
      },
    },
    {
      title: "To-do list",
      description: "Track tasks with a to-do list.",
      searchTerms: ["todo", "task", "list", "check", "checkbox", "할일", "체크박스", "투두"],
      icon: IconCheckbox,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "Heading 1",
      description: "Big section heading.",
      searchTerms: ["title", "big", "large", "헤딩"],
      icon: IconH1,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      title: "Heading 2",
      description: "Medium section heading.",
      searchTerms: ["subtitle", "medium", "헤딩"],
      icon: IconH2,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      title: "Heading 3",
      description: "Small section heading.",
      searchTerms: ["subtitle", "small", "헤딩"],
      icon: IconH3,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      title: "Bullet list",
      description: "Create a simple bullet list.",
      searchTerms: ["unordered", "point", "list", "불릿", "리스트"],
      icon: IconList,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "Numbered list",
      description: "Create a list with numbering.",
      searchTerms: ["numbered", "ordered", "list", "번호", "리스트"],
      icon: IconListNumbers,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "Quote",
      description: "Create block quote.",
      searchTerms: ["blockquote", "quotes", "인용구"],
      icon: IconBlockquote,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Code",
      description: "Insert code snippet.",
      searchTerms: ["codeblock", "코드블럭"],
      icon: IconCode,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: "Divider",
      description: "Insert horizontal rule divider",
      searchTerms: ["horizontal rule", "hr", "수평선"],
      icon: IconMenu4,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Image",
      description: "Upload any image from your device.",
      searchTerms: ["photo", "picture", "media", "file", "attachment", "사진", "그림"],
      icon: IconPhoto,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload image
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadImageAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Video",
      description: "Upload any video from your device.",
      searchTerms: ["video", "mp4", "media", "file", "attachment", "영상", "동영상"],
      icon: IconMovie,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload video
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadVideoAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Audio",
      description: "Upload any audio from your device.",
      searchTerms: ["audio", "music", "sound", "mp3", "media", "file", "attachment", "음악", "소리"],
      icon: IconMusic,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload audio
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "audio/*";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadAudioAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Embed PDF",
      description: "Upload and embed a PDF file.",
      searchTerms: ["pdf", "document", "embed", "피디에프"],
      icon: IconFileTypePdf,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/pdf";
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadPdfAction(file, editor, pos, pageId);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "File attachment",
      description: "Upload any file from your device.",
      searchTerms: ["file", "attachment", "upload", "csv", "zip", "첨부파일"],
      icon: IconPaperclip,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();

        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;

        // upload file
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "";
        input.multiple = true;
        input.style.display = "none";
        document.body.appendChild(input);
        input.onchange = async () => {
          if (input.files?.length) {
            for (const file of input.files) {
              const pos = editor.view.state.selection.from;

              uploadAttachmentAction(file, editor, pos, pageId, true);
            }
          }

          input.remove();
        };
        input.click();
      },
    },
    {
      title: "Table",
      description: "Insert a table.",
      searchTerms: ["table", "rows", "columns", "표"],
      icon: IconTable,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      title: "Toggle block",
      description: "Insert collapsible block.",
      searchTerms: ["collapsible", "block", "toggle", "details", "expand", "접기", "펼치기"],
      icon: IconCaretRightFilled,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setDetails().run(),
    },
    {
      title: "Callout",
      description: "Insert callout notice.",
      searchTerms: [
        "callout",
        "notice",
        "panel",
        "info",
        "warning",
        "success",
        "error",
        "danger",
        "콜아웃",
        "알림",
      ],
      icon: IconInfoCircle,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).toggleCallout().run(),
    },
    {
      title: "Math inline",
      description: "Insert inline math equation.",
      searchTerms: [
        "math",
        "inline",
        "mathinline",
        "inlinemath",
        "inline math",
        "equation",
        "katex",
        "latex",
        "tex",
        "수식",
      ],
      icon: IconMathFunction,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setMathInline()
          .setNodeSelection(range.from)
          .run(),
    },
    {
      title: "Math block",
      description: "Insert math equation",
      searchTerms: [
        "math",
        "block",
        "mathblock",
        "block math",
        "equation",
        "katex",
        "latex",
        "tex",
        "수식",
      ],
      icon: IconMath,
      command: ({ editor, range }: CommandProps) =>
        editor.chain().focus().deleteRange(range).setMathBlock().run(),
    },
    {
      title: "Mermaid diagram",
      description: "Insert mermaid diagram",
      searchTerms: ["mermaid", "diagrams", "chart", "uml", "다이어그램", "머메이드"],
      icon: IconMermaid,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setCodeBlock({ language: "mermaid" })
          .insertContent("flowchart LR\n" + "    A --> B")
          .run(),
    },
    {
      title: "Date",
      description: "Insert current date",
      searchTerms: ["date", "today", "오늘"],
      icon: IconCalendar,
      command: ({ editor, range }: CommandProps) => {
        const currentDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(currentDate)
          .run();
      },
    },
    {
      title: "Review",
      description: "Start a review on a selection or insertion point.",
      searchTerms: ["review", "anchor", "comment", "feedback", "검토"],
      icon: IconAnchor,
      command: ({ editor, range }: CommandProps) => {
        // @ts-ignore
        const pageId = editor.storage?.pageId;
        if (!pageId) return;
        openReviewSelectPopup(editor, range, pageId);
      },
    },
    {
      title: "Status",
      description: "Insert inline status badge.",
      searchTerms: ["status", "badge", "label", "lozenge", "뱃지"],
      icon: IconTag,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setStatus({ color: "gray" })
          .run();
      },
    },
    {
      title: "Subpages (Child pages)",
      description: "List all subpages of the current page",
      searchTerms: ["subpages", "child", "children", "nested", "hierarchy", "서브페이지", "하위"],
      icon: IconSitemap,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).insertSubpages().run();
      },
    },
    {
      title: "Linked pages",
      description: "Display selected pages from any space",
      searchTerms: ["linkpages", "links", "pages", "reference", "링크", "페이지"],
      icon: IconSitemap,
      command: ({ editor, range }: CommandProps) => {
        editor.chain().focus().deleteRange(range).insertLinkpages().run();
      },
    },
    {
      title: "2 Columns",
      description: "Split content into two columns.",
      searchTerms: ["columns", "layout", "split", "side", "단", "컬럼"],
      icon: IconColumns2,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "two_equal" })
          .run(),
    },
    {
      title: "3 Columns",
      description: "Split content into three columns.",
      searchTerms: ["columns", "layout", "split", "triple", "단", "컬럼"],
      icon: IconColumns3,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "three_equal" })
          .run(),
    },
    {
      title: "4 Columns",
      description: "Split content into four columns.",
      searchTerms: ["columns", "layout", "split", "단", "컬럼"],
      icon: IconColumns4,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "four_equal" })
          .run(),
    },
    {
      title: "5 Columns",
      description: "Split content into five columns.",
      searchTerms: ["columns", "layout", "split", "단", "컬럼"],
      icon: IconColumns5,
      command: ({ editor, range }: CommandProps) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertColumns({ layout: "five_equal" })
          .run(),
    },
    {
      title: "Iframe embed",
      description: "Embed any Iframe",
      searchTerms: ["iframe", "임베드"],
      icon: IconAppWindow,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "iframe" })
          .run();
      },
    },
    {
      title: "Airtable",
      description: "Embed Airtable",
      searchTerms: ["airtable"],
      icon: AirtableIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "airtable" })
          .run();
      },
    },
    {
      title: "Loom",
      description: "Embed Loom video",
      searchTerms: ["loom"],
      icon: LoomIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "loom" })
          .run();
      },
    },
    {
      title: "Figma",
      description: "Embed Figma files",
      searchTerms: ["figma"],
      icon: FigmaIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "figma" })
          .run();
      },
    },
    {
      title: "Typeform",
      description: "Embed Typeform",
      searchTerms: ["typeform"],
      icon: TypeformIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "typeform" })
          .run();
      },
    },
    {
      title: "YouTube",
      description: "Embed YouTube video",
      searchTerms: ["youtube", "yt", "media", "video", "유튜브", "영상"],
      icon: YoutubeIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "youtube" })
          .run();
      },
    },
    {
      title: "Vimeo",
      description: "Embed Vimeo video",
      searchTerms: ["vimeo"],
      icon: VimeoIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "vimeo" })
          .run();
      },
    },
    {
      title: "Google Drive",
      description: "Embed Google Drive content",
      searchTerms: ["google drive", "gdrive"],
      icon: GoogleDriveIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "gdrive" })
          .run();
      },
    },
    {
      title: "Google Sheets",
      description: "Embed Google Sheets content",
      searchTerms: ["google sheets", "gsheets"],
      icon: GoogleSheetsIcon,
      command: ({ editor, range }: CommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setEmbed({ provider: "gsheets" })
          .run();
      },
    },
  ],
};

/**
 * 메뉴에 실제로 보이는 라벨. command-list 가 t(item.title) 로 렌더하므로
 * 검색도 같은 문자열을 봐야 한다 — 안 그러면 화면엔 "리뷰"라고 떠 있는데
 * `/리뷰` 로는 안 잡히고 `/review` 로만 잡힌다.
 */
const translated = (key: string): string => {
  try {
    return i18n.t(key) as string;
  } catch {
    return key;
  }
};

export const getSuggestionItems = ({
  query,
}: {
  query: string;
}): SlashMenuGroupedItemsType => {
  const search = query.toLowerCase();
  const filteredGroups: SlashMenuGroupedItemsType = {};

  const fuzzyMatch = (query: string, target: string) => {
    let queryIndex = 0;
    target = target.toLowerCase();
    for (const char of target) {
      if (query[queryIndex] === char) queryIndex++;
      if (queryIndex === query.length) return true;
    }
    return false;
  };

  // 제목은 fuzzy(부분 순서), 설명·검색어는 부분 문자열 — 원문과 번역문 양쪽으로.
  const matches = (item: SlashMenuItemType) => {
    const titles = [item.title, translated(item.title)];
    if (titles.some((title) => fuzzyMatch(search, title))) return true;

    const haystacks = [
      item.description,
      translated(item.description),
      ...(item.searchTerms ?? []),
    ];
    return haystacks.some((text) => text.toLowerCase().includes(search));
  };

  // 제목에 그대로 들어있는 항목을 위로 (원문/번역문 중 하나라도)
  const titleRank = (item: SlashMenuItemType) =>
    [item.title, translated(item.title)].some((title) =>
      title.toLowerCase().includes(search),
    )
      ? 0
      : 1;

  for (const [group, items] of Object.entries(CommandGroups)) {
    const filteredItems = items.filter(matches);

    if (filteredItems.length) {
      filteredGroups[group] = filteredItems.sort(
        (a, b) => titleRank(a) - titleRank(b),
      );
    }
  }

  return filteredGroups;
};

export default getSuggestionItems;
