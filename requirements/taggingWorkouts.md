# 🏷️ Workout Tags – MVP PRD

## Overview
Introduce a **tagging system for workouts** to improve organization and enable future search and filtering capabilities.

Users will be able to assign tags to workouts when creating or editing them. Tags describe the purpose or type of workout (e.g., FTP Builder, Endurance).

This is a lightweight MVP focused on:
- Assigning tags to workouts
- Displaying tags in the workout list and editor
- Persisting tags locally with workouts

Future functionality (out of scope for MVP but supported by design):
- Search and filtering by tags
- Tag-based recommendations
- Smart categorization

---

## Goals

- Allow users to **label workouts with meaningful tags**
- Improve workout discoverability in the future
- Keep implementation simple and extendable

---

## Scope

### Included
- Add tags to workout data model
- UI for selecting tags during workout creation/edit
- Display tags in workout list and detail view
- Local persistence of tags

### Not Included
- Tag search/filter UI
- Custom user-defined tags (MVP uses predefined list only)
- Backend storage
- Tag analytics or recommendations

---

## Tag System Design

### Tag Format
- Tags are simple strings
- Stored as an array on each workout

Example:
```json
{
  "tags": ["FTP Builder", "Endurance"]
}
Default Tag List (MVP)

Provide a fixed list of selectable tags:

FTP Builder
Endurance
Recovery
Tempo
Threshold
VO2 Max
Sprint
Climbing
Sweet Spot
Race Prep

⚠️ Do not allow free text input in MVP (prevents messy data)

User Flow
Creating a Workout
User navigates to Workouts tab
Clicks Create Workout
Builds workout (existing functionality)
Selects one or more tags from predefined list
Saves workout
Editing a Workout (if supported)
User can add/remove tags
Save updates
UI Requirements
Workout Creator Screen

Add a Tags section:

Multi-select UI (checkbox list or pill buttons)
User can select multiple tags
Selected tags are visually highlighted

Example UI:

Tags:
```
[ FTP Builder ] [ Endurance ] [ Recovery ] [ Tempo ]
[ Threshold ] [ VO2 Max ] [ Sprint ] [ Climbing ]

Selected state:

[✓ FTP Builder] [✓ Endurance] [ Recovery ]
Workout List Display

Each workout item should show its tags:

Example:

Workout Name: "Sweet Spot Builder"
Duration: 45 min
```
Tags: [Sweet Spot] [FTP Builder]

Keep tags visually lightweight (pills or small labels)

Data Model Update
Workout Object

Extend existing workout model:

{
  "id": "string",
  "name": "string",
  "segments": [...],
  "totalDurationSeconds": 1800,
  "tags": ["Endurance", "FTP Builder"]
}
Storage (MVP)
Use existing local storage/cache system
Tags are stored as part of workout object
No separate tag storage required
Validation Rules
Tags are optional (workout can have zero tags)
Tags must come from predefined list
No duplicates in tag array
Suggested Types
type WorkoutTag =
  | "FTP Builder"
  | "Endurance"
  | "Recovery"
  | "Tempo"
  | "Threshold"
  | "VO2 Max"
  | "Sprint"
  | "Climbing"
  | "Sweet Spot"
  | "Race Prep"
```
type Workout = {
  id: string
  name: string
  segments: Segment[]
  totalDurationSeconds: number
  tags: WorkoutTag[]
}

Functional Requirements
Tag Selection
User can select multiple tags
Toggling a selected tag removes it
Tags persist when saving workout
Display
Tags appear in:
Workout list
Workout editor (pre-selected when editing)
Edge Cases
No tags selected → valid workout
Duplicate selection → prevent duplicates
Old workouts without tags → default to empty array []
Future Considerations (NOT IN MVP)
Search & Filtering
Filter workouts by one or more tags
Combine tags with difficulty or duration filters
Custom Tags
Allow users to create their own tags
Store global tag list
Smart Tagging
Auto-suggest tags based on workout structure
Example:
High Zone 4/5 → suggest "Threshold" or "VO2 Max"
Acceptance Criteria
User can assign one or more tags when creating a workout
Tags are saved and persist locally
Tags are displayed in workout list
Tags are editable (if edit flow exists)
No duplicate tags on a workout
App handles workouts with no tags safely
Deliverables
Update workout data model to include tags
Add tag selection UI to workout creator
Persist tags in local storage
Display tags in workout list and editor
Add safe defaults for older workouts (empty tag array)