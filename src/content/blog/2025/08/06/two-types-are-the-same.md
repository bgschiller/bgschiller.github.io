---
title: Check that two types are the same in TypeScript
date: 2025-08-06
description: A TypeScript pattern for ensuring that two types are the same.
category: blog
tags: [TypeScript, programming, types]
---

It is sometimes useful to ensure that two types are the same, and to get an error if they drift apart. For example, I recently needed a list of all the possible runtime values for a type defined in a library, something like this:

```ts
// in some-library-i-cant-change
export type ReadableField =
  | "name"
  | "email"
  | "phone"
  | "id";

// in my own code
const readableFields = [
  "name",
  "email",
  "phone",
  "id",
] as const;
function isReadableField(
  field: string,
): field is ReadableField {
  return readableFields.includes(field as ReadableField);
}
```

That works at this moment, but if the library adds a new value, `'birthday'`, then my function will be out of date. I'd like to get a type error if that happens so I can update my list. Here's how we can do that:

```ts
const readableFields = [
  "name",
  "email",
  "phone",
  "id",
] as const satisfies ReadableField[];

type UncoveredReadableFields = Exclude<
  ReadableField,
  (typeof readableFields)[number]
>;

expectNever(
  "some field isn't listed" as UncoveredReadableFields,
);
```

Try it out in a [Typescript Playground](https://www.typescriptlang.org/play/?#code/C4TwDgpgBAShCGATeAjANhAYgSwmxUAvFAOQB28AthCVAD6kSXzZq0MlgAWA9mTfVLZEJALAAoCQGM+AZ2BQATgmTosufLKJQA2hKikK1EgBpGzVqdLc+NMyWFjxAXSjwtMsvKiz4wbLIAZrhacEioGDh4iDrOEvHioJBQAKpkMgBuEMqIYaqRGohaxACiAB5SaACuiBAAPPqwKhHq0SaNSRA8gUrNalGaOmRVlCjZceIAfAkQZZBSwAByEFmKABQARLI81FDB0VABZCQKaAHAEIgbblppmdmXeS0DRQCUANwJgVXp-nxQs3mSxW2TWAH0ygAuKD8VavKAAbwAvkA). You should see that adding an extra field will cause an error because the list will no longer `satisfies ReadableField[]`. Omitting a field will also cause an error because `UncoveredReadableFields` will not be the `never` type.

If you don't have an `expectNever` function, you can define it as `function expectNever(_x: never) { }`.

## Another use case: No additional properties

This is useful in other contexts as well. For example, today I was working with an interface representing a product metrics table. It has a large number of fields, but they're nearly all optional.

```ts
interface ProductMetric {
  event_name: string;
  session_id?: string;
  client?: string;
  client_version?: string;
  client_event_epoch?: number;
  container_id?: string;
  user_id?: string;
  institution_id?: string;
  result?: string;
  source?: string;
  chat_id?: string;
  duration_ms?: number;
  // all the other fields we might need
}
```

In order to offer better type safety in the application, I'm defining subtypes that are more restrictive.

```ts
interface ContextAddedMetric extends ProductMetric {
  event_name: "context_added";
  source: "app_context" | "text_selection";
}

interface MessageSentMetric extends ProductMetric {
  event_name: "message_sent";
  chat_id: string;
}

interface ResponseReceivedMetric extends ProductMetric {
  event_name: "response_received";
  chat_id: string;
  duration_ms: number;
}

type SaferMetric =
  | ContextAddedMetric
  | MessageSentMetric
  | ResponseReceivedMetric;
```

These events are safer to use because they remind us to include the right fields for each event. But there's a danger we could introduce a new field name, which wouldn't be recognized by the backend. To prevent this, we can use the same trick: we'll make sure that the `keyof` the `SaferMetric` type matches the `keyof` the `ProcuctMetric` type.

```ts
type ExtraFieldsIntroduced = Exclude<
  keyof SaferMetric, // oops, there's a bug here. See below
  keyof ProductMetric
>;

expectNever(
  "an extra field was introduced" as ExtraFieldsIntroduced,
);
```

### An issue with `keyof` and unions

After publishing this, my colleague Steve Marquis pointed out that this _doesn't_ work. `keyof (A | B | C)` will always give the keys common to all three types. To fix it, we need a strange-looking bit of code:

```ts
type SaferMetricKeys<K = SaferMetric> = K extends K
  ? keyof K
  : never;
```

The name for this trick is [Distributive Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types). To quote the TypeScript docs, "When conditional types act on a generic type, they become distributive when given a union type." For us, that means that within the `<condition> ? <then> : <else>` expression, the `<then>` bit is evaluated for each part of the union type.

```ts
type SaferMetricKeys<K = SaferMetric> = K extends K
  ? keyof K
  : never;
// the left-hand side of the `extends` is a union type, so any expressions
// involving it are distributed to each branch of the union

type SaferMetricKeys = SaferMetric extends SaferMetric
  ? keyof ContextAddedMetric | keyof MessageSentMetric | keyof ResponseReceivedMetric
  : never;

// SaferMetric *does* extend SaferMetric, so this simplifies to:
keyof ContextAddedMetric | keyof MessageSentMetric | keyof ResponseReceivedMetric
// which is what we wanted!
```

Try it out on [the TypeScript playground](https://www.typescriptlang.org/play/?#code/JYOwLgpgTgZghgYwgAgApQPYBMCuCwCyEYUwCyA3gLABQyyEAbhOAPohwC2EAXMgM4lQAcwDctevwj9+wDCFbAsAfj6DSIMROQIANsBZhVAoZvF0d+w62ZRZ84+pHn6eg2ybWIABwwIAFsYgOJwARtAuOvJgcKDQiipqploWOFJQCY7JkaCCwGA4YHIKSlkaKfRQ0ji6RknlkfwYOFBIZc7aAXBgmfUdFrhQ3cWsnPxBIeFQkQD0M8hwurrIYP4oGKvQyDAGulj8yADuKJzAwv5gyCAQEFi0AL60tKCQsIgoAMLREAAeYACCWCwtyIQnIv0gIH2aEwuHwoNI5GoFk8bA43D4ACIEN8-qw4EDbpjGs1WrxkJi4N5vKwceAIZjkAAfCmQPFSXQQfDFYkPJ40F7QeBIZBEGRwYQQADKhgRZAYfxY0PQ2DwhGIiMo2lRPXR5Mx3HFktYUnAvIsXR6Sj6Zj5NGe9LeIoAStJfCApK6kMBmFg5eDFVCDiq4eqwVqUcw0Vx9VV+O6pKwqt7febXP5ugkbRVkINhvJRvw+MEwhFtX8htm7bQwABPbwoKVwGDQf3IAC82hZX3pf0BwL9GrIXdF0n4EulsqHCBHrvj8k9XIgPpB0-MNfrjebrenAGkILX+AAeXcd5BNltQf0APjPp4hSoOu+0ymQAGsDxgYMhnxZi55pm0DcG2QABRCs4AAMV2fYAElwFhPBbjPcC9BwYEj20C8dzBfdDwAGm0D9ay-GFVXhadaGvdcaBgHAQG5eQFQbfAADkAIAClYH5-1sABKChHntGhfhYsB2NsDjtEpEAFRIOBthgo44AOF5EKQLBGRUsCIOgiA9n4eCSHI25CJoPjRCAA)

This is a good way to lean on TypeScript to help you maintain invariants in your code. It's probably worth adding an explanatory comment where you use it, as I don't think it's a very common pattern.
