Add a very simple bike selection system to the app that affects route performance.

Goal:
Allow the rider to choose between two bike types before starting a route:
1. Climbing Bike
2. Road Bike

This system should feed into the existing speed calculation so that rider movement is influenced not just by watts, but also by:
- rider weight
- bike weight
- bike aerodynamics

This should be implemented in a way that is simple for MVP but easy to expand later with more bike types.

Core design goals:
- The climbing bike should perform better on climbs because it is lighter
- The road bike should perform better on flats (and generally at higher speed) because it is more aerodynamic
- Each bike should have a clear strength and weakness
- The UI should explain the pros and cons of each bike choice
- The architecture should support adding more bike options later without rewriting core logic

Requirements:

1. Add a bike selection step before starting a route/session.
   The rider should be able to choose between:
   - Climbing Bike
   - Road Bike

2. Each bike should have a simple data model with properties such as:
   - id
   - name
   - description
   - weightKg
   - aeroRating or dragCoefficientModifier
   - climbingModifier (optional if needed)
   - flatModifier (optional if needed)

3. For MVP, create two bikes with simple, readable values:

   Climbing Bike:
   - lighter weight
   - worse aerodynamics
   - better uphill performance
   - weaker downhill / flat performance

   Road Bike:
   - heavier weight
   - better aerodynamics
   - better flat / fast downhill performance
   - weaker uphill performance

4. Update the speed / movement calculation to factor in:
   - rider power (watts)
   - rider weight
   - bike weight
   - gradient
   - aerodynamic effect

5. Keep the physics simple but directionally believable.

Implementation guidance:
- uphill performance should be more influenced by total system weight:
  total_mass = rider_weight + bike_weight
- flat/downhill performance should be more influenced by aerodynamic drag
- the climbing bike should gain an advantage on sustained climbs
- the road bike should gain an advantage on flats and faster sections

6. Keep the model simple and tunable.
   Do not build a highly realistic simulation yet.
   Prioritize:
   - clear differences
   - believable behavior
   - easy balancing later

7. Add a UI component for bike choice.
   This should show:
   - bike name
   - short description
   - pros
   - cons

Example copy direction:
- Climbing Bike:
  Pros: lighter, better on climbs
  Cons: less aerodynamic, slower on flats and descents

- Road Bike:
  Pros: faster on flats, more aerodynamic
  Cons: heavier, slower on climbs

8. The selected bike should be saved into the route/session state and used during simulation.

9. Make the system extensible.
   Structure the code so more bike types can be added later, such as:
   - time trial bike
   - gravel bike
   - mountain bike

10. Suggested code structure:
- bikeTypes.ts or bikeCatalog.ts
- getSelectedBike()
- calculateSpeedFromPowerAndRoute(...)
- bike selection UI component
- route/session state integration

11. Suggested data example:

{
  "id": "climbing_bike",
  "name": "Climbing Bike",
  "description": "Lightweight bike built for hills.",
  "weightKg": 6.8,
  "aeroModifier": 1.1
}

{
  "id": "road_bike",
  "name": "Road Bike",
  "description": "More aerodynamic bike built for speed on flatter terrain.",
  "weightKg": 8.2,
  "aeroModifier": 0.95
}

These are placeholder balancing values and should be easy to tune later.

12. Calculation guidance:
Use a simplified speed model where:
- climbing is penalized by total mass and gradient
- flat/downhill performance benefits from lower aerodynamic drag
- bike choice slightly shifts the result, but rider watts remain the main driver

13. UX requirements:
- make the choice easy to understand
- clearly communicate strengths and weaknesses
- show which bike is currently selected
- default to one of the bikes if the user does not choose

14. Validation:
Please ensure:
- climbing bike is measurably better uphill than road bike at equal rider watts/weight
- road bike is measurably better on flats than climbing bike at equal rider watts/weight
- the selected bike affects route simulation without breaking existing route logic
- the system is easy to expand later

Deliverables:
- bike data model
- two starter bike definitions
- bike selection UI
- integration into route/session state
- updated speed calculation
- comments showing where more bike types can be added later

Important:
Keep this as an MVP-friendly framework.
Do not overcomplicate the physics.
The goal is to make bike choice meaningful, understandable, and extensible.