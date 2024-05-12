---
title: Contentful migration strategy
date: 2022-03-24
description: Contentful's migration strategy is lacking. Here's how I've worked around it.
category: blog
tags: [cms, database]
---

I've spent the last few days getting Contentful set up for a new project and have become frustrated with the migration story. As a developer, the primary way I interact with a CMS is defining the data model. When project requirements change, I will need to update and grow the model to accomodate new feature requests. A good CMS, from my perspective, is one that makes this schema migration process safe and painless.

### Why we need migrations

Some CMSs don't support migrations. The schema and articles all live in the same database and the only way to push changes up is to either

1. **Do it live**: click around in the interface, hoping you don't break something or delete something important.
2. **Stop the world**: clone down production, make your changes, then completely replace the production data with your local stuff. Any data added in the meantime is lost, so make sure to warn the content editors not to do anything while you're working.

For many sites, "Do it live" is too risky, and "Stop the world" requires too much coordination with the editors. Imagine a daily newspaper that couldn't publish any new articles (or even work on drafts!) because the devs were working on adding a field to the content model.

Migrations allow us to describe how to adjust the data model of an existing database. They make a scripted, surgical change to a database rather than replacing it entirely and blowing away any content changes.

Compared with the other two process, writing a migration script is less discoverable. However, it doesn't require coordination with content authors. You're free to spend more time experimenting and testing your changes because no one is waiting for you to hurry up and let them get back to work.

Contentful claims to support scripted migrations. True enough, you can write a script, test it out in an isolated environment, and apply it to production when you're ready. But they're missing two imporant elements:

1. A way to track migrations already applied, and
2. A way to inspect the current schema within a migration.

### Track migrations

When I write migrations, they're committed to the code repo. Once that branch is merged, the CI/CD server runs any migrations that haven't been applied yet. This should be a familiar model for anyone who's worked on a Rails or Django app.

Contentful's API for applying migrations is to use their CLI:

```bash
contentful space migration some-migration-file.js
```

This works great when executed interactively. It shows you a neat preview of the operations it's about to run, and in what order. There's even a way to [populate new fields based on old ones](https://github.com/contentful/contentful-migration/blob/8fce9244f81d97e0dbe18db32665e1a2008ae71d/examples/12-transform-content.js). But there's no way to tell Contentful to only run new migrations. Most scripts are not idempotent: they'll fail if they're run a second time. Even worse, they might run without an error, but break your data.

### Inspect current schema

In trying out Contentful migrations, I wanted to try a relatively simple change: add a new option to an existing dropdown list.

![A dropdown labelled Game Type showing options of Casino, Other, Solitaire, Trick Taking, and Rummy]({{ site.url }}{{ site.baseurl }}/images/contentful-dropdown-options.png)

Unfortunately, there's no way to say "Add 'RPG' to the list of game types". Instead, you have to say "The list of game types should be 'Casino', 'Other', 'Solitaire', 'Trick Taking', and 'Rummy'", listing all allowable options. Imagine someone else working on a concurrent change to add "Tower Defense" to the list of game types. Whichever migration lands last will blow away the other person's changes.

It's actually worse than that. The list of options is specified as a validation. When you write the migration, you end up writing the code equivalent of "The only validation needed Game Type is to check that it appears in this list: `["Casino", "Other", "Solitaire", "Trick Taking", "Rummy", "RPG"]`". So your migration will conflict with a change to any other validation on that field. Here's the code:

```js
module.exports = function (migration) {
  const rules = migration.editContentType("rules");
  const gameType = rules.editField("gameType");
  gameType.validations([
    // I wanted to say something like "existing allowed values, plus 'RPG'",
    // but there doesn't seem to be any way to do that easily.
    {
      in: ["Casino", "Other", "Solitaire", "Trick Taking", "Rummy", "RPG"],
    },
    // similarly, if there were other validations on this field, they'll be
    // gone after this migration runs.
  ]);
};
```

In a system more serious about supporting schema migrations, it would be possible to inspect the present state of a model _at the time the migration is run_. Django and Rails both have this facility. This would let you write something like this:

```ts
module.exports = function (migration, currentSchema) {
  const existingValidations = currentSchema.rules.gameType.validations;
  const existingPredefinedList = existingValidations.find((v) => v.in);

  const rules = migration.editContentType("rules");
  const gameType = rules.editField("gameType");
  gameType.validations([
    ...existingValidations.filter((v) => !v.in),
    {
      in: [...existingPredefinedList?.in, "RPG"],
    },
  ]);
};
```

### Papering over the problem

Inspecting the current schema is a nice-to-have, but I wasn't willing to live without migrations that are executed at deploy-time. I hacked together a script that:

1. Creates a new content type, `migrations` that tracks the migrations that have already run.
2. Queries the entries of this type, comparing the output to the migrations found in a `contentful/migrations` directory.
3. Applies any new migrations to the environment.

Because it wasn't too much extra work, I also set it up to make the current schema available to each migration.

~~If this sounds useful to you, it's open source at [bgschiller/contentful-migrations](https://github.com/bgschiller/contentful-migrations).~~ I've found an existing library, [deluan/contentful-migrations](https://github.com/deluan/contentful-migrate) and plan to use that instead. It's been around for longer and is more battle-tested than my hacky bash script.
