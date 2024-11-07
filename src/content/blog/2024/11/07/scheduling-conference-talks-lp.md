---
title: Scheduling Conference Talks with Linear Programming
date: 2024-11-07
description: Schedule talks for a multi-track conference with an eye to avoiding conflicts
category: blog
tags: [programming, optimization, python, linear programming]
---

We can use linear programming to schedule conference talks so there's as few conflicts as possible between talks that are exciting to the same folks.

Back in 2019, I helped organize a conference called Develop Denver. Once we'd chosen the talks, we collected an interest survey to decide which talks needed the largest venues. I remember thinking, "Wouldn't it be cool if we could schedule the talks so that when a lot of people are interested in the same talks they don't have to choose between them?". There were more important things to worry about at the time, but I thought I'd revisit the problem now.

I've lost track of the interest survey, so the first step was to generate some fake data, both talk titles and a set of preferences. The talks, and some other data, are available in [a google sheet](https://docs.google.com/spreadsheets/d/1L2yrGnl_0hjpXPH3gL2UzKH2KcRMQVNqKAhmrQIjeIs/edit?usp=sharing).

I'll use the `pulp` library in Python to solve this problem, plus a small extension I wrote for it call "citrus". Citrus adds operator overloads for boolean-or, boolean-and, and similar, as these can be simulated using linear constraints.

```python
import pandas as pd
import citrus
import pulp
from dataclasses import dataclass
from itertools import product, chain, combinations
from collections import Counter
from more_itertools import sliding_window
```

Import the data from the google sheet using Pandas:

```python
attendees = pd.read_excel('./Mock conference talks.xlsx', sheet_name='Attendees', index_col='Name')
talks = pd.read_excel('./Mock conference talks.xlsx', sheet_name='Talks', index_col='Title')
venues = pd.read_excel('./Mock conference talks.xlsx', sheet_name='Venues', index_col='Name')
timeslots = pd.read_excel('./Mock conference talks.xlsx', sheet_name='Timeslots', dtype={'Time':str})
favorites = pd.read_excel('./Mock conference talks.xlsx', sheet_name='Survey data', index_col='Name')
```

Set up the variables we'll be using: a binary variable for each possible combination of (talk, venue, timeslot). We'll use these like indicator variables— when `X[t,v,s]` is 1, that means talk `t` is scheduled in venue `v` at timeslot `s`.

```python
model = citrus.Problem('conference-schedule', pulp.LpMaximize)
# Variables are talks x venues x timeslots.
X = model.dicts(
  [(talk, venue, timeslot)
   for talk in talks.index
   for venue in venues.index
   for timeslot in timeslots.index],
  cat=pulp.LpBinary,
)
```

It would be chaotic and confusing to have two talks in the same room at once, so let's add constraints to forbid that. For every talk `t`, we'll create a constraint saying that the `sum(X[t,v,s]) over all v and s` is at most 1.

```python
# Each venue x timeslot can accommodate at most one talk.
for venue, timeslot in product(venues.index, timeslots.index):
  model.addConstraint(
    pulp.lpSum(X[t, venue, timeslot] for t in talks.index) <= 1,
    f'no more than one talk in {venue} at {timeslot}',
  )
```

Each talk is either 50 or 20 minutes long (in my fake dataset, these are arbitrarily chosen). We want to schedule the 50m talks for two timeslots and the 20m talks for one timeslot.

```python
for talk in talks.index:
  number_slots = 2 if talks['Duration'][talk] == '50m' else 1
  model.addConstraint(
    pulp.lpSum(X[talk, v, t] for v in venues.index for t in timeslots.index) == number_slots,
    f'{talk} should be scheduled just once',
  )
```

In particular, we want the 50 minute talks to have two _consecutive_ timeslots. Let's add a constraint to make this happen. This is a little harder to phrase as a linear constraint, so we'll lean on one of the definitions from the `citrus` library.

To say that a talk has two consecutive timeslots is consisten with saying, "For every three consecutive timeslots t1, t2, t3, if a talk is scheduled for t2 it must also be scheduled for either t1 or t3." We'll use the `citrus.implies` function to turn this into linear constraints.

```python
# Talks that are 50m long must have two sequential timeslots in the same venue
for long_talk in talks[talks['Duration'] == '50m'].index:
  for venue in venues.index:
    for t1, t2, t3 in sliding_window(timeslots.index, 3):
      model.addConstraint(
        citrus.implies(
          # if the talk is scheduled for t2,
          X[long_talk, venue, t2],
          # then it must be scheduled for either t1 or t3
          X[long_talk, venue, t1] | X[long_talk, venue, t3]
        ) == 1,
        f'{long_talk} must occupy two sequential slots ({venue}, {t2})'
      )
```

Some speakers may be giving more than one talk. We don't offer time-turners as a conference perk, so we'll add a constraint that each speaker can only be in one place at a time.

```python
# If anyone is giving more than one talk, they can't give both at the same time
speaker_counts = talks['Speaker'].value_counts()
multi_talk_speakers = speaker_counts[speaker_counts > 1]
for speaker in multi_talk_speakers.index:
  this_speaker_talks = talks[talks['Speaker'] == speaker].index
  for ts in timeslots.index:
    model.addConstraint(
      sum(X[t, v, ts] for t in this_speaker_talks for v in venues.index) <= 1,
      f'{speaker} must give at most one talk at {ts}'
    )
```

Now we'd like to make sure that people who are interested in the same talks aren't forced to choose between them. Using the interest survey data, we can create a `pairwise_popularity` map that tells us how popular each pair of talks is. We can even weight this higher when it's a 1st pick talk conflicting with a 2nd pick talk than when the conflict is lower priority.

```python
# weights are designed to be multiplied together so that
# opposing a pick1 with a pick2 is penalized harder than a
# pick1 with a pick5
# These weights are a bit arbitrary, and can be fiddled with to get different results
WEIGHTS = [0, 5, 4, 3, 2, 1]

# A map from picks p1 and p2 to weighted popularity of that pair.
# careful: this should always be indexed using a tuple (p1, p2) where
# p1 sorts earlier than p2. Otherwise you can end up with duplicate entries.
pairwise_popularity = Counter()
for attendee in attendees.index:
  for pick_index1, pick_index2 in product(range(1, 6), range(1, 6)):
    weight = WEIGHTS[pick_index1] * WEIGHTS[pick_index2]
    p1 = favorites[f'pick {pick_index1}'][attendee]
    p2 = favorites[f'pick {pick_index2}'][attendee]
    if p1 == p2: continue
    pairwise_popularity[tuple(sorted((p1, p2)))] += weight
```

Let's update the popularity map to include talks that speakers are excited about opposite the speaker's own talk.

```python
speaking_attendees = set(talks['Speaker']) & set(attendees.index)
for speaker in speaking_attendees:
    this_speakers_talks = talks[talks['Speaker'] == speaker]
    for pick_index, talk in product(range(1, 6), this_speakers_talks.index):
        term = []
        weight = 5 * WEIGHTS[pick_index]
        pick = favorites[f'pick {pick_index}'][speaker]
        if pick == talk: continue
        pairwise_popularity[tuple(sorted((talk, pick)))] += weight
```

`pairwise_popularity` now reflects the degree to which a pair of talks is popular with the same crowd. (remember, this is fake data, so don't read too much into the talk titles).

```python
>>> pairwise_popularity.most_common()
[(('"Beyond Kubernetes: The Next Generation of Cloud-Native Orchestration"',
   '"Securing the Software Supply Chain: Lessons from the Latest Attacks"'),
  980),
 (('"Simulating Quantum Systems: Challenges and Breakthroughs"',
   '"WebAssembly: Unlocking Native Performance in the Browser"'),
  708),
 (('"Cross-Platform Game Development: Navigating the Challenges of Unity and Unreal"',
   '"Securing the Software Supply Chain: Lessons from the Latest Attacks"'),
  703),
  ...
  (('"Live Coding for Music: Performance and Improvisation with Sonic Pi"',
   '"Scaling Distributed Databases: Lessons from the Field"'),
  4),
 (('"Designing for Speed: Frontend Performance Optimization in 2024"',
   '"Live Coding for Music: Performance and Improvisation with Sonic Pi"'),
  4)]
```

I tried avoiding conflicts for _all_ those pairs of talks—making everyone happy. That version of model relied on manipulating the objective function instead of adding constraints. That might be possible, but it was taking forever to solve. Instead, I included only popularity scores above 10. 10 was chosen by trying a few different values and seeing how small I could make the cut-off without hurting the runtime.

```python
talks_to_avoid_scheduling_opposite = [
  pair for pair, score in pairwise_popularity.most_common()
  if score > 10
]
for p1, p2 in talks_to_avoid_scheduling_opposite:
  for t in timeslots.index:
    model.addConstraint(
      talk_scheduled_anywhere_at(p1, t)
        + talk_scheduled_anywhere_at(p2, t) <= 1,
      f"Avoid scheduling {p1} opposite {p2} at {t}")
```

We can also use the survey data to put the more popular talks in the larger rooms. This is the first place we're using objective*terms instead of constraints on the model. We're asking the solver to do its best here, but some talks may be too popular to fit in \_any* room.

```python
popularity = favorites.stack().value_counts()
objective_terms = []
for talk in talks.index:
  estimated_attendance = popularity[talk]
  sufficiently_large_rooms = venues[venues.Capacity >= estimated_attendance].index
  objective_terms.append(
    pulp.lpSum(X[talk, v, t]
      for v in sufficiently_large_rooms
      for t in timeslots.index))
```

Finally, we can run the solver against our model. I found that the open-source CBC solver was too slow to be usable: I let it run for about 20 minutes before giving up. I switched to CPLEX, which is free for academic use, and it solved the problem in about 5 seconds.

```python
model.setObjective(pulp.lpSum(objective_terms))
solver = pulp.CPLEX_CMD(
  path='/Applications/CPLEX_Studio2211/cplex/bin/arm64_osx/cplex',
  gapRel=0.1, # accept an integer solution within 10% of the optimal linear solution
)
model.solve(solver)
print(pulp.LpStatus[model.status])
```

Now we can interrogate the variables to see the schedule. Looping over the pososible timeslot and venue pairs, we'll find if any talks are scheduled there by checking if `X[talk, venue, timeslot]` is 1.

```python
data = []
for ts, venue in product(timeslots.index, venues.index):
  indicator_vars = [(X[(t, venue, ts)].varValue, t) for t in talks.index]
  if any(t is not None and v > 0 for (v, t) in indicator_vars):
    v, t = max(((v, r) for (v, r) in indicator_vars if v is not None), key=lambda t: t[0])
    t = talks.loc[t].name
  else:
    t = ''
  data.append({
    'talk': t,
    'venue': venue,
    'time': timeslots.iloc[ts].Time[:5],
  })
```

This gives us a list of all the (talk, venue, time) triples that are scheduled. We can pivot to a table that's nicer to look at using pandas.

```python
schedule = pd.DataFrame(data).pivot(index='time', columns='venue', values='talk')
```

<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>venue</th>
      <th>Aspen</th>
      <th>Fir</th>
      <th>Madrona</th>
    </tr>
    <tr>
      <th>time</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>09:00</th>
      <td>"Blending Realities: The Future of AR and VR i...</td>
      <td></td>
      <td>"Simulating Quantum Systems: Challenges and Br...</td>
    </tr>
    <tr>
      <th>09:30</th>
      <td>"Zero Trust in Practice: Implementing End-to-E...</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <th>10:00</th>
      <td>"Post-Quantum Cryptography: Preparing for the ...</td>
      <td>"Compiling to the Future: How WebAssembly is R...</td>
      <td>"From Models to Applications: Practical AI for...</td>
    </tr>
    <tr>
      <th>10:30</th>
      <td>"Post-Quantum Cryptography: Preparing for the ...</td>
      <td></td>
      <td>"Building Quantum-Ready Applications: Tools an...</td>
    </tr>
    <tr>
      <th>11:00</th>
      <td>"Rethinking State Management: Beyond Redux in ...</td>
      <td>"Ethical AI: Balancing Innovation with Respons...</td>
      <td>"Interactive Installations: Bridging Digital a...</td>
    </tr>
    <tr>
      <th>11:30</th>
      <td>"Rethinking State Management: Beyond Redux in ...</td>
      <td>"Ethical AI: Balancing Innovation with Respons...</td>
      <td>"Designing for Speed: Frontend Performance Opt...</td>
    </tr>
    <tr>
      <th>12:00</th>
      <td>"From Types to Proofs: The Rise of Dependently...</td>
      <td>"Taming the Chaos: Architecting Resilient Dist...</td>
      <td>"Designing for Speed: Frontend Performance Opt...</td>
    </tr>
    <tr>
      <th>12:30</th>
      <td>"The Developer Experience: How Tooling Shapes ...</td>
      <td>"The Ethics of Algorithmic Decision-Making: Wh...</td>
      <td>"Scaling Distributed Databases: Lessons from t...</td>
    </tr>
    <tr>
      <th>13:00</th>
      <td>"Securing the Software Supply Chain: Lessons f...</td>
      <td>"The Future of OLAP: Hybrid Transactional/Anal...</td>
      <td>"Scaling Distributed Databases: Lessons from t...</td>
    </tr>
    <tr>
      <th>13:30</th>
      <td>"Streaming Data at Scale: Real-Time Analytics ...</td>
      <td>"Live Coding for Music: Performance and Improv...</td>
      <td>"Decentralized Web: A Path to Privacy and Cens...</td>
    </tr>
    <tr>
      <th>14:00</th>
      <td>"Generative Art: Creating Visual Masterpieces ...</td>
      <td>"WebAssembly: Unlocking Native Performance in ...</td>
      <td>"Decentralized Web: A Path to Privacy and Cens...</td>
    </tr>
    <tr>
      <th>14:30</th>
      <td>"Beyond Syntax: Designing Languages for Human ...</td>
      <td>"Optimizing for the Edge: Low-Latency Infrastr...</td>
      <td>"Procedural Generation: Crafting Infinite Worl...</td>
    </tr>
    <tr>
      <th>15:00</th>
      <td>"Beyond Kubernetes: The Next Generation of Clo...</td>
      <td>"Burnout in Tech: Recognizing, Preventing, and...</td>
      <td>"Procedural Generation: Crafting Infinite Worl...</td>
    </tr>
    <tr>
      <th>15:30</th>
      <td>"Transformers Unleashed: Revolutionizing NLP B...</td>
      <td>"Burnout in Tech: Recognizing, Preventing, and...</td>
      <td>"Tech Monopolies and Innovation: Are We Stifli...</td>
    </tr>
    <tr>
      <th>16:00</th>
      <td>"Transformers Unleashed: Revolutionizing NLP B...</td>
      <td></td>
      <td>"Tech Monopolies and Innovation: Are We Stifli...</td>
    </tr>
    <tr>
      <th>16:30</th>
      <td>"Cross-Platform Game Development: Navigating t...</td>
      <td>"Quantum Algorithms: From Theory to Practice"</td>
      <td>"Building High-Trust Teams in a Remote-First W...</td>
    </tr>
  </tbody>
</table>

## Reflections

We can spot-check the schedule to see if it looks reasonable, but I'd prefer for the computer to check the constraints and objectives for me. I'm reasonably sure that the constraints do what I want, but I went through a couple of iterations where the solver decided to skip scheduling a couple of talks for some reason. I'd also like to know how well it was able to achieve each of the objective terms individually, and the solver only reports the opaque objective value, which isn't as useful for me.

This technique is not accessible to non-programmers, even people who are fairly computer-savvy. Many scheduling problems can be written as assignment problems:

- Assign talks to the product of venues and timeslots
- Assign baristas to shifts
- Assign students to the product of classes and periods.

It seems like a worthwhile trade-off to make this type of assignment problem easier to accomplish with less programming at the loss of some expressiveness in the model.

Problems don't exist in a vacuum—there's always data related to them. If we represent the model alongside the data in a spreadsheet, we have a natural place to display the results and the status of conflicts and objectives.
