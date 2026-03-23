# Player Sprite Assignment System (PNG Assets)

## Overview
Create a lightweight system that loads six cyclist PNG sprite assets from the `imgLib` directory and assigns them to players based on the order they join the lobby.

The system should support up to six players and map each player to a unique sprite.

---

## Asset Requirements

- Load exactly six PNG files from the `imgLib` directory  
- Use the following naming convention:
  - rider1.png  
  - rider2.png  
  - rider3.png  
  - rider4.png  
  - rider5.png  
  - rider6.png  

- Store these assets in an indexed structure so they can be accessed by position (1–6)

---

## Player-to-Sprite Mapping

Assign sprites based on the order players join the lobby:

- Player 1 → rider1.png  
- Player 2 → rider2.png  
- Player 3 → rider3.png  
- Player 4 → rider4.png  
- Player 5 → rider5.png  
- Player 6 → rider6.png  

If more than six players attempt to join:
- Reject additional players (MVP behavior)

---

## Player Data Requirements

Each player should include:

- Unique player identifier  
- Join order (1–6)  
- Assigned sprite asset  

---

## Flow: Player Join

When a player joins the lobby:

1. Determine current number of players  
2. Assign the next available join order (maximum of 6)  
3. Assign the corresponding sprite based on join order  
4. Add player to active session list  

---

## Rendering Requirements

- Each player must render using their assigned sprite  
- Sprites should be oriented for a side-scrolling game (facing right)  
- No animation required (static sprite only for MVP)

---

## Constraints (MVP Scope)

- Maximum of 6 players  
- No sprite customization  
- No animation system  
- No sprite flipping or directional logic  
- Keep implementation simple and readable  

---

## Notes

- This system should be easy to extend later for:
  - Animation frames (pedaling)
  - Bot riders using unused sprites
  - Multiplayer synchronization  