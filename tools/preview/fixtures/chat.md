=== user ===
which branch am I on?

=== agent ===
`feature/export-csv`, two commits ahead of `main`.

=== user ===
ok rebase it and run the tests

=== agent ===
Rebased onto `main` with no conflicts. Tests: **216 pass**, 0 fail, 3 skipped (the three that need the staging database).

=== user ===
nice. open a PR, title "Export orders as CSV"

=== agent ===
Done: **Export orders as CSV** is open as a draft.

- 4 files changed, +182 −17
- CI is running; the last three runs on this branch took about 6 minutes

Want me to watch CI and mark it ready when it's green?

=== user ===
yes

=== agent ===
Watching. I'll tell you when it finishes.
