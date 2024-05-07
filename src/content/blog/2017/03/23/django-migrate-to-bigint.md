---
title: Migrating a Primary Key to Bigint
date: 2017-03-23
category: blog
tags: [programming, python, django, postgresql]
description: High volume tables can run out of ids. Here's how to convert a Django model's primary key to a bigint.
---

We noticed that the id values on one of our high-churn tables were creeping up towards maxint, so we decided to convert the id column to a bigint. It was more difficult than we expected, so I'm documenting it here for future reference.

A major point in our favor was that no other table has a foreign key to `api_event`. That would probably have made things more complicated.

We started out just adding to the model definition:

```python
id = models.BigIntegerField(unique=True, primary_key=True)
```

Previously, we had not had a column called 'id', but used the one Django made one for us automatically. Unfortunately, adding the column caused Django to prepare `INSERT` statements differently. With the explicit `id = models.BigIntegerField(..)`, Django will format an insert to say:

```sql
INSERT INTO api_event(id, message, ...) VALUES
(null, 'the message', ...),
(null, 'another message', ...);
```

This is different from omitting the column (as Django did before adding the explicit column) or using the `default` keyword in place of `null`. Postgres rejects this insert, because `id` has a `NOT NULL` constraint.

So we made a migration without changing the Django model:

![Screenshot of the Github code review UI showing a diff with a migration running "ALTER TABLE api_event ALTER COLUMN id TYPE bigint"](./api_event_bigint_id.png)

This actually was going to work fine. I ran this locally, and started it on the dev server. Problem was: it was going to take about an hour, holding an exclusive lock on the event table the whole time. That wasn't going to fly.

After some more research, we found a stackoverflow post that looked like exactly our situation (no foreign keys pointing to the id we're changing): http://stackoverflow.com/a/33509181/1586229 We copied that solution and tried it on the dev server.

At this point, we ran into another hiccup. We were running our migrations via a `heroku run -x python manage.py migrate --noinput`, and the connection kept timing out before our migration was through. So we made the migration re-entrant safe. Each time we ran migrations, it would do as much work as it could, but always leave the database in a consistent state -- with a `new_id` either null or equal to `id`. Then, we'd do the final renaming of columns inside a transaction. Here's what that looked like:

```python
# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations

# http://stackoverflow.com/a/33509181/1586229
def change_id_col_concurrently(apps, schema_editor):
    """
    We see this migration timing out on dev, so we're making it re-entrant safe.

    The hope is that we can make progress on each time we run.
    (our progress is preserved because we've exited the atomic block).
    """
    schema_editor.atomic.__exit__(None, None, None)


    with schema_editor.connection.cursor() as c:
        c.execute('''
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='api_event' and column_name='new_id';
        ''')
        column_exists = len(c.fetchall()) > 0

    if not column_exists:
        schema_editor.execute('ALTER TABLE api_event ADD COLUMN new_id bigint;')

    with schema_editor.connection.cursor() as c:
        c.execute('SELECT min(id), max(id) FROM api_event WHERE new_id IS NULL')
        min_id, max_id = c.fetchall()[0]
    if min_id is not None and max_id is not None:
        for low in xrange(min_id, min(max_id, 2**31 - 1), 10000):
            schema_editor.execute(
                '''UPDATE api_event SET new_id = id WHERE id between %(low)s and %(high)s''',
                dict(low=low, high=low + 10000))

    schema_editor.execute('DROP INDEX IF EXISTS api_event_pk_idx')
    schema_editor.execute('CREATE UNIQUE INDEX CONCURRENTLY api_event_pk_idx ON api_event(new_id);')

    schema_editor.execute('''
    BEGIN;
    ALTER TABLE api_event DROP CONSTRAINT api_event_pkey;
    CREATE SEQUENCE api_event_new_id_seq;
    ALTER TABLE api_event ALTER COLUMN new_id SET DEFAULT nextval('api_event_new_id_seq'::regclass);
    UPDATE api_event SET new_id = id WHERE new_id IS NULL;
    ALTER TABLE api_event ADD CONSTRAINT api_event_pkey PRIMARY KEY USING INDEX api_event_pk_idx;
    ALTER TABLE api_event DROP COLUMN id;
    ALTER TABLE api_event RENAME COLUMN new_id to id;
    ALTER SEQUENCE api_event_new_id_seq RENAME TO api_event_id_seq;
    SELECT setval('api_event_id_seq', (SELECT max(id) FROM api_event));
    COMMIT;
    ''')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0048_create_stage_interval'),
    ]

    operations = [
        migrations.RunPython(change_id_col_concurrently),
    ]
```
