import plist from "simple-plist";

export interface ReadingListItem {
  url: string;
  title: string;
  dateAdded: Date | null;
  previewText?: string;
}

interface BookmarkNode {
  Title?: string;
  URLString?: string;
  URIDictionary?: { title?: string };
  ReadingList?: { DateAdded?: Date; PreviewText?: string };
  Children?: BookmarkNode[];
}

export function parseReadingList(plistPath: string): ReadingListItem[] {
  const data = plist.readFileSync(plistPath) as BookmarkNode;
  const items: ReadingListItem[] = [];

  const rlNode = data.Children?.find(
    (c) => c.Title === "com.apple.ReadingList"
  );
  if (!rlNode?.Children) return items;

  for (const entry of rlNode.Children) {
    const url = entry.URLString;
    if (!url) continue;
    items.push({
      url,
      title: entry.URIDictionary?.title ?? "",
      dateAdded: entry.ReadingList?.DateAdded ?? null,
      previewText: entry.ReadingList?.PreviewText,
    });
  }

  return items;
}
