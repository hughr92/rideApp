Update the route profile / elevation graph so the visual scale reflects the actual difficulty of the route instead of always stretching the highest point to the top of the chart.

Problem:
Right now the elevation graph auto-scales so that the highest point always reaches the top of the graph area. This makes flat routes look too dramatic and makes all routes appear similarly mountainous, even when they are not.

Goal:
Make the route profile visually communicate route difficulty more honestly.
A mostly flat route should look mostly flat.
A steep climbing route should look steep.

Examples:
- A 30 km route with only 40 m of total climbing should appear nearly flat.
- A 10 km route with long sustained 7% climbing and a peak around 500 m should appear clearly steep and difficult.

Requirements:

1. Stop using “fit max elevation to chart height” as the primary scaling rule.
   Do not normalize every route so its highest point fills the graph.

2. Introduce a route profile scaling system that reflects real route difficulty using:
   - total route distance
   - total elevation gain
   - local grade / steepness
   - overall elevation range

3. The graph should preserve proportional differences between route types:
   - Flat routes should visually appear flat or gently rolling
   - Rolling routes should show modest repeated undulation
   - Hilly routes should show meaningful climbs and descents
   - Climbing routes should show clearly steep sustained ascent

4. Implement a scaling model that uses a more realistic vertical exaggeration rather than full normalization.
   Suggested approach:
   - compute horizontal distance scale from route distance
   - compute vertical scale from actual elevation change
   - apply a controlled vertical exaggeration factor
   - clamp exaggeration so flat routes are still readable but not misleading
   - do not allow tiny elevation changes to fill the chart

5. Add route-aware scaling rules.
   For example:
   - routes with very low elevation gain relative to distance should remain visually shallow
   - routes with steep sustained grades should appear steep
   - short, steep routes should look more aggressive than long, almost-flat routes

6. Consider using one or more of these signals in the scaling logic:
   - total ascent / distance ratio
   - max grade
   - average positive grade
   - elevation range
   - sustained climb segments

7. Preserve usability:
   - the route should still be readable on screen
   - extremely flat routes should still show some line variation
   - but flat routes must not look mountainous

8. Add a minimum and maximum vertical exaggeration range.
   Example concept:
   - minimum exaggeration: enough to make the line readable
   - maximum exaggeration: prevents unrealistic chart dramatization

9. The rider position indicator and route progress fill must continue to work exactly as before.

10. Keep the existing route profile component if possible, but update the scaling logic behind it.

11. Add clear helper functions and comments so the scaling can be tuned later.

Suggested implementation direction:
- Create a function that analyzes the route profile and returns a visual scaling factor
- Separate “data normalization” from “visual scaling”
- Keep the original route elevation data unchanged
- Only change how it is rendered

Suggested helper functions:
- getRouteDifficultyMetrics(route)
- getVerticalExaggerationFactor(metrics)
- mapElevationToChartY(elevation, scalingConfig)

Difficulty interpretation guidance:
- A route with tiny total ascent over long distance should render close to flat
- A route with sustained grades around 6–8% should render as visibly steep
- A route with large elevation range and shorter distance should render more dramatically than a long route with minor rolling terrain

Validation examples:
- 30 km / 40 m total climbing → mostly flat visual
- 10 km / sustained 7% climbing / ~500 m peak → steep visual
- rolling route with repeated small climbs → moderate undulation, not jagged mountains

Please:
- update the graph scaling logic
- preserve rider progress and route fill behavior
- keep the route profile visually clean
- avoid special-case hacks for only one route
- make the logic generalized and reusable