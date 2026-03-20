Add a basic FTP (Functional Threshold Power) system to the app.

Goal:
Introduce FTP as a user profile metric.
FTP represents the theoretical maximum watt output a user can sustain for approximately 1 hour.

For MVP:
- FTP should exist as part of the user profile
- FTP should be manually editable by the user
- FTP should be available for use in other systems later (power zones, workouts, progression, bike simulation, etc.)
- We are NOT building automatic FTP detection or testing yet

Core Requirements:

1. User Profile Data Model
Add FTP to the user profile as a numeric field.

Suggested profile field:
- ftpWatts: number | null

Requirements:
- support empty/null FTP for users who have not set it yet
- persist FTP in the existing user profile storage
- make it easy to access throughout the app

2. Manual Editing
Allow the user to manually enter and edit their FTP value.

Requirements:
- add an editable FTP field in the profile/account page
- allow numeric input only
- validate the input before saving
- save changes to the user profile

Suggested UX:
- label: “FTP”
- help text: “Functional Threshold Power — the maximum power you can theoretically sustain for about one hour.”
- unit: watts (W)

3. Validation Rules
Keep validation simple and practical for MVP.

Suggested validation:
- must be a positive number
- reject zero or negative values
- reject non-numeric input
- optionally clamp to a reasonable range, for example:
  - minimum: 50 W
  - maximum: 600 W

If invalid:
- show a simple validation message
- do not save bad input

4. Profile UI
Update the user profile/account page to display:
- current FTP value
- edit control/input
- save/update action if needed

Display examples:
- FTP: 245 W
- or “Set your FTP” if none exists yet

5. Architecture
Keep the implementation modular and easy to expand later.

Suggested pieces:
- profile model update
- getUserFtp(profile)
- updateUserFtp(profile, ftpWatts)
- validateFtp(value)

6. Future Extensibility
Structure this so FTP can later be used for:
- heart rate / power zone calculations
- workout targeting
- personalized effort scaling
- difficulty recommendations
- rider comparisons
- progression metrics

Do not implement these systems yet.
Just make FTP available for them.

7. Optional Nice-to-Have (Only if Easy)
If simple to add, include a small explanation or info text such as:
“FTP is an estimate of the highest average power you can sustain for around 60 minutes.”

8. Persistence
Make sure FTP:
- is saved with the profile
- survives app restarts
- loads correctly when the profile is opened

9. Validation / Testing
Ensure:
- user can add FTP if none exists
- user can edit FTP later
- invalid values are blocked
- saved FTP displays correctly after reload
- null/empty FTP state is handled gracefully

10. Deliverables
Generate:
- profile data model update
- FTP input/edit UI on account/profile page
- validation logic
- persistence integration
- helper functions for future reuse
- comments showing where future FTP-based systems can plug in

Important Product Note:
This is an MVP profile feature only.
Do NOT implement:
- FTP test workouts
- automatic FTP estimation
- zone calculations
- adaptive training logic

For now, the user only needs to be able to view and manually edit their FTP.