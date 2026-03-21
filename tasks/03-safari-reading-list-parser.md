# Task 3: Safari Reading List Parser

## Status: done

## Description
Parse Safari's Bookmarks.plist to extract Reading List items.

## Steps
1. Create `src/watcher/safari-reading-list.ts`
2. Define `ReadingListItem` interface (url, title, dateAdded, previewText)
3. Define `BookmarkNode` interface for plist structure
4. Implement `parseReadingList(plistPath)` — reads plist, finds `com.apple.ReadingList` node, extracts items

## Files
- `src/watcher/safari-reading-list.ts`
