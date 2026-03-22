Create a lightweight MVP feature for the BikeApp that calculates a **workout difficulty rating from 1 to 10**.

## Goal
Add logic that evaluates a saved workout and assigns it a whole-number difficulty score:
- Minimum difficulty is **1**
- Maximum difficulty is **10**
- Difficulty can **never be 0**
- Output must always be a **whole integer**
- A workout that is equal to or above a rider’s **average FTP effort** should qualify as **10**
- The threshold for 10 should be realistic, not absurdly hard beyond normal structured training

## Context
Workouts are made up of segments. Each segment has:
- a power zone (Zone 1 to Zone 5)
- a duration in seconds

Zones are FTP-relative, not fixed watt values. Different riders will produce different watts in the same zone, but the same workout should represent similar effort relative to their FTP.

We already store workouts locally. This task is only about computing and displaying a difficulty score for each workout.

## Requirements

### 1. Add a workout difficulty calculation
Create a utility that calculates workout difficulty using:
- segment zone
- segment duration
- relative FTP intensity
- total workout duration
- estimated average workout intensity across the full workout

The calculation should reward:
- longer workouts
- more time in higher zones
- higher average intensity

The calculation should avoid:
- making every short workout too easy
- making only extreme workouts score 10
- producing 0
- using decimal display values

### 2. Difficulty scale rules
Use the following rules:
- **1** = very easy recovery / short low-intensity workout
- **5** = moderate workout with meaningful work but sustainable
- **8** = hard structured workout with significant time in high zones
- **10** = any workout whose estimated overall effort is equal to or greater than average FTP-level effort across the workout, or otherwise clearly maximal/very hard in practical training terms

A workout should also be able to reach 10 through combinations like:
- long threshold-heavy workouts
- very hard VO2-heavy workouts
- workouts whose weighted average intensity is at or above FTP

### 3. Suggested approach
Implement a simple scoring model using zone intensity multipliers.

Use these default zone intensity values:
- Zone 1 = 0.50
- Zone 2 = 0.65
- Zone 3 = 0.83
- Zone 4 = 0.98
- Zone 5 = 1.10

For each workout:
1. Convert each segment into a weighted effort score:
   - `segmentEffort = durationSeconds * zoneIntensity`
2. Sum all segment efforts
3. Compute:
   - total duration
   - weighted average intensity = totalEffort / totalDuration
4. Use the weighted average intensity plus total duration to map to a 1–10 scale

### 4. Mapping guidance
Use a practical mapping, not a purely arbitrary one.

Suggested logic:
- start from weighted average intensity
- add a duration factor so a 10-minute hard workout is not automatically scored the same as a 60-minute hard workout
- cap output to 1–10
- round to nearest whole number
- enforce minimum 1

Use common sense so that:
- short Zone 1 recovery rides score 1–2
- endurance workouts score 2–4
- tempo / sweet spot workouts score 4–7
- threshold / VO2 workouts score 7–10
- any workout with weighted average intensity `>= 1.0` scores 10

### 5. Edge cases
Handle these safely:
- no segments → return 1
- missing zone values → ignore invalid segment or fallback safely
- zero duration → do not divide by zero
- unknown zone → fallback safely

### 6. Data integration
Add the computed difficulty score to workout display data so it can be shown in the workout list and workout detail/editor view.

Do not permanently store difficulty unless needed. Prefer computing it from the current workout definition, unless the current architecture strongly benefits from storing a derived value.

### 7. UI updates
Display difficulty as:
- `Difficulty: X/10`

Show it in:
- saved workout list item
- workout editor summary

### 8. Keep scope small
Do not build:
- trainer control
- ERG mode
- live workout execution
- backend persistence
- advanced sports science modeling

Keep this feature lightweight, understandable, and easy to tune later.

## Deliverables
1. A utility function like `calculateWorkoutDifficulty(workout, ftp?)`
2. Clear inline comments explaining the scoring
3. Integration into the workout list/editor UI
4. A few example test cases showing expected outputs

## Example expectations
These do not need exact scores but should be roughly true:

- 20 min Zone 1 recovery → difficulty 1–2
- 45 min mostly Zone 2 → difficulty 3–4
- 45 min with substantial Zone 3 / sweet spot → difficulty 5–7
- 60 min threshold-focused workout → difficulty 8–10
- Any workout with weighted average intensity at or above FTP → difficulty 10

Please implement this in the simplest maintainable way and keep the scoring constants easy to tweak later.