---
title: Commit Changeset
date: 2025-06-24
description: A git alias to use changeset descriptions as commit messages
category: blog
tags: [git, changeset, terminal]
---

I use [changesets](https://github.com/changesets/changesets) to manage releases in the main repositories I use at work. (I've [written before about how I prefer it over semantic commits](/blog/2023/09/18/changesets-vs-semantic-release))

I find that, if I've written a clear description of my change for the changeset, I probably want to use the same thing for my commit message. I had been doing this manually, then moved to a shell pipeline that I'd find in my history and re-use, but today I decided to turn it into something a little more polished. Here's the shell function in its entirety, and then I'll explain how it works:

```bash
ccs() {
    local changeset_files
    changeset_files=$(
      git status -s |
      awk '{ if ($1 == "A") print $2 }' |
      grep .changeset
    )

    if [[ -n "$changeset_files" ]]; then
        echo "$changeset_files" | \
        xargs -I {} sed '1,/^$/d' "{}" | \
        git commit -F - --edit
    else
        echo "No changeset files found to commit."
        echo "Perhaps you forgot to git add them?"
        exit 1
    fi
}
```

First, we use `git status -s` to find a list of files that are changed in our working tree. I use awk to filter only for files that are added "A", as opposed to modified, deleted, or untracked, then print only the filename (`$2`). Those are further filtered to only the files whose path includes ".changeset".

Next, we need to reformat the files a bit. Changeset files have yaml frontmatter that describes which packages were changed, and whether it was a major, minor, or patch change. I didn't want that in the commit message. `set '1,/^$/d'` says "delete the range of lines starting at 1 and ending with the first empty line". This removes the frontmatter, leaving just the description of the change.

The `xargs` business before the `sed` command is there to make sure we delete the frontmatter for each changeset file found, not just the first one.

Finally, we pipe that into `git commit -F - --edit`. The `-F -` flag tells git to read the commit message from standard input, and `--edit` opens the commit message in your editor so you can make any final adjustments before committing. This is especially useful if there were multiple changeset files.

I initially had this all in one big pipeline, but it didn't work very well. `git status` and `git commit` both want to hold `.git/index.lock`, and I got an error if `git commit` started when `git status` was still running. Capturing the changeset files in a variable ensures that `git status` is done before we try to commit.

I've added this as an alias to my gitconfig. I used `ccs` to stand for "commit changeset". Here's what it looks like in the config file, with all the necessary escaping.

```toml
# ~/.gitconfig
[alias]
    ccs = "!f() { local changeset_files; changeset_files=$(git status -s | awk '{ if ($1 == \"A\") print $2 }' | grep .changeset); if [[ -n \"$changeset_files\" ]]; then echo \"$changeset_files\" | xargs -I {} sed '1,/^$/d' \"{}\" | git commit -F - --edit; else echo \"No changeset files found to commit. Perhaps you need to git add them?\" && exit 1; fi; }; f"
```

[![Asciinema recording of git ccs command](./git-ccs.gif)](https://asciinema.org/a/9nQSh9u0wrUA80JRGnquuJO6A)
