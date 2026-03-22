# Prebuilt Workout Templates – MVP PRD

## Overview
Add a lightweight system for app-provided prebuilt workouts using the existing segment-based workout model.

These workouts are different from user-created custom workouts:
- Prebuilt workouts are fixed templates that come with the app
- They are available to all users
- They cannot be edited
- They cannot be deleted
- They can be copied into a custom workout if a user wants to modify one

Saved Workouts should now have two sections:
- Template Workouts
- Custom Workouts

The template workouts must use the same tag system as all other workouts.

This feature should stay lightweight and local-first. Template workouts should be defined in app code, while custom workouts should continue using the current local persistence approach.

---

## Goals
- Add built-in workout templates to the app
- Keep template workouts separate from custom workouts in the UI
- Reuse the existing workout segment system
- Reuse the existing workout tag system
- Allow users to copy a template into a custom editable workout
- Prevent editing and deleting of template workouts

---

## Scope

### Included
- Add a workout type/source concept
- Add a built-in dataset of template workouts
- Show template workouts in their own section under Saved Workouts
- Keep custom workouts in their own section
- Allow template workouts to be copied into custom workouts
- Ensure template workouts support tags, difficulty, rating, and favourite behavior where applicable

### Not Included
- Backend sync
- Downloading templates from a server
- Editing template workouts
- Deleting template workouts
- Advanced sorting/search beyond compatibility with current systems

---

## Product Requirements

## 1. Add workout type/source
Each workout should now have a simple distinction between:
- template
- custom

This should drive UI and behavior.

### Template workouts
- app-provided
- fixed
- visible to all users
- not editable
- not deletable
- copyable

### Custom workouts
- user-created
- editable
- deletable
- locally persisted as they are today

---

## 2. Saved Workouts UI structure
Update the Saved Workouts screen to show two clear sections.

### Section 1: Template Workouts
This section contains all built-in workouts that ship with the app.

These workouts should:
- appear near the top of the Saved Workouts area
- show the same core workout information as custom workouts
- show their tags
- show their duration
- show their difficulty if the app already calculates it
- optionally support favourite and rating if those are already global workout features

### Section 2: Custom Workouts
This section contains all user-created workouts.

These should keep their current editable and deletable behavior.

### Example structure
Saved Workouts

Template Workouts
- FTP Builder Foundation
- Endurance Base 45
- Easy Recovery Spin
- Tempo Builder 40
- Threshold Ladder
- VO2 Max Punches
- Sprint Primer
- Climbing Steps
- Sweet Spot Builder
- Race Prep Opener

Custom Workouts
- My Tuesday Intervals
- Long Endurance Ride
- Recovery Spin Copy

---

## 3. Template workout behavior
Template workouts must behave differently from custom workouts.

### Template workout actions
Allowed:
- View
- Copy
- Favourite, if favourites are supported globally
- Rate, if ratings are supported globally

Not allowed:
- Edit
- Delete

### Copy behavior
When a user copies a template workout:
- a new custom workout is created
- the copied workout should preserve:
  - name
  - segments
  - tags
  - duration
  - difficulty, if difficulty is currently computed or stored
- the copied workout must receive a new unique id
- the copied workout becomes editable
- the copied workout becomes deletable
- the copied workout should appear in the Custom Workouts section

### Naming for copied workouts
Use a simple suffix such as:
- Workout Name (Copy)

Example:
- Sweet Spot Builder
- Sweet Spot Builder (Copy)

---

## 4. Same tag system
Template workouts must use the same predefined tag system as custom workouts.

Supported tags:
- FTP Builder
- Endurance
- Recovery
- Tempo
- Threshold
- VO2 Max
- Sprint
- Climbing
- Sweet Spot
- Race Prep

Each template workout should include at least one tag.

No special tag behavior should be added for templates. They should work the same as custom workouts in the existing filter system.

---

## 5. Data and persistence model

### Template workouts
Template workouts should:
- live in app code as static seed data
- always exist for all users
- not depend on local storage to be available
- not be overwritten by user actions

### Custom workouts
Custom workouts should:
- continue to use the current local storage/cache approach
- remain fully user-managed

### Combined rendering
For display purposes, the app can combine template and custom workouts into a single screen, but they should be grouped into separate sections.

If filters are applied:
- filter the workouts first
- then render the filtered results under Template Workouts and Custom Workouts headings where applicable

---

## 6. Workout structure
Template workouts must use the existing segment system.

Each workout should include:
- id
- name
- source/type
- segment list
- total duration
- tags

Optional existing fields can remain compatible:
- difficulty
- rating
- favourited

Each segment should continue using the current structure:
- zone
- duration in seconds

Zones remain:
- Zone 1
- Zone 2
- Zone 3
- Zone 4
- Zone 5

---

## 7. UI requirements

### Workout row display
Template workouts should use the same row layout as custom workouts where possible.

They should show:
- workout name
- duration
- tags
- difficulty, if available
- favourite state, if supported
- rating, if supported

### Template-specific row actions
Template workout rows should show:
- Copy

Template workout rows should not show:
- Edit
- Delete

### Visual distinction
Add a small, lightweight badge to template workouts, such as:
- Template
- Built-in

This should be subtle and only used to make the source clear.

---

## 8. Filtering compatibility
Template workouts should work with the existing Saved Workouts filtering system.

They must be filterable by:
- difficulty
- duration
- tags
- favourited

No special filter logic should be required just because a workout is a template.

If the current implementation allows, filtered results should still render under:
- Template Workouts
- Custom Workouts

If one section has no results after filtering, it can be hidden.

---

## Seed Template Workouts
Add one template workout for each existing tag.

These should be simple, realistic, structured examples using only the current zone-based segment system.

---

## Template Workout 1
### Name
FTP Builder Foundation

### Tag
- FTP Builder

### Segments
- Zone 1 for 5 minutes
- Zone 3 for 10 minutes
- Zone 4 for 10 minutes
- Zone 2 for 5 minutes
- Zone 4 for 10 minutes
- Zone 1 for 5 minutes

### Intent
A structured workout focused on building sustained FTP-related effort.

---

## Template Workout 2
### Name
Endurance Base 45

### Tag
- Endurance

### Segments
- Zone 1 for 5 minutes
- Zone 2 for 30 minutes
- Zone 2 for 10 minutes
- Zone 1 for 5 minutes

### Intent
A steady endurance workout for aerobic base building.

---

## Template Workout 3
### Name
Easy Recovery Spin

### Tag
- Recovery

### Segments
- Zone 1 for 5 minutes
- Zone 1 for 15 minutes
- Zone 2 for 5 minutes
- Zone 1 for 5 minutes

### Intent
A low-stress recovery ride for easy spinning.

---

## Template Workout 4
### Name
Tempo Builder 40

### Tag
- Tempo

### Segments
- Zone 1 for 5 minutes
- Zone 2 for 5 minutes
- Zone 3 for 15 minutes
- Zone 2 for 5 minutes
- Zone 3 for 15 minutes
- Zone 1 for 5 minutes

### Intent
A tempo-focused session with sustained moderate pressure.

---

## Template Workout 5
### Name
Threshold Ladder

### Tag
- Threshold

### Segments
- Zone 1 for 5 minutes
- Zone 3 for 5 minutes
- Zone 4 for 8 minutes
- Zone 2 for 4 minutes
- Zone 4 for 10 minutes
- Zone 2 for 4 minutes
- Zone 4 for 12 minutes
- Zone 1 for 5 minutes

### Intent
A threshold workout with increasingly long efforts.

---

## Template Workout 6
### Name
VO2 Max Punches

### Tag
- VO2 Max

### Segments
- Zone 1 for 5 minutes
- Zone 3 for 5 minutes
- Zone 5 for 3 minutes
- Zone 1 for 3 minutes
- Zone 5 for 3 minutes
- Zone 1 for 3 minutes
- Zone 5 for 3 minutes
- Zone 1 for 3 minutes
- Zone 5 for 3 minutes
- Zone 1 for 5 minutes

### Intent
A short hard workout targeting VO2 style efforts.

---

## Template Workout 7
### Name
Sprint Primer

### Tag
- Sprint

### Segments
- Zone 1 for 5 minutes
- Zone 2 for 5 minutes
- Zone 5 for 30 seconds
- Zone 1 for 2 minutes
- Zone 5 for 30 seconds
- Zone 1 for 2 minutes
- Zone 5 for 30 seconds
- Zone 1 for 2 minutes
- Zone 5 for 30 seconds
- Zone 1 for 5 minutes

### Intent
A short session with repeated sprint efforts and easy recovery.

---

## Template Workout 8
### Name
Climbing Steps

### Tag
- Climbing

### Segments
- Zone 1 for 5 minutes
- Zone 2 for 5 minutes
- Zone 3 for 10 minutes
- Zone 4 for 10 minutes
- Zone 3 for 5 minutes
- Zone 4 for 10 minutes
- Zone 1 for 5 minutes

### Intent
A climbing-style session with longer steady uphill-feeling efforts.

---

## Template Workout 9
### Name
Sweet Spot Builder

### Tag
- Sweet Spot

### Segments
- Zone 1 for 5 minutes
- Zone 3 for 5 minutes
- Zone 4 for 12 minutes
- Zone 2 for 5 minutes
- Zone 4 for 12 minutes
- Zone 1 for 5 minutes

### Intent
A sweet spot session with repeat sustained efforts.

---

## Template Workout 10
### Name
Race Prep Opener

### Tag
- Race Prep

### Segments
- Zone 1 for 5 minutes
- Zone 2 for 5 minutes
- Zone 4 for 4 minutes
- Zone 1 for 3 minutes
- Zone 5 for 2 minutes
- Zone 1 for 3 minutes
- Zone 3 for 5 minutes
- Zone 1 for 5 minutes

### Intent
A mixed-intensity opener session designed to prepare a rider for harder efforts.

---

## Functional Requirements

### On app load
- template workouts should be available immediately
- template workouts should not rely on user-created storage
- custom workouts should still load from the existing local storage approach

### On viewing saved workouts
- template workouts should render in the Template Workouts section
- custom workouts should render in the Custom Workouts section

### On copying a template workout
- create a new custom workout from the selected template
- assign a new unique id
- append a copy suffix to the name if needed
- persist it using the custom workout storage flow
- show it in the Custom Workouts section
- allow it to be edited and deleted like any other custom workout

### On edit attempt
- template workouts should not offer edit controls
- template workouts should not enter edit mode

### On delete attempt
- template workouts should not offer delete controls
- delete action should only exist for custom workouts

---

## Acceptance Criteria
- The app supports both template workouts and custom workouts
- Saved Workouts shows two distinct sections:
  - Template Workouts
  - Custom Workouts
- Template workouts use the same segment structure as custom workouts
- Template workouts use the same tag system as custom workouts
- Template workouts cannot be edited
- Template workouts cannot be deleted
- Template workouts can be copied into custom workouts
- Copied workouts become editable and deletable
- One example template workout exists for each of the following tags:
  - FTP Builder
  - Endurance
  - Recovery
  - Tempo
  - Threshold
  - VO2 Max
  - Sprint
  - Climbing
  - Sweet Spot
  - Race Prep
- Existing custom workout behavior continues to work as it does today
- Existing filters remain compatible with both workout types

---

## Deliverables
- Add a workout source/type distinction for template vs custom
- Add a static built-in template workout dataset in app code
- Update Saved Workouts UI to show Template Workouts and Custom Workouts sections
- Add Copy action for template workouts
- Disable or hide Edit and Delete actions for template workouts
- Ensure template workouts support the same tags and filter behavior as custom workouts
- Seed the 10 template workouts listed in this document

---

## Notes for Codex
- Keep this lightweight and local-first
- Reuse the existing workout row rendering where possible
- Reuse the existing segment system without adding new workout mechanics
- Prefer one shared workout model with source/type-based behavior
- Do not over-engineer permissions; simple UI and action guards are enough for MVP
- Keep the built-in workout dataset easy to expand later
- Avoid inline code examples that break markdown formatting