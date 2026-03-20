Add a Random Route Generator feature to the app.

Requirements:
- Add a new option in route selection: “Generated Route”
- Generated routes must work exactly like existing routes in the simulation
- Generated route must include gradient/elevation data and render in the existing cross-section UI
- Route must start and end at the same altitude
- Total ascent and descent should be balanced
- Add a hilliness selector:
  - Flat
  - Rolling
  - Hilly
  - Climbing
- Add total route distance input
- Add regenerate button

Generation rules:
- Build route from multiple segments
- Each segment should have distance, grade, and elevation change
- Smooth transitions between segments
- Avoid noisy or jagged terrain
- Keep grades within believable cycling limits
- Absolute max grade: +/-12%
- Prefer these ranges:
  - Flat: mostly 0% to 2%
  - Rolling: mostly -4% to +4%
  - Hilly: mostly -6% to +6%
  - Climbing: sustained climbs around 6% to 10%, rare brief ramps to 12%

Technical requirements:
- Create a reusable route generation module/service
- Output the same route shape used by prebuilt routes
- Ensure generated routes plug into:
  - route simulation
  - elevation profile / cross-section
  - rider progress display
  - trainer resistance logic

UI requirements:
- Show generated route profile immediately after generation
- Show:
  - route distance
  - total ascent
  - total descent
  - max grade
  - hilliness preset
- Let user confirm and use generated route

Validation:
- End altitude must equal start altitude
- Distance must match selected target
- Grades must remain within limits
- Generated route must be accepted by existing route logic without special-case hacks

Please produce:
- route generator logic
- updated route selection UI
- integration with route rendering
- tests / validation helpers
- clear comments for future tuning