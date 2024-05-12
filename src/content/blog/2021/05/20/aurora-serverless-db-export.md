---
layout: post
title: Aurora Serverless DB Export
category: blog
tags: [aws, devops, serverless, postgres]
---

For Aurora Serverless databases, there's no easy way to save a snapshot to an S3 bucket. For regular RDS databases, even non-serverless Aurora clusters, it's a single API call. But we were working with an Aurora Serverless database and, per Amazon,

> Exporting snapshots created from Aurora Serverless v2 (preview) DB clusters to Amazon S3 buckets [is not supported]

[source: aurora-serverless-2 limitations](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-2.limitations.html)

So what if you need this sort of thing? We found
an [AWS sample repo](https://github.com/aws-samples/rds-snapshot-export-to-s3-pipeline) that did exactly what we wanted: save each nightly db snapshot to an S3 bucket. But again, this was only for non-serverless Aurora. We even spoke with an AWS Enterprise Support person who said it wasn't possible.

That repo did give us an idea though. It's not possible to go directly from an aurora serverless snapshot to an s3 export. But what if we

1. restore to a provisioned (non-serverless) database,
2. snapshot the _provisioned_ db,
3. export the snapshot to s3, and finally
4. clean up the provisioned db and snapshot.

We forked that sample repo, making a pipeline to do just that. The result is open source: [github.com/devetry/aurora-serverless-to-s3](https://github.com/devetry/aurora-serverless-to-s3). If you have the same problem, I hope this works for you.

## Closing thoughts

This was my first time working with AWS CDK, and it's really nice! I do wish the typings were more strict. If a parameter is required, the typescript bindings should be able to tell me before I try to run `cdk deploy`. But still, way better than wiring all these resources up by hand and wondering if I've forgotten a step.

If you have this need, maybe just use a provisioned database from the start? I'm not sure how much money we're saving from using Aurora Serverless, but it probably doesn't add up to the week or so it took to figure this pipeline out.
