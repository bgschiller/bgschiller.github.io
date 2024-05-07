---
title: Writing an Implementation Plan
category: blog
tags: [programming, writing]
date: 2019-12-30
description: A technique for getting work done in the face of overwhelming challenges.
---

On my current project, I'm working on a large, established codebase, and there are regulatory considerations that I'm not familiar with. This has made me feel a bit overwhelmed, and reminds me of being a junior developer again. When I'm about to start on a task, I'm unable to imagine how the solution will look. There's a technique I've been using to get work done in the face of these challenges that I think of as "Writing an Implementation Plan". I thought it might be useful for other developers to see, so here's how it works.

When I start working on a ticket, I give myself 1-3 hours to carefully read the ticket, and search the codebase for anything that looks similar or relevant. Most established codebases have patterns, and you're unlikely to be working on the _first_ of anything.

For example, if you're writing a resource controller, there are probably controllers for other resources that will be good examples of what yours should look like. How do they do authorization, db access, routing, testing, etc? Which parts will be the same for your controller, and which will be different?

Along the way, I keep notes on what questions I have, and what assumptions I'm making. Then I write an email to someone else on the team who has a better understanding of the codebase. It looks something like this.

> Dear Lead Developer,
>
> I'm about to start on the WidgetEditController story but I wanted to get your thoughts on a couple of things first.

If possible, include a link to your story tracker.

> Some questions,
>
> 1. The ticket doesn't specify what should happen if an unauthenticated accesses the route. Looking at SquidgetEditController, it looks like we would crash with a 500 error. Should I plan to use the same pattern here?
> 2. Does the user have to supply _all_ fields on the Widget, or only the ones that have changed? The ticket seems to suggest we only need changed fields, but I'm having trouble finding an example controller that does that. Maybe you can point me at one?
> 3. (more questions, phrased as "this is what I'm guessing, can you please confirm?" whenever possible)

Each of your questions should provide context on where you're coming from, and why the question is worth asking. Is there a discrepancy between the established patterns in the codebase and what the ticket asks for? Is the ticket ambiguous? Maybe there's not a clear way to accomplish what's being asked for. It's good to provide context on what makes you ask the question. You've been staring at this ticket and the relevant code for the past three hours, but your team lead probably hasn't.

You'll also want to specify a clear call-to-action. A call-to-action will help your team lead answer the email quickly. Most of my calls-to-action fall into two broad categories:

- "I'm guessing that XYZ, is that right?", and
- "Can you give an example in the codebase where ABC happens?"

If possible, offer your best guess at the question. This helps develop your understanding of a codebase by evaluating alternatives and committing to the answer that makes the most sense to you. You're also reducing the burden on the team lead—most of the time they can say "yep, you got it.".

After the questions, you'll want to include a list of the steps you plan to take in implementing the story.

> So, assuming those guesses are correct, here's my plan for the story:
>
> 1. Update the routes at path/to/some/file to include the new WidgetEditController's URL.
> 2. Make a new controller at path/to/WidgetEditController, mimicking the style of path/to/OtherController.
> 3. (other steps)

Include enough detail here that you might be wrong. Your goal at this point is still to get someone to correct you before you go too far down the wrong path. I find it's useful to include the project paths of files when you refer to them, as much of learning a new project is learning the structure.

My favorite thing about this technique is that once it's done, I have a step-by-step instruction list for accomplishing the story. If this seems useful, please steal it :)
