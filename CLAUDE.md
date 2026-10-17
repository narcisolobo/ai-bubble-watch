# AI Bubble Watch

Current state, next steps, and open decisions: read [docs/status.md](docs/status.md) before starting work.

## Working conventions

- **Test-first** with `node:test` (`npm test`, `npm run typecheck`). Before writing tests for a new module, propose its seams (public functions and the behaviors to test) and get the owner's OK. Work one red → green cycle at a time.
- **Expected values in tests come from an independent source**: a press release, a published total, or a CSV row worked by hand, never recomputed the way the code computes it. Fixtures are unedited slices of real source responses.
- **Live checks write to a scratch directory** through `DATA_DIR`, with `SEC_USER_AGENT` set. The repo's `data/` belongs to the scheduled workflow.
- **The owner commits.** Leave changes uncommitted; the owner drafts messages with `/commit-message`.
- Keep `docs/status.md` current. When a step is done, move it to "Done" and record any new gotchas.
