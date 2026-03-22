# BikeApp Recent Sessions Pagination (MVP)

## Overview

Add lightweight pagination to the **Recent Sessions** section so the app only renders a small set of sessions at a time. The goal is to improve usability and keep the implementation simple, fast, and easy for Codex to build.

## Goal

Allow users to browse older sessions without loading or rendering the full session history in one long list.

## MVP Scope

### In Scope

* Paginate the Recent Sessions list
* Show a fixed number of sessions per page
* Add simple Previous / Next controls
* Show current page state
* Handle empty and partial pages gracefully

### Out of Scope

* Infinite scroll
* Server-side pagination
* Filtering and sorting changes
* Search
* Virtualized list optimization beyond basic pagination

## Proposed MVP Behavior

* Show **10 sessions per page** by default
* Newest sessions appear first
* User can move between pages using:

  * **Previous** button
  * **Next** button
* Show page indicator text, for example:

  * `Page 1 of 3`
* Disable Previous on the first page
* Disable Next on the last page

## UX Requirements

### Recent Sessions Section

Each session card/row should continue to show the same existing information, such as:

* date
* duration
* distance
* average watts
* average heart rate
* elevation climbed

Do not redesign the session card UI. Only add pagination around the existing list.

### Pagination Controls

Add lightweight controls below the Recent Sessions list:

* Previous button
* Page indicator
* Next button

Example layout:

```text
[Previous]   Page 1 of 4   [Next]
```

### Empty State

If there are no sessions, show the existing empty state and hide pagination controls.

### Single Page State

If total sessions fit on one page, either:

* hide pagination controls entirely, or
* show them disabled

Prefer the simpler implementation.

## Functional Requirements

### 1. Page Size

Use a configurable constant for page size.

Example:

```ts
const RECENT_SESSIONS_PAGE_SIZE = 10;
```

### 2. Session Ordering

Use existing session ordering logic.
Assume newest-first unless the current app already does something different.

### 3. Page Calculation

Compute:

* total session count
* total pages
* current page index
* visible sessions for current page

Example logic:

```ts
const startIndex = (currentPage - 1) * pageSize;
const endIndex = startIndex + pageSize;
const visibleSessions = sessions.slice(startIndex, endIndex);
```

### 4. Navigation Rules

* Previous button:

  * moves back 1 page
  * disabled on page 1
* Next button:

  * moves forward 1 page
  * disabled on final page

### 5. Data Updates

If a new session is added:

* refresh pagination state
* keep behavior simple and predictable
* acceptable MVP behavior: reset to page 1 so the newest session is immediately visible

If sessions are deleted:

* ensure current page is still valid
* if current page becomes out of range, move to the last valid page

## Technical Notes

### State

Add lightweight UI state for pagination:

```ts
currentPage: number
pageSize: number
```

### Suggested Helpers

Create simple reusable helpers if helpful:

```ts
getPaginatedSessions(sessions, currentPage, pageSize)
getTotalPages(totalCount, pageSize)
clampPage(page, totalPages)
```

### Rendering

Keep implementation lightweight:

* use existing Recent Sessions list component
* only change the data passed into it
* render pagination controls beneath the list

Do not introduce unnecessary complexity.

## Edge Cases

Handle these cases cleanly:

* zero sessions
* fewer than page size sessions
* exactly one full page
* navigating to last page with fewer than 10 items
* deleting sessions while on a later page
* adding a new session while viewing an older page

## Acceptance Criteria

* Recent Sessions only shows one page of results at a time
* Default page size is 10
* User can navigate with Previous / Next
* Current page indicator is visible
* Buttons disable correctly at boundaries
* Empty state still works
* Existing session row/card UI remains unchanged
* Pagination logic is simple and easy to maintain

## Codex Implementation Guidance

Implement this as a small MVP enhancement, not a redesign.

Preferred approach:

1. Keep all existing Recent Sessions UI
2. Add pagination state to the Recent Sessions container/component
3. Slice the session array based on current page
4. Render Previous / Next controls below the list
5. Handle edge cases with minimal extra logic

## Suggested Deliverables

* Update Recent Sessions component/container
* Add page state and page helpers
* Add Previous / Next controls
* Add page indicator text
* Ensure empty/single-page states behave correctly

## Nice-to-Have (Only If Easy)

* Add a tiny text label above the controls like:

  * `Showing 1–10 of 26 sessions`

This is optional and should not complicate the MVP.

## Guiding Principle

Keep pagination simple, readable, and local to the Recent Sessions UI.
Do not introduce backend pagination, infinite scrolling, or major list refactors for this MVP.
