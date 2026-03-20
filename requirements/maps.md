Create a route system for a bike fitness app using the following real-world-inspired cycling climbs as templates. The goal is to convert route elevation into gradient segments that directly influence rider speed, avatar movement, downhill acceleration, uphill slowing, and trainer simulation.

Use these 10 routes as predefined route objects:

1. Alpe d’Huez (France)
- distanceKm: 13.8
- elevationGainM: 1096
- startElevationM: 754
- summitElevationM: 1850
- avgGradientPct: 7.9

2. Mont Ventoux (Bédoin, France)
- distanceKm: 21.2
- elevationGainM: 1577
- avgGradientPct: 7.5

3. Passo dello Stelvio from Prato (Italy)
- distanceKm: 24.5
- elevationGainM: 1824
- startElevationM: 934
- summitElevationM: 2758
- avgGradientPct: 7.5

4. Col du Tourmalet from Luz-Saint-Sauveur (France)
- distanceKm: 18.8
- elevationGainM: 1357
- startElevationM: 757
- summitElevationM: 2115
- avgGradientPct: 7.2

5. Col du Galibier from Valloire (France)
- distanceKm: 17.5
- elevationGainM: 1214
- startElevationM: 1427
- summitElevationM: 2642
- avgGradientPct: 7.0

6. Sa Calobra / Coll dels Reis (Mallorca, Spain)
- distanceKm: 9.9
- elevationGainM: 696
- startElevationM: 28
- summitElevationM: 724
- avgGradientPct: 7.0

7. Passo Pordoi from Arabba (Italy)
- distanceKm: 9.2
- elevationGainM: 638
- startElevationM: 1601
- summitElevationM: 2239
- avgGradientPct: 6.9

8. Alto de l’Angliru (Spain)
- distanceKm: 12.1
- elevationGainM: 1243
- startElevationM: 331
- summitElevationM: 1574
- avgGradientPct: 10.2

9. Muur van Geraardsbergen (Belgium)
- distanceKm: 1.1
- elevationGainM: 85
- startElevationM: 19
- summitElevationM: 104
- avgGradientPct: 8.1
- maxGradientPct: 17.6

10. Box Hill Zig Zag Road (England)
- distanceKm: 4.3
- elevationGainM: 204
- avgGradientPct: 5.0

Implementation requirements:

1. Create a Route data model with:
- id
- name
- country
- distanceKm
- elevationGainM
- startElevationM
- summitElevationM
- avgGradientPct
- maxGradientPct optional
- elevationProfile: array of route points

2. Each elevationProfile should be generated as sampled points every 50m or 100m along the route:
- distanceFromStartM
- elevationM
- gradientPct for the segment starting at this point

3. Do not use a perfectly linear climb.
Generate a believable climb profile for each route:
- famous Alpine climbs should vary between easier ramps, sustained middle gradients, and harder final sections
- Sa Calobra should feel like a steady hairpin climb
- Angliru should include severe late ramps
- Muur should be short and punchy
- Box Hill should be gentle and rolling compared to the others

4. Build utility functions:
- getElevationAtDistance(route, distanceM)
- getGradientAtDistance(route, distanceM)
- getRemainingDistance(route, distanceM)
- getRemainingClimb(route, distanceM)

5. Build a rider movement function where gradient affects speed:
- uphill reduces speed naturally
- downhill increases speed naturally
- acceleration should feel smooth, not instant
- allow coasting and downhill carry speed
- expose hooks for drafting and trainer resistance later

6. Add a debug UI or dev overlay showing:
- current route name
- total distance
- ridden distance
- current elevation
- current gradient
- next 500m average gradient
- remaining climb

7. Seed the app with all 10 routes as selectable presets.

8. Keep code modular and production-oriented:
- route presets in a dedicated data file
- route/elevation math in utility modules
- rider physics in a separate simulation module

9. Provide:
- route type definitions
- sample seeded data
- route generation helpers
- gradient calculation helpers
- a simple example screen/component that visualizes the elevation profile and current rider position on the route

10. Make the elevation profile easy to swap later with real GPX-derived route data.
Design the system so manually seeded routes and imported GPX routes use the same internal structure.