# 🚴‍♂️ RideSync MVP PRD

## Local Multiplayer Telemetry App (Codex-Ready)

---

## 1. Overview

### Product Summary

RideSync MVP is a lightweight, local-first multiplayer application that allows small groups of users (2–6 participants) to share and view real-time fitness telemetry.

The system focuses on:

- Real-time power (watts)
- Heart rate
- Simple derived distance

This MVP intentionally avoids complex systems such as:

- Large-scale servers
- Public matchmaking
- 3D environments
- Physics simulation

---

## 2. Core Concept

Users join a private session and can see each other’s performance in real time via a shared dashboard.

> "A real-time shared effort experience across multiple users."

---

## 3. MVP Scope

### Included

- Device connection (trainer + heart rate monitor)
- Real-time telemetry capture
- Small private multiplayer sessions
- Live leaderboard UI
- Simple distance calculation
- Local data storage

### Excluded

- Public multiplayer
- Persistent backend systems
- Avatars or 3D visualization
- Drafting or terrain physics
- Equipment, upgrades, or cosmetics

---

## 4. Target Users

- Indoor cyclists
- Fitness enthusiasts
- Small friend groups working out together

---

## 5. Functional Requirements

### 5.1 Device Connectivity

#### Bike Trainer / Power Device

- Connect via Bluetooth (FTMS preferred)
- Capture:

  - Power (watts) [REQUIRED]
  - Cadence (optional)
  - Speed (optional)

#### Heart Rate Monitor

- Connect via Bluetooth
- Capture:

  - Heart rate (BPM)

---

### 5.2 Multiplayer Session System

#### Create Session

- Host creates lobby
- Generates:

  - Session code (e.g., ABC123)

#### Join Session

- Users join via code
- Connect to host via peer-to-peer connection

#### Session Size

- 2–6 users max

---

### 5.3 Networking

#### Approach

- Peer-to-peer (WebRTC preferred)
- Host acts as session authority

#### Data Frequency

- 1 update per second (1 Hz)

#### Data Payload

```json
{
  "user_id": "string",
  "timestamp": 0,
  "power": 0,
  "heart_rate": 0,
  "cadence": 0,
  "activity_type": "cycling"
}
```

---

### 5.4 Data Normalization

All incoming data should be normalized into:

- power (watts)
- heart_rate (bpm)
- cadence (optional)

If power is unavailable:

- fallback handling can be added later (not required for MVP)

---

### 5.5 Session Lifecycle

#### Pre-Session

- Users connect devices
- Join lobby

#### Start Session

- Host starts timer
- All users begin streaming data

#### During Session

- Live leaderboard updates
- Data continuously synced

#### End Session

- Session summary displayed

---

### 5.6 Distance Calculation

Distance is derived from power.

#### Formula

```
distance += (power / normalization_factor) - delta_time
```

#### Notes

- normalization_factor should be tuned (e.g., 200–300)
- distance is abstract (not real-world km)

---

### 5.7 W/kg Calculation (Optional but Recommended)

```
w_per_kg = power / user_weight
```

- Requires user weight input

---

## 6. UI Requirements

### 6.1 Main Screen (Live Session)

#### Header

- Session name
- Timer

#### Leaderboard (Primary Component)

Each row displays:

- Name
- Watts
- W/kg (if enabled)
- Heart Rate
- Distance

Example:

```
Hugh    245W    3.2    152 bpm    1.24
Alex    210W    2.8    145 bpm    1.18
Sam     180W    2.5    138 bpm    1.05
```

#### Behavior

- Sorted by distance (descending)
- Highlight current user
- Update every second

---

### 6.2 Visual Enhancements (Optional)

- Progress bars per user
- Color-coded HR zones
- Highlight leader

---

### 6.3 Session Summary Screen

Display:

- Average power
- Max power
- Average heart rate
- Total distance
- Duration

---

## 7. Data Storage

### Local Only

- Store session summaries
- No cloud sync required

---

## 8. Technical Architecture

### Frontend

- React Native (recommended)

### Core Modules

#### 1. Device Connector

- Bluetooth FTMS
- HR monitor

#### 2. Networking Layer

- WebRTC peer-to-peer
- Host authority model

#### 3. Session Engine

- Manage users
- Manage session state

#### 4. Data Pipeline

- Ingest → Normalize → Broadcast → Render

#### 5. UI Renderer

- Leaderboard
- Session screens

---

## 9. Non-Functional Requirements

### Performance

- UI updates within 200ms
- Smooth rendering at 60 FPS

### Reliability

- Handle disconnects gracefully
- Allow rejoin to session

### Simplicity

- Minimal setup time (<30 seconds to join session)

---

## 10. Edge Cases

- Device disconnect mid-session
- User disconnect from lobby
- Missing heart rate data
- Delayed data packets
- Duplicate user IDs

---

## 11. MVP Milestones

### Phase 1

- Device connection
- Power + HR capture

### Phase 2

- Local session creation
- Peer-to-peer connection

### Phase 3

- Real-time data sync
- Leaderboard UI

### Phase 4

- Distance calculation
- Session summary

---

## 12. Success Criteria

User can:

- Create or join a session in <30 seconds
- See real-time watts for all participants
- Complete a session with live updates
- View summary at end

---

## 13. Codex Implementation Notes

- Start with mock data before device integration
- Build networking layer early
- Use event-driven architecture
- Keep state centralized (Redux/Zustand)

---

## 14. Guiding Principle

> "If it doesn’t help users compare effort in real time, it is not part of the MVP."
