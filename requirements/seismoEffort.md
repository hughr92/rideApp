# 📈 In-Session Power & Heart Rate Graph (Seismograph View) – MVP PRD

## Overview
Add a real-time **seismograph-style graph** inside an active workout session that visualizes:

- User **power output (watts)** over time
- User **heart rate** as an overlay line

The graph should:
- Display the **last 10 minutes of activity**
- Update continuously during the session
- Represent time in **5-second frames**
- Color each frame based on **FTP-relative power zones**

This is a real-time, lightweight visualization to give users immediate feedback on effort and intensity.

---

## Goals

- Provide clear visual feedback of effort over time
- Reinforce training zones visually using color
- Show trends in both power and heart rate
- Keep rendering efficient and simple for MVP

---

## Scope

### Included
- Real-time scrolling graph (last 10 minutes)
- Power visualization using colored segments
- Heart rate overlay line
- FTP-based zone coloring
- Fixed time window (10 minutes)
- Fixed resolution (5-second intervals)

### Not Included
- Zooming or panning
- Historical graph beyond 10 minutes
- Advanced smoothing algorithms
- Multi-user comparison
- Exporting or saving graph data

---

## Core Concept

The graph behaves like a **seismograph**:
- New data enters from the right
- Old data shifts left
- Oldest data drops off once exceeding 10 minutes

---

## Time Resolution

### Frame Definition
- Each frame represents **5 seconds of activity**

### Total Frames
- 10 minutes = 600 seconds
- 600 / 5 = **120 frames total**

### Behavior
- Every 5 seconds:
  - Add a new frame to the right
  - Shift all existing frames left
  - Remove oldest frame if over 120

---

## Data Inputs

### Required Inputs

#### Power Data
- Current watts (either real-time or averaged over 5s window)

#### Heart Rate Data
- Current heart rate (bpm)

#### FTP
- User’s Functional Threshold Power (used for zone calculation)

---

## Power Zone Mapping (Color Coding)

Each frame is colored based on FTP-relative power zones:

- Zone 1 (0–55% FTP) → Light Blue
- Zone 2 (56–75% FTP) → Green
- Zone 3 (76–90% FTP) → Yellow
- Zone 4 (91–105% FTP) → Orange
- Zone 5 (106%+ FTP) → Red

### Behavior
- Each 5-second frame is assigned a single zone
- Color reflects the zone for that frame

---

## Graph Structure

### Layout

- Horizontal axis → Time (last 10 minutes)
- Vertical axis → Power (relative visual height)
- Overlay → Heart rate line above power graph

### Components

#### 1. Power Bars (Seismograph Blocks)
- Represent each 5-second frame
- Fixed width per frame
- Height scaled based on watt value
- Color based on zone

#### 2. Heart Rate Line
- Continuous line across frames
- Plotted above or overlaid on power graph
- Uses consistent color (e.g., red or white for contrast)
- Smooth connection between points

---

## Data Model (In-Memory)

Maintain a rolling buffer:

- Array of last 120 frames

Each frame should contain:
- timestamp
- watts
- heartRate
- computed zone

When new data arrives:
- push new frame
- remove oldest if length > 120

---

## Update Loop

### Every 5 seconds:
1. Capture current or averaged watts
2. Capture current heart rate
3. Compute zone based on FTP
4. Create new frame
5. Append to buffer
6. Trim buffer to max 120 frames
7. Trigger UI update

---

## UI Behavior

### Real-Time Updates
- Graph updates every 5 seconds
- Smooth leftward scrolling effect

### Empty State
- At session start:
  - Graph fills progressively from right to left
  - No need to pre-fill with empty data

---

## Scaling

### Power Scaling
- Normalize graph height based on expected watt range
- Suggested:
  - Max visual height = ~150% FTP
  - Cap values above this for visual consistency

### Heart Rate Scaling
- Normalize within expected HR range:
  - Example: 80–200 bpm
- Keep consistent vertical mapping

---

## Performance Considerations

- Fixed array size (max 120 frames)
- Avoid re-rendering entire graph unnecessarily
- Prefer:
  - canvas rendering OR
  - lightweight SVG OR
  - optimized component rendering

- Keep calculations simple (no heavy smoothing required)

---

## Edge Cases

- No power data:
  - Set watts to 0
  - Render as Zone 1 or neutral

- No heart rate data:
  - Do not render HR line for that frame
  - Or interpolate if simple

- FTP missing:
  - Default to safe fallback zones
  - Or treat all as neutral color

---

## Acceptance Criteria

- Graph displays inside active session
- Shows last 10 minutes of data only
- Updates every 5 seconds
- Each frame represents 5 seconds
- Power is displayed as colored segments
- Colors reflect FTP-based zones
- Heart rate is shown as a continuous line
- Graph scrolls smoothly as new data arrives
- No performance issues with continuous updates

---

## Deliverables

1. In-memory rolling buffer for last 120 frames
2. Zone calculation utility based on FTP
3. Graph rendering component
4. Update loop (5-second interval)
5. Integration into session screen
6. Heart rate overlay line implementation

---

## Future Considerations (NOT IN MVP)

- Zoomable timeline
- Pause/inspect mode
- Highlight intervals or segments
- Compare planned vs actual workout
- Multi-rider overlay
- Data smoothing and averaging options

---

## Notes for Codex

- Keep rendering simple and efficient
- Prefer fixed-size data structures
- Avoid over-engineering animations
- Prioritize clarity over visual polish
- Ensure easy extension for future workout playback integration