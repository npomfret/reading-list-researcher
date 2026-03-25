# Task 004: HTML Report Generator

## Status: TODO

## Goal

Take the `ResearchOutput` JSON from Phase 2 and produce a self-contained HTML report written to iCloud Drive. One report per item, plus an index page listing all reports.

## What to build

### 1. Report template + generator (`src/report.ts`)

- Takes a `ResearchOutput` object, renders a self-contained HTML file (inline CSS, no external deps)
- Clean typography (system font stack, good line-height, readable widths)
- Responsive — works on iPhone, iPad, Mac
- Dark mode via `prefers-color-scheme`
- Sections:
  1. Header — title, original URL link, date researched, content type
  2. Summary — the `summary` field
  3. Key Takeaways — `keyPoints` as a bulleted list
  4. About — author, publication, date published (when available)
  5. Sentiment / Tone — `sentiment` field
  6. Related Links — `relatedLinks` with titles and relevance notes
  7. Research Notes — `researchNotes` field
  8. Topics — tag pills

No Handlebars — just template literals. The data shape is simple enough.

### 2. Index page generator (`src/report-index.ts`)

- Reads all `*.json` files from the research dir
- Generates `index.html` listing all researched items
- Each entry: title (linked to report), topics, date, content type
- Sorted by date (newest first)
- Same styling as individual reports
- Regenerated on every new report

### 3. Wire into `src/index.ts`

After research completes:
1. Generate HTML report → write to iCloud Drive output dir
2. Regenerate index page
3. Update state status through `generating_report` → `complete`

### 4. Config updates (`src/config.ts`)

- Add `outputDir` — iCloud Drive path: `~/Library/Mobile Documents/com~apple~CloudDocs/ResearchPods/`
- Create dir if it doesn't exist

### 5. macOS notification (`src/utils/notify.ts`)

- `osascript -e 'display notification "..." with title "Research Agent"'`
- Fire on completion and failure

## Files to create/modify

```
src/report.ts           # NEW — HTML report generator
src/report-index.ts     # NEW — index page generator
src/utils/notify.ts     # NEW — macOS notification helper
src/index.ts            # MODIFY — wire in report generation + notification
src/config.ts           # MODIFY — add outputDir
```

## Dependencies

None new — just Node.js built-ins (`fs`, `path`, `child_process`).

## Verification

1. Run `npm start` with an unprocessed Reading List item
2. Confirm HTML report appears in iCloud Drive ResearchPods folder
3. Open report on iPhone — verify responsive layout and dark mode
4. Confirm index.html lists all researched items
5. Confirm macOS notification fires on completion
