---
title: A Cloudfront Mystery
category: blog
tags: [programming, devops, cloudfront, aws]
date: 2018-10-24
description: "A detective story of debugging a Cloudfront 502 error"
---

Yesterday I spent most of my day stuck on one problem. There are a couple of services in front of the api I was deploying, and requests were failing to get to my server. The layers are:

1. Cloudfront, which serves all frontend files, and proxies any requests to `/api/*` on to
2. ThreatX, a web app firewall that analyzes your traffic to identify and block attacks. No idea if this works, but the client on this project uses it for all their production api endpoints.
3. ElasticBeanstalk, where I'm hosting the API.

Now that we know the cast of characters, here are the clues:

- `https://product.company.com/api/healthcheck` gave me a Cloudfront 502 "Cannot connect to origin error".
- `https://product.api.company.com/api/healthcheck` gave me a 200 OK and the expected response.

The Cloudfront logs didn't offer much more information, basically just saying "there was a 502 at this time". I brought the problem to the #help-aws channel on the [Denver Devs](https://denverdevs.org) slack, where Scott Reynen suggested that I might get more information over http, as SSL errors might be masking other problems. I updated the settings to "Match Viewer", and worked on other things while the distribution updated.

Once those updated, I was getting a new error message: an opaque 503 over http. Still 502s over https. Scott pointed out:

> scottr [4:44 PM] > http://206.191.153.167/api/healthcheck also returns 503.
> 206.191.153.167 being the IP i get from DNS for product.api.company.com

This was the seed of the solution. Hitting the api directly, bypassing cloudfront, gave me the _same_ error message as when I hit the api via cloudfront. Why would hitting `206.191.153.167` directly cause a 503? ThreatX must be serving multiple virtual hosts from the same IP address. When requests hit the IP directly, they aren't able to figure out which site to route them to.

Scott pointed out that this could explain the whole of the problem. Cloudfront would show a 502 because when connecting over https, ThreatX would also not be able to figure out which certificate it should use, causing the SSL handshake to fail.

I decided to test this theory. Does cloudfront pass along the hostname of the origin, or just forward the common name of the distribution. I used `ngrok` to set up a tunnel to my local computer, and another Cloudfront behavior to forward all traffic at `/ngrok/*` to this tunnel. So the path is:

1. `product.company.com/ngrok/test` is picked up by cloudfront. Because of the `/ngrok/*` behavior, it's forwarded to...
2. `brians-test-subdomain.ngrok.io`, which is a tunnel that forwards all traffic to...
3. my local computer, listening at a port using `nc -l 5000`.

Once this was set up, I tried sending a request to `product.company.com/ngrok/test`. It didn't succeed, but the error message was useful in pointing me further down the right path.

![Requests to the cloudfront distribution return an error "Tunnel d1ymj0x8ekkzpz.cloudfront.net not found"](./cloudfront-tunnel-not-found.png)

That error from ngrok is much more useful than the opaque 503 from ThreatX. It tells me that there wasn't enough information in the request to determine which of the tunnels hosted on the server it should forward the request to (this is the same insight Scott hit on earlier). I guessed that this missing information was the host header, and also that ThreatX was using the same information to decide which virtual host's settings to use. I set about trying to rewrite the Host header.

My first attempt was a bust. Cloudfront has settings to tack on custom headers to every request to an origin. It looks like the 'Host' header is specifically excluded from these though. Googling the error led me to [this stack overflow](https://serverfault.com/questions/888714/send-custom-host-header-with-cloudfront). I'll include the error as text here in case this writeup is useful for future googlers.

![The AWS console shows an error when attempting to override the Host header](./cloudfront-set-host-header-error.png)

> com.amazonaws.services.cloudfront.model.InvalidArgumentException: The parameter HeaderName : Host is not allowed. (Service: AmazonCloudFront; Status Code: 400; Error Code: InvalidArgument; Request ID: e5ec3341-d7b3-11e8-9d15-6d950132ee97)

Following the advice of that Stack Overflow answer, I wrote a custom Lambda@Edge function to modify the request on its way out to the origin:

```javascript
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  request.headers.host[0].value = "brians-test-subdomain.ngrok.io";
  return callback(null, request);
};
```

A few caveats apply to Lambda@Edge, which I'll repeat here in case they're new to you:

1. You must make your lambda function in `us-east-1`, or it can't be used in response to a cloudfront request.
2. Lambdas can have multiple versions, but cloudfront needs to know which specific one to run. You must click "Publish new version", which will give you a slightly different ARN (ie, it will have a `:1` or another number tacked onto the end).

Take the ARN from the lambda page, which should look something like `arn:aws:lambda:us-east-1:**********:function:rewrite-host-header-to-api:1`, and paste it into the "Lambda Function Associations" section of your cloudfront behavior. Choose "Origin Request" for your CloudFront event. There's no need to tick the "Include Body" box, since we're only modifying headers here, not the request payload.

![Add the cloudfront function association to the cloudfront distribution as an origin request](./cloudfront-lambda-origin-request.png)

Once your Cloudfront distribution finishes deploying, you should be good to go! API requests will now have their Host header rewritten so that ThreatX can figure out which virtual host certificate it should use, and everything is gravy.

Thanks to the friendly people in #help-aws, specifically `@scottr`, `@virtualandy`, `@deploytheyak`, and `@anthakingston`. Without their encouragement and direction I likely would have given up on this bug.
