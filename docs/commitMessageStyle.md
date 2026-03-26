### Commit Message Style
# Commit messages must not contain !, backticks, or unescaped $. Prefer plain descriptive language over emphasis punctuation.
# Never use git commit -m. Always open the editor so the full format can be written.

# [branch-feature-name] <type>(<scope>): <short summary>

# <body — what and why, not how>

- Component/file: specific change
- Component/file: specific change

## Branch prefix

The `prepare-commit-msg` hook automatically prepends `[branch-feature-name]` to
every commit subject on non-master branches. Install it once per clone:

```sh
sh scripts/install-hooks.sh
```

Example: on branch `feature/switch_to_digitransit` a commit becomes:
`[switch_to_digitransit] feat(api): add digitransit geocoding client`

On `master` no prefix is added.

## Rules
# Subject line

- Format: [branch] type(scope): summary
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
`wip(scope): partial implementation of X`

# Types

- feat — new feature
- fix — bug fix
- refactor — restructure without behaviour change
- chore — tooling, deps, config
- docs — documentation only
- style — formatting, no logic change
- test — tests only
- wip — work in progress (temporary, squash before merge if needed)
