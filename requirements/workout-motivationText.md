# PRD: In-Session Motivational Prompts for Workouts

## Overview
Add a lightweight in-session motivational prompt system that displays short contextual messages to the rider during a workout.

The goal is to improve workout engagement by showing encouraging and informative prompts at sensible moments based on the current workout zone, the remaining duration of the current interval, and the next interval that is coming up.

This should feel supportive and organic, not noisy or repetitive.

This is an MVP feature. It should be fully system-driven and not editable in the UI.

---

## Goal
Create a simple rules-based prompt system that:

- Watches the rider’s current workout interval
- Detects the current zone and time remaining in that interval
- Displays short motivational prompts near the end of the interval
- Adjusts message timing based on effort intensity and duration
- References the rider’s username when available
- Uses a small pool of varied messages so the experience feels less repetitive

---

## User Problem
Right now, workouts provide structure but not encouragement.

Users may lose focus during long endurance intervals or struggle mentally during short high-intensity efforts. A small amount of timely encouragement can make the session feel more guided and alive without introducing major complexity.

---

## MVP Scope
This feature should include:

- A new motivational prompt element inside the session UI
- Rules that trigger prompts near the end of workout intervals
- Different timing behavior depending on the workout zone and interval duration
- Context-aware message selection based on:
  - current zone
  - time remaining
  - upcoming zone
  - username
- A small internal library of motivational lines
- Basic repetition protection so the same line does not appear too frequently

This feature should not include:

- User editing of prompt rules
- User editing of motivational lines
- Voice playback
- Text-to-speech
- Prompt history log
- Settings UI for enabling or disabling prompts
- Per-workout customization
- AI-generated messaging

---

## Core Product Behavior

### Session Prompt Element
Add a small speech-tag style UI element inside the workout session screen.

This element should:

- Appear clearly but not dominate the screen
- Feel like an in-session coaching cue
- Display one message at a time
- Fade in and out cleanly
- Auto-dismiss after a short duration
- Avoid blocking critical ride metrics

The prompt should behave like lightweight guidance, not like a modal or disruptive alert.

---

## Prompt Trigger Philosophy
Prompts should happen near the end of an interval, not constantly throughout.

The system should help the rider by:

- letting them know the interval is nearly over
- encouraging them through the hardest part of the effort
- giving them context on what is coming next

The system should avoid:

- excessive chatter
- repeating the same message too often
- showing prompts too close together
- interrupting very short transitions too aggressively

---

## Interval Awareness
The logic should operate at the interval level.

For each active workout interval, the system should know:

- current zone
- total interval duration
- elapsed interval time
- remaining interval time
- next interval zone if one exists
- next interval duration if one exists

This logic should work for both prebuilt workouts and user-created workouts, as long as the workout is represented by the existing segment system.

---

## Prompt Timing Rules by Zone

### Zone 1
Zone 1 is low intensity and typically longer duration. Prompts should be sparse.

Recommended trigger windows:
- 10 minutes remaining
- 5 minutes remaining
- 1 minute remaining

Use these only when the interval is long enough for them to make sense.

Examples:
- Do not show a 10-minute remaining prompt if the whole interval is only 8 minutes long
- Do not spam multiple prompts in very short Zone 1 segments

Prompt tone:
- calm
- steady
- informative
- light encouragement

---

### Zone 2
Zone 2 is still controlled endurance work, but may benefit from slightly more guidance than Zone 1.

Recommended trigger windows:
- 5 minutes remaining
- 2 minutes remaining
- 1 minute remaining

Prompt tone:
- steady
- encouraging
- focused on rhythm and consistency

---

### Zone 3
Zone 3 is moderate work and should feel more active.

Recommended trigger windows:
- 2 minutes remaining
- 1 minute remaining
- 30 seconds remaining

Prompt tone:
- encouraging
- focused
- controlled urgency

---

### Zone 4
Zone 4 is hard sustained work. Prompts should support the rider through the end of the effort.

Recommended trigger windows:
- 1 minute remaining
- 30 seconds remaining
- 10 seconds remaining

Prompt tone:
- strong encouragement
- confidence-building
- reminder that relief or transition is near

---

### Zone 5
Zone 5 is very hard and often short. Prompts should be concise and helpful.

Recommended trigger windows:
- 15 seconds remaining
- 10 seconds remaining
- 5 seconds remaining

The system should only use triggers that fit the interval duration.

Examples:
- If the interval is 20 seconds long, do not attempt three prompts
- If the interval is 30 seconds long, one or two prompts is enough
- Prefer only the most meaningful late-stage prompts

Prompt tone:
- urgent
- encouraging
- short
- high energy

---

## Duration Sensitivity
Prompt timing should be filtered by interval length.

The system should not blindly apply every trigger window to every interval.

Examples of desired behavior:

- Long low-intensity intervals can support a few spaced prompts
- Short hard intervals should only show one or two short prompts
- Very short intervals may only get one prompt near the end
- If a trigger would cause clutter, skip it

The feature should prioritize quality over quantity.

---

## Prompt Frequency Rules
To prevent over-messaging, add the following constraints:

- Only one prompt can be visible at a time
- Prompts should not fire too close together
- If two trigger windows are very close in practice, prefer the later and more relevant one
- Very short intervals should not receive multiple overlapping prompts
- Repeating the exact same line back-to-back should be avoided
- The same line should not be selected again too soon if alternatives exist

Add a simple cooldown between prompts at the session level so the rider is not flooded during dense interval transitions.

---

## Message Content Rules
Messages should combine encouragement with useful context.

They should often include one or more of the following:

- rider username
- how much time is left in the current interval
- reassurance that the current effort is nearly done
- what kind of zone is coming next
- whether a rest or easier effort is coming
- whether another hard effort is coming

The best prompts should feel like a coach giving short, timely cues.

---

## Username Personalization
When possible, messages should include the rider’s username as a variable.

Examples of desired style:
- Great work, Hugh, only a little more to go
- Stay smooth, Hugh, recovery is coming up
- Keep pushing, Hugh, you’re almost through this effort

If no username is available, the prompt should still read naturally without it.

---

## Upcoming Interval Context
When a next interval exists, the prompt system should adapt messaging based on what comes next.

Examples of contextual behavior:

- If an easier zone is coming next, the prompt can emphasize that recovery is coming
- If another hard zone is coming next, the prompt can encourage the rider to finish strong and prepare for the next push
- If the workout is ending, the prompt can reinforce that the effort is almost complete

This makes the feature feel smarter without adding major complexity.

---

## Prompt Categories
Organize internal message templates into categories.

### Endurance Calm
Used mostly for Zones 1 and 2.

Tone:
- steady
- reassuring
- low pressure

Purpose:
- maintain engagement without overhyping easy work

---

### Controlled Push
Used mostly for Zones 3 and 4.

Tone:
- focused
- supportive
- slightly urgent

Purpose:
- help the rider stay committed through meaningful work

---

### High Intensity Finish
Used mostly for Zone 5.

Tone:
- direct
- energetic
- concise

Purpose:
- get the rider through the last moments of a hard effort

---

### Recovery Incoming
Used when the next interval is easier.

Tone:
- reassuring
- relief-oriented
- celebratory

Purpose:
- help the rider hold on because easier work is coming

---

### More Work Ahead
Used when another hard effort is coming next.

Tone:
- resilient
- focused
- realistic

Purpose:
- encourage the rider to complete the current effort while preparing mentally for the next one

---

### Workout Ending
Used when the interval is one of the final segments or the session is about to conclude.

Tone:
- rewarding
- encouraging
- positive

Purpose:
- reinforce accomplishment and close the workout well

---

## Message Variety Requirements
Each category should have multiple message options.

Requirements:
- Avoid using only one message per scenario
- Rotate through available messages
- Avoid immediate repeats
- Keep lines short and readable
- Keep tone positive and grounded
- Avoid cheesy or excessive language

The system should feel varied enough that repeated workouts do not always display the exact same wording.

---

## Message Style Guidelines
Messages should be:

- short
- readable at a glance
- supportive
- context-aware
- appropriate to workout intensity

Messages should not be:

- overly long
- sarcastic
- overly dramatic
- cluttered with too much information
- repetitive in structure every time

---

## Display Behavior
The prompt element should:

- appear briefly when triggered
- remain visible long enough to read comfortably
- dismiss automatically
- optionally fade or slide in subtly
- not require user interaction

If a new prompt would conflict with a currently visible prompt, prefer suppressing or delaying the new one rather than stacking multiple prompts.

---

## Data and Configuration
For MVP, all motivational rules and message templates should be internal to the app.

They should live in code or configuration and not be exposed in the UI.

Recommended internal structure:
- zone-based trigger definitions
- category-based message pools
- lightweight selection rules
- repetition protection state

This should be organized so it can later be extended into editable workout-specific prompts if needed.

---

## Future-Proofing
While customization is out of scope now, the implementation should not block future features such as:

- workout-specific motivational messages
- user-authored prompt libraries
- coach voice packs
- text-to-speech
- per-user tone preferences
- prompt enable or disable settings
- different coaching styles

The MVP should be structured so these can be added later without rewriting the core trigger system.

---

## Acceptance Criteria

### Functional
- The session UI includes a motivational prompt element
- Prompts trigger automatically during workout intervals
- Trigger timing changes based on workout zone
- Trigger timing respects interval duration
- Messages can include the rider’s username
- Messages can reference what is coming next in the workout
- Prompt selection includes variety
- Immediate repetition is avoided
- Prompts do not overwhelm the rider

### UX
- Prompts are noticeable but not disruptive
- Prompts are readable at a glance
- Prompts feel supportive and relevant
- Long easy intervals do not feel spammy
- Short hard intervals receive concise and timely encouragement

### Technical
- The logic works with the existing workout segment system
- The feature does not require workout editor changes
- The feature can be extended later without major rework

---

## Example Desired Experience

### Long Zone 1 Interval
A rider is in a long easy endurance block.

Desired experience:
- one prompt when there are 10 minutes left
- one prompt when there are 5 minutes left
- one prompt near the final minute
- messaging is calm and may mention whether harder work is coming next

---

### Short Zone 5 Interval
A rider is in a 30-second high-intensity effort.

Desired experience:
- one prompt around the last 10 to 15 seconds
- possibly one final short push cue near the end if spacing allows
- messaging is brief, energetic, and focused on holding on

---

### Hard Interval Into Recovery
A rider is finishing a hard effort and the next interval is easier.

Desired experience:
- the prompt encourages the rider to stay committed
- it mentions that recovery is coming next
- it feels timely and rewarding

---

### Hard Interval Into Another Hard Interval
A rider is nearing the end of a hard effort and another hard effort follows.

Desired experience:
- the prompt acknowledges the challenge
- it encourages strong completion
- it mentally prepares the rider for what is next

---

## Implementation Notes
Keep the implementation lightweight and deterministic.

Do not add unnecessary systems or UI complexity.

Focus on:
- smart trigger timing
- clean message selection
- smooth session integration
- readable prompt presentation

This should feel like a small but meaningful layer of coaching added to the workout experience.