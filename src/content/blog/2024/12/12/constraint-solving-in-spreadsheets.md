---
title: Constraint Solving in Spreadsheets
date: 2024-12-12
description: Can we create a tool that allows users to specify constraints in a spreadsheet and then solve them?
category: blog
tags: [programming, optimization, linear programming, user-interface]
---

Constraint optimization tools are underused. As far as I can tell, they're used in niche applications like shipping logistics, but not for everyday tasks like seating arrangements for a party. They're a powerful tool, but definitely hard to use.

I found a couple of examples of people applying constraint optimization to everyday problems:

- [Wedding seating arrangements](https://blogs.sas.com/content/operations/2014/11/10/do-you-have-an-uncle-louie-optimal-wedding-seat-assignments/) (many examples like this)
- [Scheduling rowing outings](https://www.danielhugenroth.com/posts/2022_03_glpk_tutorial/)
- [Scheduling operating rooms](https://towardsdatascience.com/schedule-optimisation-using-linear-programming-in-python-9b3e1bc241e1)

I've written about a couple of others:

- [Scheduling conference talks to avoid conflicts](../../../2024/11/07/scheduling-conference-talks-lp.md)
- [Scheduling medical rotations in a residency](../../../2019/01/26/residency-scheduling.md)

How would a non-programmer approach these problems? Imagine you're making a shift schedule for a local cafe. It seems unlikely that you would reach for a constraint solver. You're probably going to work it out by hand, or use Excel (but only as a grid—not for computation).

This seems like a missed opportunity. Isn't this what computers are supposed to be for? To help us with tedious tasks like this? [Here's a reddit post](https://www.reddit.com/r/learnprogramming/comments/161lkex/complicated_linear_programmingsolver_type/) from someone trying to solve this problem for 7 employees and 5 shifts and they say, "we do the schedule by hand, and it's excruciating."

Ink & Switch wrote about this in their post, [Untangle: solving problems with fuzzy constraints](https://www.inkandswitch.com/untangle/). They describe a tool that allows hand drawing on a table, creating constraints with something they call "visual queries". It's a great post! The strangeloop presentation has a great demo. However, I'm interested in problems that might be a little larger in scope—big enough to warrant a spreadsheet.

## Formulating the problems as linear programs

For all of the problems above, we'd like to assign elements from one set to another.

- In the wedding seating problem, we want to assign guests to tables.
- In the conference talk scheduling problem, we want to assign talks to `(venues X time_slots)`—the Cartesian product of venues and time slots.
- In the residency scheduling problem, we want to assign residents to `(rotations X time_slots)`.
- In the rowing outing problem, we want to assign rowers to outings.

In order to formulate these problems as linear programs, we can define indicator variables. For example, in the rowing problem the author defines `x[i,j] = 1 means rower i is assigned to outing j`.

This seems general enough to tackle a wide variety of problems, though it's less expressive than linear programs in general. We should be able to hide this implementation detail from end-users.

## Visualizing the solution

Let's use the rowing outing problem as an example. If we wanted to solve this by hand, we might start by laying out a grid of rowing positions and outing days, then start writing names into place.

|        | Mon | Tue | Wed | Thu |
| :----: | :-: | :-: | :-: | :-: |
| Coach  |     |     |     |     |
|  Cox   |     |     |     |     |
|  Bow   |     |     |     |     |
| Stroke |     |     |     |     |

You might have some erasing to do as you go along. Maybe Steven can't make it to Tuesday, and would prefer not to row on two consecutive days. You might pencil him in for Monday and Wednesday, making a note that you could move him from Wednesday to Thursday if you needed.

|        |  Mon   | Tue |           Wed           | Thu |
| :----: | :----: | :-: | :---------------------: | :-: |
| Coach  |        |     |                         |     |
|  Cox   |        |     |                         |     |
|  Bow   | Steven |     | Steven (or move to Thu) |     |
| Stroke |        |     |                         |     |

You might also add a note showing who is available for each of the positions.

|        |  Mon   | Tue |           Wed           | Thu |                       who?                        |
| :----: | :----: | :-: | :---------------------: | :-: | :-----------------------------------------------: |
| Coach  |        |     |                         |     |                 Stacy<br>Donovan                  |
|  Cox   |        |     |                         |     |                  Grace<br>Quinn                   |
|  Bow   | Steven |     | Steven (or move to Thu) |     | Jack<br>Karen<br>Liam<br>Ethan<br>Carla<br>Steven |
| Stroke |        |     |                         |     |  Noah<br>Peter<br>Mia<br>Aisha<br>Carlos<br>Jack  |

You could go on adding notes like this, trying to make sure that everyone is happy with the schedule like you're solving a Sudoku puzzle. But what if you could make those notes into computable rules? The computer could propose solutions, and you could tweak them and see updated proposals in response.

The idea I have is that every cell can accept some combination of

- a value (like a name, or a list of names)
- a formula that constrains the value. For example,
  - "if the cell to the left contains 'Steven', this cell may not", or
  - "each name may appear at most once in a column—no one can row two positions on the same outing")
- A formula that expresses a preference. For example,
  - "Jack prefers to row Bow, but is willing to row Stroke" _I don't know anything about rowing, is this reasonable?_
  - Kathleen would like to take vacation during the first week of July
- A computer-proposed value consistent with the constraints

## Aside: UCSF Medical Residency Scheduling

_Question for early readers: is this section useful? Should I just cut it?_

After I wrote my first post on scheduling medical rotations in a residency, I got an email from the chief resident at the pediatrics residency at UCSF. They were working on the same problem, but for around 70 residents (I originally wrote about a residency with 12 people). They hired me to work on the problem with them.

Things mostly progressed pretty well. I was stuck for a little while because `cbc`—the open-source solver that is pulp's default—was too slow to tackle the problem. I switched to CPLEX and made more progress.

A bigger issue was in clarifying rules. I kept finding that the problem was infeasible—had no solution under the constraints. Sometimes that was a bug in my code, but often it was because the residency program had asked me to implement rules as hard constraints that were actually best effort. For example, a rule might have said "only third year residents may staff the NICU", but there aren't enough third year residents to staff it in light of their other curricular needs. Bringing this back to the program, they might clarify that second year-residents who were at least 8 months into their second year could fill in if needed.

This back-and-forth characterized much of the project, and lead to its taking much longer than I'd anticipated. I came to think of myself as a middleman between the residency program and the linear program. Much better would be if the program coordinator could write the rules themselves and get interactive feedback when a constraint couldn't be satisfied.

In order to speed up the turn-around, the chief resident put together a very complicated google sheet that could check a proposed schedule for many of the rules. In the main part of the spreadsheet, I could paste the output from my python program. The spreadsheet would color-code it, and use it to calculate two sections of sanity checks. The first sanity checks were about staffing needs. They added up the number of residents assigned to each of the services and compared it to the number of residents needed. The second sanity checks were about curriculum requirements. They added up the number of two-week blocks of each rotation and ensured that each resident had the right number of each type of rotation.

![UCSF Pediatrics Residency Schedule Checker. Described in a paragraph above](./ucsf-schedule-checker.png)

This got me thinking: can we move the whole process into a spreadsheet? Can we create a tool that allows users to specify constraints in a spreadsheet and then solve them?

## Spreadsheet-based constraint solving

Spreadsheets are the most powerful end-user programming tool in the world. Nearly everyone who would be helped by a tool like this is already using a spreadsheet for it (though the spreadsheet isn't helping them solve the problem). What is good about spreadsheets that we can leverage for this problem?

### Co-located data and rules

Traditional software abstracts over the data, storing it separately in a file or database or API. Only the computation is described in the code. Spreadsheets, on the other hand, have the data and the computation in the same place. I suspect this is more intuitive for people, as they're familiar with the data—those are the names of people or rooms or shifts: something from the domain.

Laying out the data also offers a tidy way to locate the rules. I'll show an example using the [conference talk scheduling problem](/blog/2024/11/07/scheduling-conference-talks-lp) I wrote about last week. Here's a portion of the "talks" table from that problem:

| Title                                                                            | Duration |
| -------------------------------------------------------------------------------- | -------- |
| Beyond Syntax: Designing Languages for Human Cognition                           | 20m      |
| From Models to Applications: Practical AI for the Everyday Developer             | 20m      |
| Ethical AI: Balancing Innovation with Responsibility in Machine Learning Systems | 50m      |
| Transformers Unleashed: Revolutionizing NLP Beyond Text                          | 50m      |
| Rethinking State Management: Beyond Redux in Modern Web Apps                     | 50m      |
| WebAssembly: Unlocking Native Performance in the Browser                         | 20m      |

One rule we want to apply is that each talk should be scheduled exactly once. In a spreadsheet there's a natural place to put this rule: in a column to the right of the table.

How might this look? Thinking about the indicator variables from [above](#formulating-the-problems-as-linear-programs), we want each row to be associated with the set of indicator variables that are "on" for that row's value. For the talks table, imagine there's a magic variable `X` that consists of a set of all `(venue, time_slot)` pairs associated with each talk. So for the "Beyond Syntax" talk, if `X` is `{(Madrona, 9:30), (Madrona, 10:00), (Fir, 12:00)}`, we understand that the "Beyond Syntax" talk is scheduled in the Madrona conference room at 9:30 and 10:00, and in Fir at 12:00.

Let's think about constraints as constraining the value of this `X` variable, and try to write a rule that says, "each talk is scheduled exactly once". We can write this as a formula (with made-up functions `CONSTRAIN` and `LENGTH`) in a cell to the right of the table:

```scala
=CONSTRAIN(LENGTH(X) = 1)
```

That defines a constraint for one talk. To apply it to every talk, we can copy-paste the formula down the column. This is how we can accomplish looping in spreadsheets!

Some of the talks are 50 minutes long, so they actually need two consecutive time slots. Leaving aside the 'consecutive' part, let's adjust the formula to allow for this:

```scala
=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2)))
```

This uses the `RC` notation to refer to the cell in the same row and one column to the left. The `IF` function checks the duration of the talk and sets the constraint to 1 if it's 20 minutes and 2 if it's 50 minutes.

| Title                                                                            | Duration | Schedule for one time slot (two for 50m talks)     |
| -------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| Beyond Syntax: Designing Languages for Human Cognition                           | 20m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |
| From Models to Applications: Practical AI for the Everyday Developer             | 20m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |
| Ethical AI: Balancing Innovation with Responsibility in Machine Learning Systems | 50m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |
| Transformers Unleashed: Revolutionizing NLP Beyond Text                          | 50m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |
| Rethinking State Management: Beyond Redux in Modern Web Apps                     | 50m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |
| WebAssembly: Unlocking Native Performance in the Browser                         | 20m      | `=CONSTRAIN(LENGTH(X) = IF(RC[-1] = "20m", 1, 2))` |

#### Constraints on the combination of two tables

Most of the constraints make sense at the intersection of two tables. For example, we might want to make sure that no two talks are scheduled in the same room at the same time. For that, we'd need to create a view reflecting the cross-product of venues and time slots.

|         | Aspen | Fir | Madrona |
| ------- | ----- | --- | ------- |
| 9:00am  |       |     |         |
| 9:30am  |       |     |         |
| 10:00am |       |     |         |
| ...     |       |     |         |

Given this view, we can write a simple formula that looks at the `X` variables for each talk:

```scala
=CONSTRAIN(LENGTH(X) <= 1)
```

Copy-pasting this across the grid will enforce that no venue is double-booked for any time slot.

![A table of venues X times, as above. Each interior cell has the LENGTH(X) <= 1 formula](./formula-no-more-than-one-talk-in-a-room.png)

#### Revisiting the consecutive time slots constraint

Now that we've explored constraints on the combination of two tables, we can revisit the "50 minute talks need two consecutive time slots" constraint. We can write a formula that creates a constraint relating a pair of time slots.

We'd like to say something like

> If the talk is 50 minutes, then one of the following must be true:
>
> - The talk is scheduled for this time slot and the next time slot
> - The talk is scheduled for this time slot and the previous, or
> - The talk is _not_ scheduled for this time slot

Imagine we have the following table:

| Title                                                                            | Duration | 9:00am | 9:30am | 10:00am | 10:30am | 11:00am | .... |
| -------------------------------------------------------------------------------- | -------- | ------ | ------ | ------- | ------- | ------- | ---- |
| Beyond Syntax: Designing Languages for Human Cognition                           | 20m      |
| From Models to Applications: Practical AI for the Everyday Developer             | 20m      |
| Ethical AI: Balancing Innovation with Responsibility in Machine Learning Systems | 50m      |
| Transformers Unleashed: Revolutionizing NLP Beyond Text                          | 50m      |
| Rethinking State Management: Beyond Redux in Modern Web Apps                     | 50m      |
| WebAssembly: Unlocking Native Performance in the Browser                         | 20m      |

Let's try and build each part of that formula, as it would appear in the 9:30am cell for the "Beyond Syntax" talk (we'll leave the 9am column blank because it doesn't have a previous time slot, so the pattern breaks).

"If the talk is 50 minutes" can be written as `=IF($B2 = "50m", ..something..)`. Here, we use `$B` to always refer to the duration column, rather than implying "the column a couple to the left"

"The talk is scheduled for this timeslot and the next" is written `X = RC[1]`, and "the talk is scheduled for this timeslot and the previous" is `X = RC[-1]`. We can combine these with an `OR` function.

Finally, "the talk is not scheduled for this time slot" is `LENGTH(X) = 0`. That is, there are no (talk, venue, timeslot) triples where the talk is "Beyond Syntax" and the timeslot is "9:30am". Putting this all together, we'd have:

```scala
=IF($B2 = "50m", // Only consider 50m talks
  CONSTRAIN(OR( // one of the following must be true
    X = RC[1], // the talk is scheduled for this time slot and the next
    X = RC[-1], // the talk is scheduled for this time slot and the previous
    LENGTH(X) = 0 // the talk is not scheduled for this time slot
)))
```

Copying this formula across the grid will enforce the constraint that 50 minute talks are scheduled in consecutive time slots.

### Multiple views on the same data

Every cross-product view of the data can have a different set of constraints. In our example, these are some of the constraints we created on different sheets:

- one talk at a time in each room
- 50m talks need two sequential slots
- schedule each talk exactly once

Each of these constraints is written in a different place in the spreadsheet, but they all refer to the same underlying data. That is, they're all constraining the same triples of `(talk, venue, timeslot)`. Spreadsheets (as far as I know) don't usually work this way.

## Digging into the formula language

The idea of using formulas to specify constraints is one I'm happy with. Traditional formulas like `=AVERAGE(B2:B10)` exactly specify the value for that cell. Constraint formulas don't specify an exact value, but they narrow down the allowable values that might appear in the cell.

However, I feel that there's a lot of room to improve the semantics and construction of the formula language. Some of the issues are inherited from Excel, and I'm not sure how much it's possible to break compatibility while still being useful to people who are already familiar with Excel.

### Magic `X` variable

The magic `X` variable is a bit of a hack. It's not a real variable in the spreadsheet, but it's a stand-in for the possible values that could appear in a given cell. In javascript, we might use a callback instead, something like

```typescript
constrain((x) => expect(x.length).toEqual(1));
```

### Evaluation semantics

Consider an expression like `LENGTH(X) <= 1` in a cell for row "9:30am" and column "Aspen". Excel's semantics would have this evaluate `LENGTH(X)`, producing a number, then compare that number to 0 giving a boolean.

For our purposes, we need the whole expression to be preserved so we can convert it into linear constraints. With this example, we'd change it to be something like `sum(X[t,"Aspen", "9:30am"] for t in talks) <= 1`. There's no way to convey that much information if we boil the expression down to a boolean.

Other tools have a similar need to manipulate or interrogate expressions without evaluating it. `pulp` overloads the arithmetic operators to create an `LpAffineExpression` or `LpConstraint` object. `pytest` rewrites the AST of your test functions to be able to log the value of different parts of a failed assertion. Many languages have macros that allow manipulating the code before evaluation.

I don't know how to make this happen in a spreadsheet. It probably won't work the way I've described it in the earlier sections.

### Attributes of implicit variables

Looking back on the consecutive time slots constraint, we cheated a little bit. Our rule depends on whether the talk is 50 minutes long, so we repeated that column next to the talk name to make it easy to refer to. In a larger problem, like the UCSF residency program, we might have enough columns of data to make this unwieldy. Here are some of the data associated with each resident from that problem:

- Class in 2023-24 academic year—either R1, R2, R3, FT (fast track), or Gen (Genetics track)
- whether or not the resident applied to be chief resident
- Track, which implied slightly different curriculum requirements
- Clinic day. Residents were unable to staff clinic during some rotations, so we had to make sure that we didn't pull all the Monday residents onto one of those rotations during the same month.
- Whether the resident was applying to fellowship (and would need time off to travel to interviews)
- Whether the resident had requested particular electives
- How many weeks of each curriculum requirement they had completed up to now.

And some others that are difficult to describe. All told, there were 31 columns of data for each resident. It would be nice to avoid copying the data into every view where we needed to reference it. Excel does offer a way to look up a value in another table (`VLOOKUP`, `XLOOKUP`, index-match-match are the ones I'm aware of), but none of them are very easy to use. For example, here's a formula for our 50 minutes talk constraint.

```scala
=IF(
  INDEX(talks, MATCH($A2, talks), MATCH("Duration", talk_headers)) = "50m",
  CONSTRAIN(OR(
    X = RC[-1],
    X = RC[1],
    LENGTH(X) = 0
  )))
```

Even this is slightly simplified. It assumes we have a named region called `talks`.

Better would be if we could refer to attributes of the implicit variables more directly. In a cell at the intersection of the "talks" rows and "timeslots" columns, it would be convenient to write a formula more like `=IF(talk.duration = "50m", ...)`.

### A separate language

Taken together, these adjustments to the formula language (implicit variables depending on position, deferred evaluation of expressions, dotted attribute access) make me think we may need a different language altogether. I'm not sure how to make this work in a spreadsheet. We can wholesale replace the formula language, but a lot of the benefit of using a spreadsheet is the familiarity. Some of that is lost if we introduce a new language.

Maybe we could have a separate language scoped within certain syntax? For example, we could use a different character than `=` to start the new style formulas.

## Computer voice

We've said that a cell can contain a user-specified value, a formula constraining the values in that cell, or a computer-suggested value. The [ink and switch article refers to suggested values as _computer voice_](https://www.inkandswitch.com/untangle/#responses-from-the-computer-are-under-designed).

The computer has a few types of feedback it may surface:

- "This is the only value that satisfies the constraints"
- "This value satisfies the constraints, but there are other values that also satisfy the constraints"
- "There is no value we can put here that satisfies all the constraints. In particular, these are the ones in conflict"

All of these should be stylized differently, and offer different affordances. A suggested value should be dismissable or offer another way to see alternatives. An over-constrained cell should offer a way to click-through to see which constraints are in conflict.

I haven't had a chance to mock up a prototype for this, but the Ink & Switch video does a good job of showing some possibilities.

## Conclusion

This feels like a tool that should exist in some form. Mentally juggling constraints and finding a solution that satisfies that can be a fun puzzle, but it's also the sort of thing that computers should be helping us with. This is a bicycle for the mind that could eliminate some drudgery.

Please reach out if you have feedback or suggestions on how to refine or implement this idea. You can email me at `bgschiller@gmail.com`.
