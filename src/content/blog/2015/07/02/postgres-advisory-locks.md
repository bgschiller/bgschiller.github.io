---
title: Postgres Advisory Locks
description: Acquire and release postgres advisory locks from python with a decorator
category: blog
tags: [programming, postgresql, python]
date: 2015-07-02
---

I've become a big fan of PostgreSQL in the last year. Window functions, indexed JSON data types, and full text search are all awesome, but lately I was really happy to find a simple feature that did exactly what I needed: `pg_advisory_lock`. Postgres advisory locks are stored along with Postgres' own internal locks ( you can even see them in the `pg_locks` table), but their meaning is entirely application-dependent.

In my case, we have a per-client sync process that occurs in a background task. We don't want
two of these stepping on one another's toes, so we can make an advisory lock. Suppose we are doing the sync for a client with an id of 4. We can run

```sql
SELECT pg_try_advisory_lock(4);
```

That query will return True/False depending on whether or not we were granted the lock on 4. When we're finished with the lock, we call

```sql
SELECT pg_advisory_unlock(4);
```

So this is pretty neat, but the locks are using a global namespace. What if we need to lock for a sync and also for some other background task? One trick you can use is to scope the locks using a hash.

```python
hasher = hashlib.sha1()
hasher.update('sync({})'.format(client_id))
lock_name = struct.unpack('q', h.digest()[:8]) # the pg_lock accepts an int8, so we have to throw away some bits.
cursor.execute('SELECT pg_try_advisory_lock(%s);', (lock_name,))
```

We can extract this pattern into a context manager to make it more Pythonic and easier to reuse. Here's my attempt:

```python
import hashlib
import struct
import contextlib

from django.db import connection # or create a connection directly with psycopg2

@contextlib.contextmanager
def pg_try_advisory_lock(lock):
    """
    Context manager to acquire a Postgres advisory lock.

    :param lock: The lock name. Can be anything convertible to a string.
      Should be scoped to the user/org and action being taken.
    :param cur: A database cursor. Optional.
    :return True/False whether lock was acquired.
    """
    hasher = hashlib.sha1()
    hasher.update('{}'.format(lock))
    int_lock = struct.unpack('q', hasher.digest()[:8])

    cur = connection.cursor()

    try:
        cur.execute('SELECT pg_try_advisory_lock(%s);', (int_lock,))
        acquired = cur.fetchall()[0][0]
        yield acquired
    finally:
        cur.execute('SELECT pg_advisory_unlock(%s);', (int_lock,))
        cur.close()
```

Now we can use that function like this:

```python
with pg_try_advisory_lock('sync({})'.format(client_id)) as acquired:
    if acquired:
        print 'beginning sync for', client_id
        # ... actually do the sync
    else:
        print 'some other process holds the sync lock for', client_id
```
