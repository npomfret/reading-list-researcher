# Reading List Researcher

See `README.md` for what this project does and how to run it.

## Task files

A `tasks/` folder holds one markdown file per piece of work. This is our standard workflow and the wording is identical across all our projects. Task files are committed with the code.

### When a task file is required

- Always, for planned work.
- For unplanned work, whenever a reasonable-length commit message could not adequately describe the problem, the solution and the evidence. If a commit message is enough, no task file is needed.
- One file per piece of work. If an existing task already owns the work, update it instead of creating another.

### Naming and location

- `<slug>.md` inside a `tasks/` folder. The slug is a short imperative description in plain search terms, for example `fix-login-timeout.md` or `add-csv-export.md`. A numeric or stream prefix is fine where the project already uses one.
- A `tasks/` folder need not be at the repository root. Where a project is split into sub-projects, each may keep its own `tasks/` folder owning the work for its code, and a root `tasks/` then covers work that crosses sub-projects or concerns the repository itself. Put the file in the `tasks/` folder closest to the code it changes.
- Subfolders inside `tasks/` may group related work.
- Non-task documentation goes in `docs/`, not `tasks/`.

### What goes in a task file

A task file grows with the work. It may begin as nothing more than a bug report or a one-line feature request, and at that point it is complete. Add a section when the work produces something to put under it; never write a heading you have nothing to fill.

Only the issue is always present:

- The issue: the bug, feature, refactor or research question, and why it matters.
- Brainstorming: candidate approaches, including rejected ones and why they were rejected.
- The plan: the chosen solution, broken into steps or phases that each leave the system working, with observable success criteria.
- Tracking: current status, decisions and approvals, what has shipped, what remains, blockers, the exact verification run, and residual risk.

### Keeping it current

- A task file is a living working document, not a diary. Correct stale scope, plans and claims in place. Do not append a chronological log of changes of mind; git history records that.
- Update the task file in the same commit as the code it describes so status and implementation never drift.
- Mark a step complete only when the implementation exists and its verification has passed. If verification cannot run, leave the step open and record the exact blocker.

### Completion and deletion

- A task file is not an authority, and code and durable docs must never reference one.
- Usually nothing needs promoting before deletion. The work is the code, the tests are the evidence, and both stay. Delete the file.
- Occasionally a task reaches a conclusion the code cannot carry: a product or architecture decision, or an approach rejected for reasons worth not rediscovering. Move that to `docs/` first. This is the exception, not the rule.
- The commit that lands the last piece of work also updates the task file to its final state: what shipped, exact verification, remaining risk.
- Delete the completed task file in a separate follow-up commit, after that last piece of work is committed. Genuinely outstanding work moves to a new, narrower task file first.
