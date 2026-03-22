# 🚴 Workout Creator & Selector – MVP PRD

## Overview
The Workout Creator allows users to build structured cycling workouts based on FTP-relative power zones (Zone 1–5). These workouts are designed to provide equal perceived effort across riders regardless of their absolute wattage.

This feature is accessible via a new top-level tab: **"Workouts"**.

The MVP focuses on:
- Creating workouts using drag-and-drop zones
- Assigning durations to each zone
- Saving workouts locally (cached)
- Listing and selecting saved workouts

Future integration (out of scope for MVP but considered in design):
- ERG mode trainer control
- Session integration (select workout when creating session)

---

## Navigation & UI Placement

### Top Navigation Tabs
- Account
- Create Session
- Join Session
- Devices
- **Workouts (NEW)**

---

## Workout Creator UI

### Layout
The Workout Creator screen consists of:

1. **Zone Palette (Left Panel)**
   - Draggable items:
     - Zone 1
     - Zone 2
     - Zone 3
     - Zone 4
     - Zone 5

2. **Workout Timeline (Main Canvas)**
   - Horizontal sequence of blocks
   - Users drag zones into this area
   - Each block represents a segment of the workout

3. **Segment Editor (Right Panel or Modal)**
   - When a segment is selected:
     - Zone (read-only)
     - Duration input (seconds or minutes)
     - Option to delete segment

4. **Workout Controls (Top or Bottom)**
   - Workout Name (text input)
   - Total Duration (auto-calculated)
   - Save Workout button

---

## Core Concepts

### Power Zones (FTP-Based)
Each zone represents a % of FTP, not fixed watts:

| Zone | % FTP Range | Label        |
|------|-------------|--------------|
| 1    | 0–55%       | Recovery     |
| 2    | 56–75%      | Endurance    |
| 3    | 76–90%      | Tempo        |
| 4    | 91–105%     | Threshold    |
| 5    | 106–120%    | VO2 Max      |

⚠️ No watt calculations needed in MVP — just store zone identifiers.

---

## User Flow

### Create Workout
1. User navigates to **Workouts tab**
2. Clicks **"Create Workout"**
3. Enters workout name
4. Drags zones into timeline
5. Sets duration for each segment
6. Reorders segments via drag-and-drop (optional MVP stretch)
7. Clicks **Save**

### View Workouts
- List of saved workouts displayed
- Each shows:
  - Name
  - Total duration
  - Number of segments

### Edit Workout (Optional MVP Stretch)
- Load existing workout into editor
- Modify segments
- Save (overwrite)

---

## Data Model

### Workout Object
```json
{
  "id": "string",
  "name": "string",
  "createdAt": "timestamp",
  "segments": [
    {
      "zone": 1,
      "durationSeconds": 300
    },
    {
      "zone": 3,
      "durationSeconds": 600
    }
  ],
  "totalDurationSeconds": 900
}
## Storage (MVP)
- Use local storage / in-memory cache (same pattern as profile storage)
- Key: workouts
- Value: Array of Workout Objects

## Example:
{
  "workouts": [ ... ]
}

## Core Logic
Total Duration Calculation
- sum all durationSeconds from segments
Validation Rules
- Workout must have:
  - Name (non-empty)
  - At least 1 segment
  - Each segment duration > 0
Segment Defaults
- Default duration when added: 300 seconds (5 min)

Components (Suggested)
- WorkoutPage
- WorkoutList
- WorkoutCreator
- ZonePalette
- WorkoutTimeline
- WorkoutSegment
- SegmentEditor

Drag & Drop Behavior
Requirements
- Drag zone from palette → timeline
- Creates new segment block
- Blocks displayed in order of placement
- Clicking block opens editor
MVP Simplification
- No need for complex snapping/grid
- Linear horizontal stacking is enough

UI Representation
Timeline Example
[ Z2 - 5:00 ] [ Z3 - 10:00 ] [ Z1 - 3:00 ]

Future Considerations (NOT IN MVP)
ERG Mode Integration
Each segment maps to target watts:
targetWatts = FTP * zonePercentage
Trainer resistance adjusts per segment
Session Integration
Add dropdown in "Create Session":
Select saved workout
Session engine executes segments in sequence
Real-Time Playback
Timer progresses through segments
UI highlights current segment
Non-Goals (MVP)
No backend persistence
No multiplayer sync
No trainer/device integration
No advanced interval types (ramps, cadence targets, etc.)