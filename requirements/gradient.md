# 🚴‍♂️ RideSync Systems Note
## Trainer Control, Grade UI, and Momentum Physics (MVP+ Foundation)

---

## 1. Overview

This document defines the core systems required to simulate terrain-based riding in a fitness application.

The goal is to:
- Translate real-world rider power (watts) into virtual movement
- Simulate incline/decline (grade)
- Control smart trainer resistance (if supported)
- Provide clear UI feedback for terrain and effort

This system must:
- Work with both controllable and non-controllable trainers
- Remain simple for MVP
- Be extensible for future realism improvements

---

## 2. System Architecture

The terrain simulation system is composed of three main parts:

1. **Course Grade Engine**
2. **Trainer Control System**
3. **Movement / Momentum System**

---

## 3. Trainer Control System

### 3.1 Purpose

To adjust trainer resistance in real time based on simulated terrain.

Smart trainers support:
- Resistance control via Bluetooth FTMS or ANT+ FE-C
- Bidirectional communication (send resistance, receive power data)

Smart trainers can automatically adjust resistance to simulate hills, making uphill harder and downhill easier. :contentReference[oaicite:0]{index=0}

---

### 3.2 Control Modes

#### Simulation Mode (REQUIRED)
- Resistance is based on terrain grade
- Used for free riding / immersive experience

#### ERG Mode (NOT USED HERE)
- Locks rider to a target wattage
- Not suitable for terrain simulation

---

### 3.3 Control Loop

Run at ~1 Hz (or when grade changes):


loop:
grade = getCurrentGrade()
scaled_grade = grade * user_gradient_setting
sendResistanceToTrainer(scaled_grade)


---

### 3.4 Gradient Scaling

Add user control:


effective_grade = actual_grade * gradient_scale


Example:
- 100% = full realism
- 50% = easier hills
- 0% = flat feel

---

### 3.5 Trainer Capability Handling

#### Controllable Trainer
- Send resistance updates
- Adjust feel in real time

#### Non-Controllable Trainer
- Do NOT send resistance
- Still simulate terrain in app (speed changes)

---

### 3.6 Smoothing

Avoid harsh resistance jumps:


smoothed_grade = lerp(previous_grade, new_grade, smoothing_factor)


---

## 4. Course Grade Engine

### 4.1 Purpose

Provide terrain data to:
- Trainer control
- Movement simulation
- UI display

---

### 4.2 Data Model


segment = {
start_distance: number,
end_distance: number,
grade: number // % incline or decline
}


Route = array of segments

---

### 4.3 Current Grade Calculation


current_segment = findSegmentByDistance(current_distance)
current_grade = current_segment.grade


---

### 4.4 Lookahead System (UI + Gameplay)


next_segment = findNextSegment(current_distance)
distance_to_next = next_segment.start - current_distance


---

## 5. Grade UI System

### 5.1 Purpose

Communicate terrain clearly and allow users to anticipate effort.

---

### 5.2 Core UI Elements

#### Current Grade
- Display as:
  - +X.X% (uphill)
  - -X.X% (downhill)

#### Color Coding
- Uphill: red/orange
- Flat: neutral
- Downhill: green

---

### 5.3 Lookahead UI

Display upcoming terrain:


+6% in 120m
-3% in 80m


---

### 5.4 Optional Enhancements

- Mini elevation graph (next 200–500m)
- Gradient trend arrow:
  - ↑ getting steeper
  - ↓ easing
- “Shift suggestion”:
  - uphill → “shift easier”
  - downhill → “shift harder”

---

### 5.5 Resistance Feedback Indicator

Simple label:

- Light
- Moderate
- Heavy

---

## 6. Movement / Momentum System

### 6.1 Purpose

Convert rider power into:
- Speed
- Distance
- Acceleration

---

### 6.2 Core Principle

Rider power is **input**  
Terrain and physics determine **output**

---

### 6.3 Forces to Simulate (Simplified)

1. Gravity (dominant on climbs)
2. Rolling resistance (constant drag)
3. Aerodynamic drag (dominant at high speed)

Aerodynamic drag increases rapidly with speed and becomes the dominant resistance on flat terrain. :contentReference[oaicite:1]{index=1}

---

### 6.4 Simplified Model (MVP)

#### Inputs
- power (watts)
- rider_mass
- grade
- current_speed

---

### 6.5 Approximate Calculation


gravity_force = mass * g * grade
rolling_force = crr * mass * g
aero_force = k * speed^2

net_force = power_equivalent - (gravity_force + rolling_force + aero_force)

acceleration = net_force / mass
speed += acceleration * delta_time
distance += speed * delta_time


---

### 6.6 MVP Shortcut (Simplified)

If full physics is too complex:


effective_speed = power / (1 + grade_factor)
distance += effective_speed * delta_time


---

### 6.7 Momentum / Inertia

Add smoothing to avoid unrealistic jumps:


speed = lerp(previous_speed, target_speed, smoothing_factor)


---

### 6.8 Behavioral Rules (Important)

- Speed should NOT change instantly
- Uphill should feel progressively harder
- Downhill should allow acceleration
- Cresting hills should feel briefly easier
- Short hills should preserve momentum

---

## 7. Downhill Behavior

### 7.1 Trainer

- Reduce resistance
- Allow free spinning

---

### 7.2 Simulation

- Increase speed even at same watts
- Cap speed based on drag

---

## 8. Non-Smart Trainer Behavior

If trainer cannot be controlled:

- DO NOT change resistance
- STILL:
  - apply grade to speed calculation
  - display grade in UI
  - simulate uphill/downhill speed differences

This ensures fairness across all devices.

---

## 9. Data Flow Summary


Trainer → Power Data → App

App:
→ reads grade from course
→ computes resistance (if supported)
→ computes speed from power + grade
→ updates UI

Trainer (optional):
← receives resistance updates


---

## 10. Key Product Principles

1. Real watts are always the source of truth
2. Terrain affects outcome, not input
3. Resistance enhances immersion, not fairness
4. UI must communicate effort clearly
5. Simulation should feel smooth, not perfectly accurate

---

## 11. MVP Implementation Order

1. Static grade input
2. UI grade display
3. Speed calculation from power + grade
4. Basic momentum smoothing
5. Trainer resistance control
6. Lookahead UI

---

## 12. Future Extensions

- Drafting system
- Bike aerodynamics
- Wind simulation
- Advanced physics model
- Multiplayer synchronization

---

## 13. Guiding Principle

> “The rider produces power. The system translates it into movement based on terrain.”