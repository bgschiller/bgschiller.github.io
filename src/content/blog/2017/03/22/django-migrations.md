---
title: Django Migrations Tribulations
category: blog
tags: [programming, python, django]
date: 2017-03-22
description: Ensuring merge migrations are unique in Django
---

## aka, How we use Django Migrations at TopOPPS

Please do not read this as advice. Although we've spent a while thinking about it, I'm not convinced that we've arrived at the best solution. It seems to work oh-kay, but it's a bit of a pain. Rather, I'm hoping that someone will tell me I'm wrong, and demonstrate a better way. After all, "the best way to get the right answer on the Internet is not to ask a question, it's to post the wrong answer." In the meantime, this is the best way I know of to manage Django migrations under version control.

_edit:_ I've come across a couple other articles discussing this topic: [Zenefits](https://engineering.zenefits.com/2015/11/using-old-ideas-to-solve-new-problems/) and [DoorDash](https://blog.doordash.com/tips-for-building-high-quality-django-apps-at-scale-a5a25917b2b5) both use a migrations manifest file to artificially cause conflicts when a merge needs to be created.

## The setup

Let's say the latest migration in the production branch is `0014_user_phone_num.py`. Sometimes, two different feature branches will add migrations numbered 15: `0015_create_taskcustom.py` and `0015_opp_splits.py`. First, the branch with `0015_create_taskcustom` is merged to the `dev` server. The migration is run, and it all goes swimmingly. But what happens when `0015_opp_splits` is merged?

Django expects a single migration to be the 'latest' migration. When there are two 'latest' migrations, it will refuse to run until you make a merge migration; `./manage.py makemigrations --merge` will do the job for you. It makes `0016_merge.py`. It doesn't do any work, just lists both of `create_taskcustom` and `opp_splits` as dependencies. Dev is the only branch where this file exists. It's not in either feature branch, and it won't ever make it to production.

While those two are being tested, a new feature branch is cut from prod. It also adds a migration: `0015_product_family`.

The branch with `0015_create_taskcustom` is deemed worthy, and advances to production. The product family branch merges in the latest from production, which includes the new migration. That means there are now two 0015 migrations in that branch, so we make a merge migration: `0016_merge.py`. _This_ `0016_merge` is different from the one that lives in the dev branch. It had dependencies for `create_taskcustom` and `product_family`, while the dev one knows about `create_taskcustom` and `opp_splits`.

## The problem

Danger ahead, friends. Now we merge the product family branch to dev for testing. Both branches have a file called `0016_merge`, but they have different contents. We get a merge conflict that looks something like:

```
dependencies = [
    ('topopps', '0015_create_taskcustom'),
<<<<<<< HEAD
    ('topopps', '0015_opp_splits'),
=======
    ('topopps', '0015_product_family'),
>>>>>>> feature/product-family
]
```

What should we do here? It seems like a sensible choice would be to include all three lines as dependencies. However, that way lies madness. Doing that, then pushing to the dev server _will not_ run the migrations. The `django_migrations` table the dev server's database already includes an entry for `topopps, 0016_merge`, so it sees that and thinks there's nothing to do. That means the `0015_product_family` migration won't run.

# The (sorta) solution

The solution we've come up with is to never allow a merge migration to be named `####_merge`. We always add a couple of random words to change it to something like `0018_seashell_queenbee_merge.py`. That way, instead of a merge conflict as above, we make an extra merge migration. Let's consider what happens with this rule in place:

1. `0015_create_taskcustom` is merged to dev.
2. `0015_opp_splits` is merged to dev. `0016_chilly_spider_merge.py` is created.
3. The branch containing `0015_product_family` is created.
4. The branch with `0015_create_taskcustom` is merged to production.
5. The product family branch merges in the latest from production, including `0015_create_taskcustom`. This necessitates creating `0016_giant_xanclomys_merge.py`.
6. When the product family branch is merged to dev, both `0016_giant_xanclomys_merge` and `0016_chilly_spider_merge` are present. This means we need to create `0017_humiliating_deer_merge`, which depends on both of those two.
7. Everything is good (I think?).

This is admittedly a bit of work. It's not the prettiest solution. We end up creating merge migrations for merge migrations. I don't have a better idea.

## The process

We've been doing this at TopOPPS since March 29 2016 with `0011_fancy_turtle_merge`, all the way up to March 1, 2017 with `0052_unhappy_honeycreeper_merge` (the latest as of this writing). We have a script that runs as a pre-commit and post-merge hook to checks if a merge migration needs to be created, and nettles you into choosing a unique-ish name (available at [bgschiller/pre-commit-hooks](https://github.com/bgschiller/pre-commit-hooks/blob/master/pre_commit_hooks/django_migration_merge.py)).
