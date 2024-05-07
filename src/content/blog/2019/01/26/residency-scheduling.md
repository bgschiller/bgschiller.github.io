---
title: Scheduling a Medical Residency using Python
category: blog
tags: [programming, optimization, python]
date: 2019-01-26
description: Using linear programming to schedule a medical residency program
---

Last year, Morgan was given the responsibility of planning the schedule for her residency program—who would be working which rotation each month. She was describing all the requirements: "Everyone has to do three months of FMS", but "No one can do more than two months of FMS in a row". "Everyone has to do a month of School-based Peds", but "No one can do School-based Peds in July or August (no school)".

As she described the difficult constraints, I was quietly nursing a geeky excitement. This sounded like a great problem for a computer to solve! I asked if I could take the scheduling task off of Morgan's hands, and she graciously agreed.

Normally, the scheduling is done by hand, moving around index cards or spreadsheet cells and mentally checking the constraints one at a time. Morgan's program has only 12 residents, so it takes only a few hours. But some of the other programs have 40 or more residents, and I'm told it's the work of several long evenings for a group of people.

I set to work writing a program to generate the best possible schedule given the constraints and everyone's schedule preferences ("I want to be on vacation in September", "I'd like to do OB as soon as possible"). To avoid burying the lede too far, the schedule came out great! We were able to satisfy all the constraints, as well as _every single resident request_.

With scheduling season coming up again, I thought it would be worthwhile to write up my method. If it helps you, I'd love to hear about it! Please write me an email at `brian (a) brianschiller.com`.

Note: if you don't care about how all of this works, and just want an optimal residency schedule without fussing over it, [click here](#hire-me-to-do-it)

## The problem

There are a couple of general types of constraints I identified: curriculum constraints and staffing constraints.

In addition, each resident likely has some preferences about their schedule. We'll do our best to ensure that each resident has approximately the same influence over the final model. If Tim makes 6 schedule requests but Laura only makes one, Laura's one request should be given greater importance than any of Tim's.

### Curriculum constraints

In order to graduate residency, the curriculum requires that every year-two resident do:

- 3 months of FMS
- 2 months of Elective
- 1 month of Inpatient Peds at either CHCO or DH
- etc...

### Staffing constraints

The residency program has an obligation to staff various teams with specific numbers of residents each month:

- In December, 1 person must be scheduled for Inpatient Peds at each of CHCO and DH
- 1 person must do School-based Peds each month, other than June and July (when there is no school and 0 people should be scheduled)
- 3 people must do FMS in August
- etc...

### Resident preferences

To collect everyone's preferences, Morgan sent out an email:

> Hey Friends! So excited to be looking ahead to this next stage in our residency training, and so excited we get to do it together!
>
> Here's a brief summary of the way I'm planning to do this:
>
> - You will all send me your scheduling requests (see details below)
> - Brian has developed a computer program that will accept everyone's preferences and the schedule requirements and will produce a tentative schedule
> - I will send out the computer-generated tentative schedule for everyone to review, then we can make additional changes as desired.
>
> Using the requirements that Amelia sent out, please send me a list of your schedule preferences. This should not be example schedules, but rather characteristics that you would like in your schedule. Here is an example:
>
> #1 "I want to be on outpatient in March"
>
> #2 "I would like my electives to be in October and February"
>
> #3 "I would like to do MICU in July, August, or September"
>
> Please rank your requests in order of importance. Note that by making more requests, the requests that you make will be relatively diluted (i.e. if I have 4 requests and Alicia has 1 request, Alicia is more likely to get her 1 request than I am to get my #1 ranked request). If there are any requests that you have that are absolute musts (i.e. "I'm getting married in April and absolutely need that month as an elective"), please let me know.
>
> Using everyone's ranked requests and the requirements laid out by the residency, the computer program will spit out a schedule that balances total happiness and fairness to produce a schedule. If you're curious, Brian is using a method called linear optimization, and he would be thrilled to talk to you about it if you have questions 😉

The resident preferences came in many forms. I'll list some basic ones, as well as a couple that were more difficult to achieve.

- Naomi would like a vacation-eligible month in September
- Anita would like as many DH months as possible (Inpatient Peds and MICU can both be done at either DH or UH)
- Alicia would like no two FMS months in a row
- Anita would like, as much as possible, alternating months of inpatient and outpatient throughout the year.

### Other rules

There were a few other constraints that didn't fit neatly into one of these categories. The residents are divided into two groups: Denver Health track and University Hospital track. All DH track residents must do PTF during the same month, and it must be different from the month when all UH track residents do PTF.

Additionally, the program expressed a preference (but not a hard constraint) that DH residents should rotate at DH when there is an option, and similarly UH residents should rotate at UH when possible.

## The Model

I decided to approach this as an Integer Lineary Programming problem. Since fast and well-tested libraries already exist for solving Linear Programming problems, this meant my work was reduced to phrasing the problem in LP terms.

LP doesn't operate at levels like "What does John's schedule look like?", or "Try to schedule Anita for alternating inpatient/outpatient". Instead, we choose variables to represent the outcome, and then write equations that represent our goals and constraints in terms of those variables.

The core variables I decided to work with were all of the form:

```
<resident> will work <rotation> during <month> (True/False)
```

With a value like that for every combination of resident, rotation, and month we are able to describe every constraint and goal. In python, using the `citrus` library (a small convenience wrapper around `pulp` that I wrote), we define our variables like so:

```python
import citrus
import pulp


MONTHS = [
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
]

OUTPATIENT_ROTATIONS = VACATIONABLE_ROTATIONS = [
    'Elective', 'Gyn', 'MSK-1',
    'School-based Peds', 'PTF',
]
INPATIENT_ROTATIONS = [
    'FMS', 'OB',
    'Inpatient Peds CHCO',
    'Inpatient Peds DH',
    'MICU-DH', 'MICU-UH',
]
ROTATIONS = INPATIENT_ROTATIONS + OUTPATIENT_ROTATIONS


DH_RESIDENTS = [
    'John', 'Morgan', 'Anita', 'Alicia',
]
UH_RESIDENTS = [
    'Kenny', 'Jeff', 'Cristi', 'Naomi', 'Steve', 'Alisa',
]
RESIDENTS = DH_RESIDENTS + UH_RESIDENTS

model = citrus.Problem('pgy2-schedule', pulp.LpMaximize)
x = model.dicts(
  'x',
  ((month, rotation, resident)
    for month in MONTHS
    for rotation in ROTATIONS
    for resident in RESIDENTS),
  cat=pulp.LpBinary)

# x['Jul', 'FMS', 'John'] represents the True/False
# value: "John is on FMS during July"
```

### Curriculum constraints

To express our curriculum constraints, we combine the variables we just made into statements about how many are true. To say "Cristi must do 3 months of FMS", we write:

```python
model.addConstraint(
  sum(x[month, 'FMS', 'Cristi'] for month in MONTHS) == 3,
  "Rabaza must do 3 months of FMS")
```

Since _all_ residents must do 3 months of FMS, we can put this code into a loop.

```python
for resident in RESIDENTS:
  model.addConstraint(
    sum(x[month, 'FMS', resident] for month in MONTHS) == 3,
    f'{resident} must do 3 months of FMS')
```

Most of the others are similar. It is a little more difficult to say "Each resident must do 1 month of _either_ MICU at DH or MICU at UH.

```python
for resident in RESIDENTS:
  model.addConstraint(
    (
      sum(x[month, 'MICU-DH', resident] for month in MONTHS) +
      sum(x[month, 'MICH-UH', resident] for month in MONTHS)
    ) == 1,
    f'{resident} must do 1 month of MICU')
```

### No Time-Turners Constraints

This is the rule that says no resident can do more than one rotation in a month. Intuitively, this seems to go without saying. However, since we've reduced the problem to a bag of True/False value, the computer ascribes no meaning to the variables other than what we tell it. We have to spell it out.

```python
for resident in RESIDENTS:
  for month in MONTHS:
    model.addConstraint(
      sum(x[month, rotation, resident] for rotation in ROTATIONS) == 1,
      f'{resident} can only do one rotation during {month}')
```

### Staffing Constraints

> For FMS we need 2 residents in July, 3 in August, 2 in September, ...

```python
fms_numbers = {
    'Jul': 2, 'Aug': 3, 'Sep': 2, 'Oct': 2,
    'Nov': 3, 'Dec': 3, 'Jan': 2, 'Feb': 2,
    'Mar': 2, 'Apr': 3, 'May': 3, 'Jun': 3,
}
for month in MONTHS:
    fms_num = fms_numbers[month]
    model.addConstraint(
        sum(x[month, 'FMS', resident] for resident in RESIDENTS) == fms_num,
        '{} residents on FMS in {}'.format(fms_num, month))
```

### Resident preferences

These were by far the most interesting pieces to phrase in terms of a linear program. The first thing to notice that that a _preference_ is decidely different than a _constraint_. The program will give up entirely if it cannot achieve a constraint, but a preference it will only achieve if it's possible.

Linear Programming can handle preferences in the form of the Objective Function. Way back at the start of the code, we wrote `model = citrus.Problem('pgy2-schedule', pulp.LpMaximize)`. That `pulp.LpMaximize` bit is saying "Make the objective function as big as possible. We can express each residents preferences by giving them a term in the objective function.

```
MAXIMIZE
  naomi's prefs +
  morgan's prefs +
  steve's prefs +
  ...
SUBJECT TO
  curriculum constraints,
  staffing constraints,
  time-turner constraints
```

But what happens if Morgan is just more picky than Steve, and lists more preferences? We need some way to try to regulate the amount of influence each resident has on the objective function.

#### Influence limits

I decided to cap each resident's influence at One. One what, you might ask? Well, one objective-function-unit. The unit is arbitrary, we just have to be consistent. For some LP problems, the objective function represents dollars or some other real value. For this problem, we can think of it as "total resident satisfaction".

I also wanted to allow folks to rank their preferences. If Alicia lists 3 preferences in order of how much she cares about them, the model should take into account how important each item is to her.

With this in mind, we came up with this weighting scheme, where the sum of the weights is equal to 1:

- two preferences: 2/3, 1/3
- three preferences: 3/6, 2/6, 1/6
- four preferences: 4/10, 3/10, 2/10, 1/10
- ...and so on

#### Example Resident objective terms

##### Anita's Goal

> Highly preferred:
>
> #1 A vacation-able month in December
>
> Also would be nice:
>
> #2 Maximum DH months (i.e., MICU, Peds)
>
> #3 Alternating months of inpatient and outpatient throughout the year, within reason (like two consecutive months of either is not a big deal)

The first two were not too difficult—I gave 3/6 of Anita's influence to #1 and 2/6 to MICU and Peds at DH (1/6 each). The hard part was the "alternating months of inpatient and outpatient". I decided to interpret that as "no two inpatient in a row", since there are 6 inpatient and 6 outpatient months.

```python
anita_objective = (
  3/6 * sum(x['Dec', rotation, 'Anita'] for rotation in VACATIONABLE_ROTATIONS) +
  1/6 * sum(x[month, 'MICU-DH', 'Anita'] for month in MONTHS) +
  1/6 * sum(x[month, 'Inpatient Peds DH', 'Anita' for month in MONTHS) +
  1/6 * no_two_inpatient_in_a_row('Anita')
)
```

So, how to define that `no_two_inpatient_in_a_row` function using linear constraints that our solver can understand? We can say "For the two consecutive months `m1` and `m2`, they should not both be inpatient". We also want to make sure that the term we return from this helper function is never more than one, and is exactly one when all the subgoals are met. That's the reason for using `avg` rather than `sum` on the last line.

```python
def no_two_inpatient_in_a_row(resident):
  sequential_inpatient = []
  for m1, m2 in zip(MONTHS, MONTHS[1:]):
    m1_is_inpatient = # something...
    m2_is_inpatient = # something...
    both_are_inpatient = m1_is_inpatient & m2_is_inpatient
    sequential_inpatient.append(negate(both_are_inpatient))
  # avg rather than sum below because each of
  # "NOT (Jan inpatient & Feb inpatient)" is a request
  return avg(sequential_inpatient)
```

So now we need to construct the `m1_is_inpatient` term. We can do this by summing over the `INPATIENT_ROTATIONS` list. Even though that will be the sum of 6 terms, each one represents Anita working during a particular month, so they're all mutually exclusive. This means we're safe to use `sum` instead of `avg` here.

```python
m1_is_inpatient = sum(x[m1, rotation, resident] for rotation in INPATIENT_ROTATIONS)
m2_is_inpatient = sum(x[m2, rotation, resident] for rotation in INPATIENT_ROTATIONS)
```

That's it for Anita's requests, so we'll save off the value of her objective function term.

```python
resident_objective.append(anita_objective)
```

This part felt a little bit more like an art than a science. There's more than one way to do things. For example, I originally used an `or_all` function instead of the `sum` when defining `m1_is_inpatient`, because I hadn't thought through how the constituent terms were mutually exclusive.

##### Kenny's Goal

> 1. A vacationable rotation in September (preferably an elective, but Gyn, MSK-1, or school Peds would work, too).
> 2. Something outpatient in December (elective, Gyn, MSK-1, or school Peds).

Originally, I wrote the following:

```python
kenny_objective = (
  3/6 * x['Sep', 'Elective', 'Kenny'] +
  2/6 * sum(x['Sep', rotation, 'Kenny'] for rotation in ('Gyn', 'MSK-1', 'School-based Peds')) +
  1/6 * sum(x['Dec', rotation, 'Kenny'] for rotation in ('Elective', 'Gyn', 'MSK-1', 'School-based Peds'))
)
resident_objective.append(kenny_objective)
```

However, look at those first two terms. They're both concerned with the rotation Kenny will do in September, which means they can never both be satisfied. This meant that Kenny's influence over the Objective Function would never be more than 4/6. I adjusted the weights to the following:

```python
kenny_objective = (
    2/3 * x['Sep', 'Elective', 'Kenny'] +
    1/3 * sum(x['Sep', rotation, 'Kenny'] for rotation in ('Gyn', 'MSK-1', 'School-based Peds')) +
    # Prior two conflict, so it's okay that the weights sum to over 1
    1/3 * sum(x['Dec', rotation, 'Kenny'] for rotation in ('Elective', 'Gyn', 'MSK-1', 'School-based Peds'))
)
resident_objective.append(kenny_objective)
```

##### Cristi's Goal

> 1. MICU as early as possible
> 2. Ob as early as possible
> 3. school based Peds in December

Another challenge! How to write `as_early_as_possible` in terms of an LP? It should produce a term that evaluates to one if Cristi is on MICU during the first month, and decrease smoothly from there.

```python
def as_early_as_possible(resident, rotation):
  divisor = len(MONTHS) - 1
  weights = [w / divisor for w in reversed(range(len(MONTHS)))]
  # weights is [ 11/11, 10/11, ... 1/11, 0/11]
  return sum(w * x[month, rotation, resident] for w, month in zip(weights, MONTHS))
```

Now to get the weights right. One complication is that MICU is offered at both DH and UH, but Cristi will only take it once. This is a similar case to Kenny's where the goal terms will be mutually exclusive, so it's okay that they look like they add up to more than one.

```python
cristi_objective = (
  3/6 * as_early_as_possible('Cristi', 'MICU-DH') +
  3/6 * as_early_as_possible('Cristi', 'MICU-UH') +
  2/6 * as_early_as_possible('Cristi', 'OB') +
  1/3 * x['Dec', 'School-based Peds', 'Cristi']
)
resident_objective.append(cristi_objective)
```

#### Fairness term

This is starting to verge into over-engineering territory, especially since all of every resident's preferences ended up being satisfied. But I had to do something while I was waiting for the emails to come in!

I wanted to make sure that, if all of a resident's preferences couldn't be satisified, that they at least got _something_ they had asked for. This is the purpose of including a fairness term, which I defined as "Ten times the minimum of the residents' objective terms".

This definition is a way of ensuring that no individual would be left behind by the optimization. Since the LP solver has, again, no knowledge of the situation, one 0.5 improvement to the objective function looks the same as another. With the fairness term, we ensure that the improvement to the worse-off resident (in terms of which of their prefs had been met) would be prioritized.

```python
fairness_objective = 10 * minimum(*resident_objective, name='least satisfied resident goals')
```

#### Program goals

The program also expressed some goals: DH residents should do Inpatient Peds and MICU at DH, UH residents at UH. I decided to give these minimal weight compared with the residents' goals.

```python
program_objective = (
  # Prefer to have DH residents doing Inpatient Peds DH
  avg([x[month, 'Inpatient Peds DH', resident]
    for resident in DH_RESIDENTS
    for month in MONTHS]) +

  # Prefer to have UH residents doing Inpatient Peds CHCO
  avg([x[month, 'Inpatient Peds CHCO', resident]
    for resident in UH_RESIDENTS
    for month in MONTHS]) +

  # Prefer to have DH residents doing MICU-DH
  avg([x[month, 'MICU-DH', resident]
    for resident in DH_RESIDENTS
    for month in MONTHS]) +

  # Prefer to have UH residents doing MICU-UH
  avg([x[month, 'MICU-UH', resident]
    for resident in UH_RESIDENTS
    for month in MONTHS])
)
```

#### Solving the problem

```python
model.setObjective(
  program_objective +
  sum(resident_objective) +
  fairness_objective
)

model.solve()
if pulp.LpStatus[model.status] != 'Optimal':
  raise ValueError(pulp.LpStatus[model.status])

data = [{
    'resident': resident,
    'month': month,
    'rotation': max(ROTATIONS, key=lambda r: x[month, r, resident].varValue),
} for resident in RESIDENTS for month in MONTHS]

json.dump(data, sys.stdout)
```

#### Displaying the problem

I wrote a quick script to transform the json output into an easier to read HTML table. It's at [github.com/bgschiller/pgy2-schedule/blob/master/display.py](https://github.com/bgschiller/pgy2-schedule/blob/master/display.py).

Comes out looking something like this

| Month | Jul                 | Aug   | Sep      | Oct               | ... |
| ----- | ------------------- | ----- | -------- | ----------------- | --- |
| Kenny | Inpatient Peds CHCO | MSK-1 | Elective | FMS               | ... |
| Naomi | MSK-1               | FMS   | Elective | School-based Peds | ... |
| ...   | ...                 | ...   | ...      | ...               | ... |

or like this (depending on choice of pivot)

| Month    | Jul          | Aug                   | Sep          | Oct           | ... |
| -------- | ------------ | --------------------- | ------------ | ------------- | --- |
| Elective | Alisa        | Jeff                  | Kenny, Naomi | Morgan, Anita | ... |
| FMS      | Anita, Steve | Morgan, Alicia, Naomi | Anita, Jeff  | Alicia, Kenny | ... |
| ...      | ...          | ...                   | ...          | ...           | ... |

### Do it Yourself

Please feel free to follow this method to make the best possible schedule for your own residency program! The code is available at [github.com/bgschiller/pgy2-schedule](https://github.com/bgschiller/pgy2-schedule), and I'm happy to answer questions or give advice by email: `brian (a) brianschiller.com` (or use the [contact form](https://brianschiller.com/blog/contact/)).

Please let me know how it goes! I'm especially interested if you come across some constraints or goals that are difficult to phrase using this model.

### Hire me to do it

I'm hoping to eventually turn this into a self-service app, but have decided I don't know enough about the problem yet. A great way to learn is to work on more examples! If you'd like to have me make an optimal schedule for your residency program, send me an email at `brian (a) (brianschiller.com)` or use the [contact form](https://brianschiller.com/blog/contact/) on this website.
