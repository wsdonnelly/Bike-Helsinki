### git workflow

- Keep `master` **always working**
- Work on **one feature per branch**
- Keep branches tight and focused
- Keep branches updated via **rebase**
- Merge finished work cleanly back into `master`

## branch naming convention
Valid types: `feat`, `fix`, `refactor`, `tests`, `chore`, `docs`, `style`
- feat/<name>
- fix/<name>
- refactor/<name>
- tests/<name>
- chore/<name>
- docs/<name>
- style/<name>

`wip` is not a valid branch type — use WIP commits on a properly typed branch instead.

Branch names must be **descriptive** — the full branch name becomes the `[branch]` prefix in every commit message via the `prepare-commit-msg` hook.
Good: `feat/add-address-autocomplete` → `[feat/add-address-autocomplete] feat(...): ...`
Bad: `feat/stuff`

Install the hook once per clone:
```bash
sh scripts/install-hooks.sh
```

## Start a New Feature
```bash
git checkout master
git pull --rebase
git checkout -b feat/<name>
```

## Resume Work on a Feature
```bash
git checkout master
git pull --rebase
git checkout feat/<name>
git rebase master
```

## Keep Feature Branch Updated
```bash
git checkout feat/<name>
git fetch origin
git rebase origin/master
# If conflicts occur:
# fix files
# git add <file>
# git rebase --continue
#Abort if needed:
#git rebase --abort
```

### Normal Development on a feature branch (or branches)

Always open the editor for commits — never use `git commit -m`. The hook will pre-fill the `[branch]` prefix.
Keep the subject line under ~72 characters — the full branch name prefix counts toward the limit.
See `docs/commitMessageStyle.md` for the full format.

```bash
git add <changes>
git commit

#WIP commits are fine and preferred over stash — use the editor:
#git commit   (write: WIP: partial implementation of X — no scope needed)

#Temporary switch (stash)
#git stash push -m "work in progress"
#git checkout feat/other-feature

# later
#git stash pop
```


## Squash WIP Commits Before Merge

WIP commits must be squashed into clean, properly-typed commits before merging to `master`.
Use interactive rebase to collapse or reword them:

```bash
git rebase -i master
```

In the editor, mark WIP commits with `squash` (or `s`) to fold them into the preceding commit,
or `reword` (or `r`) to keep the commit but write a proper message.

Example — branch has three commits:
```
pick abc1234 [feat/geocoding] feat(api): scaffold geocoding module
pick def5678 [feat/geocoding] WIP: half-done address parsing
pick ghi9012 [feat/geocoding] WIP: finish parsing, add tests
```
Change to:
```
pick abc1234 [feat/geocoding] feat(api): scaffold geocoding module
squash def5678 [feat/geocoding] WIP: half-done address parsing
squash ghi9012 [feat/geocoding] WIP: finish parsing, add tests
```
Git opens the editor again to write the final combined message — write it as a proper commit.

After squashing, force-push the branch:
```bash
git push --force-with-lease
```
The pre-push hook blocks any push that still contains WIP commits.

## Push a Feature Branch
```bash
# First push
git push -u origin feat/<name>
# Normal push
git push
# After amend or rebase
git push --force-with-lease
# Why Force Push Is Needed
# git commit --amend → creates new commit hash
# git rebase → rewrites history
# Remote still has old commits
```
## Finish a Feature
```bash
git checkout master
git pull

git checkout feat/<name>
git rebase master

git checkout master
git merge feat/<name>
git push

# Clean up
git branch -d feat/<name>
# see repo branches
git branch -r
# update local view of repo
git fetch --prune
# delete repo branches
git push origin --delete feat/<name>
```
## gitlog reference command
```bash
git log --oneline --graph --decorate
```
