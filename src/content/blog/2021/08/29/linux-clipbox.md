---
title: Clipbox for S3
date: 2021-08-29
description: Clipbox is a little utility that I've been using in some form or another for years. It is a utility that provides a keyboard shortcut to select a region of the screen, upload the screenshot to a server, and put a link to the image on your clipboard.
category: blog
tags: [aws, productivity, screenshot]
---

Clipbox is a little utility that I've been using in some form or another for years. It is a utility that provides a keyboard shortcut to

1. select a region of the screen,
2. upload the screenshot to a server, and
3. put a link to the image on your clipboard.

Some versions have supported text, file, or video captures as well. Some coworkers have noticed the branded links I drop in slack and asked me to write up how to set it up for themselves.

## History

The [first version I used](https://github.com/emeth-/Clipbox) was written by Sean Kooyman, my boss at TopOPPS. I think it originally used dropbox (hence the name), but by the time I used it all our images were uploaded to an FTP server. Sometimes we'd lose a link for something important and trawl through the FTP server's files looking for it. It looks like he has a [newer one that uploads to imgur](https://github.com/emeth-/clipgur).

After I left TopOPPS, I decided I wanted more ownership over my files. I made a version that leveraged [Alfred](https://www.alfredapp.com/) for catching keyboard shortcuts and uploaded to Trello or S3: [bgschiller/alfred-clipbox](https://github.com/bgschiller/alfred-clipbox).

## Linux version

These days, I mostly use Linux, so Alfred isn't an option. Instead, I have a couple of short scripts and aws resources to do the same task.

### AWS setup: S3 bucket

Create an s3 bucket to hold your uploads. I upload several large images a day, and 1-2 video recordings per week and I don't think I've ever come close to the free tier limits. You'll want to set this up to allow public Read access, but not List or Write permissions.

Check that this is working by uploading a file using the web console. Be sure to select Grant Public Access. Then visit https://`bucket-name`.s3.`Region`.amazonaws.com/`your-file`. For example, [https://brianschiller-clipbox.s3.us-west-2.amazonaws.com/twimst.jpg](https://brianschiller-clipbox.s3.us-west-2.amazonaws.com/twimst.jpg). That should show the file in your browser.

However, visiting just https://`bucket-name`.s3.`Region`.amazonaws.com should return an AccessDenied error message, like this https://brianschiller-clipbox.s3.us-west-2.amazonaws.com. That keeps people from being able to look at each file you have ever uploaded.

Make your bucket name available as `CLIPBOX_AWS_S3_BUCKET`.

### AWS setup: S3 writer API user

I don't think it's safe to use a highly privileged API user for a task like this. I made an IAM user with the following policy allowing writing only to the one bucket

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "VisualEditor0",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:AbortMultipartUpload", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::brianschiller-clipbox/*"
    }
  ]
}
```

Download the API keys and make them available as `CLIPBOX_AWS_ACCESS_KEY_ID` and `CLIPBOX_AWS_SECRET_KEY`.

<aside>
I keep my ~/.zshrc under version control, but I don't like to commit keys to git. To solve this, I have a separate file, ~/.zshrc-sensitive that is sourced by ~/.zshrc but not tracked in version control.
</aside>

### Optional AWS setup: Cloudfront distribution

This step is only necessary if you want prettier or shorter URLs, like [https://clip.brianschiller.com/dorkweb.png](https://clip.brianschiller.com/dorkweb.png). You'll need to buy a domain if you don't already have one.

Set up a cloudfront distribution with one origin: your s3 bucket. No need to specify an origin path, or Origin Access Identity. Add an alternate domain name for your domain or subdomain and follow AWS instructions to get an SSL cert for it.

The cloudfront distribution acts as a proxy, mapping a nice URL to files from your S3 bucket.

### Script: s3_upload.py

[s3_upload.py](https://github.com/bgschiller/dotfiles/blob/master/s3_upload.py) lives in my ~/bin folder. It's job is to:

1. Take a single argument: a file name to upload,
2. Update the filename to include the date and a few random characters (this makes it difficult for someone to access my uploads by guessing likely filenames),
3. Upload that file to an S3 bucket, specified by an environment variable, and
4. Print a publicly accessible link to stdout.

For example:

```bash
$ s3_upload.py child.c
https://clip.brianschiller.com/BgyijIx-2021-08-29-child.c
```

It depends on python3 and boto3. If you object to those dependencies you could probably port it to use the AWS cli instead.

### Script: clipbox-screenshot.sh

[clipbox-screenshot.sh](https://github.com/bgschiller/dotfiles/blob/master/clipbox-screenshot.sh) also lives in ~/bin. You may need to adjust it to work for you, depending on your platform.

### Keyboard shortcut

I set up a keyboard shortcut from the settings (I think this might be a gnome thing?). I don't know how to save this as a dotfile, but it's quick to set up. Here's how it looks

![custom shortcut settings for clipbox-screenshot.sh]({{ site.url }}{{ site.baseurl }}/images/clipbox-screenshot-keyboard-shortcut.png)

## Extensions

I haven't added any of these options yet, but other versions of clipbox may have them.

### upload video recordings

I haven't wired this up, I'd like to add another shortcut to

1. record a video of a screen or portion of a screen
2. convert it for web streaming using ffmpeg (mp4 format and fast-start flags)
3. upload and grab a link

### annotate the screenshot before uploading

Sometimes I'd like to draw or otherwise mark up a screenshot before uploading it.

### Copy text or a file

The `s3_upload.py` script works fine with any type of file, but it could be nice to have a keyboard shortcut for it. The script should also take input from stdin and upload it as text.

## Alternatives

There are a handlful of paid versions of this: droplr, cloud-app, snagit. It looks like sharex is donation-ware, but only supports Windows.
