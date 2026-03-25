# Task 006: GitHub Pages Deployment

## Status: TODO

## Goal

Deploy reports to GitHub Pages so they're accessible at public URLs. This enables one-click sharing to NotebookLM for podcast generation, and makes reports viewable on any device without iCloud.

## What to build

### 1. GitHub Pages repo setup

Create a GitHub repo (e.g. `research-reports`) with GitHub Pages enabled, serving from the default branch root.

### 2. Deploy module (`src/deploy.ts`)

After generating a report, copy the HTML to a local clone of the GitHub Pages repo and push.

```typescript
export async function deployReport(htmlPath: string, hash: string): Promise<string>
// Returns the public URL
```

Implementation: copy file into local repo clone, `git add`, `git commit`, `git push`. GitHub Pages auto-deploys on push. Also deploys the index page.

### 3. Config additions (`src/config.ts`)

- `githubPagesDir`: local path to the GitHub Pages repo clone
- `githubPagesBaseUrl`: public URL base (e.g. `https://nickpomfret.github.io/research-reports`)
- `deployEnabled`: `DEPLOY_ENABLED !== "false"` (opt-out)

### 4. Share button in report template (`src/report.ts`)

"Share to NotebookLM" button that copies the public URL to clipboard and opens NotebookLM. Only renders when `publicUrl` is provided.

### 5. Index page update (`src/report-index.ts`)

Show public URL for deployed reports.

### 6. Pipeline wiring (`src/index.ts`)

After report + index generation: if `deployEnabled`, call `deployReport()`, store public URL in state, re-generate report with share button.

### 7. State addition (`src/state.ts`)

Add `publicUrl?: string` to `StateItem`.

## Files to create/modify

```
src/deploy.ts          # NEW
src/index.ts           # MODIFY
src/config.ts          # MODIFY
src/report.ts          # MODIFY
src/report-index.ts    # MODIFY
src/state.ts           # MODIFY
```

## Dependencies

None new — just `child_process` for git commands.

## Verification

1. `npm start` processes an item → report appears in iCloud Drive AND GitHub Pages repo
2. GitHub Pages URL is accessible in browser
3. Report has "Share to NotebookLM" button that copies URL + opens NotebookLM
4. Paste URL in NotebookLM → it ingests the report content
5. Index page is also deployed
6. `DEPLOY_ENABLED=false` skips deployment, no share button
