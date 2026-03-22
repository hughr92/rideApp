# ERG Mode Trainer Control – MVP PRD / Build Prompt

Implement a robust **ERG mode control system** for the BikeApp so a paired smart trainer can automatically increase or reduce resistance during a workout based on the current workout segment target.

This is a key feature and must be built with a reliable device-control architecture, not as a UI-only toggle.

## Core Goal

Add an **ERG On / Off** setting to the app and connect it to the paired smart trainer so that:

- when ERG is ON, the app uses the workout’s current target to control trainer resistance
- when ERG is OFF, the trainer is not actively controlled by the app
- the app continuously reads trainer telemetry such as:
  - current watts
  - cadence
  - resistance-related machine data if available
- the app updates the trainer target when the workout segment changes
- the app fails safely if the trainer does not support the required control features

## Important Product Rule

Do **not** implement ERG as a naive “increase resistance if cadence drops / decrease if cadence rises” loop.

Instead:

- treat ERG mode as a **target power control mode**
- set a target power for the active workout segment
- allow the trainer to do the primary resistance regulation internally
- use rider cadence and actual watts for:
  - telemetry display
  - compliance monitoring
  - warnings
  - fail-safe handling
  - optional smoothing / delayed target updates if needed

The app should only change the trainer target when:
- the workout segment changes
- the workout is paused/resumed
- ERG is toggled on/off
- the user manually changes the workout target in a future version
- the trainer reports a state requiring recovery or re-send

## Required BLE / FTMS Support

Build this around Bluetooth LE GATT and the standard Fitness Machine Service shape.

The implementation should be organized to work with:

- Fitness Machine Service
- Fitness Machine Feature
- Indoor Bike Data
- Supported Power Range
- Fitness Machine Control Point
- Fitness Machine Status

The app must discover trainer services/characteristics and verify that the paired trainer supports the required control path before enabling ERG mode.

## Platform Requirements

Support the existing BikeApp platforms through a reusable BLE abstraction layer.

### Apple platforms
Use Core Bluetooth for:
- scan/discovery
- connect
- service discovery
- characteristic discovery
- notifications / indications
- writes with response where required

### Android
Use Android BLE GATT for:
- permissions
- scan/discovery
- connectGatt
- service discovery
- characteristic read/write
- notifications / indications
- reconnection handling

Do not hardcode behavior to one trainer brand.

## Scope

### Included
- ERG mode toggle in session UI
- trainer capability discovery
- trainer connection state handling
- FTMS characteristic discovery
- target power control pipeline
- workout-segment-driven target updates
- telemetry subscription for watts and cadence
- safe enable / disable behavior
- fallback when trainer is not controllable
- logs and debug visibility for trainer control state

### Not Included
- trainer firmware updates
- proprietary vendor SDK integrations unless absolutely required later
- simulation-only fake control as the main implementation
- advanced calibration / spin-down flows
- multi-trainer control
- slope / SIM mode
- power matching to external power meter
- background workout execution while app is fully terminated

## UX Requirements

### Session UI
Add an **ERG toggle** inside the active session UI:

- ERG: Off
- ERG: On

### ERG availability states
The toggle should be enabled only when:
- a trainer is paired
- the trainer is connected
- the trainer exposes the required control capabilities

Possible UI states:
- ERG unavailable
- ERG available but off
- ERG active
- ERG error / lost control
- trainer unsupported

### Session indicators
Show:
- current target watts
- actual watts
- cadence
- ERG status
- trainer connection status

Optional but recommended:
- small status text such as:
  - “Controlling trainer”
  - “Trainer does not support ERG”
  - “Reconnecting to trainer”
  - “Control lost, ERG paused”

## Functional Flow

### 1. Pair and connect to trainer
When a trainer is paired and connected:
- discover services
- discover characteristics
- identify FTMS-related characteristics needed for telemetry and control

### 2. Capability validation
Before allowing ERG to be turned on:
- confirm the trainer exposes the expected FTMS service
- confirm the trainer exposes the control and telemetry characteristics needed
- inspect supported feature/range characteristics where available
- determine whether target power control is realistically supported

If not supported:
- disable ERG toggle
- show unsupported state
- do not attempt fake control

### 3. Enter ERG mode
When the user turns ERG on:
- claim trainer control if required by the control flow
- subscribe to status/telemetry notifications
- read supported power range if available
- compute target watts for the current workout segment
- send the initial target to the trainer
- mark ERG state as active only after trainer acknowledgement / successful write path

### 4. During workout
While ERG is active:
- keep listening to trainer telemetry
- update actual watts and cadence in the UI
- compare actual values to target
- do not spam trainer writes every second
- only send a new trainer target when:
  - the workout segment changes
  - the workout is paused/resumed
  - the user disables/re-enables ERG
  - a retry is needed after recoverable control failure

### 5. Segment transitions
At each workout segment transition:
- calculate the new segment target watts
- clamp it to trainer supported power range if required
- send the new target cleanly once
- update UI immediately
- confirm success or show control error if write fails

### 6. Exit ERG mode
When the user turns ERG off:
- stop sending target updates
- release trainer control if applicable
- keep telemetry running if the rest of the session still uses it
- update UI state accordingly

### 7. Disconnect / reconnect handling
If trainer connection drops:
- mark ERG as interrupted
- stop assuming control is active
- show reconnecting / disconnected state
- on reconnect:
  - rediscover capabilities if necessary
  - resubscribe to telemetry
  - only restore ERG if the app still considers ERG enabled and the trainer still supports control

## Workout Integration

Use the existing workout segment system.

Each workout segment already has:
- zone
- duration

Use the rider’s FTP to convert the active segment into a target wattage.

For MVP:
- derive target watts from the current workout segment and user FTP
- every segment should resolve to a single target watt value
- if needed, use midpoint logic for the zone target in this first version
- keep the target calculation modular so later we can support:
  - ramps
  - custom exact watt targets
  - cadence targets
  - bias/intensity adjustment

## ERG Target Calculation

Create a dedicated utility that:
- takes current segment
- takes user FTP
- returns target watts for ERG control

Keep this logic separate from BLE code.

Suggested MVP behavior:
- Zone 1 maps to an easy FTP-relative target
- Zone 2 maps to endurance target
- Zone 3 maps to tempo target
- Zone 4 maps to threshold target
- Zone 5 maps to hard interval target

The exact mapping constants should be centralized and easy to tune.

## Architecture Requirements

Create a clean separation of concerns.

### Recommended modules

#### TrainerConnectionManager
Responsible for:
- BLE scan/connect/disconnect
- service/characteristic discovery
- subscriptions
- write queue
- connection state

#### TrainerCapabilityResolver
Responsible for:
- reading FTMS-related services/characteristics
- determining whether ERG is supported
- extracting supported power range and other useful capabilities

#### ErgController
Responsible for:
- ERG on/off state
- current control ownership state
- sending target power updates
- clamping targets
- retry policy
- fail-safe behavior

#### WorkoutTargetEngine
Responsible for:
- translating current workout segment + FTP into target watts

#### TrainerTelemetryStore
Responsible for:
- latest watts
- cadence
- trainer status
- timestamps
- signal freshness

## Reliability Requirements

This feature must be robust.

### Write discipline
- serialize BLE control writes
- do not perform overlapping writes on the same connection
- wait for completion / acknowledgement before sending the next control write where required
- add timeout handling for control operations

### Safety / fail-safe rules
- if trainer support is incomplete, disable ERG rather than guessing
- if target write fails, keep session running but mark ERG as degraded/off
- if telemetry becomes stale for too long, show lost-data state
- if cadence drops dramatically and rider clearly cannot hold the target, do not thrash control writes
- if workout target exceeds supported trainer range, clamp and surface that state in logs

### Logging
Add debug logs for:
- discovery result
- FTMS capability detection
- ERG enable
- target sent
- target acknowledged
- target rejected / write failed
- reconnect flow
- ERG disable
- stale telemetry
- unsupported trainer reason

## State Model

Implement explicit ERG states:

- unavailable
- available
- enabling
- active
- interrupted
- error
- disabled

Do not rely on a single boolean alone.

## Data Needed From Trainer

Subscribe to and parse trainer telemetry needed for ERG monitoring:
- current power
- cadence
- trainer status if available

Store timestamps with every telemetry update so stale-data detection is possible.

## Permissions / System Requirements

Handle all needed Bluetooth permissions and runtime prompts.

### Android
Support the modern BLE permission flow and nearby device permissions.

### Apple
Handle Bluetooth authorization and central-role BLE use through Core Bluetooth.

## Testing Requirements

This feature must be tested against real hardware.

### Unit / logic tests
Cover:
- target watt calculation
- state transitions
- target clamping
- unsupported trainer detection logic
- retry / timeout behavior

### Integration tests
Cover:
- connect to supported trainer
- discover capabilities
- enable ERG
- send first target
- transition between workout segments
- disable ERG
- disconnect/reconnect handling

### Manual hardware test matrix
At minimum validate:
- supported FTMS trainer
- unsupported / telemetry-only trainer
- trainer disconnect during ERG
- pause/resume during ERG
- segment transitions while riding
- low cadence / high cadence while target remains active

## Acceptance Criteria

- A connected controllable trainer can be detected and marked ERG-capable
- The user can toggle ERG on/off inside the session
- When ERG is on, the app sends a target tied to the active workout segment
- The trainer target updates when the workout segment changes
- The app reads and displays actual watts and cadence during ERG
- The app does not spam writes continuously
- Unsupported trainers do not expose a broken ERG path
- BLE disconnects do not crash the session
- ERG transitions to safe states on errors
- The system is modular enough to support future slope mode and exact-watt custom workouts

## Notes for Implementation
- Prefer standards-based FTMS behavior first
- Do not hardcode to a single trainer manufacturer
- Keep all control writes serialized
- Keep target calculation separate from transport/BLE code
- Build the control layer so future features can reuse it:
  - exact watt workouts
  - interval ramps
  - intensity bias
  - SIM mode
  - external power matching