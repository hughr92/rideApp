Add a basic power-up system to the app.

Goal:
Introduce a simple, extensible power-up system where players earn and use power-ups during a ride.

For MVP:
- Players receive a power-up every 1 km traveled
- Players can hold up to 2 power-ups at a time
- Power-ups must be used in order (FIFO: first-in, first-out)
- Only one type of power-up exists for now:
  - Speed Boost (+5% speed for a short duration)

This system should be simple, modular, and easy to expand later.

---

Core Requirements:

1. Power-up Acquisition
- Every 1 km of distance traveled:
  - grant 1 power-up
- Do not exceed max capacity of 2 power-ups
- If already holding 2, do not grant additional power-ups

---

2. Power-up Inventory (Queue System)
- Each player has a power-up queue
- Max size: 2
- FIFO order:
  - first collected must be used first
  - cannot skip ahead

Example:
[Boost, Boost] → must use first Boost before second

---

3. Power-up Usage
- Player can trigger power-up manually (e.g., button press)
- When used:
  - remove from front of queue
  - apply effect immediately

---

4. Power-up Effect (MVP)

Speed Boost:
- increases rider’s effective speed by +5%
- applies to final computed speed (after physics, grade, etc.)
- duration: 10 seconds (IMPORTANT: this is a temporary value and should be easy to change later)

Implementation detail:
- apply as a multiplier:
  speed = baseSpeed * 1.05

---

5. Integration with Existing Systems

The boost should integrate with:
- current speed calculation system
- route/terrain system
- bike selection system

Important:
- do NOT modify raw rider power
- modify resulting speed only

---

6. Duration System

- power-up should have:
  - start time
  - duration (set to 10 seconds for MVP)
- effect should automatically expire

Suggested structure:
- activePowerUp = {
    type,
    startTime,
    duration
  }

IMPORTANT:
- duration must be configurable
- do not hardcode logic that assumes 10 seconds permanently

---

7. UI Requirements

Add minimal UI for power-ups:

Inventory Display:
- show up to 2 power-up slots
- indicate order clearly (left = next to use)
- simple icon or label (e.g., “BOOST”)

Usage:
- add button to activate power-up
- disable button if no power-ups available

Active State:
- indicate when boost is active (e.g., highlight, small timer, or text)

---

8. Data Model

Create a reusable power-up structure:

{
  id,
  type,
  duration,
  effect
}

Player state should include:
- powerUpQueue: []
- activePowerUp: null or object

---

9. Distance Tracking

- track cumulative distance during session
- trigger power-up grant at each 1 km interval
- ensure:
  - no duplicate grants
  - no missed thresholds

Suggested:
- track lastPowerUpDistanceThreshold
- compare against current distance

---

10. Architecture

Create modular system:

- powerUpTypes.ts
- powerUpEngine.ts
- applyPowerUpEffects(...)
- grantPowerUp(...)
- usePowerUp(...)

Keep logic separate from UI.

---

11. Extensibility

Design system to easily support:
- multiple power-up types
- different effects (e.g., climb boost, draft boost, recovery)
- stacking rules (later)
- different acquisition rules

---

12. Validation

Ensure:
- power-ups are granted correctly every 1 km
- queue never exceeds size 2
- FIFO order is enforced
- boost increases speed by 5% during active duration
- boost lasts exactly 10 seconds (based on system time)
- boost expires correctly
- system does not break speed or route simulation
- works with multiplayer state (if applicable)

---

13. Deliverables

Generate:
- power-up data model
- queue system
- distance-trigger logic
- speed boost implementation
- duration handling (10 seconds configurable)
- UI for inventory + activation
- integration with speed calculation
- comments for future expansion

---

Important Product Note:
This is a simple MVP implementation.

Do NOT overcomplicate:
- no animations required
- no rarity system
- no randomization yet
- no balancing system yet

Focus on:
- clean structure
- predictable behavior
- easy expansion later

Key Rule:
Modify final speed, not rider power.