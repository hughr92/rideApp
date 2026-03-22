# ⭐ Workout Rating System (1–5) – MVP PRD

## Overview
Add a **simple 1–5 rating system** for saved workouts. Users can rate workouts directly from the **Saved Workouts list** via a button on each row. Clicking the button opens a lightweight pop-up/modal to select a rating.

This is a minimal feature focused on:
- Capturing a user’s rating (1–5)
- Displaying the rating in the workout list
- Persisting ratings locally

Future extensions (out of scope for MVP but supported by design):
- Sorting/filtering by rating
- Aggregated ratings across users (backend)
- Review/comments

---

## Goals

- Allow users to **quickly rate workouts (1–5)**
- Surface rating in the workout list for quick reference
- Keep implementation simple and consistent with local storage patterns

---

## Scope

### Included
- Add rating to workout data model
- Add rating button in saved workouts row
- Modal/pop-up to select rating (1–5)
- Persist rating locally
- Display current rating in list and modal

### Not Included
- Text reviews/comments
- Backend sync or shared ratings
- Sorting/filtering UI by rating
- Analytics or recommendations

---

## UX / UI

### Saved Workouts List (Row)

Each workout row includes:
- Workout name
- Duration
- Tags (if implemented)
- Difficulty (if implemented)
- **Rating button (NEW)**

#### Rating Button States
- **Unrated:** `Rate ★`
- **Rated:** `★ 4` (example)

#### Example Row

"Sweet Spot Builder" | 45 min | [Sweet Spot] | Difficulty: 6/10 | ★ 4


Clicking the rating button opens the modal.

---

### Rating Modal / Pop-up

#### Behavior
- Opens on click of rating button
- Shows 5 selectable stars (1–5)
- Highlights current rating if it exists
- User selects a rating and confirms

#### UI Example

Rate Workout

[ ★ ★ ★ ★ ★ ]

(Select a rating from 1 to 5)

[ Cancel ] [ Save ]


#### Interaction Rules
- Clicking a star selects that rating
- Clicking the same rating again keeps it selected
- Save persists the rating
- Cancel closes without changes

---

## Data Model Update

Extend the existing workout object:

```json
{
  "id": "string",
  "name": "string",
  "segments": [...],
  "totalDurationSeconds": 1800,
  "tags": [],
  "rating": 4
}
Notes
rating is optional
If not present → workout is considered unrated
Valid values: integers 1–5
Storage (MVP)
Store rating as part of the workout object
Use existing local storage/cache system (workouts key)
No backend required
Functional Requirements
Setting a Rating
User clicks rating button on workout row
Modal opens
User selects rating (1–5)
User clicks Save
Workout object is updated with rating
Data is persisted locally
UI updates immediately
Updating a Rating
Re-opening modal shows current rating selected
User can change rating
Save overwrites previous value
Removing a Rating (Optional MVP)
If implemented:
Allow "Clear Rating" button in modal
Removes rating field or sets to null
Validation Rules
Rating must be:
Integer
Between 1 and 5
No decimals
No 0 values
Suggested Types
```
type Workout = {
  id: string
  name: string
  segments: Segment[]
  totalDurationSeconds: number
  tags?: string[]
  rating?: number // 1–5
}
Components (Suggested)
WorkoutList
WorkoutRow
RatingButton
RatingModal
StarSelector
State Management
Local State (Modal)
selectedRating (1–5 or null)
Global / Stored State
Workout object updated with rating
Edge Cases
Workout has no rating → display "Rate ★"
Old workouts without rating → handled safely
User opens modal and closes → no change
Rapid re-rating → last saved value wins
Invalid value → ignore and fallback safely
Acceptance Criteria
User can click rating button from workout row
Modal appears with 1–5 star selection
User can select and save rating
Rating persists locally
Rating displays correctly in workout list
Existing workouts without rating still function
Rating updates immediately in UI
Deliverables
Update workout data model to include rating
Add rating button to workout list row
Implement rating modal with 1–5 selection
Persist rating in local storage
Display rating in workout list
Handle backward compatibility for older workouts