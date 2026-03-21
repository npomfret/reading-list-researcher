# Task 7: HTML Report Writer

## Status: done

## Description
Generate standalone magazine-style HTML pages from markdown reports.

## Steps
1. Create `src/writers/html-report.ts`
2. Define `ReportMeta` interface (title, url, date, category, slug)
3. Implement `slugify(title)` — lowercase, replace non-alphanumeric with hyphens, trim, max 80 chars
4. Implement `writeReport(reportsDir, meta, markdown)` — converts markdown to HTML via `marked`, wraps in magazine-style template with inline CSS (dark mode, typography, mobile-friendly)
5. Implement `escapeHtml()` utility

## Files
- `src/writers/html-report.ts`
