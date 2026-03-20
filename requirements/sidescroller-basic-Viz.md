Add a very basic side-scrolling race visualization to the app.

Goal:
Create a lightweight MVP visualization that shows all participants riding together on the course at the same time.

Important:
This is NOT the final visual style or final game view.
This is only a temporary visualization layer so we can see riders together in motion during a session and better understand relative spacing, pacing, and terrain.

Core visualization concept:
- Show a side-scrolling view
- Keep the main/local player fixed in the center of the screen
- Show other riders to the:
  - right if they are ahead
  - left if they are behind
- The visible frame represents the current 100 meters of the route
- The ground line should undulate based on the grade/elevation profile within that visible window
- Use very basic SVG-based rider/bike assets
- Keep everything intentionally simple and modular

Requirements:

1. View Framing
- The local/main player should remain centered horizontally in the viewport
- Treat the viewport as a moving window over the course
- The window should represent the current 100 meters of route around the player
- Other riders should be positioned relative to the main player based on distance traveled on the course

Example:
- if another rider is 12m ahead, place them to the right of center
- if another rider is 20m behind, place them to the left of center
- if another rider is outside the 100m window, either hide them or clamp them at the edge depending on what is simplest for MVP

2. Course Window / Coordinate Mapping
- Convert route distance into screen X position
- The local player’s route distance is the center reference
- Visible route range should be something like:
  - 50m behind the player
  - 50m ahead of the player
- Make this window size configurable

3. Terrain / Ground Rendering
- Render a simple ground/path line across the width of the viewport
- The shape of the ground should reflect the current elevation/grade within the visible 100m route window
- Use the actual route profile data if available
- If route data is segmented by grade/elevation, sample enough points to draw a smooth but simple line
- The terrain should visually rise and fall based on incline/decline
- Keep vertical exaggeration controlled so the view stays readable and not cartoonishly steep unless the route is actually steep

4. Rider Positioning on Terrain
- Each rider should sit on the ground line at their corresponding X position
- The rider sprite should align with the terrain height
- Optional for MVP:
  - rotate rider slightly to match local slope
- If rotation is too complex, keep riders upright for now

5. Assets / Visual Style
- Use very basic SVG assets or simple SVG-like shapes for:
  - bike
  - wheels
  - rider body
  - optional helmet/head
- Keep visuals intentionally minimal
- Do not spend time on polished art
- Prioritize clarity over aesthetics
- Structure asset usage so we can replace them later with better art or a different visual style

6. Animation
- Add very basic looping animation to imply motion
- At minimum:
  - wheel rotation
  - slight rider bobbing or simple movement cue
- Animation should be subtle and lightweight
- Do not build a full sprite animation system yet

7. Participants
- Render the local player and other active participants in the session
- Each participant should have:
  - id
  - name
  - distanceTraveled
  - optional color/accent for differentiation
- Optionally display the participant name above or near the rider
- Keep labels simple and readable

8. Relative Position Logic
- Use distance traveled on the course as the authoritative input
- Do not simulate new movement in this visualization layer
- This view should reflect existing session/race state only

Formula concept:
- relativeDistance = otherRider.distanceTraveled - localPlayer.distanceTraveled
- screenX = centerX + map(relativeDistance within visible range)

9. Camera / Scrolling Model
- The world should appear to move relative to the centered player
- The local player should not drift left/right during normal riding
- Terrain and other riders move relative to the local player position

10. UI / Overlay
- Keep overlays minimal
- Optional:
  - small names above riders
  - current visible range marker
- Do not clutter the screen with large telemetry UI inside this view unless already present elsewhere

11. Architecture
Please keep this modular:
- SideScrollRaceView component
- RiderVisual component
- TerrainProfileRenderer component
- helper functions for:
  - mapping route distance to screen position
  - sampling terrain in visible window
  - mapping elevation to screen Y
  - filtering visible riders

12. Data Inputs
Assume the visualization can consume:
- local player distance traveled
- all participants’ distances traveled
- route profile / elevation / grade data

Suggested inputs:
- localPlayer
- participants[]
- route
- visibleDistanceWindow = 100

13. MVP Constraints
- This is a temporary prototype visualization
- Do not over-engineer rendering
- Do not build a full game camera system
- Do not build collisions
- Do not build drafting visuals yet
- Do not build advanced parallax yet unless trivial

14. Behavior Expectations
- Riders ahead appear on the right
- Riders behind appear on the left
- As riders gain or lose distance, their screen positions should update smoothly
- The terrain shape should make it easier to understand whether the group is on a climb, descent, or rolling section

15. Optional Simple Enhancements (only if easy)
- faint sky/background color
- simple ground fill under terrain line
- edge fade for riders near window boundary
- slight tilt of bike/rider to terrain angle

16. Deliverables
Generate:
- a basic side-scrolling race visualization component
- simple SVG rider/bike assets or inline SVG shapes
- terrain rendering based on the current route window
- participant relative positioning
- local player centered camera behavior
- minimal animation for motion
- comments noting where the final visual system can later replace this prototype

Important product note:
This is a temporary shared-rider visualization prototype only.
It should help us understand pack spacing, movement, and terrain at a glance.
It is not intended to represent the final art direction or final gameplay presentation.

Please favor:
- simplicity
- readability
- modularity
- easy future replacement