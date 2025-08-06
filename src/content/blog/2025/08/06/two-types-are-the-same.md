---
title: two types are the same
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

assertNever(
  "some field isn't listed" as UncoveredReadableFields,
);
```

Try it out in a [Typescript Playground](https://www.typescriptlang.org/play/?#code/PTAEEsFsEMHNwHYFNQBcAW4DOEcBMkAzRJPCBULAe0hQBtwAjAJ2mYE8AaSq0dqgK6gAxtAQByVAFgAUCFAFiyNOhTMBCVFHrZUoaHSoJYWcAQjSZqdgAcUAJSTQ80RnSQAxcEjpkAvKDiCNC04qAAPoFIMOB0YZHiNuhGSPGBZuKysvIIVADuoHmpzCiIoILM5XkUwlQEAHSgACocIuhi8MbZYBgoAG4GAkg4ZRjYoAxYqI0AmoKUyQK+lEgoYqAAoszMVMzdoIS7+gjsoEgAHqis5ZWQ2KbGoAN0Q1j1srUIU6Alzq7uXh8eBwAQA2rJQIFgqFuOJotBYuJYUkUkj0nhMjIALr6HCfb5YaBaLDEYagRx-Nyeby+UFYrIyWTWOygACqCFqfSQJTwFJcVMBvhBm3OwheBAAPBDyU5+QCaXhONLmUgqIQfrL-tSgVhQQgBJBGNz6TIAHwM6BYLDc1AAOSQXOYAAoAETUWgHBW4CR6SaoUgu3FsjlUR2kPlawXAgCUAG4GYQNMItEZcdbmHaHdynecAFygZCO6P5wvc0AAb2V6B2BWQBS2O2dAAMNBc7MnSCJLUh8wAScvnAC+TejskHQA). You should see that adding an extra field will cause an error because the list will no longer `satisfies ReadableField[]`. Omitting a field will also cause an error because `UncoveredReadableFields` will not be the `never` type.

If you don't have an `assertNever` function, you can define it as `function assertNever(x: never): never { throw new Error("Unexpected value: " + x) }`.

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
  keyof SaferMetric,
  keyof ProductMetric
>;

assertNever(
  "an extra field was introduced" as ExtraFieldsIntroduced,
);
```

This is a good way to lean on TypeScript to help you maintain invariants in your code. It's probably worth adding an explanatory comment where you use it, as I don't think it's a very common pattern.
