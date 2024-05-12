---
title: Raw SQL Array parameters in Rails
date: 2022-02-23
description: How to pass an array as a parameter to a raw SQL query in Rails
category: blog
tags: [ruby, rails, sql]
---

Most of the time in Rails, you're better off going with the flow and relying on the ORM to write your SQL queries. Sometimes, to accomplish something custom, you want to write your own SQL and send it to the database. You can do that like this:

```ruby
ActiveRecord::Base.connection.exec_query(
  "SELECT tablename from pg_tables WHERE schemaname = $1", "tableNames", [
    ActiveRecord::Relation::QueryAttribute.new("schema_name", schema_name, ActiveRecord::Type::String.new)
  ]
)
```

In my situation, I had a complicated query that I wanted to run for a handful of posts, where I knew all of the IDs. I expected to be able to pass in the IDs as an array, but that didn't work. I got a message: `TypeError (can't cast Array)`. But I really wanted to use an array! The workaround I came up with was to:

1. In Ruby code, prepare a string formatted like a postgres array literal (eg, `{1, 2, 3}`).
2. Pass that as a bind parameter, typed as a string.
3. In SQL, cast that to an array of the proper type (eg, `$1::int[]`).

Here's how it looks all together:

```ruby
post_ids = [1, 2, 3, 4] # imagine this is dynamic, get_post_ids() or something
post_id_array = '{' + post_ids.map(&:to_i).join(',') + '}'
ActiveRecord::Base.connection.exec_query(
  "SELECT
    posts.id
    # imagine we're selecting a bunch of
    # complicated stuff to justify writing custom SQL
   FROM posts
   WHERE id = ANY($1::int[])", "grabPosts", [
    ActiveRecord::Relation::QueryAttribute.new("postIds", post_id_array, ActiveRecord::Type::String.new)
  ]
)
```
