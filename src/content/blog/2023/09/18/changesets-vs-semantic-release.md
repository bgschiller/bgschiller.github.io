---
title: Changesets vs Semantic Release
date: 2023-09-18
description: A comparison of two tools for managing version numbers and changelogs in a monorepo
category: blog
tags: [javascript, monorepo, versions, open-source]
---

`semantic-release` and `changesets` are different ways to solve the same problem: how to maintain a log of the changes in each release and correctly update the version number when performing a release. In the last few months, I've worked with projects using each tool and have come to strongly prefer changesets.

## Where they keep state

Where each tool keeps track of state:

|                                                      | changesets                                      | semantic-release                        |
| ---------------------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| current version                                      | package.json `version` field                    | git tags                                |
| changes that have accumulated since the last release | markdown files inside the .changesets directory | specially formatted git commit messages |
| changelog of prior versions                          | a CHANGELOG.md file                             | Github or Gitlab releases page          |
| configuration                                        | A config file in the repo                       | A config file in the repo               |

Keeping the state in files is simpler in a handful of ways:

- The changelog only contains versions you care about and not prereleases, which clog up the Gitlab releases page in the project I work on. [In this screenshot of the gitlab release page]({{ site.url }}{{ site.baseurl }}/images/cheetah-releases-page.png), the blue are release notes I care about, and the purple are for prereleases. If you want to see the changelog for a prerelease version, it's available on that branch.
- It's easy to edit a change description before release—it's just a file! For semantic-release, you'd have to rebase that commit, and every one after it. In a project with many contributors, that would be difficult to accomplish.
- If you have multiple packages, each has its own version in a separate package.json file. With git tags, I'm not sure what the options are.
- The version of an app using semantic-release is oddly difficult to access. In one of the projects that uses semantic-release, I need to expose the version at runtime. But package.json's version field just says `0.0.0`. I'm not sure how to solve it yet. The version is available only as a command line argument to the publish script, but the application has already been built by then. I may do something heinous like `for ff in $(ls dist/*.js)"; sed 's/PLS_PUT_THE_VERSION_HERE/g $ff | sponge $ff`. Similarly, the deploy happens in two steps: "publish", which makes a build available for QA, and "promote", which makes it available to customers. In order to know which version to promote, we have to save the version somewhere. If it were recorded in package.json, it would be easy to find. As it is, we have to be sure to save during "publish" so we can refer to it during "promote".

![a code review comment complimenting Zach Hauser on coming up with a way to save the version between the "publish" and "promote" CI jobs. The code shows writing an environment variable to a file called applet_version.env.]({{ site.url }}{{ site.baseurl }}/images/semantic-release-save-version.png)

## Enforcing usage -- semantic-release

Semantic-release assumes that your commit messages will be formatted as [Conventional Commits](https://www.conventionalcommits.org/). The project I'm on enforces this with two tools: commitlint and commitizen. Commitlint is a pre-commit hook that errors if your commits aren't formatted properly. Commitizen hijacks the `prepare-commit-msg` hook, using `exec < /dev/tty` to guide you through choosing a commit type, specifying a message, and a related ticket number. This _mostly_ works. It doesn't correctly handle readline shortcuts like `ctrl + e`, `ctrl + a` and `ctrl + w`, and the apparent cursor position starts to differ from where new characters are inserted (see ascii-cast below).

[![asciicast](https://asciinema.org/a/mB0Ijt44wwVRXdP86Ni2gu9at.svg)](https://asciinema.org/a/mB0Ijt44wwVRXdP86Ni2gu9at)

Another annoyance is that the prepare-commit-msg hook is invoked for `git merge` and `git rebase`, where it gets in the way. If you run `git rebase main`, the prepare-commit-msg hook will prompt you to rewrite every single commit message (you can get around it with `ctrl + c`).

My biggest frustration with semantic-release comes from the code review process. I often want to make a change to my branch based on a reviewer's suggestions. Does such a commit need to be part of the release notes? I shouldn't need to designate it as a "fix" or a "refactor" when the code needing a fix wasn't ever released.

## Enforcing usage -- changesets

Instead of commits, a changesets setup will require that every pull request include at least one file in `.changesets`. This is enforced (in my repos) on CI, around the same time as tests are run. A downside is that it's much later than a git commit hook, so it is easy to forget. It would also be possible to define a commit hook that warns (but doesn't fail) if there is no changeset file.

There is a command to help create the file, like commitizen. Because changesets is designed with monorepos in mind, it prompts you to specify which packages have changed.

[![asciicast](https://asciinema.org/a/BBIqjLLpgnojC2Rfn7FuaGCmI.svg)](https://asciinema.org/a/BBIqjLLpgnojC2Rfn7FuaGCmI)

## Creating a release

To create a release, the semantic-release command does something like this.

1. Look up the latest git tag to find the range of commits since the last release.
2. Collect the commit messages to build a changelog and decide whether to bump the major, minor, or patch version number.
3. Create a new git tag and push it up to your repository.
4. Push to npm, github releases, or anywhere you have it configured to. In one project, we run a deploy at this point.

Coupling the version increase with deploys has unpleasant consequences. If one of the steps fails, the other steps aren't cleaned up. I recently updated the deploy script to push to two different environments. One of them was the production environment and the other was a newer version of that environment that I was still debugging. When the deploy to the new environment failed, the system was left in an inconsistent state:

- The git tag had been created.
- The deploy to our S3 bucket (the old, reliable environment) succeeded
- The deploy to the newer system had failed (this is fine, though, I was still getting it up and running).
- semantic-release skipped updating the Gitlab releases pages with the changelog, as the prior step had failed.

Changesets avoids directly tying the version bump with the deploy. Instead, when you run `changesets version`,

1. Each markdown file in `.changesets` is checked to see which packages it impacts. The tool determines for each package whether to increment the major, minor, or patch version (or do nothing, when no changes affect a package), and makes that change in the `package.json` version field.
2. Each package's CHANGELOG.md file is updated with the text from the markdown files.
3. The `.changesets` directory is cleared out, as the changes are now reflected in each package's CHANGELOG and version number.

Crucially, these steps only affect local files. In our system, we run `changesets version` in CI, and then have CI open a pull request with the change. This gives us an opportunity to review the changes, rephrase things in the changelog, or bail out if we accidentally included a change that wasn't ready. Deploying or publishing is a separate step that runs after _that_ pull request is merged.

## Making do with semantic-release

If you must use semantic-release, I imagine that it would be more comfortable with the change: Instead of a pre-commit hook on every commit, require every pull request to contain at least one conventional commit. That is enforceable on CI, and avoids the frustrating situation where you need to make changes in response to code reviews.

## A reason not to use changesets

Changesets relies on the `package.json` file for the name and version of each package. If your packages aren't in javascript or typescript, it seems a bit odd to have a `package.json` solely for this purpose. I might still do it though—changesets works really well and I'm not aware of a language-agnostic replacement.
