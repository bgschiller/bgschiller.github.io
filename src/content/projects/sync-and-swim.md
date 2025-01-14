---
date: Jan 13, 2025
title: "sync-and-swim"
repoURL: "https://github.com/bgschiller/sync-and-swim"
---

A Tauri app to load music and audiobooks onto Shokz OpenSwim headphones. It offers three functions:

- Load music from a directory onto the headphones. Copying via Finder or Explorer tends to screw up the order of files (because the headphones sort by file timestamp instead of alphabetically). This tool copies files in the correct order.
- Slice long audio files, like podcasts or audiobooks, into smaller pieces. This makes it easier to skip forward or backward on a device with no screen and only three buttons.
- Find your place in a directory of audio files. Rather than starting from the beginning of the book if you lose your spot (like if the headphones accidentally turn on in your bag), this app uses binary search to find the last file you listened to.
