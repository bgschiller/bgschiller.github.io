---
title: Stacked MR Workflow in Gitlab
date: 2025-09-28
description: Survey of tools to stack merge requests in GitLab, and a recommended workflow.
category: blog
tags: [git, gitlab, command line, tools]
draft: true
---

In git, a stacked workflow is one where you publish a sequence of small changesets (merge requests or pull requests) that build on one another. By keeping them small, you keep the effort to code review low. Building each change on top of the previous one means that you can avoid merge conflicts and keep working instead of waiting for code review.

However, there are some difficulties:

- When you get feedback on an early change, you must update all downstream changes. This can require multiple rebases.
- It can be tedious to create the merge requests, ensuring that each one is targeting the immediate predecessor.

There's more information on what makes stacked diffs valuable from [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/stacked-diffs) and [stacking.dev](https://www.stacking.dev/). TK more resources. I want to focus two things:

1. A glossary (TK do we like "gloassary"?) of tools I tried, and why they didn't work for me.
2. Details on the workflow I've landed on (at least for now).

# 1. The tools

## Github-specific Tools

Most of my coding at Grammarly happens on our private Gitlab instance. There are a number of stacked PR tools that work with GitHub, but not with Git*lab*. I considered the following only far enough to learn that did not work on Gitlab, but I'm listing them here in case one of them works for you (or me in the future):

- Graphite
- ghstack
- spr
- aviator (My Coda friends tell me this one is very good)

## `glab stack`, in the Gitlab CLI

I really wanted this to work, but it seems to be in permanent experimental state. It includes several bugs and doesn't match my mental state very well: it's required to "create a stack" to hold the branches; I'd rather this was implicit. Some bugs I encountered:

TK grab from https://gitlab.com/gitlab-org/cli/-/issues/7473#note_2651933041

## jujutsu

I so wanted to like jujutsu. Many engineers I look up to (Steve Klabnik, The "Defunctionalize the continuation" guy, TK others) have written about how much they like it. I failed to give it a good try because it doesn't work in repos that include files tracked by git LFS. There's an open issue for that bug (TK link), so hopefully I can give it another try someday. Or, my work might shift to a repo that doesn't include LFS.

I was also uncomfortable with the all-or-nothing approach: it didn't seem like I can mix `jj` and `git` commands without care.

## `git branchless`, what I landed with

Similar to jujutsu, `git branchless` maintains a database of changes and operation history that's separate from the `.git` directory. However, it still uses git commands, just introducing a handful of additional subcommands.

## Tools I still need to research

TK Other tools to cover:

- git branchless has a list of similar projects
- git town
- Git Butler. Jason Sperske says this is the closest he's seen to his dream workflow.

# 2. My workflow

Let's go through the workflow by following the actions I need to take to create a made-up package called "gringotts"

- First MR: `generate-gringotts-package -> main`
- Second MR: `gringotts-low-level-functions -> generate-gringotts-package`
- Third MR: `gringotts-friendly-api -> gringotts-low-level-functions`
- First MR approved
- Addressing review feedback: "please add unit tests"
- Remaining MRs approved

## The first MR

The first MR works like normal: cut a branch from `main` and hack on it.

```sh
git checkout main && git pull
git checkout -b generate-gringotts-package
```

If you have already run `git branchless init`, you'll see output like the following:

```
branchless: processing 1 update: branch generate-gringotts-package
Switched to a new branch 'generate-gringotts-package'
```

This output is from the git hooks that branchless installed in order to keep track of the relationships between your changes.

Suppose we do the work of this branch, setting up a package with boilerplate files and directories so it's ready to be published. By keeping these undifferentiated changes in a separate MR, we're making it easier to review the meaningful work.

When you're ready to make an MR, you can either use the web UI, the `glab` cli, or gitlab also supports push options. Right now, that's what's been working best for me. I run:

```sh
git push \
 -o merge_request.create \
 -o merge_request.target=main
```

At this point, CI has started to run on your first MR. The title of the MR was taken from the title of the first commit on your branch and the description from the body of that commit.

Another thing to point out: `-o merge_request.target` is hard-coded to `main`. This works for the first MR, but we would have to adjust that part of the command in order to target other branches. I want to turn this into a git alias, so I'd like to avoid having to edit that piece. We'll fix it up in the next section.

Let's run a `git smartlog` (also available as `git sl` to see how our changes look. You should see something like this:

```
◇ d65137e 2d (main) Merge branch 'changeset-release/main' into 'main'
┃
● c33cd2b 6s (ᐅ generate-gringotts-package) Boilerplate for gringotts package
```

## The second MR

                                                                                             d

Let's cut a second branch off of this one.

```sh
git checkout -b gringotts-low-level-functions`
```

Imagine we've written and committed some helper functions to be used in the next set of changes. It's time to create the MR. Last time, we set the `merge_request.target` to be `main`, but that's not what we want this time. We could explicitly write `generate-gringotts-package`, since that's the correct value this time, but let's do something that will work every time.

To orient ourselves, here's what the smartlog looks like right now

```
◇ d65137e 2d (main) Merge branch 'changeset-release/main' into 'main'
┃
◯ c33cd2b 5m Boilerplate for gringotts package
┃
◯ 36bf560 1m (generate-gringotts-package) Describe the purpose of the package in the README.md
┃
◯ 95f233f 3s Define some useful low-level functions
┃
● be8821e 2s (ᐅ gringotts-low-level-functions) Add tests for the functions
```

`git branchless` includes a command `git query` that offers a DSL for describing and selecting sets of commits. It relies on the database created when you run `git branchless init` (TK is that right?), so this will only work if you had already set it up before creating these branches. We'll run

```sh
git query --branches \
  '(ancestors(HEAD) & parents(stack())) - HEAD'
```

I'm pretty new to this tool, so there might be a terser way to write that. Here's how I read it:

- Find the names of `--branches` pointing at commits...
- That are among the ancestors of the HEAD commit `ancestors(HEAD)`...
- And (`&`) are immediate `parents(...)`...
- Of the current `stack()`-this set of commits descending from `main`...
- Excluding the branch pointing at `HEAD`.

This gives us a list of branches ordered with the "earliest" ones at top. In our situation, the output looks like this

```
main
generate-gringotts-package
```

We always want the most recent branch, so we'll pipe that into `tail -n1`. This gives the following command.

```sh
git push \
 -o merge_request.create \
 -o merge_request.target=$(
    git query --branches \
    '(ancestors(HEAD) & parents(stack())) - HEAD' |
     tail -n1)
```

When we run this, we're free to move onto the next branch.

## The third MR

This works much like before:

```sh
git checkout -b gringotts-friendly-api
# some editing...
git commit ...
```

Instead of copy-pasting that command from before, let's assume we set it up as a git alias:

```sh
git create-mr
```

And the smartlog looks like this

```
◇ d65137e 2d (main) Merge branch 'changeset-release/main' into 'main'
┃
◯ c33cd2b 9m Boilerplate for gringotts package
┃
◯ 36bf560 5m (generate-gringotts-package) Describe the purpose of the package in the README.md
┃
◯ 95f233f 3m Define some useful low-level functions
┃
◯ be8821e 3m (gringotts-low-level-functions) Add tests for the functions
┃
● fabfb4e 4s (ᐅ gringotts-friendly-api) Expose some higher-level APIs
```

## First MR approved

In the time we were working on those first two branches, our scaffolding MR was approved (yay!). Let's go ahead and merge it.

In the Gitlab Web UI, make sure the box for "Squash commits on merge" is unchecked. Otherwise, we'll run into conflicts when we go to rebase the downstream branches: it will appear that two unrelated commit histories both created the same file. It seems that creating the MR via the git push options (`-o merge_request.create`) always unchecks that box, even if it's the default for the repo, but I wouldn't count on that staying the same. It feels like an oversight that gitlab might "fix".

After merging, our `git smartlog` looks like the following:

```
◇ b02223f 2d Merge branch 'changeset-release/main' into 'main'
⋮
◇ 36bf560 7m Describe the purpose of the package in the README.md
┣━┓
┃ ◯ 95f233f 6m Define some useful low-level functions
┃ ┃
┃ ◯ be8821e 6m (gringotts-low-level-functions) Add tests for the functions
┃ ┃
┃ ◯ fabfb4e 2m (gringotts-friendly-api) Expose some higher-level APIs
┃
◆ 4c10048 4s (ᐅ main) Merge branch 'generate-gringotts-package'
```

Gitlab is smart enough to re-target the MRs when an MR is merged and the associated branch is deleted. But our history isn't so clean any more. `gringotts-low-level-functions` still has as its parent commit `36bf560`, the artist formerly known as `generate-gringotts-package`. However, we'd like to rebase `gringotts-low-level-functions` onto the tip of `main`. That is, pick up `95f233f` above and rewrite history to pretend that `4c10048` was it's parent.

### The tedious way

If we didn't have access to `git branchless`, here's how that would look:

```
git checkout gringotts-low-level-functions
git rebase main
```

That _sorta_ works. Here's what our smartlog looks like now:

```
◇ b02223f 2d Merge branch 'changeset-release/main' into 'main'
⋮
◇ 36bf560 13m (generate-gringotts-package) Describe the purpose of the package in the README.md
┣━┓
┃ ◯ 95f233f 12m Define some useful low-level functions
┃ ┃
┃ ◯ be8821e 12m Add tests for the functions
┃ ┃
┃ ◯ fabfb4e 8m (gringotts-friendly-api) Expose some higher-level APIs
┃
◇ 4c10048 6m (main) Merge branch 'generate-gringotts-package'
┃
◯ 50efa00 3s Define some useful low-level functions
┃
● b520d2c 2s (ᐅ gringotts-low-level-functions) Add tests for the functions
```

We've moved the specific branch we asked about, but left behind `gringotts-friendly-api`. And now there are two copies of each commit from `gringotts-low-level-functions`: `95f233f`/`50efa00` and `fabfb4e`/`b520d2c`.

What we actually wanted was to pick up the whole subtree, starting with commits on that branch, and move the whole thing. `git move` does what we want.

First, let's `git undo` that rebase. `git undo` is general purpose undo command that comes from the `git branchless` suite.

Then we can run

```
git move --source 95f233f --dest main
```

Hmm, that didn't work. wth.
