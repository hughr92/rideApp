Add a basic bot rider system to the app.

Goal:
Allow the user to add AI/bot riders to a session so they can ride against them or use them as pacing targets.

For MVP:
- user can add up to 3 bots to a session
- each bot has a selectable difficulty level
- each difficulty level maps to a theoretical FTP value
- bots should simulate riding output based on that FTP level
- bots are not meant to be highly realistic yet; they just need to provide believable pacing/challenge

This system should be simple, readable, and easy to expand later.

Core Requirements:

1. Bot Rider Support
- Allow the user to add bots to a session before the ride starts
- Maximum additional bots: 3
- Bots should appear in the participant list and behave like other session riders in the UI

2. Difficulty Levels
Create 9 bot difficulty levels.
Each level should clearly indicate:
- difficulty label
- theoretical FTP

Suggested MVP structure:
- Level 1
- Level 2
- Level 3
- Level 4
- Level 5
- Level 6
- Level 7
- Level 8
- Level 9

Each level should map to a simple FTP target, for example:
- Level 1: 120 W
- Level 2: 140 W
- Level 3: 160 W
- Level 4: 180 W
- Level 5: 200 W
- Level 6: 230 W
- Level 7: 260 W
- Level 8: 300 W
- Level 9: 340 W

These are placeholder values and should be easy to tune later.

3. Bot Configuration UI
Before starting a session, allow the user to:
- add a bot
- remove a bot
- choose the difficulty for each bot
- see the FTP value associated with that difficulty

Suggested UI per bot:
- Bot name (e.g. Bot 1, Bot 2, Bot 3)
- Difficulty selector
- FTP display
- Remove button

4. Bot Naming
Use simple default names for now:
- Bot 1
- Bot 2
- Bot 3

Structure this so custom names can be added later if desired.

5. Bot Behavior
Bots should simulate a rider whose output is based on their FTP.
For MVP:
- bot power output should be generated from a simple pacing model
- their effort should be consistent and believable, not random and chaotic
- bots should be useful either as:
  - a challenge rider
  - a pacing rider to follow

6. MVP Bot Power Model
Keep this simple.
A bot should ride at a sustainable fraction of its FTP depending on context.

Suggested MVP logic options:
- steady pacing model:
  - bot rides around a target percentage of FTP
- small variation model:
  - slight controlled fluctuations around that target
- optional terrain sensitivity:
  - increase/decrease output slightly on hills/flats if easy to implement

Important:
- avoid wild random spikes
- avoid unrealistic surging every second
- prioritize smooth, predictable pacing

7. Suggested Bot Power Behavior
For an MVP pacing/challenge model:
- bot target power should generally stay near a stable effort level
- example:
  - easy bot rides at 70–80% of FTP
  - stronger bot rides at 80–90% of FTP
- add small smooth variation to avoid feeling robotic

Optional:
- if route grade exists, allow slight adjustments:
  - a bit more effort uphill
  - a bit less on descents
But keep it simple.

8. Integration With Existing Simulation
Bots should plug into the same route/session systems as real riders:
- distance progression
- speed calculation
- terrain interaction
- bike logic if applicable
- leaderboard / session UI
- side-scrolling rider view if present

Important:
- bots should produce simulated power data
- that power should feed into the same movement logic as a real rider

9. Session State
Add bots to session state as participants with a flag such as:
- isBot: true

Suggested bot participant fields:
- id
- name
- isBot
- difficultyLevel
- ftpWatts
- currentPower
- currentHeartRate (optional/fake if needed)
- distanceTraveled

10. FTP Communication in UI
Clearly show the user what each bot difficulty represents.

Example:
- Level 4 — 180 W FTP
- Level 7 — 260 W FTP

The goal is to make the challenge understandable before the ride starts.

11. Rider Cap
Enforce a hard max of 3 bots.
If user already has 3 bots:
- disable add button
or
- show simple message

12. UX Goal
The user should be able to:
- open session setup
- add up to 3 bots
- set difficulty for each
- understand their FTP level
- start the ride and use them as pacers or competitors

13. Architecture
Keep the implementation modular.

Suggested files/modules:
- botDifficultyConfig.ts
- botRiderFactory.ts
- botPacingEngine.ts
- addBotToSession(...)
- removeBotFromSession(...)
- updateBotDifficulty(...)
- simulateBotPower(...)

14. Extensibility
Structure the system so we can later add:
- smarter terrain-aware bots
- drafting behavior
- bike choices for bots
- pacing styles
- named rival riders
- ghost riders based on past sessions
- more than 9 difficulty levels if needed

15. Validation
Ensure:
- user can add 1 to 3 bots
- user cannot exceed 3 bots
- each bot can have its own difficulty level
- each difficulty displays its FTP clearly
- bots appear in session/race UI
- bots generate stable believable power
- bots affect distance/speed through the same systems as other riders
- removing a bot updates session state correctly

16. Deliverables
Generate:
- bot difficulty config with 9 levels
- session setup UI for adding/removing/configuring bots
- bot participant/session integration
- simple bot pacing/power simulation
- display of FTP per difficulty level
- validation for max 3 bots
- comments for future expansion

Important Product Note:
This is an MVP bot system.
Do NOT overcomplicate it with advanced AI, tactics, or racing behavior yet.
The main purpose is:
- pacing
- challenge
- comparative riding presence

Bots should feel steady, understandable, and useful.