# Product Requirements Document (PRD)
## BikeApp MVP – Route Elevation Profile & Player Progress UI

## 1. Overview

### Objective
Implement a real-time route elevation profile UI component that displays the full route as a cross-sectional elevation graph, shows the rider’s current position as a moving dot, and fills the graph progressively as the rider advances through the route.

This component should:
- Display the full route as a distance-versus-elevation profile
- Show the rider’s position as a simple dot
- Fill the completed portion of the route based on rider progress
- Dim or leave unfilled the remaining portion of the route
- Be lightweight and readable during an active session

## 2. Goals

### Primary Goals
- Visualize the route elevation profile in a compact HUD-friendly format
- Show the rider’s live position on the route
- Show completion progress visually by filling the graph from left to right
- Use the graph shape itself to communicate climbs and descents

### Non-Goals (MVP)
- No hover interactions
- No zooming or panning
- No multi-rider display
- No gradient-based color mapping
- No clickable route segments
- No route editing tools

## 3. Core Concept

The component is a 2D elevation profile graph.

- The X-axis represents distance along the route
- The Y-axis represents elevation
- The rider is represented by a small dot on the line
- The route profile is filled from the start to the rider’s current position
- The remaining route stays visually dimmed or unfilled

The visual design should resemble a standard cycling elevation profile:
- START label on the left
- FINISH label on the right
- A simple monochrome profile line
- A filled completed section
- A small dot for the rider marker

## 4. User Story

As a rider in an active session, I want to see where I am on the route and how much of the route profile I have completed, so I can understand what terrain is ahead and how far I have progressed.

## 5. Functional Requirements

### 5.1 Route Elevation Profile Rendering
The app must render a route elevation profile from route point data.

The profile must:
- Use route distance as the horizontal axis
- Use route elevation as the vertical axis
- Connect route points into a continuous line
- Scale correctly to the size of the UI container

### 5.2 Rider Position Marker
The app must show the rider’s current position on the route as a small dot.

The dot must:
- Move as distance traveled increases
- Be positioned accurately relative to total route progress
- Be placed on the elevation line at the correct interpolated location

### 5.3 Progress Fill
The app must visually fill the route profile from the start of the route to the rider’s current position.

The fill must:
- Increase as the rider progresses
- Stop exactly at the rider position
- Distinguish completed terrain from remaining terrain

### 5.4 Real-Time Updates
The component must update during the live session as the rider’s distance changes.

The update behavior must:
- Recalculate rider position from current distance traveled
- Recalculate the filled portion of the route
- Render smoothly during active riding

### 5.5 Labels
The component must display:
- START at the left edge of the profile
- FINISH at the right edge of the profile

Optional future labels are out of scope for MVP.

## 6. Data Requirements

### 6.1 Route Data Model
The component requires route elevation data in sampled form.

```ts
type RoutePoint = {
  distanceMeters: number
  elevationMeters: number
  gradientPercent?: number
}

type RouteProfile = {
  totalDistanceMeters: number
  points: RoutePoint[]
}

### 6.2 Session Data Model

The component requires live session progress data.

type SessionState = {
  distanceTraveledMeters: number
}
### 7. Calculation Requirements
### 7.1 Progress Ratio

The rider’s progress through the route must be calculated as:

const progressRatio = clamp(
  distanceTraveledMeters / totalDistanceMeters,
  0,
  1
)
### 7.2 X Coordinate Mapping

The x-position of any route point or rider position must be calculated relative to route distance and graph width.

const x = (distanceMeters / totalDistanceMeters) * graphWidth

7.3 Y Coordinate Mapping

The y-position must be calculated relative to route elevation and scaled within the graph height.

const normalizedElevation =
  (elevationMeters - minElevationMeters) /
  Math.max(maxElevationMeters - minElevationMeters, 1)

const y = graphHeight - normalizedElevation * graphHeight

Y should be inverted for screen coordinates so higher elevation appears visually higher on screen.

7.4 Rider Position Interpolation

If the rider’s distance falls between two route points, the component must interpolate the rider position between those points.

const t =
  (distanceTraveledMeters - p1.distanceMeters) /
  (p2.distanceMeters - p1.distanceMeters)

const elevationMeters =
  p1.elevationMeters +
  (p2.elevationMeters - p1.elevationMeters) * t

The interpolated elevation must then be converted to graph coordinates.

8. Rendering Requirements
8.1 Base Profile

Render the full route profile as a continuous line or path derived from all route points.

8.2 Completed Section

Render the section from route start to rider position as visually completed.

Possible implementation options:

Filled area under the completed line segment

Brighter path stroke for completed portion

Brighter area fill behind the rider

8.3 Remaining Section

Render the section after the rider position as visually incomplete.

Possible implementation options:

Lower opacity fill

Dimmer stroke

Unfilled area with outline only

8.4 Rider Dot

Render a small circular dot at the rider’s current interpolated position.

The dot should:

Be simple and minimal

Be clearly visible against the graph

Not use a bike icon in MVP

9. Styling Requirements
MVP Style

Monochrome only

No terrain heatmap or gradient coloring

Dark background for readability

White or light gray profile line

Brighter completed section

Dimmer remaining section

Small white dot for rider position

Visual Hierarchy

Route line should be clearly readable

Rider dot should stand out against the route line

Completed progress should be obvious at a glance

START and FINISH labels should be legible but secondary to the graph

10. Performance Requirements

The component must perform smoothly during an active session.

Requirements:

Target smooth updates during normal gameplay

Avoid unnecessary full re-renders

Support typical route sizes without visible lag

Downsample route points if point count is excessively high

Suggested threshold:

If route point count exceeds 1000, downsample before rendering

11. Edge Cases

The component must handle the following gracefully:

distanceTraveledMeters <= 0

rider dot appears at the start

completed fill is empty or nearly empty

distanceTraveledMeters >= totalDistanceMeters

rider dot appears at the finish

completed fill covers the entire route

Empty route points array

render nothing or a safe placeholder state

Route with a single point

render a minimal flat representation or fallback safely

Flat route

render a flat horizontal line

Identical elevation values

avoid divide-by-zero during normalization

Invalid or unsorted route data

normalize or sort by distance before rendering if needed

12. Integration Requirements
Inputs

The component must accept:

RouteProfile

distanceTraveledMeters

optional width and height from layout or parent container

Outputs

The component is visual only and should not mutate application state directly.

Session Integration

The active session screen must pass current route data and live distance traveled into the component.

13. Suggested Component API
type ElevationProfileProps = {
  routeProfile: RouteProfile
  distanceTraveledMeters: number
  width: number
  height: number
}
14. Suggested Internal Helpers
function getElevationBounds(points: RoutePoint[]): {
  minElevationMeters: number
  maxElevationMeters: number
}

function normalizeRoutePoints(
  points: RoutePoint[],
  width: number,
  height: number
): Array<{ x: number; y: number; distanceMeters: number; elevationMeters: number }>

function getPlayerPosition(
  points: RoutePoint[],
  distanceTraveledMeters: number,
  width: number,
  height: number
): { x: number; y: number }

function getCompletedPath(
  points: RoutePoint[],
  distanceTraveledMeters: number,
  width: number,
  height: number
): Array<{ x: number; y: number }>
15. Build Order

Define route profile and route point types

Implement route point normalization and scaling

Render a static full elevation profile from route data

Implement rider position interpolation

Render a rider dot at the interpolated position

Split route rendering into completed and remaining segments

Add filled completed section

Connect component to live session state

Optimize performance and prevent unnecessary re-renders

Test with flat, hilly, and long routes

16. Acceptance Criteria
Route Graph

The app renders a route elevation graph from route data

The graph shape matches the elevation profile of the route

The graph scales correctly within the available UI area

Rider Position

The rider is represented by a dot

The dot moves correctly based on distance traveled

The dot is positioned accurately on the elevation line

Progress Fill

The graph fills from the left as the rider progresses

The fill stops at the rider’s current position

The remaining route is visually distinct from the completed route

Real-Time Session Behavior

The component updates during the session as progress changes

The movement of the rider dot appears smooth

The component does not noticeably degrade performance

Reliability

The component handles flat routes and empty data safely

The component clamps progress correctly at start and finish

17. Testing Requirements

Add tests for:

progress ratio clamping between 0 and 1

interpolation between route points

correct rider position at start, middle, and finish

flat route rendering logic

handling of empty route data

completed path generation up to rider distance

normalization with identical min/max elevation values

18. Implementation Notes for Codex

Build a reusable UI component called ElevationProfile that:

accepts route data and current session distance

renders a monochrome elevation profile

displays a small moving dot for the rider

fills the route profile from the start to the current rider position

updates continuously during the session

Keep the implementation modular and testable.

Recommended structure:

a pure route-scaling utility

a pure interpolation utility

a pure completed-path utility

a lightweight rendering component

memoization where appropriate to avoid unnecessary recalculations

Possible rendering approaches:

SVG

Canvas

Unity UI line/path rendering

Choose the rendering approach that best matches the existing app stack.

19. Out of Scope for MVP

Do not include:

multi-rider markers

drafting visualization

terrain color coding

hover tooltips

route editing

zoom/pan controls

clickable profile interaction

live segment labeling

20. Future Enhancements

Potential future enhancements include:

multiple rider dots

drafting and pack visualization

segment labels for climbs and descents

gradient-based route coloring

current gradient tooltip near rider dot

minimap synchronization

animated transitions between route states

route preview before session start

21. Codex Task Prompt

Add a new reusable ElevationProfile UI component to the existing bike app.

Requirements:

Render a route cross-section using route elevation data

Use route distance as the x-axis and elevation as the y-axis

Show the rider position as a small dot

Fill the graph from the route start to the rider’s current position

Dim or leave unfilled the remaining section of the route

Update the component in real time using distanceTraveledMeters

Keep the visual style monochrome and HUD-friendly

Optimize for continuous session updates

Handle flat routes, empty routes, and finish-state clamping safely

Data model:

type RoutePoint = {
  distanceMeters: number
  elevationMeters: number
  gradientPercent?: number
}

type RouteProfile = {
  totalDistanceMeters: number
  points: RoutePoint[]
}

Session input:

type SessionState = {
  distanceTraveledMeters: number
}

Suggested component API:

type ElevationProfileProps = {
  routeProfile: RouteProfile
  distanceTraveledMeters: number
  width: number
  height: number
}

Suggested helper functions:
function getElevationBounds(points: RoutePoint[]) {}
function normalizeRoutePoints(points: RoutePoint[], width: number, height: number) {}
function getPlayerPosition(points: RoutePoint[], distanceTraveledMeters: number, width: number, height: number) {}
function getCompletedPath(points: RoutePoint[], distanceTraveledMeters: number, width: number, height: number) {}