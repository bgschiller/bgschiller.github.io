---
title: Claude techniques I like
date: 2025-09-28
description: A couple of simple techniques for getting better results from Claude Code
category: blog
tags: [llm, ai, claude]
---

I've read a lot of blog posts describing how to set up complicated multi-role agents. So far, they haven't stuck with me. These tricks are simpler than that: things you can do right away that should fit into nearly any coding workflow.

## Give Claude the logs

The system I'm developing right now involves communication between multiple browser contexts and a native app. The processes need to be started in a particular order, the native code needs to be launched from XCode or Visual Studio, and restarting is not quite as simple as sending SIGINT and running again.

Rather than trying to put all these instructions into Claude's context, I pipe the log output to a file (or a couple of files), and then tell Claude where to find them. Even if you have to copy-paste the logs (out of browser devtools, for example), this is still useful.

This is especially effective if you ask Claude to liberally pepper the relevant code with log statements. I recently tracked down a React re-rendering bug by asking Claude to add logs to fire whenever any of the components in that part of the tree re-rendered, including which props had changed. This produced a lot of output-but that's the sort of thing LLMs are good at sorting through.

## Have it write a script

I hear people talk about how they'll ask LLMs to do some repetitive refactoring task and they "get lazy" after a few iterations and give up. Picture a task that's too complicated for a quick regex, but still follows some simple rules. For example, "Find every place `scrobbleCobbleStone` is called with 3 or 4 parameters and change it to use an options hash instead."

Someone is going to say they could write a regex to do that, and they're probably right. Alternatively, tell Claude to write a script to perform that task. The script won't "get lazy".

In general, having Claude write a script to do things is frequently faster and more reliable than asking it to do those things directly.

## External todo list

Using the same instance of Claude for a long time doesn't work very well. It accumulates many things in context, ends up compacting and keeping the wrong parts, and seems to get dumber the more you use it. In general, I try to keep my context below 150k tokens.

Perhaps counter-intuitively, launching many instances of Claude and using each only lightly can be cheaper than a large conversation with many back and forths. This is because the API is stateless (mostly, there's some caching). The whole chat history is sent with each new turn in the conversation. Also, even though Sonnet can handle up to 1M tokens, it's significantly more expensive to go beyond 200k.

I have been working recently on a Gitlab CI linter, something to flatten the config and identify common problems. I came up with something like the following set of TODOs:

- [ ] Resolve any local includes, inlining their contents into the document. Local includes are plain strings within the top-level `includes:` key
- [ ] Look through [files] to see examples of remote includes. Use the `glab` CLI to fetch those files.
- [ ] local includes can also be globs. Update the code to handle this.
- [ ] Wherever the `extends` key appears in a job (a next-to-top-level object), inline the referenced job's fields into this one.
- [ ] `include`d files (even remote ones) can also include other files. Make sure we can recursively include.
- [ ] Gitlab uses a custom YAML array tag, `!reference`. Add logic to handle this tag.
- ...

Then, prompt Claude with something like the following:

> Please create a script that will
>
> 1. launch an instance of `claude` instructing it to choose a task from the remaining items and attempt to tackle it. Include unit tests for changes where appropriate. Advise that it can add follow-up tasks by updating IMPLEMENTATION_PLAN.md
> 2. If there are still unchecked boxes in that file, loop. Otherwise exit.
>
> I'll run the script to give each Claude instance a fresh context. Make sure to use the `--print` flag to start Claude in non-interactive mode.

This time around, it took a couple of tries before the script worked. It had gotten the escaping wrong when grepping for `- [ ]` unchecked boxes, and neglected to make the script executable. But then I ran the script and let it rip while I went and worked on something else.

In this case, I believe the total cost was around $10.
