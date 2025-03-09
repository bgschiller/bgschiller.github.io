---
title: Privacy-preserving Analytics with Counterscale
date: 2025-03-08
description:
category: blog
tags: [blog, analytics, counterscale, serverless]
---

Since I removed Google Analytics from my blog, I'd been looking for a way to track page views to see which posts are popular. I didn't want to use a third-party service that follows users around the web, but I also didn't want to self-host an analytics server.

Counterscale overcame my hesitation to deploy an analytics server. It's written to fit within Cloudflare's serverless offerings, and was incredibly easy to deploy. Following the instructions in the README took about 10 minutes, and I've spent zero time maintaining it since deploying it a few months ago.

I'm happy with the results—I can see which posts are popular, and how much traffic I'm getting, but I don't learn too much else about my readers (and importantly, neither does anyone else). You can take a look at the dashboard at [counterscale.brianschiller.com/dashboard](https://counterscale.brianschiller.com/dashboard?site=brianschiller-dot-com).

I'm excited to see more projects like Counterscale that deploy to serverless platforms. The platforms often have generous free tiers, and the maintenance is much less than having a pet server to care for. Ben Vinegar writes more about this in his post [Counterscale and the New Self-Hosted](https://benv.ca/blog/posts/counterscale-and-the-new-self-hosted).
