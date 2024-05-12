---
title: JavaScript Package Development
date: 2024-04-29
description: Setting up a JavaScript package repo with multiple packages, TypeScript, testing, codegen, and automatic releases
category: blog
tags: [programming, javascript, typescript, npm, gitlab, tools]
---

I just finished setting up the main repo I use at work the way I wanted it. It accumulates tricks and tips from several different projects I've worked on in the past, trying to glean the best from everything. I feel I sense that I'll forget it all if I don't write it down, so here we are.

It's a bit GitLab-centric, since that's what I use at work. I'm confident it can be adapted to GitHub Actions or other CI/CD tools. Let me know if you write up such an adaptation—I'd love to link to it!

I've found GitLab CI to be lacking in narrative-style documentation, so I'll explain the reasons behind some of the choices. For example, the `needs` key is always an optimization: it allows to specifying a smaller set of jobs that must succeed before this one can run. Omitting the `needs` key is usually the same as listing all jobs in every previous stage.

## Goals

Some things I need from the setup:

1. **Multiple packages**: I want to have multiple packages in the same repo. If you're developing a library you may not think you have multiple packages, but you probably do. You have the library itself, but you probably also have an example project or a CLI tool. You might have a website or a documentation generator. You might have a React component library with a Storybook. You might have a server and a client. You might have a server and a client and a shared library. You might have a server and a client and a shared library and a CLI tool. You get the idea.
1. **TypeScript**: I want to write TypeScript, and I want it to be checked and compiled. Browser-focused code uses `vite`, other things use `rollup` or `esbuild`. I'll talk more about those choices, and why you might use different ones in the same repo.
1. **Testing**: I want to run tests on every push. I use `vitest` for this, but the CI setup doesn't change if you use Jest or Mocha or whatever.
1. **Codegen and Formatting**: This project uses codegen extensively to generate client code in several languages. CI should check that the codegen is up-to-date. That is, running the codegen should produce no changes to the tracked files.
1. **Changesets**: I want to use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. New features and bugfixes should accumulate on the `main` branch, and we should be able to release them in a batch.
1. **Automatic Releases**: When we create a release, the packages should be automatically published to npm. But only the ones that changed!

## Tools

### pnpm

I use `pnpm` as an `npm` replacement, mostly for its workspace support. A "workspace" is a repo with several JS packages whose dependencies are all installed with `pnpm`. It also offers a way to run the same command across all projects in a workspace. I use this to run tests and build all packages at once, and even to publish only the packages that have changed.

### vite

`vite` is fast and low-config. It's great for browser-focused code. It's not great for libraries, because it doesn't output a CommonJS bundle.

### rollup

`rollup` is a bit slower than `vite`, but it's more flexible. It can output CommonJS, ES modules, UMD, and more. It's great for libraries. Rollup plugins are straightforward to write, so you can customize your build process easily. For example:

- I recently wrote a plugin to inline some `.sql` migration files into the JS bundle. The database code was part of a shared package, so the relative path to the migrations was different at the point where the migrations were run.
- Rahul wrote a plugin to extract `invariant(!isIframeWithNullOrigin, "Grammarly EditorSDK is not supported in IFrames with null origin")`, putting the string into a separate file, and replacing the code with something like `if (isIframeWithNullOrigin) throw new InvariantError(12)`. At runtime we showed a URL to the documentation for that error code. The bundle size was a bit smaller, but the really nice thing was that we could offer a page troubleshooting steps specific to each error and even update them after the code was released.

### esbuild

`esbuild` is the JS compiler that `vite` uses behind the scenes. It's not browser-specific and can output CommonJS. I've found that it's not as configurable as `rollup`, but it's very easy to set up. I use it for some oddball projects that are neither libraries nor browser-focused:

- A CLI tool that I distribute as a single node file. `esbuild --bundle --platform=node`.
- A couple of AWS Lambda functions that I also want to distribute as single files. Additionally, I want to omit the `@aws-sdk/*` dependencies, since the Lambda environment provides them and bundle size is important on lambdas. `esbuild --bundle --platform=node --target=node18 --external:@aws-sdk/client-s3 --external:@aws-sdk/client-secrets-manager`.

### changesets

`changesets` is a tool to keep track of version updates and write a changelog for a package. Every time you make a change to a package, you write a markdown file with a description of the change. The markdown file has some yaml frontmatter to specify the packages (many repos have multiple) and the type of change (major, minor, patch). Here's an example:

```
---
"@grammarly/avro-codegen": minor
"@grammarly/avro-parser": minor
---

Add support for @experiment() annotation
```

Every Merge Request that changes the behavior of a package also includes a file like that. The files, along with the changes, accumulate in the `.changeset` directory on the `main` branch. When you're ready to release, you run `changeset version` to eat all those files, turning them into CHANGELOG.md entries and increments to the versions of the affected packages.

We have two bits of CI automation around `changesets`:

1. A check that every MR that changes a package has a corresponding changeset file. If a change involves only tests, or otherwise doesn't need to be reflected in the changelog, you can create an empty changeset file.
2. A manual job to run `changeset version` and open an MR with the changes (that is, the removal of the .changeset files and updates to package.json and CHANGELOG.md files).

## gitlab-ci.yml

The gitlab-ci.yml file ends up quite long, so I'll break it up into sections with explanations for each piece. I've edited it to omit some irrelevant details. For instance, we use `nx` to cache build artifacts, but I've left it out because most projects won't need it.

### pnpm cache

This block creates a re-usable chunk of config for caching the npm modules that pnpm installs. They're stored in the `.pnpm-store` directory. The cache key is based on the `pnpm-lock.yaml` file, so if the lockfile changes, the cache is invalidated. If the cache is not found, it falls back to the most recent cache with the same prefix.

```yaml
.pnpm_cache: &pnpm_cache
  key:
    files:
      - pnpm-lock.yaml
    prefix: pnpm-cache-v1-
  fallback_keys:
    - pnpm-cache-v1-
  paths:
    - .pnpm-store/
```

The `&pnpm_cache` syntax creates a "named anchor" that we can reference later with `*pnpm_cache`.

### .node reusable job template

Gitlab skips running jobs whose names begin with a dot. This is a way to define a job that we can reference later, but that won't run on its own. It's another way to create reusable chunks of config.

```yaml
.node:
  variables:
    PNPM_CACHE_POLICY: pull
  cache:
    - <<: *pnpm_cache
      policy: $PNPM_CACHE_POLICY
  # continues below
```

Let's pause to talk about the wild `- <<: *pnpm_cache` business. This is a way to merge the contents of the `*pnpm_cache` anchor with the `policy` key. The `-` at the beginning says the whole object will be a entry in a list. In JS, this would look like, as `cache: [{ ...pnpm_cache, policy: $PNPM_CACHE_POLICY }]`. In yaml we do this `<<: *pnpm_cache` business.

<!-- prettier-ignore -->
```yaml
  # continued from above
  image: node:18 # Note: we actually use an artifactory docker repo to avoid rate limits
  before_script: &node_before_script
    - corepack enable
    - corepack prepare --activate
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile --prefer-offline
```

I didn't set this part up, but I believe the `corepack` commands are making it so that `pnpm` is fetched when we use it. We could also have included `pnpm` in the docker image we use.

The `pnpm config set store-dir .pnpm-store` line tells `pnpm` to store its modules in the `.pnpm-store` directory, where we'll be caching them.

Setting all of this in the `before_script` key means that when we reference `.node` in a job, we can put the job-specific commands in `script` without worrying about overriding them. If we end up needing to override the `before_script`, we can use the `&node_before_script` anchor to avoid repeating these four lines.

### workflow

This `workflow` block is something I copy between repos and don't fully understand. I believe it specifies when the pipeline as a whole should be run. In this case, I want to run the pipeline on every push to the `main` branch, and on every MR to any branch.

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### stages

The `stages` block is an ordered list of named sections. Every job has to belong to one of the stages listed here. By default, a job in a later stage won't run until all the jobs in earlier stages have completed successfully. Jobs in the same stage cannot depend on one another. I don't really know why these have to be called out explicitly.

```yaml
stages:
  - setup
  - build
  - preview
  - test
  - publish
```

### jobs

Everything else in the file is a job. Each job has a name, belongs to one of the stages, and specifies some commands to run. A job can also specify dependencies on jobs from previous stages. By default, they have access to any artifacts created by jobs in previous stages.

#### install

Nearly everything depends on having the NPM dependencies. This is the only job in the `setup` stage.

```yaml
install:
  extends: .node
  variables:
    PNPM_CACHE_POLICY: pull-push # override the default to say that this job can write to the cache as well as read from it.
  script:
    - echo "done" # we don't need to do anything here, because the `before_script` in `.node` already installs the dependencies.
```

#### check changesets

This job checks that every MR that changes a package has a corresponding changeset file. If a change is a refactor, involves only tests, or otherwise doesn't need to be reflected in the changelog, you can create an empty changeset file.

```yaml
check changesets:
  extends: .node
  stage: build
  variables:
    GIT_DEPTH: 0
  # continues below
```

This stage doesn't _really_ belong in the `build` stage, but it's a good place to put it. It doesn't depend on anything in the build stage, and if it fails we'd like to know ASAP. The `GIT_DEPTH: 0` variable is a way to tell GitLab to fetch the whole repo history. This is necessary because we need to check the changesets against the `main` branch, and the default depth is 50 commits.

<!-- prettier-ignore -->
```yaml
  # continued from above
  script:
    - git checkout "${CI_DEFAULT_BRANCH}"
    - git pull --ff-only origin "${CI_DEFAULT_BRANCH}"
    - git checkout "${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME:-${CI_COMMIT_BRANCH}}"
    - $(pnpm bin)/changeset status --verbose --since "${CI_DEFAULT_BRANCH}"
```

The script checks out the `main` branch and ensures it has the latest commits from the remote. Then we run `changeset status` to see if there are any changesets that haven't been applied to the current branch. The `--since` flag tells `changeset` to only look at changesets that have been added since the `main` branch diverged from the current branch.

<!-- prettier-ignore -->
```yaml
  # continued from above
  rules:
    - if: '"$CI_PIPELINE_SOURCE" == "merge_request_event" && "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME" != "changesets-release"'
      changes:
        - api/**/*
        - packages/**/*
        - platforms/**/*
    - when: never
```

The `rules` block specifies when the job should run. In this case, it runs on every MR that isn't the `changesets-release` branch. The `changes` key specifies which files should trigger a run of the job. If any of the files listed change, the job will run. The `when: never` line is a way to say "don't run this job unless it's triggered by a rule."

We carve out an exception for the `changesets-release` branch. That's the branch name we use to create an MR applying the changesets: eating the files and turning them into updates to the package.json version field and entries in CHANGELOG.md files. We don't want to require that that MR include a changeset file—it will have just deleted all of them.

#### build

In the real repo, we have `build_web`, `build_dotnet`, and `build_swift` jobs all in `stage: build`. I'll just show the `build_web` job here. `pnpm recursive run <something>` invokes the script in the `package.json` of every package in the workspace, skipping packages that don't have the script. `pnpm` knows which packages depend on which, so it runs them in the right order.

```yaml
build_web:
  extends: .node
  stage: build
  script:
    - pnpm recursive run lint
    - pnpm recursive run build
    - |
      if [[ $(git status -s | wc -c) -ne 0 ]]; then
        echo "The build produced changes to the following files:"
        git status -s
        echo "Generated code is out of date. Please run 'pnpm recursive run build' locally and commit the changes."
        exit 1
      fi
  artifacts:
    untracked: true # save even files not tracked by git
    exclude:
      - .pnpm-store
      - node_modules
```

This particular repo relies heavily on code-generation, so that's what the `git status` check is about. You might not need it, but I find a similar rule useful if you have prettier or another auto-formatter.

#### test

Just like with the build stage, there are also `test_dotnet` and `test_swift` jobs that I've omitted.

```yaml
test_web:
  extends: .node
  stage: test
  script:
    - pnpm recursive run test
```

#### publish_preview_packages

It's common to make a change to our library in order to support work in some other repository. To avoid waiting on a review before testing that other work, we allow publishing preview packages. Those have version numbers like `0.2.3-vite-plugin-inject-gos-runtime.1710367393954` and they're not tagged with `latest`, so it's unlikely for someone to confuse them with an official release.

This is a manual job, as we don't always need it and we don't want to clog our NPM server with unnecessary versions.

```yaml
publish_preview_packages:
  extends: .node
  stage: preview
  script:
    - node assets/update-preview-version.mjs
    - pnpm recursive publish --no-git-checks --tag "${CI_COMMIT_REF_NAME:-preview}"
  rules:
    - when: manual
```

The `assets/update-preview-version.mjs` script walks over all the package.json files in the repo, swapping out their `"version"` field with one built from `<current-version>-<branch-name>.<unix-timestamp>`. So instead of `1.0.3`, you'd see something like `1.0.3-allow-iso-timestamps.1710367393954`.

#### create release

The create release job

1. Consumes the markdown files in the `.changesets` directory. These files indicate the type of change (major, minor, or patch), which packages are affected, and a description of the change.
2. For each mentioned package, a minimal version increase is made. For example, if there are 3 patch changes for a package and 2 minor changes, that package will have it's minor version incremented once.
3. The descriptions are added to the CHANGELOG.md file for each affected package.
4. All these changes are committed to the `changesets-release` branch, and an MR is opened against `main`. It would be possible to allow committing directly to `main`, but this offers a chance for review and editing of CHANGELOG.md files.

In order to push to the repo and to open an MR, this job relies on a gitlab API token. You can make one of these at the Project Access Tokens page for your gitlab project: `/<group-name>/<repo-name>/-/settings/access_tokens`.

```yaml
create release:
  extends: .node
  stage: publish
  needs: [install, build_web]
  # continues below
```

By specifying jobs in the `needs` array, we make it possible to trigger this job early. Without the `needs` option, the job would have to wait until the jobs in every previous stage succeeded.

<!-- prettier-ignore -->
```yaml
  # continued from above
  variables:
    GITLAB_TOKEN: "${PRIVATE_TOKEN}" # from /<group-name>/<repo-name>/-/settings/access_tokens
    REQUEST_PAYLOAD: >-
      {
        "id": ${CI_PROJECT_ID},
        "source_branch": "changesets-release",
        "target_branch": "${CI_DEFAULT_BRANCH}",
        "remove_source_branch": true,
        "title": "chore: release from ${CI_COMMIT_SHORT_SHA}",
        "assignee_id": "${GITLAB_USER_ID}"
      }
  script:
    - git branch -D changesets-release || echo 'ok'
    - git checkout -b changesets-release
    - git reset --hard HEAD
    - $(pnpm bin)/changeset version
    - git remote set-url --push origin "https://gitlab-ci-token:${GITLAB_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git"
    - git remote show origin
    - git add -- .
    - git -c user.name='CI Changesets Bot' -c user.email='no-reply+ci-changesets-bot@example.com' commit -m 'bump versions' --no-verify
    - git push --no-verify --force origin HEAD:changesets-release
    - git checkout ${CI_COMMIT_BRANCH}
    - git branch -D changesets-release
    - >-
      curl -X POST \
        --fail \
        --header "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        --header "Content-Type: application/json" \
        --data "${REQUEST_PAYLOAD}" \
        ${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/merge_requests
  only: [main]
  when: manual
```

#### publish_packages

This job publishes packages to NPM (or actually to our internal artifactory server).

```yaml
publish_packages:
  extends: .node
  stage: publish
  needs:
    - job: build_web
      artifacts: true
    - job: test_web
      artifacts: false
  # continues below
```

Publishing requires the built artifacts (TypeScript compiled to .js and .d.ts files, for example). We also want to require that the tests passed, but we don't need any of the outputs from them. Passing `artifacts: false` for that job may slightly speed up this job.

In the next section, we choose a tag depending on whether changesets is in [prerelease mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md). If it is, we use that as the tag rather than `latest`. For example, `alpha` or `next`.

<!-- prettier-ignore -->
```yaml
  script:
    - |
      if [ -f ".changeset/pre.json" ]; then
        export TAG=$(node -e "console.log(require('./.changeset/pre.json').tag)")
      else
        export TAG="latest"
      fi
    - pnpm recursive publish --no-git-checks --tag $TAG
  # continues below
```

We want to run this job automatically for commits just after a release MR is merged. It's also possible that something was wrong with that commit, and the publish step was never reached, so we'll allow running the publish job manually as long as we're on the `main` branch.

<!-- prettier-ignore -->
```yaml
  # continued from above
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $CI_COMMIT_TITLE =~ /'changesets-release'/
      when: always
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
      allow_failure: true # makes job skippable
    - when: never
```
