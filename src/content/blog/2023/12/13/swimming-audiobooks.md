---
title: Swimming with Audiobooks
date: 2023-12-13
description: I've been swimming a lot recently. I find swimming to be pretty boring, so I've been listening to music with swim headphones to occupy my mind. A few weeks ago, my cheapo headphones were stolen from the side of the pool. To replace them, I bought some Shokz OpenSwim headphones. Wow, these are so much better.
category: blog
tags: [programming, swimming, books]
---

I've been swimming a lot recently. I find swimming to be pretty boring, so I've been listening to music with swim headphones to occupy my mind. A few weeks ago, my cheapo headphones were stolen from the side of the pool. To replace them, I bought some Shokz OpenSwim headphones. _Wow_, these are so much better.

The audio quality on the old ones was bad, barely enough to hum along to songs I already knew. The Shokz are great! They are as good as the bone-conduction headphones I use on dry land. This made me wonder: could I listen to audiobooks with these?

## Getting the audiobooks

Bluetooth doesn't work through water, so I couldn't just stream the audio from my phone. I needed to get mp3s, like in the 2000s.

I wrote a program to download audiobooks that I checked out from the library. The program

1. Opens a web browser,
2. Signs into the library site,
3. Begins playing the audiobook, skipping 5 minutes ahead every few seconds,
4. Watches for network requests for audio files and saves them in a folder.

This gives me a folder with a handful of mp3s in the right order.

## Splitting the files

The shokz have no way to "scrub" and jump back a bit if I miss something. I could miss a crucial plot point when someone asks to join my lane!

There is a control to go back to the start of the track, but a "track" of an audiobook is 1-3 hours. That's too much to go back.

What if we split each big track into smaller ones? Say, 60 seconds each. That way, I can go back just a bit at a time. This can be done with `ffmpeg`:

```bash
ffmpeg -i alloy-of-law/alloy-of-law-01.mp3 \
-f segment -segment_time 60 \
-c copy \
alloy-of-law-itty-bitty/alloy-of-law-01-%03d.mp3
```

I mostly copied this from a StackOverflow answer, but I'll do my best to interpret it. Line by line, that says

1. Run `ffmpeg` on the first track of my audiobook, at `alloy-of-law/alloy-of-law-01.mp3`.
2. Segment the file, 60 seconds per track
3. Copy the codec (don't bother to re-encode the data)
4. Write the output to some new files, where `%03d` is a placeholder for the segment number.

This produced 59 files, each 60 seconds long. Wanting to try it out, I copied the files onto my headphones. The book started right in the middle of a sentence 🤦🏻.

## Ordering the songs

After some research, I came across some documentation that suggested the OpenSwim headphones determined the order of songs according to when each file was copied to the memory rather than by file name. When I copied over my 59 tiny tracks, some of the later ones must have finished before the earlier ones.

With a bit of patience, I could fix this. Just copy one file... wait for it to finish... then copy the next... Ugh! Who has the patience for that?

Instead, I wrote a script:

```bash
for ff in $(ls alloy-of-law-itty-bitty); do
  cp $ff /Volumes/OpenSwim/alloy-of-law 
  sleep 5
done
```

And... it worked! The tracks played in order.

## Field test

During my ~40-minute swim this morning, I listened to The Alloy of Law by Brandon Sanderson the whole time. In that way, it was a great success!

However, I'm not sure I'll continue to do this. I don't usually do flip-turns, so there's a moment at each end of the pool when the water drains from my ears. When that happens, the sound gets much quieter—water carries sound waves much better than air—and I miss a second or so of audio. I also found that I couldn't _quite_ devote enough attention to the book. Between maintaining my stroke form and tracking the other swimmers in my lane to stay out of their way, it was a lot of effort to follow the story.

There was also a small stutter when the track transitioned in the middle of the word. If I was planning to continue, I think that could be avoided by identifying gaps between sentences and splitting the track at that point.

## Reflections

I've heard people say that "coding is the new literacy". I'm still skeptical of that idea. Literacy is a public good that makes all of society more efficient. Coding is useful _sometimes_. Still, I think this is a great example of applying programming skills to a problem in my own life.

## Update: swimming-staging-area

I wrote a new script for copying the files across.

```bash
find ~/Music/swimming-staging-area -type f | sort | while read -d $'\n' ff; do
  relname=$(echo $ff | sed "s|^$HOME/Music/swimming-staging-area/||g")
  echo $relname
  mkdir -p "$(dirname /Volumes/OpenSwim/$relname)"
  cp "$ff" "/Volumes/OpenSwim/$relname"
  sleep 3
done
```

This new one:

- Allows me to prepare all the songs and albums that will be on the headphones ahead of time, in `swimming-staging-area`
- handles spaces in filenames
- creates directories for the albums if they don't already exist on the headphones.

With the new script, my workflow is to

1. pick out albums and podcasts, putting them in `swimming-staging-area`.
2. Rename the folders until they're in the order I want.
3. Delete the files in /Volumes/OpenSwim/.
4. Run my script.

## Update: shuffled folders

This is mostly working for me, with one small annoyance. I used [spotify-dl](https://sathyasays.com/2015/12/29/spotify-dl-download-your-spotify-my-music-songs-as-mp3/) to download a playlist of songs and I wasn't careful about the filenames, so the songs are sorted by artist. I added a line to the script to shuffle the contents of any folder with "shuffle" in its name.

```bash
find ~/Music/swimming-staging-area -type d -depth 1 | sort | while read -d $'\n' dir; do
  sortFlags=$([[ $dir == *shuffle* ]] && echo "-R" || echo "")
  find $dir -type f | sort $sortFlags | while read -d $'\n' ff; do
    relname=$(echo $ff | sed "s|^$HOME/Music/swimming-staging-area/||g")
    echo $relname
    mkdir -p "$(dirname /Volumes/OpenSwim/$relname)"
    cp "$ff" "/Volumes/OpenSwim/$relname"
    sleep 3
  done
done
```

## Update: a kindred spirit

I heard from Christopher Woggon who has a very similar setup! His script adjusts the volume of each track to be the same, and uses the file-system sync instead of my `sleep 3`. Check out his blog post at https://christopherwoggon.com/blog/swimming-audiobook/
