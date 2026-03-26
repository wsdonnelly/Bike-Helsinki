### git workflow

- Keep `master` **always working**
- Work on **one feature per branch**
- Keep branches tight and focused
- Keep branches updated via **rebase**
- Merge finished work cleanly back into `master`

## branch naming convention eg. SEE commitMessageStyle.md -> Types
- feature/<name>
- fix/<name>
- refactor/
- tests/
etc

## Start a New Feature
```bash
git checkout master
git pull --rebase
git checkout -b feature/<name>
```

## Resume Work on a Feature
```bash
git checkout master
git pull --rebase
git checkout feature/<name>
git rebase master
```

## Keep Feature Branch Updated
```bash
git checkout feature/<name>
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
```bash
git add <changes>
git commit -m "Add feature X"

#WIP commits are fine and prefered over stash:
#git commit -m "WIP: partial implementation"

#Temporary switch (stash)
#git stash push -m "work in progress"
#git checkout feature/other-feature

# later
#git stash pop
```


## Push a Feature Branch
```bash
# First push
git push -u origin feature/<name>
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

git checkout feature/<name>
git rebase master

git checkout master
git merge feature/<name>
git push

# Clean up
git branch -d feature/<name>
# see repo branches
git branch -r
# update local view of repo
git fetch --prune
# delete repo branches
git push origin --delete feature/<name>
```
## gitlog reference command
```bash
git log --oneline --graph --decorate
```