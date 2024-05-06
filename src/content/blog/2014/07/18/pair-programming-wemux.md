---
title: Pair Programming with wemux and ngrok
description: "Share your terminal with friends!"
category: blog
tags: [programming, pair, tools]
date: 2014-07-18
---

A couple people at work are in California, while most of us are here in St. Louis. We did a bit of screen sharing with Google hangouts, but it was laggy and one-sided. Only the host could make changes, and there was a lot of friction involved in switching the host. After looking around for a better solution, I found Martin Brochhaus' blog post, [Pair Programming With Tmux](http://martinbrochhaus.com/pair.html).

My setup is the same as his, with the small addition of [`ngrok`](https://ngrok.com/). `ngrok` lets us avoid the trouble of setting up port forwarding for ssh.

### Setting it up

This will be at a pretty high level, but more details are available on [Martin's blog](http://martinbrochhaus.com/pair.html)

1. Create a new user on your computer, called `pair` or something similar.
2. Authorize your colleagues to ssh into that user's account.

- Add their public keys to ~pair/.ssh/authorized_keys
- On OS X, turn on `Remote Login` in the System Preferences.
- edit your `sshd_config` to prevent password login.

3. Install `tmux` and `wemux`. On OS X, this is just `brew install tmux wemux` as long as you have [homebrew](http://brew.sh/) installed.
4. Change `pair`'s `.bashrc` to be `wemux pair; exit`. When the `pair` user logs in, they will join a `wemux` session right away, and log out (`exit`) immediately after leaving it. This keeps folks from doing insidious things on your computer. For example, they might add `echo 'say penguin' >> ~/.bashrc` to your `~/.bashrc`. By keeping them in `wemux`, you can see everything they're doing on your computer.

### Pairing

This is where the `ngrok` secret sauce comes in. Up to now, our configuration has been the same as [Martin's](http://martinbrochhaus.com/pair.html). However, we won't set up port forwarding on our router (maybe you're at work, or a coffeeshop or an airplane and don't have access to the router). Instead, we'll use a 'Secure tunnel to localhost' provided by `ngrok`.

You'll have to download [ngrok](https://ngrok.com/) and put it somewhere on your `PATH`. Now, run `ngrok -proto=tcp 22`, which says "Make a TCP tunnel to my local port 22". Port 22 is where ssh usually runs. You should get a screen like below.

![ngrok screen](./ngrok.png)

> You may have to create an account and authenticate your computer in order to use `-proto=tcp`. Don't worry &mdash; it's free.

I happened to get port `35731`. This number will be different every time. Now, start a wemux session by opening a new terminal window and typing `wemux start`. Because of what we put in `pair`'s `.bashrc` file, the `pair` user won't be able to stay logged in without a `wemux` session running. Give it a try, as soon as you end `wemux` (by typing `exit` or `Ctrl-D`), any users attached over ssh will be immediately logged out.

Now that you have `wemux` and `ngrok` running, have your colleague log on using `ssh -p 35731 pair@ngrok.com`. The connection will be forwarded from ngrok.com straight to your local computer.

![wemux pair](./wemux_pair.png)
