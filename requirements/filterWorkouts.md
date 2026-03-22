# 🔍 Saved Workouts Filtering & Pagination – UPDATED (Duration Filter Adjustment)

## Overview
Update the **Duration Filter** behavior in the Saved Workouts filter system.

Instead of a range (min–max), duration will now be:
- A **minimum threshold only**
- Represented as **"X minutes and greater"**
- Controlled via a **slider**
- Incremented in **5-minute steps**
- Max value: **120 minutes (2 hours)**

All other filtering and pagination behavior remains unchanged.

---

## Updated Duration Filter (MVP)

### UX Behavior

Replace previous duration range with:


Minimum Duration:
[ 20 min and up ]


Slider example:

[ 5 ——— 120 ] (steps of 5)


Selected value displays as:
- `20 min and up`
- `45 min and up`
- `60 min and up`

---

## Requirements

### 1. Slider Configuration

- Min value: **5 minutes**
- Max value: **120 minutes**
- Step: **5 minutes**
- Default: **0 or no filter applied** (see logic below)

### 2. Data Representation

Store value as:

```ts
minDurationSeconds: number

Where:

minDurationSeconds = selectedMinutes * 60
Filtering Logic Update

Replace previous duration range logic with:

if (minDurationSeconds > 0) {
  if (workout.totalDurationSeconds < minDurationSeconds) return false
}
Default Behavior
When no duration filter is applied:
minDurationSeconds = 0
All workouts pass duration filter
UI Updates
Filter Modal Section

Replace previous duration section with:

Duration:
Minimum Duration:
[ 30 min and up ]
Active Filter Indicator

Update display format:

[ Duration: 30+ min ]
Edge Cases
If user selects 5 min, almost all workouts pass
If user selects 120 min, only very long workouts pass
If workout has missing duration:
Exclude if filter is active
Include if no filter
Acceptance Criteria (Updated)
User can set minimum duration using slider
Slider increments in 5-minute steps
Slider max is 120 minutes
Filtering correctly shows workouts ≥ selected duration
Active filter shows X+ min
No duration filter → all workouts visible
Pagination still works correctly after filtering
Notes for Codex
Replace previous duration range logic entirely
Keep implementation simple and consistent with other filters
Ensure slider UI clearly communicates "minimum only"
Avoid off-by-one errors when converting minutes → seconds