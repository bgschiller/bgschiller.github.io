---
title: The best Result type for TypeScript
date: 2025-02-07
description: Make Result types in TypeScript as ergonomic as Rust's ? operator
category: blog
tags: [typescript, programming, rust]
---

Thrown Errors don't appear in the signature of TypeScript functions. Many people work around this by writing something like

<!-- prettier-ignore -->
```ts
type Result<T, E> =
  | { ok: true, value: T }
  | { ok: false, error: E };
```

This works great! It forces the caller of a function to handle errors that might happen. But if I'm calling a function that returns a `Result` from a function that _also_ returns a `Result`, I usually want to just pass the error along.

This leads to code that either checks for errors at every step (like Go):

```ts
const configResult = readConfig();
if (!configResult.ok) return configResult;
const config = configResult.value;
// ... the same thing with every step...
```

...or leans into the Monadic nature of `Result` and uses `.map` (or `.andThen` or a `pipe()` function) to pass the error along:

```ts
return pipe(
  readConfig(),
  map((config) => doSomething(config)),
  map((result) => doSomethingElse(result)),
  map((result) => doAnotherThing(result)),
);
```

Either of these are fine. The first is a bit wordy, and the second is sometimes difficult to read, but fine. We have a lot of examples at work where the pipelines start to nest and be especially hard to understand.

Yesterday I was thinking about how nice Rust's handling of this situation is, where you can put a `?` after a `Result` and it will propagate the error or give the value. I wondered, can we make something like that in TypeScript? It turns out we can!

```ts
Result.do((unwrap) => {
  const config = unwrap(readConfig());
  const db = unwrap(connectToDatabase(config.db_url));
  // ...
});
```

Surprisingly, we can still do this with full type-safety. The trick is to allow ourselves to throw an exception, since it's the only way for `unwrap` to halt execution through the function, then immediately catch it. Here's what the implementation looks like:

```ts
type Unwrap<E> = <T>(result: Result<T, E>) => T;

// do is a keyword, so we call it _do and export it as part of
// an object called Result to make it callable
function _do<T, E>(fn: (unwrap: Unwrap<E>) => T): Result<T, E> {
  let unwrappedError: E | undefined;
  try {
    const value = fn((result) => {
      if (!result.ok) {
        unwrappedError = result.error;
        throw result.error;
      }
      return result.value;
    });
    return { ok: true, value };
  } catch (error) {
    if (error === unwrappedError) {
      return { ok: false, error };
    }
    // some error was thrown that wasn't
    // due to an `unwrap` call. rethrow it.
    throw error;
  }
}

export const Result = {
  do: _do,
  // ... other helper functions ...
};
```

When this is used within a function listing an explicit set of return types, it catches the case where you forgot to list an error.

```ts
class DivideByZeroError extends Error {
  kind = "divide by zero" as const;
}
class EvalError extends Error {
  kind = "eval error" as const;
}
class ParseError extends Error {
  kind = "parse error" as const;
}
function divide(a: number, b: number): Result<number, DivideByZeroError> {
  // ...
}

function parseNumber(num: string): Result<number, ParseError> {
  // ...
}

function evaluate(
  expression: string,
): Result<number, EvalError | DivideByZeroError> {
  return Result.do((unwrap) => {
    const [a, op, b] = expression.split(" ");
    // red squiggly here: forgot to list `ParseError` as a possible
    // error type in the return type of evaluate
    const numA = unwrap(parseNumber(a));
    // This one is okay though. `unwrap` limits the error types it
    // accepts to the ones the function is allowed to return
    const numB = unwrap(parseNumber(b));
    // ...
  });
}
```

This does for the `Result` type what `async`/`await` does for promises—it's Haskell's `do-notation` for this specific monad.

Speaking of promises, the same trick works for `AsyncResult`, a `Result` that is wrapped in a `Promise`.

I haven't seen this in any TypeScript codebases yet (have you?). This is part of an internal library at work, but I'd like to open source it if we can get permission. I want to use it everywhere!

## Updates after field-testing

After using this for about a week, we've made a couple of changes.

First, we noticed that using `unwrap` in a second scope (like in a nested function) is dangerous. Consider this code:

```ts
function lazyAdd(expression: string): Result<() => number, EvalError> {
  return Result.do((unwrap) => {
    const [a, op, b] = expression.split(" ");

    return () => {
      // close over the `unwrap` function
      const numA = unwrap(parseNumber(a));
      const numB = unwrap(parseNumber(b));
      return numA + numB;
    };
  });
}

const add = lazyAdd("1 + 2");
const result = add(); // 💥 throws an error that's not caught
// by `Result.do` because that function has already returned
```

To fix this, we added an eslint rule that disallows using `unwrap` unless it was defined in the current scope.

Second, we updated the signature to require returning a `Result` from the function passed to `Result.do`. This makes it easier to return errors from the function. For example,

```ts
// before, it's weird to unwrap an error we're making on the spot
unwrap(Result.failure(new EvalError("divide by zero")));
// after, we can just return the failure
return Result.failure(new EvalError("divide by zero"));
```

This is also more consistent with most flatMap signatures in functional programming.
