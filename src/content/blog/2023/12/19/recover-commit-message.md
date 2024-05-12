---
title: Recover a Lost Commit Message
date: 2023-12-19
description: How to recover a lost git commit message
category: blog
tags: [programming, git, tools]
---

Today, I was writing a long, careful `git commit` message. No `git commit -m "fixes"` for me—this was a real novel. It had bulleted lists, and links to tickets and related pull requests. I finished up my message, typed `<esc>-:wq-<enter>` to exit vim and...

```
***ERROR***: Invalid commit message.

On a task branch (i.e. branch with a JIRA ticket ID in it's name, like
SF-XXX where SF-XXX is the id of your Jira ticket), all commit messages must
start with the JIRA ticket's ID, in all caps. Merge commits are also allowed.
E.g.

  SF-XXX Made some changes

[... more advice, snipped ...]

Aborting.
```

A git post-commit hook cancelled my commit! For a moment, panic. Would I need to rewrite that whole thing? Luckily, some googling turned up the following:

> In order to commit, your editor MUST write the commit message to the file .git/COMMIT_EDITMSG and exit with a 0 status code.

Maybe the message is still there, in `.git/COMMIT_EDITMSG`? It was! My day is saved! I was able to grab the full text and copy it into a new commit message.
