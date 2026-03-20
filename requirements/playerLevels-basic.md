Add a basic user leveling and experience system to the app.

Goal:
Introduce the concept of player levels to the user profile.
Each user should earn experience over time and level up.
For now, levels are only progression and visual identity. We are NOT defining gameplay rewards or unlocks yet.

Core requirements:
1. Each user profile should have:
   - currentLevel
   - currentXp
   - totalXp
   - xpRequiredForNextLevel
   - levelProgressPercent

2. Level cap:
   - maximum level is 100

3. Experience should be earned from:
   - time spent riding
   - distance traveled
   - hills climbed

4. The progression curve should be long and meaningful.
   Reaching level 100 should take roughly:
   - about 2 years
   - assuming very consistent usage
   - approximately 1 hour of biking per day

5. Experience requirements should scale with level.
   - early levels should come faster
   - later levels should take much longer
   - use a progression curve, not a flat XP-per-level system

6. Keep the system simple and tunable.
   We want a good framework now, not perfect balancing.
   All XP values and scaling formulas should be easy to adjust later.

Functional requirements:

7. Add XP earning logic based on completed session data.
   The system should support awarding XP from:
   - session duration
   - session distance
   - elevation climbed / hills climbed

8. For now, define simple base XP sources such as:
   - XP per minute ridden
   - XP per km or mile traveled
   - XP per meter climbed

These values should be configurable constants.

9. Add a level calculation system that:
   - computes total XP earned
   - determines current level from total XP
   - determines current progress toward next level
   - respects level cap of 100

10. Add profile UI updates:
   - display the user’s level number around or near the profile photo
   - add a visible progress bar on the account/profile page
   - progress bar should show progress toward next level
   - optionally show text like:
     “Level 12”
     “1,240 / 1,800 XP to Level 13”

11. The level display should feel like part of the identity of the user profile.
   The current level should be visible in a compact, prominent way around or overlapping the profile image.

12. Session completion flow:
   After a ride/session ends:
   - calculate XP earned
   - add XP to the user profile
   - update level if thresholds are crossed
   - persist updated profile progression data

13. Add level-up detection:
   - if a session gives enough XP to cross one or more levels, handle it correctly
   - support multiple level-ups from one session even if rare
   - clamp at level 100

14. Persistence:
   - store level and XP data in the user profile data model
   - preserve this data across app restarts
   - use current local profile storage approach for MVP

15. Suggested architecture:
   Create modular logic such as:
   - progressionConfig.ts
   - calculateSessionXp(session)
   - getLevelFromTotalXp(totalXp)
   - getXpForLevel(level)
   - getProgressToNextLevel(totalXp)
   - applySessionXpToProfile(profile, session)

16. Suggested progression design:
   Use an increasing XP curve.
   Example acceptable approaches:
   - quadratic
   - exponential-lite
   - piecewise scaling
   - cumulative XP table

Important:
- do NOT hardcode every level manually unless you generate a table programmatically
- do NOT make level gains linear
- do make the tuning values easy to adjust

17. Balance target:
   Tune the initial values so that:
   - first few levels are quick and satisfying
   - mid levels slow down noticeably
   - level 100 is a long-term achievement
   - total time to level 100 is roughly aligned with 2 years of daily 1-hour riding

18. UI requirements:
   On the profile/account page show:
   - profile photo
   - level badge/level ring/level number near the photo
   - progress bar to next level
   - current XP progress text
   - optionally total XP in smaller text

19. Keep the visuals MVP-friendly.
   No advanced animations required.
   A simple progress bar and a clean level badge are enough.

20. Extensibility:
   Build this so later we can add:
   - rewards for level-up
   - unlocks
   - cosmetics
   - titles/badges
   - separate prestige systems if desired

21. Validation:
   Please ensure:
   - XP increases correctly after sessions
   - level is calculated correctly from total XP
   - progress bar always reflects current progress accurately
   - level never exceeds 100
   - users near max level still display correctly
   - reaching level 100 stops further level increases but may optionally still track total XP

22. Deliverables:
   Please generate:
   - profile data model updates
   - XP calculation logic
   - level progression logic
   - configurable progression constants
   - profile page UI updates
   - level progress bar
   - level badge around/near profile image
   - tests or validation helpers for progression math

Important product note:
This is a framework for long-term progression only.
Do not define gameplay bonuses, perks, or stat upgrades from levels yet.
We only want users to earn XP, level up, and see progress in their profile.