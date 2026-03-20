# Product Requirements Document (PRD)

## BikeApp MVP – Profiles, Authentication, and Friends System

---

## 1. Overview

### Objective

Build a cross-platform (desktop + mobile) user account system that allows:

* user authentication
* persistent profiles across devices
* profile editing (name, weight, height, etc.)
* profile picture upload
* adding and managing friends

This system will serve as the foundation for multiplayer lobbies and gameplay features.

---

## 2. Goals

### Primary Goals

* Users can create and log into an account
* Users can access their profile from any device
* Users can edit and persist personal profile data
* Users can upload and display a profile picture
* Users can find and add friends
* Users can manage a friends list

### Non-Goals (MVP)

* No public social profiles
* No messaging system
* No follower system
* No large-scale matchmaking
* No advanced privacy controls beyond basic defaults

---

## 3. Target Users

* Solo users tracking workouts
* Small private groups of friends (invite-based)
* Users with multiple devices (desktop + mobile)

---

## 4. Technical Scope

### Platforms

* Desktop (Windows/Mac)
* Mobile (iOS/Android)

### Backend (Recommended)

* Firebase Auth (authentication)
* Firestore (database)
* Firebase Storage (profile images)

---

## 5. Core Features

---

## 5.1 Authentication System

### Description

Users must be able to create and access accounts securely.

### Requirements

* Email + password sign up
* Email + password login
* Password reset via email
* Persistent login session (user remains logged in)
* Logout functionality

### Acceptance Criteria

* User can sign up and immediately access the app
* User remains logged in after app restart
* User can log in on a second device and access same account
* Password reset email is sent successfully

---

## 5.2 User Profile System

### Description

Each user has a profile stored in the cloud and synced across devices.

### Data Model: UserProfile

```
id: string (auth user id)
email: string
displayName: string
age: number
weight: number
weightUnit: "kg" | "lb"
height: number
heightUnit: "cm" | "ft_in"
weightKg: number (normalized)
heightCm: number (normalized)
profilePhotoUrl: string
createdAt: timestamp
updatedAt: timestamp
```

### Requirements

* Profile is automatically created on signup
* Profile is fetched on login
* Profile persists across devices
* Profile updates overwrite previous values (latest write wins)

### Acceptance Criteria

* Profile loads on login
* Profile edits are saved to backend
* Same profile appears on another device after login

---

## 5.3 Profile Editing

### Description

Users can update personal information.

### Editable Fields

* display name
* age
* weight + unit
* height + unit
* profile picture

### Validation Rules

* displayName: 2–24 characters
* age: 13–100
* weight > 0
* height > 0

### Acceptance Criteria

* Invalid inputs are rejected
* Valid inputs save successfully
* UI reflects updated values immediately

---

## 5.4 Profile Picture Upload

### Description

Users can upload and update an avatar image.

### Flow

1. Select image from device
2. Resize/compress client-side
3. Upload to storage
4. Save returned URL to profile

### Requirements

* Supported formats: jpg, png, webp
* File size limit enforced
* Image stored at:
  `profile_photos/{userId}/avatar.jpg`

### Acceptance Criteria

* Uploaded image appears immediately
* Image persists across devices

---

## 5.5 Public Profile Summary

### Description

A limited public-facing version of a user profile for discovery.

### Data Model

```
userId: string
displayName: string
profilePhotoUrl: string
```

### Requirements

* No private data exposed (age, weight, height)
* Used for search and friends list

---

## 5.6 Friends System

### Description

Users can connect with other users.

---

### 5.6.1 Friend Request Model

```
id: string
fromUserId: string
toUserId: string
status: "pending" | "accepted" | "rejected"
createdAt: timestamp
```

---

### 5.6.2 Friendship Model

```
id: string (sorted_userA_userB)
userIds: [userA, userB]
createdAt: timestamp
```

---

### 5.6.3 Features

#### Send Friend Request

* User searches another user
* Sends request

#### Accept Request

* Creates friendship record
* Updates request status

#### Reject Request

* Marks request rejected or deletes

#### Cancel Request

* Sender can cancel pending request

#### Remove Friend

* Deletes friendship record

---

### Acceptance Criteria

* Cannot send request to self
* Cannot duplicate requests
* Accepted users appear in both friend lists
* Removing a friend removes from both users

---

## 5.7 User Search

### Description

Users can find others to add as friends.

### Search Inputs

* email (primary)
* display name (secondary)

### Output

```
userId
displayName
profilePhotoUrl
```

### Rules

* Exclude self
* Exclude existing friends
* Exclude pending requests where applicable

---

## 6. Data Storage Design

### Collections

* users (private profile)
* publicProfiles
* friendRequests
* friendships

### Storage

* profile_photos/{userId}/avatar.jpg

---

## 7. Sync Behavior

### Requirements

* Fetch profile on login
* Cache locally for fast load
* Sync on update
* Resolve conflicts with latest `updatedAt`

---

## 8. Security Rules

### Requirements

* Users can only edit their own profile
* Public profile is readable by authenticated users
* Only recipient can accept/reject requests
* Only involved users can delete friendships

---

## 9. Architecture (High Level)

### Modules

* AuthService
* ProfileService
* FriendService
* StorageService

### Layers

* UI layer
* Service layer
* Data layer (Firestore)

---

## 10. Build Order

### Phase 1 – Auth

1. Setup backend
2. Implement signup/login/logout/reset

### Phase 2 – Profile

3. Create profile schema
4. Auto-create profile on signup
5. Build profile UI
6. Add edit + validation
7. Add avatar upload

### Phase 3 – Discovery

8. Create public profile model
9. Implement user search

### Phase 4 – Friends

10. Implement friend requests
11. Implement friendships
12. Build UI for friends and requests

### Phase 5 – Hardening

13. Add security rules
14. Add error handling
15. Add loading states

---

## 11. Success Metrics

* % of users completing profile setup
* Profile save success rate
* Friend request acceptance rate
* Cross-device login success rate
* Profile sync latency

---

## 12. Acceptance Criteria (MVP Complete)

### Authentication

* Users can sign up, log in, log out, reset password
* Sessions persist across app restarts

### Profile

* Users can edit and save profile fields
* Profile persists across devices
* Profile picture upload works

### Friends

* Users can search for other users
* Users can send, accept, reject friend requests
* Users can remove friends
* Friends list updates correctly

### Security

* Users cannot access or edit other users’ private data

---

## 13. Future Considerations (Not in MVP)

* Social login (Google, Apple)
* Messaging between friends
* Presence (online/offline)
* Privacy controls
* Blocking/reporting users
* Public profiles
* Group systems / clubs

---

## 14. Open Questions

* Do we require email verification for signup? (TBD)
* Do we allow duplicate display names? (Recommended: Yes for MVP)
* Do we support guest mode? (TBD)

---

END OF DOCUMENT
