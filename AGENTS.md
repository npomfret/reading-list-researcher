# Reading List Researcher

Researches every article in the Safari Reading List with a Claude agent and publishes HTML reports to GitHub Pages from `docs/`. See `README.md` for setup.

Tech: Node 18+, TypeScript (tsx), Claude Agent SDK, Brave Search API, macOS Safari bookmarks and `osascript`.
Lifecycle: reports are published at https://npomfret.github.io/reading-list-researcher; maintenance status and any other users are not evidenced.

- `npm start` runs the poller; `npm run typecheck` checks types.
- `docs/` is generated published output: do not hand-edit it. `npm run reset` deletes `docs/`, the agent state under `~/.reading-list-agent` and the iCloud ResearchPods HTML; run it only on explicit request.

<!-- agent-standards:begin -->
## Shared agent guidance

Before starting work, read [Git](.agents/agent-standards/guidance/git.md), [Scope](.agents/agent-standards/guidance/legacy-scope.md).
Keep the shared checkout on its default branch. Use detached worktrees. Agents commit, fast-forward land and push their verified, reviewed work.

*Managed by `npomfret/agent-standards`; edit the shared sources there.*
<!-- agent-standards:end -->
