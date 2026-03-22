# Calories Burned Tracking & Profile Accumulation – MVP PRD

## Overview
Add a **Calories Burned** stat to the ride summary and persist total calories burned on the user profile, similar to how experience is currently accumulated.

This should be lightweight and follow the same local persistence pattern already used for profile and progression-related stats.

## Goal
When a ride ends:
- Calculate total calories burned for that ride
- Show calories burned in the ride summary UI
- Add that ride’s calories to the user’s cumulative lifetime calories total
- Persist the updated total on the user profile

## Scope
This task includes:
- Per-ride calories calculation
- Ride summary display
- Profile stat accumulation
- Local persistence

This task does **not** include:
- nutrition guidance
- calorie goal systems
- weight-loss recommendations
- backend sync
- historical charting
- editing past ride calorie values

## Product Requirements

### 1. Add calories burned to ride summary
At the end of a session, the ride summary should display:
- Calories Burned

It should appear alongside existing ride metrics such as distance, duration, elevation, experience, etc.

### 2. Accumulate calories on the user profile
The user profile should track:
- `totalCaloriesBurned`

When a ride is completed:
- calculate ride calories
- add ride calories to `profile.totalCaloriesBurned`
- persist updated profile data

This should behave similarly to how total experience is accumulated.

### 3. Persist the stat locally
Use the same local storage / cached persistence pattern already used for the profile.

No backend required for MVP.

---

## Calories Calculation

### Preferred input
Calories should be calculated from ride power and elapsed time.

Use ride session data already available in the app:
- average watts or sampled watts across the ride
- elapsed moving/active duration in seconds

### MVP calculation
Use a simple cycling-friendly estimate:

```ts
caloriesBurned = (averageWatts * durationSeconds / 3600) * 3.6