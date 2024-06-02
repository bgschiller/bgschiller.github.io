---
date: Nov 17, 2021
title: "cpp-subprocess"
repoURL: "https://github.com/bgschiller/cpp-subprocess"
description: "A C++ library for safely invoking external commands and pipelines."
---

A C++ library for safely (no exceptions!) invoking external commands and pipelines. 5x better than popen.h or your money back.

It's not quite there yet, but the goal is to be able to write something like this:

```cpp
auto res = (
    Exec::shell("cat api/src/*.avdl") |
    Exec::cmd("grep").arg("-oP").arg(R"(@since\((\d+)\))") |
    Exec::cmd("tr").arg("-cd").arg("0-9\\n") |
    Exec::cmd("sort").arg("-rn") |
    Exec::cmd("head").arg("-n1")
).capture();
```

The killer app here is that you can avoid shell injection attacks because arguments are passed as separate strings, not as a single string that gets parsed by the shell. This is a common problem with `system` and `popen` in C++.

```cpp
auto res = Redirection::Exec::cmd("jq").arg(jqFilter).stdin(body).capture();
```

This is all a shameless rip-off of [Rust's subprocess crate](https://docs.rs/subprocess/latest/subprocess/).
