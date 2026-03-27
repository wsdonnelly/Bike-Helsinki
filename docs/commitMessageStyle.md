### Commit Message Style
# Commit messages must not contain !, backticks, or unescaped $. Prefer plain descriptive language over emphasis punctuation.
# Never use git commit -m. Always open the editor so the full format can be written.

# [type/branch-name] type(scope): short summary

# <body — what and why, not how>

- Component/file: specific change
- Component/file: specific change

## Branch prefix

The `prepare-commit-msg` hook automatically prepends the full branch name as `[type/name]`
to every commit subject on non-master branches. Install it once per clone:

```sh
sh scripts/install-hooks.sh
```

Example: on branch `feat/switch-to-digitransit` a commit becomes:
`[feat/switch-to-digitransit] feat(api): add digitransit geocoding client`

On `master` no prefix is added.

## Rules
# Subject line

- Format: [type/branch-name] type(scope): summary
- Max ~72 characters (prefix included)
- Lowercase, no trailing period
- Use imperative mood — add, fix, remove, not added, fixes
- Never use git commit -m — always open the editor

# Body (only when needed)

- Blank line after subject
- Explain the what and why, not the implementation detail
- Bullet list of per-file/component changes at the end for multi-file commits

# WIP commits

WIP commits are preferred over stashing. Write them in the editor like any other commit:
`WIP: partial implementation of X`

No scope needed — the branch prefix already carries that context.

# Types

- feat — new feature
- fix — bug fix
- refactor — restructure without behaviour change
- chore — tooling, deps, config
- docs — documentation only
- style — formatting, no logic change
- tests — tests only
- WIP — work in progress (always uppercase, no scope, temporary — squash before merge)
