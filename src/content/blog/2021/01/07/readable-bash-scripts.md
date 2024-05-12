---
title: Readable Bash Scripts
date: 2021-01-07
category: blog
description: A technique for breaking bash pipelines into smaller, more easily debuggable pieces.
tags: [programming, shell]
---

I really love the feeling of writing a bash pipeline. It's fun to string commands together, peek at the output, add another couple pipes to massage the data closer to my goal. I even gave a short class on them: [bgschiller/shell-challenges](https://github.com/bgschiller/shell-challenges).

But it's easy to find that a pipeline that was delightful to write is painful to maintain. Even if you're the one reading it a month later, it's difficult to remember what the purpose of each piece is. This is a trick I learned to break pipelines into intermediate files for more readable scripts.

### The task

The product I'm working on has a list of "Alarms"&mdash;conditions that the end user needs to be alerted to. We also have a localization file for each supported language that maps Alarm names to human-readable names, descriptions, etc. There are a lot of alarms, enough to make it difficult to keep track of which ones are already translated. This calls for a script!

The Alarms file looks something like this:

```xml
<!-- Alarms.xml -->
<?xml version="1.0" encoding="utf-8"?>
<config name="AlarmConfig">
   <AlarmList name="IngredientAlarms" version="1.0">
      <Alarm name="MozzarellaTooWarm">
        <!-- some alarm-specific stuff here -->
      </Alarm>
      <Alarm name="PizzaTooCold">
      </Alarm>
      <!-- ... -->
```

And the localization something like this:

<!-- prettier-ignore -->
```js
[{ stringId: "alarm_id_MozzarellaTooWarm",
   localString: "MozzarellaTooWarm" },
 { stringId: "alarm_title_MozzarellaTooWarm",
   localString: "Mozzarella Too Warm" },
 { stringId: "alarm_description_MozzarellaTooWarm",
   localString: "The mozzarella has become too warm and must be used within the next five minutes" },
  //...
]
```

### Make a plan

1. Extract the alarms names from Alarms.xml using `xpath`.
2. Each alarm needs to be prefixed with `alarm_id_`, `alarm_title_`, `alarm_description_`, `alarm_operator_actions_` in order to match the localization file. Figure out some way to do that.
3. Extract the `"stringId"` from each entry in the localization file. Oh, but there are other entries for things that need to be localized, and aren't alarms at all. Figure out a way to filter those out. Probably use `jq` for that.
4. Use `diff` to compare the expected keys with the actual keys.

This isn't a post on how to make bash pipelines, so I'll gloss over that piece. Here's what I came up with:

```bash
diff \
  <(join -j 99999 \
    <(echo 'alarm_id_
alarm_title_
alarm_description_
alarm_operator_actions_') \
    <(xpath -q -e config/AlarmList/Alarm/@name Alarms.xml |
      cut -d= -f2 | tr -d '"') \
    | tr -d ' ' | sort) \
  <(jq '.[] | select(.stringId | startswith("alarm_")) |
        .stringId ' i18n/en.json | sort)
```

It's convoluted and kinda impressive in that way. But not code you'd be happy to maintain.

### One step at a time

The prior step accomplished what we needed, but it was pretty difficult to see what was going on. In my opinion, that's because

- Nothing has a name. Because each process substitution is fed directly into a parent, nothing ever receives a name. We need to name our intermediates!
- No comments. It's difficult to add comments because every line ends in a backslash, meaning "continue this line as if I hadn't pressed enter". Bash doesn't allow you to say "continue this line" and also add a comment.

Let's see if we can tease out each part using intermediate files.

```bash
cat > alarm_attrs << EOF
alarm_id_
alarm_title_
alarm_description_
alarm_operator_actions_
EOF

xpath -q -e config/AlarmList/Alarm/@name Alarms.xml |
  cut -d= -f2 | tr -d '"' > expected_alarm_names

join -j 999 alarm_attrs expected_alarm_names |
  tr -d ' ' | sort > expected_localization_keys

jq -r '.[] | select(.stringId | startswith("alarm_")) |
       .stringId' en.json | sort > actual_localization_keys
```

This is better! Each piece can be understood in isolation, and the dependencies between steps are explictly tracked with named files. All that's left is to add comments and some error checking, and clean up our intermediate files.

Cleaning up after ourselves is a little tricky. Ideally, we'd like to avoid leaving the intermediate results files laying around regardless of whether the script exits normally, crashes, or is cancelled with ctrl-c. We can use `trap` to handle this. `trap` sets up a command to run when a "signal" occurs. We'll put all our intermediate files into a directory and use `trap` to delete that directory when a signal that indicates our script is ending fires.

```bash
#!/bin/bash

set -ef -o pipefail

readonly script_name=`basename "$0"`
usage() {
  cat >&2 << EOF
Usage: $script_name <path-to-Alarms.xml> <path-to-en.json>

  Compare the alarms specified in Alarms.xml against the
  localizations keys provided in a [language-code].json file
  (eg, en.json). Warn if any keys are missing or unexpected.
EOF
  exit 2
}

if [[ $# != 2 ]]; then
   echo "error: expected 2 arguments, received $#" 1>&2
   usage
fi

readonly ALARM_CONFIG_XML=$1
if [[ ${ALARM_CONFIG_XML: -4} != ".xml" || ! -e $ALARM_CONFIG_XML ]]; then
   echo "error: unable to find XML file at $ALARM_CONFIG_XML" 1>&2
   usage
fi
readonly LOCALIZATION_JSON=$2
if [[ ${LOCALIZATION_JSON: -5} != ".json" || ! -e $LOCALIZATION_JSON ]]; then
   echo "error: unable to find JSON file at $LOCALIZATION_JSON" 1>&2
   usage
fi

# Make a directory for intermediate results
tmpdir=$(mktemp -d -p .)
# ensure it's removed when this script exits
trap "rm -rf $tmpdir" EXIT HUP INT TERM
# note: when debugging, turn off that `trap` line to keep
# intermediate results around

# The plan is ultimately to use diff to compare names between
# Alarms.xml and en.json. diff will tell us if any names
# appear in one file but are missing in the other (checks
# both directions for a mismatch).In pursuit of this, we need
# to create a couple of temporary files:
#  1) all the alarm names we expect to find (based on Alarms.xml)
#  2) all the names actually present in the localization file.
# A complication: the location file uses a flat format to
# store the id, title, description, and operator_actions:
#   { "stringId": "alarm_id_MozzarellaTooWarm", ... },
#   { "stringId": "alarm_title_MozzarellaTooWarm", ... },
#   { "stringId": "alarm_description_MozzarellaTooWarm", ... },
#   { "stringId": "alarm_operator_actions_MozzarellaTooWarm", ... },
# We want to check that *all* of these keys are present, so
# we use a cross product of (alarm names) X (those attributes)

cat > $tmpdir/alarm_attrs << EOF
alarm_id_
alarm_title_
alarm_description_
alarm_operator_actions_
EOF

xpath -q -e config/AlarmList/Alarm/@name $ALARM_CONFIG_XML |
 cut -d= -f2 | tr -d '"' > $tmpdir/expected_alarm_names

# trick to compute cross product: use `join` with a join
# field that doesn't exist (999). since both files lack a
# field at 999, they will compare equal for every key, and
# each line of the left file will be joined with each line
# of the right file--a cross product.
join -j 999 $tmpdir/alarm_attrs $tmpdir/expected_alarm_names |
tr -d ' ' | sort > $tmpdir/expected_localization_keys

jq -r '.[] | select(.stringId | startswith("alarm_")) |
       .stringId' $LOCALIZATION_JSON |
  sort > $tmpdir/actual_localization_keys

if diff $tmpdir/expected_localization_keys $tmpdir/actual_localization_keys; then
   echo "Success! Found all" $(wc -l $tmpdir/expected_localization_keys) "expected localization keys"  1>&2
else
   echo "Failure. Found discrepancies between expected alarm names and actual localization keys" 1>&2
   exit 1
fi
```
