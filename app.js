/* RideSync MVP - Browser demo (mock data + local multi-tab sync)
 *
 * Goals:
 * - Create/join private sessions via a short code
 * - Simulate per-user telemetry (power / HR / cadence)
 * - Broadcast updates via localStorage events (works across tabs)
 * - Render a live leaderboard + session timer
 * - Store session summaries locally
 */

const STORAGE_PREFIX = "ridesync";
const SESSION_STORE_KEY = (code) => `${STORAGE_PREFIX}:session:${code}`;
const SUMMARIES_KEY = `${STORAGE_PREFIX}:summaries`;
const AUTH_USERS_KEY = `${STORAGE_PREFIX}:auth:users`;
const AUTH_SESSION_KEY = `${STORAGE_PREFIX}:auth:currentUserId`;
const PROFILES_KEY = `${STORAGE_PREFIX}:profiles`;
const PUBLIC_PROFILES_KEY = `${STORAGE_PREFIX}:publicProfiles`;
const FRIEND_REQUESTS_KEY = `${STORAGE_PREFIX}:friendRequests`;
const FRIENDSHIPS_KEY = `${STORAGE_PREFIX}:friendships`;
const WORKOUTS_KEY = `${STORAGE_PREFIX}:workouts`;

// WebRTC signaling server (fallbacks to localStorage if unavailable)
const DEFAULT_SIGNALING_SERVER = "ws://localhost:3000";
const SIGNALING_SERVER_QUERY_PARAM = "signaling"; // e.g. ?signaling=ws://example.com:3000

const appEl = document.getElementById("app");
const PRIVATE_RIDER_STATS_REFRESH_MS = 5000;
const PRIVATE_RIDER_PEAK_WINDOWS = Object.freeze([
  { label: "10s", seconds: 10 },
  { label: "30s", seconds: 30 },
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "20m", seconds: 1200 },
  { label: "40m", seconds: 2400 },
  { label: "1h", seconds: 3600 },
]);
const PRIVATE_RIDER_MAX_WINDOW_SECONDS = PRIVATE_RIDER_PEAK_WINDOWS[PRIVATE_RIDER_PEAK_WINDOWS.length - 1].seconds;
const BIKE_SWITCH_SPEED_LIMIT_KPH = 2;
// Bike catalog is intentionally data-driven so adding new bike types is a catalog-only change.
const BIKE_CATALOG = Object.freeze([
  {
    id: "climbing_bike",
    name: "Climbing Bike",
    description: "Lightweight bike built for hills and sustained gradients.",
    weightKg: 6.8,
    aeroModifier: 1.08, // >1 means more drag (worse aero)
    climbingModifier: 1.04,
    flatModifier: 0.97,
    pros: "Lighter and stronger on climbs",
    cons: "Less aerodynamic on flats and descents",
  },
  {
    id: "road_bike",
    name: "Road Bike",
    description: "More aerodynamic all-rounder for speed on flatter terrain.",
    weightKg: 8.2,
    aeroModifier: 0.94, // <1 means less drag (better aero)
    climbingModifier: 0.98,
    flatModifier: 1.03,
    pros: "Faster on flats and high-speed sections",
    cons: "Heavier and slightly weaker on steep climbs",
  },
]);
const DEFAULT_BIKE_ID = "road_bike";
const MAX_PLAYER_LEVEL = 100;
// Tuned for an MVP target of ~2 years to level 100 at roughly 1 hour/day of consistent riding.
const XP_CONFIG = Object.freeze({
  xpPerMinuteRidden: 8,
  xpPerKmTraveled: 6,
  xpPerMeterClimbed: 0.35,
});
const CALORIES_PER_KJ_CYCLING = 3.6;
const LEVEL_CURVE_CONFIG = Object.freeze({
  baseXpPerLevel: 125,
  linearXpScale: 36,
  quadraticXpScale: 1.25,
  minXpPerLevel: 120,
});
const POWER_UP_GRANT_DISTANCE_METERS = 1000;
const POWER_UP_QUEUE_MAX = 2;
const POWER_UP_TYPE_SPEED_BOOST = "speed_boost";
const FTP_MIN_WATTS = 50;
const FTP_MAX_WATTS = 600;
const MAX_SESSION_BOTS = 3;
const RECENT_SESSIONS_PAGE_SIZE = 10;
const WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS = 300;
const WORKOUT_DEFAULT_SET_SEGMENT_DURATION_SECONDS = 60;
const WORKOUT_MIN_SEGMENT_DURATION_SECONDS = 5;
const WORKOUT_MAX_SEGMENT_DURATION_SECONDS = 7200;
const WORKOUT_SEGMENT_SECOND_STEP = 5;
const WORKOUT_TIMELINE_BASE_WINDOW_SECONDS = 3600;
const WORKOUT_TIMELINE_MARKER_STEP_SECONDS = 300;
const WORKOUT_SET_REPETITIONS_MIN = 1;
const WORKOUT_SET_REPETITIONS_MAX = 99;
const WORKOUT_ITEM_TYPE_SEGMENT = "segment";
const WORKOUT_ITEM_TYPE_SET = "set";
const WORKOUT_DEFAULT_FTP_WATTS = 200;
const WORKOUT_NOTES_MAX_LENGTH = 5000;
const WORKOUT_RATING_MIN = 1;
const WORKOUT_RATING_MAX = 5;
const WORKOUT_TAG_OPTIONS = Object.freeze([
  "FTP Builder",
  "Endurance",
  "Recovery",
  "Tempo",
  "Threshold",
  "VO2 Max",
  "Sprint",
  "Climbing",
  "Sweet Spot",
  "Race Prep",
]);
const WORKOUT_ZONES = Object.freeze([
  Object.freeze({ zone: 1, label: "Recovery", ftpRange: "0-55%", minPct: 0, maxPct: 55 }),
  Object.freeze({ zone: 2, label: "Endurance", ftpRange: "56-75%", minPct: 56, maxPct: 75 }),
  Object.freeze({ zone: 3, label: "Tempo", ftpRange: "76-90%", minPct: 76, maxPct: 90 }),
  Object.freeze({ zone: 4, label: "Threshold", ftpRange: "91-105%", minPct: 91, maxPct: 105 }),
  Object.freeze({ zone: 5, label: "VO2 Max", ftpRange: "106-120%", minPct: 106, maxPct: 120 }),
]);
const WORKOUT_ZONE_INTENSITY_MULTIPLIERS = Object.freeze({
  1: 0.5,
  2: 0.65,
  3: 0.83,
  4: 0.98,
  5: 1.1,
});
const BOT_DEFAULT_WEIGHT_KG = 75;
const BOT_DIFFICULTY_LEVELS = Object.freeze([
  Object.freeze({ level: 1, label: "Level 1", ftpWatts: 120 }),
  Object.freeze({ level: 2, label: "Level 2", ftpWatts: 140 }),
  Object.freeze({ level: 3, label: "Level 3", ftpWatts: 160 }),
  Object.freeze({ level: 4, label: "Level 4", ftpWatts: 180 }),
  Object.freeze({ level: 5, label: "Level 5", ftpWatts: 200 }),
  Object.freeze({ level: 6, label: "Level 6", ftpWatts: 230 }),
  Object.freeze({ level: 7, label: "Level 7", ftpWatts: 260 }),
  Object.freeze({ level: 8, label: "Level 8", ftpWatts: 300 }),
  Object.freeze({ level: 9, label: "Level 9", ftpWatts: 340 }),
]);
const POWER_UP_TYPES = Object.freeze({
  [POWER_UP_TYPE_SPEED_BOOST]: Object.freeze({
    type: POWER_UP_TYPE_SPEED_BOOST,
    label: "BOOST",
    durationMs: 10000,
    speedMultiplier: 1.05,
  }),
});
const SIDE_SCROLL_VISIBLE_WINDOW_METERS = 100;
const SIDE_SCROLL_SVG_WIDTH = 760;
const SIDE_SCROLL_SVG_HEIGHT = 220;
const SIDE_SCROLL_TERRAIN_SAMPLE_COUNT = 96;
const TELEMETRY_POLL_INTERVAL_MS = 1000;
const SIDE_SCROLL_RENDER_TARGET_FPS = 24;
const SIDE_SCROLL_RENDER_INTERVAL_MS = Math.round(1000 / SIDE_SCROLL_RENDER_TARGET_FPS);
const SIDE_SCROLL_MAX_EXTRAPOLATION_MS = 1400;
const SIDE_SCROLL_HORIZON_Y_RATIO = 0.72;
const SIDE_SCROLL_TERRAIN_TOP_RATIO = 0.7;
const SIDE_SCROLL_TERRAIN_BOTTOM_MARGIN_PX = 12;
const SIDE_SCROLL_RIDER_ACCENTS = Object.freeze([
  "#4dd2ff",
  "#ffd166",
  "#95e06c",
  "#ff8aa7",
  "#ffb36b",
  "#78d2b6",
  "#b9a0ff",
  "#84a9ff",
]);

// Progression math is kept centralized so balancing can be tuned in one place.
function normalizeXpValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

function getXpRequiredForLevelTransition(levelInput) {
  const level = Math.round(Number(levelInput));
  if (!Number.isFinite(level) || level < 1 || level >= MAX_PLAYER_LEVEL) return 0;
  const rawRequirement =
    LEVEL_CURVE_CONFIG.baseXpPerLevel +
    LEVEL_CURVE_CONFIG.linearXpScale * level +
    LEVEL_CURVE_CONFIG.quadraticXpScale * level * level;
  return Math.max(LEVEL_CURVE_CONFIG.minXpPerLevel, Math.round(rawRequirement));
}

function getXpForLevel(levelInput) {
  const requestedLevel = Math.round(Number(levelInput));
  if (!Number.isFinite(requestedLevel) || requestedLevel <= 1) return 0;
  const level = Math.min(MAX_PLAYER_LEVEL, requestedLevel);
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getXpRequiredForLevelTransition(currentLevel);
  }
  return total;
}

function getLevelFromTotalXp(totalXpInput) {
  const totalXp = normalizeXpValue(totalXpInput);
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && totalXp >= getXpForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

function getProgressToNextLevel(totalXpInput) {
  const totalXp = normalizeXpValue(totalXpInput);
  const currentLevel = getLevelFromTotalXp(totalXp);
  if (currentLevel >= MAX_PLAYER_LEVEL) {
    const finalLevelRequirement = getXpRequiredForLevelTransition(MAX_PLAYER_LEVEL - 1);
    return {
      currentLevel: MAX_PLAYER_LEVEL,
      currentXp: finalLevelRequirement,
      totalXp,
      xpRequiredForNextLevel: finalLevelRequirement,
      levelProgressPercent: 100,
      nextLevel: MAX_PLAYER_LEVEL,
      isMaxLevel: true,
    };
  }

  const levelStartXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpRequiredForNextLevel = Math.max(1, nextLevelXp - levelStartXp);
  const currentXp = clamp(totalXp - levelStartXp, 0, xpRequiredForNextLevel);
  const levelProgressPercent = clamp((currentXp / xpRequiredForNextLevel) * 100, 0, 100);

  return {
    currentLevel,
    currentXp,
    totalXp,
    xpRequiredForNextLevel,
    levelProgressPercent,
    nextLevel: currentLevel + 1,
    isMaxLevel: false,
  };
}

function validateFtp(valueInput, { allowNull = true } = {}) {
  if (valueInput == null || valueInput === "") {
    return allowNull ? { valid: true, value: null } : { valid: false, error: "FTP is required." };
  }
  const parsed = Number(valueInput);
  if (!Number.isFinite(parsed)) {
    return { valid: false, error: "FTP must be a number." };
  }
  if (parsed <= 0) {
    return { valid: false, error: "FTP must be greater than 0." };
  }
  const rounded = Math.round(parsed);
  if (rounded < FTP_MIN_WATTS || rounded > FTP_MAX_WATTS) {
    return { valid: false, error: `FTP must be between ${FTP_MIN_WATTS} and ${FTP_MAX_WATTS} W.` };
  }
  return { valid: true, value: rounded };
}

function getUserFtp(profileInput) {
  const profile = profileInput && typeof profileInput === "object" ? profileInput : {};
  const validation = validateFtp(profile.ftpWatts, { allowNull: true });
  return validation.valid ? validation.value : null;
}

function updateUserFtp(profileInput, ftpWattsInput, updatedAtMs = currentMs()) {
  const profile = profileInput && typeof profileInput === "object" ? profileInput : {};
  const validation = validateFtp(ftpWattsInput, { allowNull: true });
  if (!validation.valid) {
    return { ok: false, error: validation.error, profile };
  }
  return {
    ok: true,
    profile: {
      ...profile,
      ftpWatts: validation.value,
      updatedAt: updatedAtMs,
    },
  };
}

function withProfileProgression(profileInput) {
  const profile = profileInput && typeof profileInput === "object" ? profileInput : {};
  const progression = getProgressToNextLevel(profile.totalXp);
  return {
    ...profile,
    ftpWatts: getUserFtp(profile),
    totalCaloriesBurned: normalizeCaloriesValue(profile.totalCaloriesBurned),
    currentLevel: progression.currentLevel,
    currentXp: progression.currentXp,
    totalXp: progression.totalXp,
    xpRequiredForNextLevel: progression.xpRequiredForNextLevel,
    levelProgressPercent: progression.levelProgressPercent,
  };
}

function calculateSessionXp(sessionSummary, participantSummary) {
  if (!sessionSummary || !participantSummary) {
    return {
      totalXp: 0,
      breakdown: { durationXp: 0, distanceXp: 0, climbXp: 0 },
      metrics: { durationMinutes: 0, distanceKm: 0, climbMeters: 0 },
    };
  }

  const durationMinutes = Math.max(0, Number(sessionSummary.durationSec) || 0) / 60;
  const distanceKm = Math.max(0, Number(participantSummary.totalDistance) || 0) / 1000;
  const climbMeters = Math.max(0, Number(participantSummary.totalClimbMeters) || 0);

  const durationXp = Math.round(durationMinutes * XP_CONFIG.xpPerMinuteRidden);
  const distanceXp = Math.round(distanceKm * XP_CONFIG.xpPerKmTraveled);
  const climbXp = Math.round(climbMeters * XP_CONFIG.xpPerMeterClimbed);
  const totalXp = Math.max(0, durationXp + distanceXp + climbXp);

  return {
    totalXp,
    breakdown: { durationXp, distanceXp, climbXp },
    metrics: { durationMinutes, distanceKm, climbMeters },
  };
}

function calculateSessionCalories(sessionSummary, participantSummary) {
  if (!sessionSummary || !participantSummary) {
    return {
      caloriesBurned: 0,
      metrics: { averageWatts: 0, durationSeconds: 0 },
    };
  }
  const averageWatts = Math.max(0, Number(participantSummary.avgPower) || 0);
  const durationSeconds = Math.max(0, Number(sessionSummary.durationSec) || 0);
  const caloriesBurned = normalizeCaloriesValue((averageWatts * durationSeconds / 3600) * CALORIES_PER_KJ_CYCLING);
  return {
    caloriesBurned,
    metrics: { averageWatts, durationSeconds },
  };
}

function applySessionXpToProfile(profileInput, sessionSummary, participantSummary) {
  const profile = withProfileProgression(profileInput);
  const xpResult = calculateSessionXp(sessionSummary, participantSummary);
  const beforeProgress = getProgressToNextLevel(profile.totalXp);
  const nextTotalXp = normalizeXpValue(profile.totalXp + xpResult.totalXp);
  const afterProgress = getProgressToNextLevel(nextTotalXp);
  const levelsGained = Math.max(0, afterProgress.currentLevel - beforeProgress.currentLevel);

  return {
    profile: withProfileProgression({
      ...profile,
      totalXp: nextTotalXp,
    }),
    xpAward: {
      earnedXp: xpResult.totalXp,
      breakdown: xpResult.breakdown,
      metrics: xpResult.metrics,
      beforeLevel: beforeProgress.currentLevel,
      afterLevel: afterProgress.currentLevel,
      levelsGained,
      totalXpBefore: beforeProgress.totalXp,
      totalXpAfter: afterProgress.totalXp,
      currentXpAfter: afterProgress.currentXp,
      xpRequiredForNextLevelAfter: afterProgress.xpRequiredForNextLevel,
      levelProgressPercentAfter: afterProgress.levelProgressPercent,
      awardedAt: currentMs(),
    },
  };
}

function applySessionCaloriesToProfile(profileInput, sessionSummary, participantSummary) {
  const profile = withProfileProgression(profileInput);
  const calorieResult = calculateSessionCalories(sessionSummary, participantSummary);
  const nextTotalCalories = normalizeCaloriesValue(profile.totalCaloriesBurned + calorieResult.caloriesBurned);
  return {
    profile: withProfileProgression({
      ...profile,
      totalCaloriesBurned: nextTotalCalories,
    }),
    calorieAward: {
      caloriesBurned: calorieResult.caloriesBurned,
      metrics: calorieResult.metrics,
      totalCaloriesBefore: normalizeCaloriesValue(profile.totalCaloriesBurned),
      totalCaloriesAfter: nextTotalCalories,
      awardedAt: currentMs(),
    },
  };
}

function validateProgressionMath() {
  const issues = [];
  let previousCumulative = -1;
  let previousPerLevel = -1;
  for (let level = 1; level <= MAX_PLAYER_LEVEL; level += 1) {
    const cumulative = getXpForLevel(level);
    if (cumulative < previousCumulative) {
      issues.push(`Cumulative XP decreased at level ${level}.`);
    }
    previousCumulative = cumulative;
    if (level < MAX_PLAYER_LEVEL) {
      const perLevel = getXpRequiredForLevelTransition(level);
      if (perLevel < previousPerLevel) {
        issues.push(`Per-level XP decreased at level ${level}.`);
      }
      previousPerLevel = perLevel;
    }
  }
  const levelAtZero = getLevelFromTotalXp(0);
  if (levelAtZero !== 1) issues.push("Expected level 1 at 0 XP.");
  const maxLevelProgress = getProgressToNextLevel(getXpForLevel(MAX_PLAYER_LEVEL));
  if (maxLevelProgress.currentLevel !== MAX_PLAYER_LEVEL) issues.push("Expected max level progress at level cap.");
  return { valid: issues.length === 0, issues };
}

function createEmptyPrivateRiderStats(sessionCode = null, userId = null) {
  const bestRollingWatts = {};
  PRIVATE_RIDER_PEAK_WINDOWS.forEach((windowDef) => {
    bestRollingWatts[windowDef.seconds] = null;
  });
  return {
    sessionCode,
    userId,
    recentPowerSeconds: [],
    totalPowerSeconds: 0,
    totalDurationSeconds: 0,
    latestSpeedMps: null,
    bestRollingWatts,
    lastPolledAtMs: currentMs(),
    snapshot: {
      updatedAtMs: null,
      avgWatts: null,
      speedMps: null,
      bestRollingWatts: { ...bestRollingWatts },
      totalDurationSeconds: 0,
    },
  };
}

function createEmptyPowerUpState(sessionCode = null, userId = null) {
  return {
    sessionCode,
    userId,
    powerUpQueue: [],
    activePowerUp: null,
    lastPowerUpDistanceThreshold: 0,
  };
}

function createEmptyFtpProposalState(sessionCode = null, userId = null) {
  return {
    sessionCode,
    userId,
    pendingProposal: null,
    lastDeclinedCandidateWatts: null,
  };
}

let state = {
  view: "lobby", // "lobby" | "session" | "summary" | "pairing"
  pairingReturnView: "lobby",
  account: {
    userId: null,
    showProfileEditor: false,
    showFriendsPanel: false,
    friendSearchQuery: "",
  },
  lobby: {
    selectedRouteId: null,
    routeSelectionMode: "preset",
    selectedBikeId: DEFAULT_BIKE_ID,
    botDrafts: [],
    activeSection: null,
    generatedRouteDraft: null,
    generatedRouteConfirmed: null,
    generatedRouteDistanceKm: 20,
    generatedRouteHilliness: "rolling",
    recentSessionsPage: 1,
    recentSessionsKnownCodes: [],
    workoutDraftName: "",
    workoutDraftNotes: "",
    workoutDraftTags: [],
    workoutDraftSegments: [],
    workoutSelection: null,
    workoutEditingId: null,
    workoutFtpOverrideWatts: null,
    showWorkoutFtpModal: false,
    showWorkoutNotesModal: false,
    savedWorkoutNotesView: null,
    workoutRatingModal: null,
    workoutDeleteModal: null,
  },
  session: null,
  user: null,
  timer: null,
  lastTick: null,
  toastTimeout: null,
  devices: {
    trainer: {
      connected: false,
      name: null,
      device: null,
      server: null,
      characteristic: null,
      controlCharacteristic: null,
      controlSupported: false,
      controlGranted: false,
      lastControlError: null,
      lastResistancePercent: null,
      lastResistanceAt: 0,
      lastReading: null,
    },
    hrm: {
      connected: false,
      name: null,
      device: null,
      server: null,
      characteristic: null,
      lastReading: null,
    },
  },
  webrtc: {
    enabled: true,
    isHost: false,
    code: null,
    peerId: null,
    peers: {},
    ws: null,
    wsConnected: false,
    useLocalStorage: false,
    awaitingSessionState: false,
  },
  simulation: {
    gradientScale: 1.0, // 0.0 - 1.0
    gradeSmoothing: 0.35,
    speedSmoothing: 0.45,
    lastSmoothedGrade: 0,
    terrain: {
      currentGrade: 0,
      effectiveGrade: 0,
      nextGrade: 0,
      distanceToNext: null,
      routeDistance: 0,
      resistancePercent: 20,
      resistanceLabel: "Light",
      trainerControlStatus: "No trainer",
    },
  },
  visualLoop: {
    sideScrollRafId: null,
    lastSideScrollFrameAt: 0,
  },
  sessionRenderDeferred: false,
  privateRiderStats: createEmptyPrivateRiderStats(),
  powerUps: createEmptyPowerUpState(),
  ftp: createEmptyFtpProposalState(),
};

function makeId(len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function cloneJson(value) {
  return safeJsonParse(JSON.stringify(value));
}

function loadSessionFromStorage(code) {
  const raw = localStorage.getItem(SESSION_STORE_KEY(code));
  return raw ? safeJsonParse(raw) : null;
}

function saveSessionToStorage(session) {
  localStorage.setItem(SESSION_STORE_KEY(session.code), JSON.stringify(session));
}

function loadSummaries() {
  const raw = localStorage.getItem(SUMMARIES_KEY);
  return raw ? safeJsonParse(raw) : [];
}

function saveSummaries(summaries) {
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
}

function getTotalPages(totalCountInput, pageSizeInput) {
  const totalCount = Math.max(0, Math.floor(Number(totalCountInput) || 0));
  const pageSize = Math.max(1, Math.floor(Number(pageSizeInput) || 1));
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

function clampPage(pageInput, totalPagesInput) {
  const totalPages = Math.max(1, Math.floor(Number(totalPagesInput) || 1));
  const page = Math.floor(Number(pageInput) || 1);
  return clamp(page, 1, totalPages);
}

function getPaginatedSessions(sessionsInput, currentPageInput, pageSizeInput) {
  const sessions = Array.isArray(sessionsInput) ? sessionsInput : [];
  const pageSize = Math.max(1, Math.floor(Number(pageSizeInput) || 1));
  const totalPages = getTotalPages(sessions.length, pageSize);
  const currentPage = clampPage(currentPageInput, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    totalCount: sessions.length,
    totalPages,
    currentPage,
    pageSize,
    startIndex,
    endIndex,
    sessions: sessions.slice(startIndex, endIndex),
  };
}

function persistLocalSession(code, userId) {
  sessionStorage.setItem(`${STORAGE_PREFIX}:currentSession`, code);
  sessionStorage.setItem(`${STORAGE_PREFIX}:currentUser`, userId);
}

function clearLocalSession() {
  sessionStorage.removeItem(`${STORAGE_PREFIX}:currentSession`);
  sessionStorage.removeItem(`${STORAGE_PREFIX}:currentUser`);
}

function loadLocalSession() {
  const code = sessionStorage.getItem(`${STORAGE_PREFIX}:currentSession`);
  const userId = sessionStorage.getItem(`${STORAGE_PREFIX}:currentUser`);
  return { code, userId };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  const parsed = raw ? safeJsonParse(raw) : null;
  return parsed ?? fallback;
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadAuthUsers() {
  return loadJson(AUTH_USERS_KEY, []);
}

function saveAuthUsers(users) {
  saveJson(AUTH_USERS_KEY, users);
}

function loadProfiles() {
  return loadJson(PROFILES_KEY, {});
}

function saveProfiles(profiles) {
  saveJson(PROFILES_KEY, profiles);
}

function loadPublicProfiles() {
  return loadJson(PUBLIC_PROFILES_KEY, {});
}

function savePublicProfiles(publicProfiles) {
  saveJson(PUBLIC_PROFILES_KEY, publicProfiles);
}

function loadFriendRequests() {
  return loadJson(FRIEND_REQUESTS_KEY, []);
}

function saveFriendRequests(requests) {
  saveJson(FRIEND_REQUESTS_KEY, requests);
}

function loadFriendships() {
  return loadJson(FRIENDSHIPS_KEY, []);
}

function saveFriendships(friendships) {
  saveJson(FRIENDSHIPS_KEY, friendships);
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function isAuthenticated() {
  return !!state.account.userId;
}

function getCurrentAccountProfile() {
  if (!state.account.userId) return null;
  const profiles = loadProfiles();
  const profile = profiles[state.account.userId];
  if (!profile) return null;
  const normalizedProfile = withProfileProgression(profile);
  const needsPersistence =
    profile.currentLevel !== normalizedProfile.currentLevel ||
    profile.currentXp !== normalizedProfile.currentXp ||
    profile.totalXp !== normalizedProfile.totalXp ||
    profile.xpRequiredForNextLevel !== normalizedProfile.xpRequiredForNextLevel ||
    profile.levelProgressPercent !== normalizedProfile.levelProgressPercent;
  if (needsPersistence) {
    profiles[state.account.userId] = normalizedProfile;
    saveProfiles(profiles);
  }
  return normalizedProfile;
}

function computeAgeFromDob(dateOfBirth, referenceMs = currentMs()) {
  if (!dateOfBirth) return null;
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date(referenceMs);
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatProfileHeight(profile) {
  if (!profile) return "--";
  if (profile.heightUnit === "ft_in") {
    const totalInches = Number.isFinite(profile.height) ? profile.height : null;
    const feet = Number.isFinite(profile.heightFeet) ? profile.heightFeet : totalInches != null ? Math.floor(totalInches / 12) : null;
    const inches = Number.isFinite(profile.heightInches) ? profile.heightInches : totalInches != null ? totalInches - feet * 12 : null;
    if (feet == null || inches == null) return "--";
    const inText = Number.isInteger(inches) ? String(inches) : Number(inches).toFixed(1);
    return `${feet}ft ${inText}in`;
  }
  if (!Number.isFinite(profile.height)) return "--";
  const cmText = Number.isInteger(profile.height) ? String(profile.height) : Number(profile.height).toFixed(1);
  return `${cmText} cm`;
}

function buildDefaultProfile({ id, email }) {
  const now = currentMs();
  const baseName = email.split("@")[0] || "Rider";
  return withProfileProgression({
    id,
    email,
    displayName: baseName.slice(0, 24),
    age: null,
    dateOfBirth: null,
    weight: null,
    weightUnit: "kg",
    height: null,
    heightUnit: "cm",
    heightFeet: null,
    heightInches: null,
    weightKg: null,
    heightCm: null,
    ftpWatts: null,
    totalCaloriesBurned: 0,
    profilePhotoUrl: "",
    createdAt: now,
    updatedAt: now,
  });
}

function upsertPublicProfile(profile) {
  const publicProfiles = loadPublicProfiles();
  publicProfiles[profile.id] = {
    userId: profile.id,
    displayName: profile.displayName || "Rider",
    profilePhotoUrl: profile.profilePhotoUrl || "",
    email: profile.email || "",
  };
  savePublicProfiles(publicProfiles);
}

function setAuthenticatedUser(userId) {
  state.account.userId = userId;
  localStorage.setItem(AUTH_SESSION_KEY, userId);
}

function clearAuthenticatedUser() {
  state.account.userId = null;
  state.account.showProfileEditor = false;
  state.account.showFriendsPanel = false;
  state.account.friendSearchQuery = "";
  resetFtpProposalState();
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function restoreAuthSession() {
  const userId = localStorage.getItem(AUTH_SESSION_KEY);
  if (!userId) return;
  const profiles = loadProfiles();
  if (profiles[userId]) {
    setAuthenticatedUser(userId);
  } else {
    clearAuthenticatedUser();
  }
}

function signUpWithEmail(email, password) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password || password.length < 6) {
    return { error: "Use a valid email and a password with at least 6 characters." };
  }

  const users = loadAuthUsers();
  if (users.some((u) => u.email === normalized)) {
    return { error: "An account with that email already exists." };
  }

  const newUser = {
    id: `acct_${makeId(10)}`,
    email: normalized,
    password,
    createdAt: currentMs(),
  };
  users.push(newUser);
  saveAuthUsers(users);

  const profiles = loadProfiles();
  profiles[newUser.id] = buildDefaultProfile({ id: newUser.id, email: normalized });
  saveProfiles(profiles);
  upsertPublicProfile(profiles[newUser.id]);
  setAuthenticatedUser(newUser.id);
  return { ok: true };
}

function logInWithEmail(email, password) {
  const normalized = normalizeEmail(email);
  const users = loadAuthUsers();
  const found = users.find((u) => u.email === normalized && u.password === password);
  if (!found) return { error: "Invalid email or password." };
  setAuthenticatedUser(found.id);
  return { ok: true };
}

function sendPasswordReset(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { error: "Enter your account email first." };
  const users = loadAuthUsers();
  const exists = users.some((u) => u.email === normalized);
  if (!exists) return { error: "No account found for that email." };
  return { ok: true, message: "Password reset email simulated (basic MVP mode)." };
}

function updateProfile(profileUpdate) {
  const userId = state.account.userId;
  if (!userId) return { error: "Not logged in." };

  const profiles = loadProfiles();
  const existingProfile = profiles[userId];
  if (!existingProfile) return { error: "Profile not found." };
  const current = withProfileProgression(existingProfile);

  const displayName = String(profileUpdate.displayName || "").trim();
  const dateOfBirth = String(profileUpdate.dateOfBirth || "").trim() || null;
  const age = computeAgeFromDob(dateOfBirth);
  const weight = profileUpdate.weight === "" ? null : Number(profileUpdate.weight);
  const heightCmInput = profileUpdate.heightCm === "" ? null : Number(profileUpdate.heightCm);
  const heightFeetInput = profileUpdate.heightFeet === "" ? null : Number(profileUpdate.heightFeet);
  const heightInchesInput = profileUpdate.heightInches === "" ? null : Number(profileUpdate.heightInches);
  const ftpInput = profileUpdate.ftpWatts ?? "";
  const weightUnit = profileUpdate.weightUnit === "lb" ? "lb" : "kg";
  const heightUnit = profileUpdate.heightUnit === "ft_in" ? "ft_in" : "cm";
  const ftpValidation = validateFtp(ftpInput, { allowNull: true });

  if (displayName.length < 2 || displayName.length > 24) {
    return { error: "Display name must be 2-24 characters." };
  }
  if (dateOfBirth && (age == null || age < 13 || age > 100)) {
    return { error: "Date of birth must result in an age between 13 and 100." };
  }
  if (weight != null && (!Number.isFinite(weight) || weight <= 0)) {
    return { error: "Weight must be greater than 0." };
  }
  if (!ftpValidation.valid) {
    return { error: ftpValidation.error };
  }

  let height = null;
  let heightFeet = null;
  let heightInches = null;
  let heightCm = null;

  if (heightUnit === "cm") {
    if (heightCmInput != null && (!Number.isFinite(heightCmInput) || heightCmInput <= 0)) {
      return { error: "Height must be greater than 0." };
    }
    height = heightCmInput;
    heightCm = heightCmInput;
  } else {
    const feet = heightFeetInput ?? 0;
    const inches = heightInchesInput ?? 0;
    if (!Number.isFinite(feet) || feet < 0) {
      return { error: "Feet must be 0 or greater." };
    }
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      return { error: "Inches must be between 0 and 11.9." };
    }
    if (feet === 0 && inches === 0) {
      return { error: "Height must be greater than 0." };
    }
    heightFeet = Math.floor(feet);
    heightInches = Number(inches);
    height = heightFeet * 12 + heightInches;
    heightCm = height * 2.54;
  }

  const weightKg = weight == null ? null : weightUnit === "kg" ? weight : weight / 2.20462;

  profiles[userId] = withProfileProgression({
    ...current,
    displayName,
    age,
    dateOfBirth,
    weight,
    weightUnit,
    height,
    heightUnit,
    heightFeet,
    heightInches,
    weightKg,
    heightCm,
    ftpWatts: ftpValidation.value,
    updatedAt: currentMs(),
  });
  saveProfiles(profiles);
  upsertPublicProfile(profiles[userId]);
  return { ok: true };
}

function friendshipId(userA, userB) {
  return [userA, userB].sort().join("_");
}

function isFriend(userA, userB) {
  const friendships = loadFriendships();
  return friendships.some((f) => f.id === friendshipId(userA, userB));
}

function hasPendingRequest(userA, userB) {
  const requests = loadFriendRequests();
  return requests.some(
    (r) =>
      r.status === "pending" &&
      ((r.fromUserId === userA && r.toUserId === userB) || (r.fromUserId === userB && r.toUserId === userA)),
  );
}

function sendFriendRequest(toUserId) {
  const fromUserId = state.account.userId;
  if (!fromUserId) return { error: "Log in first." };
  if (!toUserId || toUserId === fromUserId) return { error: "Cannot add yourself." };
  if (isFriend(fromUserId, toUserId)) return { error: "Already friends." };
  if (hasPendingRequest(fromUserId, toUserId)) return { error: "A request is already pending." };

  const requests = loadFriendRequests();
  requests.push({
    id: `fr_${makeId(10)}`,
    fromUserId,
    toUserId,
    status: "pending",
    createdAt: currentMs(),
  });
  saveFriendRequests(requests);
  return { ok: true };
}

function acceptFriendRequest(requestId) {
  const userId = state.account.userId;
  const requests = loadFriendRequests();
  const request = requests.find((r) => r.id === requestId && r.toUserId === userId && r.status === "pending");
  if (!request) return { error: "Request not found." };

  request.status = "accepted";
  saveFriendRequests(requests);

  const friendships = loadFriendships();
  const id = friendshipId(request.fromUserId, request.toUserId);
  if (!friendships.some((f) => f.id === id)) {
    friendships.push({
      id,
      userIds: [request.fromUserId, request.toUserId],
      createdAt: currentMs(),
    });
    saveFriendships(friendships);
  }
  return { ok: true };
}

function rejectFriendRequest(requestId) {
  const userId = state.account.userId;
  const requests = loadFriendRequests();
  const request = requests.find((r) => r.id === requestId && r.toUserId === userId && r.status === "pending");
  if (!request) return { error: "Request not found." };
  request.status = "rejected";
  saveFriendRequests(requests);
  return { ok: true };
}

function cancelFriendRequest(requestId) {
  const userId = state.account.userId;
  const requests = loadFriendRequests();
  const next = requests.filter((r) => !(r.id === requestId && r.fromUserId === userId && r.status === "pending"));
  saveFriendRequests(next);
  return { ok: true };
}

function removeFriend(friendUserId) {
  const userId = state.account.userId;
  const id = friendshipId(userId, friendUserId);
  const friendships = loadFriendships().filter((f) => f.id !== id);
  saveFriendships(friendships);
  return { ok: true };
}

function getFriendContext(userId) {
  const requests = loadFriendRequests();
  const friendships = loadFriendships();
  const publicProfiles = loadPublicProfiles();

  const incoming = requests.filter((r) => r.toUserId === userId && r.status === "pending");
  const outgoing = requests.filter((r) => r.fromUserId === userId && r.status === "pending");
  const friendLinks = friendships.filter((f) => f.userIds.includes(userId));
  const friendIds = friendLinks.map((f) => f.userIds.find((id) => id !== userId)).filter(Boolean);

  return {
    incoming,
    outgoing,
    friendIds,
    getProfile: (id) => publicProfiles[id] || null,
  };
}

function searchUsers(query, userId) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [];

  const publicProfiles = loadPublicProfiles();
  const profiles = Object.values(publicProfiles);
  const context = getFriendContext(userId);
  const pendingTargetIds = new Set([
    ...context.incoming.map((r) => r.fromUserId),
    ...context.outgoing.map((r) => r.toUserId),
  ]);
  const friendIds = new Set(context.friendIds);

  return profiles
    .filter((p) => p.userId !== userId)
    .filter((p) => !friendIds.has(p.userId))
    .filter((p) => !pendingTargetIds.has(p.userId))
    .filter((p) => (p.email || "").toLowerCase().includes(normalized) || (p.displayName || "").toLowerCase().includes(normalized))
    .slice(0, 10);
}

function fileToResizedDataUrl(file, maxSize = 512, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Invalid image file."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}

function showToast(message, duration = 2200) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

function ensureWorkoutTooltipElement() {
  let tooltip = document.getElementById("workoutUiTooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "workoutUiTooltip";
  tooltip.className = "workout-ui-tooltip";
  document.body.appendChild(tooltip);
  return tooltip;
}

function hideWorkoutTooltip() {
  const tooltip = document.getElementById("workoutUiTooltip");
  if (!tooltip) return;
  tooltip.classList.remove("is-visible");
}

function showWorkoutTooltipForTrigger(triggerEl) {
  const trigger = triggerEl && typeof triggerEl.getAttribute === "function" ? triggerEl : null;
  if (!trigger) return;
  const tooltipText = String(trigger.getAttribute("data-tooltip") || "").trim();
  if (!tooltipText) {
    hideWorkoutTooltip();
    return;
  }
  const tooltip = ensureWorkoutTooltipElement();
  tooltip.textContent = tooltipText;
  tooltip.classList.add("is-visible");
  tooltip.style.left = "-9999px";
  tooltip.style.top = "-9999px";

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportPadding = 10;
  const horizontalCenter = triggerRect.left + triggerRect.width / 2;
  const rawLeft = horizontalCenter - tooltipRect.width / 2;
  const clampedLeft = clamp(rawLeft, viewportPadding, Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding));

  const aboveTop = triggerRect.top - tooltipRect.height - 10;
  const belowTop = triggerRect.bottom + 10;
  const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding);
  const nextTop = aboveTop >= viewportPadding ? aboveTop : Math.min(maxTop, belowTop);

  tooltip.style.left = `${Math.round(clampedLeft)}px`;
  tooltip.style.top = `${Math.round(nextTop)}px`;
}

function currentMs() {
  return Date.now();
}

function formatDuration(seconds) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function normalizeCaloriesValue(valueInput) {
  const parsed = Number(valueInput);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

function formatCalories(valueInput) {
  const calories = normalizeCaloriesValue(valueInput);
  return `${calories.toLocaleString()} kcal`;
}

function formatWorkoutTimelineMarker(secondsInput) {
  const seconds = Math.max(0, Math.floor(Number(secondsInput) || 0));
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}` : `${totalMinutes}:00`;
}

function formatNumber(value, decimals = 0) {
  return value != null && !Number.isNaN(value) ? value.toFixed(decimals) : "--";
}

function formatDistanceKmFloor(distanceMeters) {
  if (distanceMeters == null || Number.isNaN(distanceMeters)) return "--";
  const kmFloored = Math.floor((distanceMeters / 1000) * 10) / 10;
  return `${kmFloored.toFixed(1)}KM`;
}

function calculateElevationGainMeters(speedMetersPerSecond, gradientPercent, deltaTimeSeconds) {
  const speed = Number(speedMetersPerSecond);
  const gradient = Number(gradientPercent);
  const delta = Number(deltaTimeSeconds);
  if (!Number.isFinite(speed) || !Number.isFinite(gradient) || !Number.isFinite(delta)) return 0;
  if (speed <= 0 || delta <= 0 || gradient <= 0) return 0;
  const distanceMeters = speed * delta;
  return distanceMeters * (gradient / 100);
}

function formatClimbedMeters(totalClimbedMeters) {
  const climbed = Number(totalClimbedMeters);
  if (!Number.isFinite(climbed) || climbed < 0) return "--";
  return `${Math.round(climbed)} m climbed`;
}

function formatSpeedMpsAsKph(speedMps) {
  const speed = Number(speedMps);
  if (!Number.isFinite(speed) || speed < 0) return "--";
  return `${(speed * 3.6).toFixed(1)} km/h`;
}

function normalizeBikeId(bikeIdInput) {
  const normalized = String(bikeIdInput || "").trim().toLowerCase();
  const found = BIKE_CATALOG.find((bike) => bike.id === normalized);
  return found ? found.id : DEFAULT_BIKE_ID;
}

function getBikeById(bikeIdInput) {
  const bikeId = normalizeBikeId(bikeIdInput);
  return BIKE_CATALOG.find((bike) => bike.id === bikeId) || BIKE_CATALOG[0];
}

function buildBikeOptionsHtml(selectedBikeId) {
  const activeBikeId = normalizeBikeId(selectedBikeId);
  return BIKE_CATALOG.map(
    (bike) => `<option value="${bike.id}" ${bike.id === activeBikeId ? "selected" : ""}>${escapeHtml(bike.name)}</option>`,
  ).join("");
}

function renderBikeDetailsHtml(selectedBikeId) {
  const bike = getBikeById(selectedBikeId);
  return `
    <div class="small"><strong>${escapeHtml(bike.name)}</strong> - ${escapeHtml(bike.description)}</div>
    <div class="small" style="margin-top:2px;">Pros: ${escapeHtml(bike.pros)}</div>
    <div class="small" style="margin-top:2px;">Cons: ${escapeHtml(bike.cons)}</div>
  `;
}

function canSwitchBikeAtSpeed(speedMps) {
  const speedKph = Number(speedMps) * 3.6;
  if (!Number.isFinite(speedKph) || speedKph < 0) return true;
  return speedKph <= BIKE_SWITCH_SPEED_LIMIT_KPH;
}

function normalizeBotDifficultyLevel(levelInput) {
  const level = Math.round(Number(levelInput));
  if (!Number.isFinite(level)) return BOT_DIFFICULTY_LEVELS[0].level;
  return clamp(level, BOT_DIFFICULTY_LEVELS[0].level, BOT_DIFFICULTY_LEVELS[BOT_DIFFICULTY_LEVELS.length - 1].level);
}

function getBotDifficultyConfig(levelInput) {
  const normalizedLevel = normalizeBotDifficultyLevel(levelInput);
  return BOT_DIFFICULTY_LEVELS.find((entry) => entry.level === normalizedLevel) || BOT_DIFFICULTY_LEVELS[0];
}

function buildBotDifficultyOptionsHtml(selectedLevelInput) {
  const selectedLevel = normalizeBotDifficultyLevel(selectedLevelInput);
  return BOT_DIFFICULTY_LEVELS.map(
    (entry) =>
      `<option value="${entry.level}" ${entry.level === selectedLevel ? "selected" : ""}>${escapeHtml(entry.label)} - ${entry.ftpWatts} W FTP</option>`,
  ).join("");
}

function createBotDraft(index, difficultyLevelInput = 4) {
  const difficulty = getBotDifficultyConfig(difficultyLevelInput);
  const safeIndex = Math.max(1, Number(index) || 1);
  return {
    id: `bot_draft_${safeIndex}_${makeId(4)}`.toLowerCase(),
    name: `Bot ${safeIndex}`,
    difficultyLevel: difficulty.level,
    ftpWatts: difficulty.ftpWatts,
  };
}

function normalizeBotDrafts(draftsInput) {
  const drafts = Array.isArray(draftsInput) ? draftsInput : [];
  return drafts
    .slice(0, MAX_SESSION_BOTS)
    .map((draft, index) => {
      const difficulty = getBotDifficultyConfig(draft?.difficultyLevel);
      return {
        id: String(draft?.id || `bot_draft_${index + 1}_${makeId(3)}`).toLowerCase(),
        name: String(draft?.name || `Bot ${index + 1}`),
        difficultyLevel: difficulty.level,
        ftpWatts: difficulty.ftpWatts,
      };
    });
}

function getNextBotName(draftsInput) {
  const drafts = Array.isArray(draftsInput) ? draftsInput : [];
  for (let index = 1; index <= MAX_SESSION_BOTS; index += 1) {
    const candidate = `Bot ${index}`;
    if (!drafts.some((draft) => String(draft?.name || "").toLowerCase() === candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `Bot ${drafts.length + 1}`;
}

function addBotDraft(difficultyLevelInput = 4) {
  const currentDrafts = normalizeBotDrafts(state.lobby.botDrafts);
  if (currentDrafts.length >= MAX_SESSION_BOTS) {
    return { ok: false, error: `You can add up to ${MAX_SESSION_BOTS} bots.` };
  }
  const difficulty = getBotDifficultyConfig(difficultyLevelInput);
  const next = createBotDraft(currentDrafts.length + 1, difficulty.level);
  next.name = getNextBotName(currentDrafts);
  state.lobby.botDrafts = [...currentDrafts, next];
  return { ok: true, bot: next };
}

function removeBotDraft(botDraftId) {
  const currentDrafts = normalizeBotDrafts(state.lobby.botDrafts);
  const nextDrafts = currentDrafts.filter((draft) => draft.id !== botDraftId);
  if (nextDrafts.length === currentDrafts.length) {
    return { ok: false, error: "Bot not found." };
  }
  state.lobby.botDrafts = nextDrafts;
  return { ok: true };
}

function updateBotDraftDifficulty(botDraftId, difficultyLevelInput) {
  const difficulty = getBotDifficultyConfig(difficultyLevelInput);
  let updated = false;
  state.lobby.botDrafts = normalizeBotDrafts(state.lobby.botDrafts).map((draft) => {
    if (draft.id !== botDraftId) return draft;
    updated = true;
    return {
      ...draft,
      difficultyLevel: difficulty.level,
      ftpWatts: difficulty.ftpWatts,
    };
  });
  return updated ? { ok: true } : { ok: false, error: "Bot not found." };
}

function createBotRider(botDraftInput, index) {
  const draft = botDraftInput && typeof botDraftInput === "object" ? botDraftInput : {};
  const difficulty = getBotDifficultyConfig(draft.difficultyLevel);
  const safeName = String(draft.name || `Bot ${index + 1}`).trim() || `Bot ${index + 1}`;
  return {
    id: String(draft.id || `bot_${makeId(8)}`).toLowerCase(),
    name: safeName,
    weight: BOT_DEFAULT_WEIGHT_KG,
    bikeId: DEFAULT_BIKE_ID,
    isBot: true,
    difficultyLevel: difficulty.level,
    ftpWatts: difficulty.ftpWatts,
  };
}

function addBotToSession(session, botInput) {
  const sessionState = session && typeof session === "object" ? session : null;
  if (!sessionState) return { ok: false, error: "Session unavailable." };
  if (!sessionState.users) sessionState.users = {};
  const existingBots = Object.values(sessionState.users).filter((participant) => participant?.isBot);
  if (existingBots.length >= MAX_SESSION_BOTS) {
    return { ok: false, error: `You can add up to ${MAX_SESSION_BOTS} bots.` };
  }

  const bot = createBotRider(botInput, existingBots.length);
  sessionState.users[bot.id] = bot;
  sessionState.telemetry = sessionState.telemetry || {};
  sessionState.aggregates = sessionState.aggregates || {};
  if (!sessionState.telemetry[bot.id]) {
    sessionState.telemetry[bot.id] = {
      power: 0,
      heartRate: 0,
      cadence: 0,
      speedMps: 0,
      grade: 0,
      effectiveGrade: 0,
      resistancePercent: null,
      resistanceLabel: null,
      activePowerUp: null,
      distance: 0,
      updatedAt: currentMs(),
    };
  }
  ensureAggregate(bot.id, sessionState);
  return { ok: true, bot };
}

function removeBotFromSession(session, botId) {
  const sessionState = session && typeof session === "object" ? session : null;
  if (!sessionState) return { ok: false, error: "Session unavailable." };
  const participant = sessionState.users?.[botId];
  if (!participant?.isBot) return { ok: false, error: "Bot not found." };
  delete sessionState.users[botId];
  delete sessionState.telemetry?.[botId];
  delete sessionState.aggregates?.[botId];
  return { ok: true };
}

function updateBotDifficulty(session, botId, difficultyLevelInput) {
  const sessionState = session && typeof session === "object" ? session : null;
  if (!sessionState) return { ok: false, error: "Session unavailable." };
  const participant = sessionState.users?.[botId];
  if (!participant?.isBot) return { ok: false, error: "Bot not found." };
  const difficulty = getBotDifficultyConfig(difficultyLevelInput);
  sessionState.users[botId] = {
    ...participant,
    difficultyLevel: difficulty.level,
    ftpWatts: difficulty.ftpWatts,
  };
  return { ok: true };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildSegmentsFromGradientBlocks(distanceKm, gradientBlocksInput) {
  const totalDistanceMeters = Math.max(100, Math.round((Number(distanceKm) || 0) * 1000));
  const gradientBlocks = Array.isArray(gradientBlocksInput) && gradientBlocksInput.length > 0
    ? gradientBlocksInput
    : [{ ratio: 1, gradientPct: 0 }];
  const ratioSum = gradientBlocks.reduce((sum, block) => sum + (Number(block.ratio) || 0), 0) || 1;

  let cursor = 0;
  return gradientBlocks.map((block, index) => {
    const normalizedRatio = (Number(block.ratio) || 0) / ratioSum;
    const remaining = totalDistanceMeters - cursor;
    const blockLength = index === gradientBlocks.length - 1 ? remaining : Math.max(1, Math.round(totalDistanceMeters * normalizedRatio));
    const startDistance = cursor;
    const endDistance = Math.min(totalDistanceMeters, cursor + blockLength);
    cursor = endDistance;
    return {
      startDistance,
      endDistance,
      grade: Number(block.gradientPct) || 0,
    };
  });
}

function scaleGradientBlocksToElevationGain(distanceKm, elevationGainM, gradientBlocksInput, maxGradientPct = null) {
  const totalDistanceMeters = Math.max(100, Math.round((Number(distanceKm) || 0) * 1000));
  const gradientBlocks = Array.isArray(gradientBlocksInput) ? gradientBlocksInput : [];
  const ratioSum = gradientBlocks.reduce((sum, block) => sum + (Number(block.ratio) || 0), 0) || 1;
  const rawGain = gradientBlocks.reduce((sum, block) => {
    const ratio = (Number(block.ratio) || 0) / ratioSum;
    const gradient = Number(block.gradientPct) || 0;
    return sum + totalDistanceMeters * ratio * (gradient / 100);
  }, 0);
  const targetGain = Number(elevationGainM) || 0;
  const scale = rawGain > 0 ? targetGain / rawGain : 1;

  return gradientBlocks.map((block) => {
    const scaledGradient = (Number(block.gradientPct) || 0) * scale;
    const capped = Number.isFinite(maxGradientPct) && maxGradientPct > 0
      ? clamp(scaledGradient, -maxGradientPct, maxGradientPct)
      : scaledGradient;
    return {
      ratio: Number(block.ratio) || 0,
      gradientPct: capped,
    };
  });
}

function findSegmentByAbsoluteDistance(segmentsInput, distanceMeters) {
  const segments = Array.isArray(segmentsInput) ? segmentsInput : [];
  if (segments.length === 0) return null;
  const clampedDistance = clamp(Number(distanceMeters) || 0, 0, getCourseLengthMeters(segments));
  return segments.find((segment) => clampedDistance >= segment.startDistance && clampedDistance < segment.endDistance) || segments[segments.length - 1];
}

function getGradientFromSegmentsAtDistance(segmentsInput, distanceMeters) {
  const segment = findSegmentByAbsoluteDistance(segmentsInput, distanceMeters);
  return Number(segment?.grade) || 0;
}

function getElevationAtDistanceFromSegments(segmentsInput, startElevationMeters, distanceMeters) {
  const segments = Array.isArray(segmentsInput) ? segmentsInput : [];
  if (segments.length === 0) return Number(startElevationMeters) || 0;
  const clampedDistance = clamp(Number(distanceMeters) || 0, 0, getCourseLengthMeters(segments));
  let elevation = Number(startElevationMeters) || 0;
  for (const segment of segments) {
    const segmentStart = Number(segment.startDistance) || 0;
    const segmentEnd = Number(segment.endDistance) || segmentStart;
    if (clampedDistance <= segmentStart) break;
    const covered = Math.min(clampedDistance, segmentEnd) - segmentStart;
    if (covered > 0) {
      elevation += covered * ((Number(segment.grade) || 0) / 100);
    }
    if (clampedDistance <= segmentEnd) break;
  }
  return elevation;
}

function buildElevationProfileFromSegments(segmentsInput, startElevationMeters = 0, sampleStepMeters = 100) {
  const segments = Array.isArray(segmentsInput) ? segmentsInput : [];
  if (segments.length === 0) return [];

  const totalDistanceMeters = getCourseLengthMeters(segments);
  const step = Math.max(50, Number(sampleStepMeters) || 100);
  const points = [];
  for (let distance = 0; distance <= totalDistanceMeters; distance += step) {
    points.push({
      distanceFromStartM: distance,
      elevationM: getElevationAtDistanceFromSegments(segments, startElevationMeters, distance),
      gradientPct: getGradientFromSegmentsAtDistance(segments, distance),
    });
  }
  if (points.length === 0 || points[points.length - 1].distanceFromStartM !== totalDistanceMeters) {
    points.push({
      distanceFromStartM: totalDistanceMeters,
      elevationM: getElevationAtDistanceFromSegments(segments, startElevationMeters, totalDistanceMeters),
      gradientPct: getGradientFromSegmentsAtDistance(segments, totalDistanceMeters),
    });
  }
  return downsampleRoutePoints(
    points.map((point) => ({
      distanceMeters: point.distanceFromStartM,
      elevationMeters: point.elevationM,
      gradientPercent: point.gradientPct,
    })),
    1000,
  ).map((point) => ({
    distanceFromStartM: point.distanceMeters,
    elevationM: point.elevationMeters,
    gradientPct: point.gradientPercent,
  }));
}

function createRoutePreset(seed) {
  const scaledBlocks = scaleGradientBlocksToElevationGain(
    seed.distanceKm,
    seed.elevationGainM,
    seed.gradientBlocks,
    seed.maxGradientPct ?? null,
  );
  const courseSegments = buildSegmentsFromGradientBlocks(seed.distanceKm, scaledBlocks);
  const startElevationM = Number(seed.startElevationM);
  const safeStartElevation = Number.isFinite(startElevationM) ? startElevationM : 0;
  const elevationProfile = buildElevationProfileFromSegments(courseSegments, safeStartElevation, 100);
  const distanceKm = Number(seed.distanceKm) || 0;
  const totalDistanceMeters = Math.round(distanceKm * 1000);
  const summitElevationM = Number(seed.summitElevationM);

  return {
    id: seed.id,
    name: seed.name,
    country: seed.country,
    distanceKm,
    elevationGainM: Number(seed.elevationGainM) || 0,
    startElevationM: Number.isFinite(startElevationM) ? startElevationM : safeStartElevation,
    summitElevationM: Number.isFinite(summitElevationM) ? summitElevationM : safeStartElevation + (Number(seed.elevationGainM) || 0),
    avgGradientPct: Number(seed.avgGradientPct) || 0,
    maxGradientPct: Number.isFinite(Number(seed.maxGradientPct)) ? Number(seed.maxGradientPct) : null,
    totalDistanceMeters,
    courseSegments,
    elevationProfile,
  };
}

const ROUTE_PRESET_SEEDS = Object.freeze([
  {
    id: "alpe-dhuez",
    name: "Alpe d'Huez",
    country: "France",
    distanceKm: 13.8,
    elevationGainM: 1096,
    startElevationM: 754,
    summitElevationM: 1850,
    avgGradientPct: 7.9,
    gradientBlocks: [
      { ratio: 0.12, gradientPct: 6.2 },
      { ratio: 0.2, gradientPct: 7.4 },
      { ratio: 0.23, gradientPct: 8.6 },
      { ratio: 0.2, gradientPct: 7.8 },
      { ratio: 0.15, gradientPct: 9.0 },
      { ratio: 0.1, gradientPct: 8.3 },
    ],
  },
  {
    id: "mont-ventoux",
    name: "Mont Ventoux (Bedoin)",
    country: "France",
    distanceKm: 21.2,
    elevationGainM: 1577,
    startElevationM: 302,
    summitElevationM: 1879,
    avgGradientPct: 7.5,
    gradientBlocks: [
      { ratio: 0.15, gradientPct: 4.8 },
      { ratio: 0.2, gradientPct: 7.1 },
      { ratio: 0.25, gradientPct: 8.2 },
      { ratio: 0.2, gradientPct: 7.6 },
      { ratio: 0.2, gradientPct: 8.9 },
    ],
  },
  {
    id: "stelvio-prato",
    name: "Passo dello Stelvio (Prato)",
    country: "Italy",
    distanceKm: 24.5,
    elevationGainM: 1824,
    startElevationM: 934,
    summitElevationM: 2758,
    avgGradientPct: 7.5,
    gradientBlocks: [
      { ratio: 0.12, gradientPct: 5.8 },
      { ratio: 0.18, gradientPct: 7.0 },
      { ratio: 0.25, gradientPct: 8.1 },
      { ratio: 0.25, gradientPct: 7.6 },
      { ratio: 0.2, gradientPct: 8.2 },
    ],
  },
  {
    id: "tourmalet-luz",
    name: "Col du Tourmalet (Luz)",
    country: "France",
    distanceKm: 18.8,
    elevationGainM: 1357,
    startElevationM: 757,
    summitElevationM: 2115,
    avgGradientPct: 7.2,
    gradientBlocks: [
      { ratio: 0.18, gradientPct: 5.5 },
      { ratio: 0.22, gradientPct: 6.8 },
      { ratio: 0.25, gradientPct: 7.6 },
      { ratio: 0.2, gradientPct: 7.1 },
      { ratio: 0.15, gradientPct: 8.4 },
    ],
  },
  {
    id: "galibier-valloire",
    name: "Col du Galibier (Valloire)",
    country: "France",
    distanceKm: 17.5,
    elevationGainM: 1214,
    startElevationM: 1427,
    summitElevationM: 2642,
    avgGradientPct: 7.0,
    gradientBlocks: [
      { ratio: 0.2, gradientPct: 5.3 },
      { ratio: 0.25, gradientPct: 6.5 },
      { ratio: 0.22, gradientPct: 7.4 },
      { ratio: 0.18, gradientPct: 7.0 },
      { ratio: 0.15, gradientPct: 8.0 },
    ],
  },
  {
    id: "sa-calobra",
    name: "Sa Calobra",
    country: "Spain",
    distanceKm: 9.9,
    elevationGainM: 696,
    startElevationM: 28,
    summitElevationM: 724,
    avgGradientPct: 7.0,
    gradientBlocks: [
      { ratio: 0.2, gradientPct: 6.4 },
      { ratio: 0.2, gradientPct: 6.9 },
      { ratio: 0.2, gradientPct: 7.1 },
      { ratio: 0.2, gradientPct: 7.3 },
      { ratio: 0.2, gradientPct: 6.8 },
    ],
  },
  {
    id: "passo-pordoi",
    name: "Passo Pordoi",
    country: "Italy",
    distanceKm: 9.2,
    elevationGainM: 638,
    startElevationM: 1601,
    summitElevationM: 2239,
    avgGradientPct: 6.9,
    gradientBlocks: [
      { ratio: 0.2, gradientPct: 6.0 },
      { ratio: 0.25, gradientPct: 6.8 },
      { ratio: 0.25, gradientPct: 7.3 },
      { ratio: 0.2, gradientPct: 6.9 },
      { ratio: 0.1, gradientPct: 7.8 },
    ],
  },
  {
    id: "alto-angliru",
    name: "Alto de l'Angliru",
    country: "Spain",
    distanceKm: 12.1,
    elevationGainM: 1243,
    startElevationM: 331,
    summitElevationM: 1574,
    avgGradientPct: 10.2,
    gradientBlocks: [
      { ratio: 0.15, gradientPct: 5.5 },
      { ratio: 0.2, gradientPct: 7.2 },
      { ratio: 0.2, gradientPct: 9.1 },
      { ratio: 0.2, gradientPct: 11.0 },
      { ratio: 0.15, gradientPct: 12.8 },
      { ratio: 0.1, gradientPct: 14.0 },
    ],
  },
  {
    id: "muur-geraardsbergen",
    name: "Muur van Geraardsbergen",
    country: "Belgium",
    distanceKm: 1.1,
    elevationGainM: 85,
    startElevationM: 19,
    summitElevationM: 104,
    avgGradientPct: 8.1,
    maxGradientPct: 17.6,
    gradientBlocks: [
      { ratio: 0.2, gradientPct: 6.5 },
      { ratio: 0.2, gradientPct: 9.5 },
      { ratio: 0.2, gradientPct: 12.5 },
      { ratio: 0.2, gradientPct: 15.5 },
      { ratio: 0.2, gradientPct: 11.0 },
    ],
  },
  {
    id: "box-hill-zigzag",
    name: "Box Hill Zig Zag Road",
    country: "England",
    distanceKm: 4.3,
    elevationGainM: 204,
    startElevationM: 56,
    summitElevationM: 260,
    avgGradientPct: 5.0,
    gradientBlocks: [
      { ratio: 0.25, gradientPct: 4.0 },
      { ratio: 0.25, gradientPct: 5.1 },
      { ratio: 0.2, gradientPct: 5.8 },
      { ratio: 0.15, gradientPct: 4.8 },
      { ratio: 0.15, gradientPct: 5.2 },
    ],
  },
]);

const ROUTE_PRESETS = Object.freeze(ROUTE_PRESET_SEEDS.map(createRoutePreset));
const DEFAULT_ROUTE_PRESET = ROUTE_PRESETS[0];
const DEFAULT_COURSE_SEGMENTS = Object.freeze(DEFAULT_ROUTE_PRESET.courseSegments.map((segment) => ({ ...segment })));
const GENERATED_ROUTE_ID = "generated-route";
const GENERATED_ROUTE_NAME = "Generated Route";
const GENERATED_ROUTE_COUNTRY = "Virtual";
const ROUTE_GENERATOR_SERVICE = window.RouteGeneratorService || null;
const GENERATED_HILLINESS_KEYS = Object.freeze(["flat", "rolling", "hilly", "climbing"]);
const GENERATED_HILLINESS_LABELS = Object.freeze({
  flat: "Flat",
  rolling: "Rolling",
  hilly: "Hilly",
  climbing: "Climbing",
});
const LOBBY_SECTIONS = Object.freeze(["account", "create", "join", "devices", "workouts"]);

function normalizeGeneratedRouteDistanceKm(distanceKmInput) {
  const parsed = Number(distanceKmInput);
  if (!Number.isFinite(parsed)) return 20;
  return clamp(parsed, 2, 300);
}

function normalizeGeneratedHilliness(hillinessInput) {
  const key = String(hillinessInput || "rolling").trim().toLowerCase();
  return GENERATED_HILLINESS_KEYS.includes(key) ? key : "rolling";
}

function normalizeRouteSelectionMode(modeInput) {
  return String(modeInput || "").trim().toLowerCase() === "generated" ? "generated" : "preset";
}

function normalizeLobbySection(sectionInput, fallbackSection = "account") {
  const fallback = LOBBY_SECTIONS.includes(fallbackSection) ? fallbackSection : "account";
  const normalized = String(sectionInput || "").trim().toLowerCase();
  return LOBBY_SECTIONS.includes(normalized) ? normalized : fallback;
}

function getWorkoutZoneConfig(zoneInput) {
  const parsedZone = Math.round(Number(zoneInput));
  const match = WORKOUT_ZONES.find((zoneDef) => zoneDef.zone === parsedZone);
  return match || WORKOUT_ZONES[0];
}

function normalizeWorkoutFtpWatts(ftpWattsInput, fallbackFtpWatts = WORKOUT_DEFAULT_FTP_WATTS) {
  const parsedFallback = Math.round(Number(fallbackFtpWatts));
  const safeFallback = Number.isFinite(parsedFallback) ? parsedFallback : WORKOUT_DEFAULT_FTP_WATTS;
  const parsed = Math.round(Number(ftpWattsInput));
  const candidate = Number.isFinite(parsed) ? parsed : safeFallback;
  return clamp(candidate, FTP_MIN_WATTS, FTP_MAX_WATTS);
}

function getWorkoutZoneWatts(zoneInput, ftpWattsInput) {
  const zoneDef = getWorkoutZoneConfig(zoneInput);
  const ftpWatts = normalizeWorkoutFtpWatts(ftpWattsInput, WORKOUT_DEFAULT_FTP_WATTS);
  const minPct = Number.isFinite(Number(zoneDef.minPct)) ? Number(zoneDef.minPct) : 0;
  const maxPct = Number.isFinite(Number(zoneDef.maxPct)) ? Number(zoneDef.maxPct) : 100;
  const minWatts = Math.max(0, Math.floor((ftpWatts * minPct) / 100));
  const maxWatts = Math.max(minWatts, Math.floor((ftpWatts * maxPct) / 100));
  const targetWatts = Math.max(minWatts, Math.floor((minWatts + maxWatts) / 2));
  return {
    minWatts,
    maxWatts,
    targetWatts,
  };
}

function normalizeWorkoutTargetWatts(targetWattsInput, fallbackTargetWatts = null) {
  const parsed = Math.floor(Number(targetWattsInput));
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  const parsedFallback = Math.floor(Number(fallbackTargetWatts));
  if (Number.isFinite(parsedFallback)) return Math.max(0, parsedFallback);
  return null;
}

function normalizeWorkoutTargetFtpPct(targetFtpPctInput, fallbackTargetFtpPct = null) {
  const parsed = Number(targetFtpPctInput);
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  const parsedFallback = Number(fallbackTargetFtpPct);
  if (Number.isFinite(parsedFallback)) return Math.max(0, parsedFallback);
  return null;
}

function getWorkoutTargetFtpPctFromWatts(targetWattsInput, ftpWattsInput) {
  const ftpWatts = normalizeWorkoutFtpWatts(ftpWattsInput, WORKOUT_DEFAULT_FTP_WATTS);
  const targetWatts = normalizeWorkoutTargetWatts(targetWattsInput, 0);
  const safeTargetWatts = Number.isFinite(targetWatts) ? targetWatts : 0;
  if (ftpWatts <= 0) return 0;
  const rawTargetPct = (safeTargetWatts / ftpWatts) * 100;
  return Math.max(0, Math.round(rawTargetPct * 10000) / 10000);
}

function getWorkoutWattsFromTargetFtpPct(targetFtpPctInput, ftpWattsInput, fallbackTargetWatts = 0) {
  const targetFtpPct = normalizeWorkoutTargetFtpPct(targetFtpPctInput, null);
  if (targetFtpPct == null) return normalizeWorkoutTargetWatts(fallbackTargetWatts, 0);
  const ftpWatts = normalizeWorkoutFtpWatts(ftpWattsInput, WORKOUT_DEFAULT_FTP_WATTS);
  return Math.max(0, Math.floor((ftpWatts * targetFtpPct) / 100));
}

function getWorkoutZoneForWatts(targetWattsInput, ftpWattsInput) {
  const ftpWatts = normalizeWorkoutFtpWatts(ftpWattsInput, WORKOUT_DEFAULT_FTP_WATTS);
  const targetWatts = normalizeWorkoutTargetWatts(targetWattsInput, 0);
  const safeWatts = Number.isFinite(targetWatts) ? targetWatts : 0;
  for (const zoneDef of WORKOUT_ZONES) {
    const zoneMaxWatts = Math.floor((ftpWatts * Number(zoneDef.maxPct || 0)) / 100);
    if (safeWatts <= zoneMaxWatts) return zoneDef.zone;
  }
  return WORKOUT_ZONES[WORKOUT_ZONES.length - 1].zone;
}

function getWorkoutSegmentTargetWatts(segmentInput, ftpWattsInput) {
  const segment = segmentInput && typeof segmentInput === "object" ? segmentInput : {};
  const targetFtpPct = normalizeWorkoutTargetFtpPct(segment.targetFtpPct ?? segment.targetPct, null);
  if (targetFtpPct != null) return getWorkoutWattsFromTargetFtpPct(targetFtpPct, ftpWattsInput, 0);
  const explicitTargetWatts = normalizeWorkoutTargetWatts(segment.targetWatts, null);
  if (explicitTargetWatts != null) return explicitTargetWatts;
  const zoneDef = getWorkoutZoneConfig(segment.zone);
  return getWorkoutZoneWatts(zoneDef.zone, ftpWattsInput).targetWatts;
}

function getWorkoutSegmentZone(segmentInput, ftpWattsInput) {
  const segment = segmentInput && typeof segmentInput === "object" ? segmentInput : {};
  const targetWatts = getWorkoutSegmentTargetWatts(segment, ftpWattsInput);
  return getWorkoutZoneForWatts(targetWatts, ftpWattsInput);
}

function getWorkoutEffortClass(zoneInput) {
  const zone = getWorkoutZoneConfig(zoneInput).zone;
  return `workout-zone-level-${zone}`;
}

function normalizeWorkoutDurationSeconds(durationInput, fallbackSeconds = WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS) {
  const fallback = clamp(
    Math.round(Number(fallbackSeconds) || WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS),
    WORKOUT_MIN_SEGMENT_DURATION_SECONDS,
    WORKOUT_MAX_SEGMENT_DURATION_SECONDS,
  );
  const parsed = Math.round(Number(durationInput));
  const candidate = Number.isFinite(parsed) ? parsed : fallback;
  const clamped = clamp(candidate, WORKOUT_MIN_SEGMENT_DURATION_SECONDS, WORKOUT_MAX_SEGMENT_DURATION_SECONDS);
  const roundedToStep = Math.round(clamped / WORKOUT_SEGMENT_SECOND_STEP) * WORKOUT_SEGMENT_SECOND_STEP;
  return clamp(roundedToStep, WORKOUT_MIN_SEGMENT_DURATION_SECONDS, WORKOUT_MAX_SEGMENT_DURATION_SECONDS);
}

function getWorkoutDurationParts(durationInput) {
  const totalSeconds = normalizeWorkoutDurationSeconds(durationInput);
  return {
    totalSeconds,
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

function normalizeWorkoutSetRepetitions(valueInput) {
  const parsed = Math.round(Number(valueInput));
  if (!Number.isFinite(parsed)) return 1;
  return clamp(parsed, WORKOUT_SET_REPETITIONS_MIN, WORKOUT_SET_REPETITIONS_MAX);
}

function normalizeWorkoutZoneSegment(segmentInput, ftpReferenceWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  const segment = segmentInput && typeof segmentInput === "object" ? segmentInput : {};
  const targetFtpPctInput = segment.targetFtpPct ?? segment.targetPct;
  const parsedTargetFtpPct = normalizeWorkoutTargetFtpPct(targetFtpPctInput, null);
  const fallbackTargetWatts = normalizeWorkoutTargetWatts(segment.targetWatts, null);
  const targetFtpPct =
    parsedTargetFtpPct != null
      ? parsedTargetFtpPct
      : fallbackTargetWatts != null
        ? getWorkoutTargetFtpPctFromWatts(fallbackTargetWatts, ftpReferenceWattsInput)
        : null;
  const hasZone = Number.isFinite(Number(segment.zone));
  const referenceWatts = getWorkoutWattsFromTargetFtpPct(targetFtpPct, ftpReferenceWattsInput, fallbackTargetWatts);
  const zone = hasZone
    ? getWorkoutZoneConfig(segment.zone).zone
    : targetFtpPct != null
      ? getWorkoutZoneForWatts(referenceWatts, ftpReferenceWattsInput)
      : getWorkoutZoneConfig(segment.zone).zone;
  return {
    type: WORKOUT_ITEM_TYPE_SEGMENT,
    zone,
    targetFtpPct,
    durationSeconds: normalizeWorkoutDurationSeconds(segment.durationSeconds),
  };
}

function isWorkoutSetItem(itemInput) {
  const item = itemInput && typeof itemInput === "object" ? itemInput : null;
  if (!item) return false;
  return String(item.type || "").toLowerCase() === WORKOUT_ITEM_TYPE_SET || (Array.isArray(item.segments) && item.zone == null);
}

function normalizeWorkoutSetItem(setInput, ftpReferenceWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  const setItem = setInput && typeof setInput === "object" ? setInput : {};
  const segments = Array.isArray(setItem.segments)
    ? setItem.segments
        .map((segment) => normalizeWorkoutZoneSegment(segment, ftpReferenceWattsInput))
        .filter((segment) => Number.isFinite(segment.durationSeconds) && segment.durationSeconds > 0)
    : [];
  return {
    type: WORKOUT_ITEM_TYPE_SET,
    repetitions: normalizeWorkoutSetRepetitions(setItem.repetitions),
    segments,
  };
}

function normalizeWorkoutItem(itemInput, ftpReferenceWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  if (isWorkoutSetItem(itemInput)) {
    return normalizeWorkoutSetItem(itemInput, ftpReferenceWattsInput);
  }
  return normalizeWorkoutZoneSegment(itemInput, ftpReferenceWattsInput);
}

function normalizeWorkoutSegments(segmentsInput, ftpReferenceWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  if (!Array.isArray(segmentsInput)) return [];
  return segmentsInput.map((item) => normalizeWorkoutItem(item, ftpReferenceWattsInput)).filter((item) => {
    if (item.type === WORKOUT_ITEM_TYPE_SET) return true;
    return Number.isFinite(item.durationSeconds) && item.durationSeconds > 0;
  });
}

function getWorkoutZoneIntensityMultiplier(zoneInput) {
  const zone = getWorkoutZoneConfig(zoneInput).zone;
  return WORKOUT_ZONE_INTENSITY_MULTIPLIERS[zone] || WORKOUT_ZONE_INTENSITY_MULTIPLIERS[2];
}

function computeWorkoutDifficultyMetrics(segmentsInput, ftpWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  const ftpWatts = normalizeWorkoutFtpWatts(ftpWattsInput, WORKOUT_DEFAULT_FTP_WATTS);
  let totalDurationSeconds = 0;
  let totalEffortScore = 0;
  let zone4PlusSeconds = 0;

  const applySegmentEffort = (segmentInput, repeatsInput = 1) => {
    const segment = normalizeWorkoutZoneSegment(segmentInput);
    const durationSeconds = normalizeWorkoutDurationSeconds(segment.durationSeconds);
    const repeats = Math.max(1, normalizeWorkoutSetRepetitions(repeatsInput));
    const zone = getWorkoutSegmentZone(segment, ftpWatts);
    const intensity = getWorkoutZoneIntensityMultiplier(zone);
    const effectiveDurationSeconds = durationSeconds * repeats;
    totalDurationSeconds += effectiveDurationSeconds;
    totalEffortScore += effectiveDurationSeconds * intensity;
    if (zone >= 4) zone4PlusSeconds += effectiveDurationSeconds;
  };

  segments.forEach((item) => {
    if (item.type === WORKOUT_ITEM_TYPE_SET) {
      const repeats = normalizeWorkoutSetRepetitions(item.repetitions);
      item.segments.forEach((segment) => applySegmentEffort(segment, repeats));
      return;
    }
    applySegmentEffort(item, 1);
  });

  if (totalDurationSeconds <= 0) {
    return {
      difficulty: 1,
      weightedAverageIntensity: 0,
      totalDurationSeconds: 0,
      zone4PlusSeconds: 0,
    };
  }

  const weightedAverageIntensity = totalEffortScore / totalDurationSeconds;
  if (weightedAverageIntensity >= 1) {
    return {
      difficulty: 10,
      weightedAverageIntensity,
      totalDurationSeconds,
      zone4PlusSeconds,
    };
  }

  // Tunable MVP model:
  // - intensity drives most of the score
  // - duration adds structure so short hard workouts are not always maximal
  // - sustained time in Z4/Z5 bumps the final result for clearly hard workouts
  const intensityScore = clamp((weightedAverageIntensity - 0.5) / 0.5, 0, 1);
  const durationScore = clamp(totalDurationSeconds / 3600, 0, 1.25);
  const highZoneScore = clamp(zone4PlusSeconds / 900, 0, 1);
  const rawDifficulty = 1 + intensityScore * 6 + durationScore * 2 + highZoneScore;
  const difficulty = clamp(Math.round(rawDifficulty), 1, 10);

  return {
    difficulty,
    weightedAverageIntensity,
    totalDurationSeconds,
    zone4PlusSeconds,
  };
}

function calculateWorkoutDifficulty(segmentsInput, ftpWattsInput = WORKOUT_DEFAULT_FTP_WATTS) {
  return computeWorkoutDifficultyMetrics(segmentsInput, ftpWattsInput).difficulty;
}

function computeWorkoutTotalDurationSeconds(segmentsInput) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  return segments.reduce((total, item) => {
    if (item.type === WORKOUT_ITEM_TYPE_SET) {
      const setCycleDuration = item.segments.reduce((setTotal, segment) => setTotal + (Number(segment.durationSeconds) || 0), 0);
      return total + setCycleDuration * normalizeWorkoutSetRepetitions(item.repetitions);
    }
    return total + (Number(item.durationSeconds) || 0);
  }, 0);
}

function createWorkoutSegment(
  zoneInput,
  durationSecondsInput = WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS,
  ftpWattsInput = WORKOUT_DEFAULT_FTP_WATTS,
) {
  const zoneDef = getWorkoutZoneConfig(zoneInput);
  const targetWatts = getWorkoutZoneWatts(zoneDef.zone, ftpWattsInput).targetWatts;
  const targetFtpPct = getWorkoutTargetFtpPctFromWatts(targetWatts, ftpWattsInput);
  return {
    type: WORKOUT_ITEM_TYPE_SEGMENT,
    zone: zoneDef.zone,
    targetFtpPct,
    durationSeconds: normalizeWorkoutDurationSeconds(durationSecondsInput),
  };
}

function createWorkoutSet(repetitionsInput = 2) {
  return {
    type: WORKOUT_ITEM_TYPE_SET,
    repetitions: normalizeWorkoutSetRepetitions(repetitionsInput),
    segments: [],
  };
}

function countWorkoutConfiguredSegments(segmentsInput) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  return segments.reduce((total, item) => {
    if (item.type === WORKOUT_ITEM_TYPE_SET) {
      return total + item.segments.length;
    }
    return total + 1;
  }, 0);
}

function findFirstWorkoutSelection(segmentsInput) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  if (segments.length === 0) return null;
  if (segments[0].type === WORKOUT_ITEM_TYPE_SET) {
    if (segments[0].segments.length > 0) {
      return {
        kind: "set-segment",
        setIndex: 0,
        segmentIndex: 0,
      };
    }
    return {
      kind: "set",
      setIndex: 0,
    };
  }
  return {
    kind: "segment",
    index: 0,
  };
}

function normalizeWorkoutSelection(selectionInput, segmentsInput) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  if (!selectionInput || typeof selectionInput !== "object") return findFirstWorkoutSelection(segments);
  const kind = String(selectionInput.kind || "").trim().toLowerCase();
  if (kind === "segment") {
    const index = Math.round(Number(selectionInput.index));
    if (!Number.isFinite(index)) return findFirstWorkoutSelection(segments);
    const segment = segments[index];
    if (!segment || segment.type === WORKOUT_ITEM_TYPE_SET) return findFirstWorkoutSelection(segments);
    return { kind: "segment", index };
  }
  if (kind === "set") {
    const setIndex = Math.round(Number(selectionInput.setIndex));
    if (!Number.isFinite(setIndex)) return findFirstWorkoutSelection(segments);
    const setItem = segments[setIndex];
    if (!setItem || setItem.type !== WORKOUT_ITEM_TYPE_SET) return findFirstWorkoutSelection(segments);
    return { kind: "set", setIndex };
  }
  if (kind === "set-segment") {
    const setIndex = Math.round(Number(selectionInput.setIndex));
    const segmentIndex = Math.round(Number(selectionInput.segmentIndex));
    if (!Number.isFinite(setIndex) || !Number.isFinite(segmentIndex)) return findFirstWorkoutSelection(segments);
    const setItem = segments[setIndex];
    if (!setItem || setItem.type !== WORKOUT_ITEM_TYPE_SET) return findFirstWorkoutSelection(segments);
    if (segmentIndex < 0 || segmentIndex >= setItem.segments.length) {
      return setItem.segments.length > 0
        ? { kind: "set-segment", setIndex, segmentIndex: 0 }
        : { kind: "set", setIndex };
    }
    return { kind: "set-segment", setIndex, segmentIndex };
  }
  return findFirstWorkoutSelection(segments);
}

function getSelectedWorkoutEntity(segmentsInput, selectionInput) {
  const segments = normalizeWorkoutSegments(segmentsInput);
  const selection = normalizeWorkoutSelection(selectionInput, segments);
  if (!selection) return { selection: null, item: null, setItem: null, segment: null };
  if (selection.kind === "segment") {
    return {
      selection,
      item: segments[selection.index] || null,
      setItem: null,
      segment: segments[selection.index] || null,
    };
  }
  if (selection.kind === "set") {
    return {
      selection,
      item: segments[selection.setIndex] || null,
      setItem: segments[selection.setIndex] || null,
      segment: null,
    };
  }
  const setItem = segments[selection.setIndex] || null;
  return {
    selection,
    item: setItem,
    setItem,
    segment: setItem?.segments?.[selection.segmentIndex] || null,
  };
}

function normalizeWorkoutName(nameInput) {
  return String(nameInput || "").trim();
}

function normalizeWorkoutNotes(notesInput) {
  const normalized = String(notesInput || "").replace(/\r\n?/g, "\n");
  if (normalized.length <= WORKOUT_NOTES_MAX_LENGTH) return normalized;
  return normalized.slice(0, WORKOUT_NOTES_MAX_LENGTH);
}

function normalizeWorkoutFavorite(valueInput) {
  return valueInput === true;
}

function normalizeWorkoutRating(valueInput, fallbackValue = null) {
  if (valueInput == null || valueInput === "") {
    return fallbackValue == null ? null : normalizeWorkoutRating(fallbackValue, null);
  }
  const numeric = Number(valueInput);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
    return fallbackValue == null ? null : normalizeWorkoutRating(fallbackValue, null);
  }
  if (numeric < WORKOUT_RATING_MIN || numeric > WORKOUT_RATING_MAX) {
    return fallbackValue == null ? null : normalizeWorkoutRating(fallbackValue, null);
  }
  return numeric;
}

function normalizeWorkoutTag(tagInput) {
  const candidate = String(tagInput || "").trim().toLowerCase();
  if (!candidate) return null;
  const match = WORKOUT_TAG_OPTIONS.find((tag) => tag.toLowerCase() === candidate);
  return match || null;
}

function normalizeWorkoutTags(tagsInput) {
  if (!Array.isArray(tagsInput)) return [];
  const seen = new Set();
  const normalized = [];
  tagsInput.forEach((tagInput) => {
    const tag = normalizeWorkoutTag(tagInput);
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    normalized.push(tag);
  });
  return normalized;
}

function normalizeWorkoutRecord(workoutInput, index = 0) {
  const workout = workoutInput && typeof workoutInput === "object" ? workoutInput : {};
  const ftpReferenceWatts = normalizeWorkoutFtpWatts(workout.ftpReferenceWatts, WORKOUT_DEFAULT_FTP_WATTS);
  const segments = normalizeWorkoutSegments(workout.segments, ftpReferenceWatts);
  const name = normalizeWorkoutName(workout.name) || `Workout ${index + 1}`;
  const notes = normalizeWorkoutNotes(workout.notes);
  const isFavorite = normalizeWorkoutFavorite(workout.isFavorite);
  const rating = normalizeWorkoutRating(workout.rating, null);
  const tags = normalizeWorkoutTags(workout.tags);
  const createdAt = Number(workout.createdAt);
  const createdAtMs = Number.isFinite(createdAt) ? createdAt : currentMs();
  const id =
    workout.id != null && String(workout.id).trim() !== ""
      ? String(workout.id).trim()
      : `workout_${createdAtMs}_${index}_${makeId(5).toLowerCase()}`;
  const totalDurationSeconds = computeWorkoutTotalDurationSeconds(segments);

  return {
    id,
    name,
    createdAt: createdAtMs,
    ftpReferenceWatts,
    notes,
    isFavorite,
    rating,
    tags,
    segments,
    totalDurationSeconds,
  };
}

function loadWorkouts() {
  const raw = loadJson(WORKOUTS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((workout, index) => normalizeWorkoutRecord(workout, index));
}

function saveWorkouts(workoutsInput) {
  const workouts = Array.isArray(workoutsInput) ? workoutsInput : [];
  const normalized = workouts.map((workout, index) => normalizeWorkoutRecord(workout, index));
  saveJson(WORKOUTS_KEY, normalized);
}

function validateWorkoutDraft(nameInput, segmentsInput, tagsInput = []) {
  const name = normalizeWorkoutName(nameInput);
  const segments = normalizeWorkoutSegments(segmentsInput);
  const tags = normalizeWorkoutTags(tagsInput);
  const errors = [];
  if (!name) errors.push("Workout name is required.");
  if (segments.length === 0) errors.push("Add at least one segment.");
  segments.forEach((item) => {
    if (item.type === WORKOUT_ITEM_TYPE_SET) {
      if (item.segments.length === 0) {
        errors.push("Each set needs at least one segment.");
        return;
      }
      if (!Number.isFinite(item.repetitions) || item.repetitions < WORKOUT_SET_REPETITIONS_MIN) {
        errors.push("Set repetitions must be at least 1.");
      }
      if (item.segments.some((segment) => !Number.isFinite(segment.durationSeconds) || segment.durationSeconds <= 0)) {
        errors.push("Each segment in a set needs a duration greater than 0 seconds.");
      }
      return;
    }
    if (!Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) {
      errors.push("Each segment needs a duration greater than 0 seconds.");
    }
  });
  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    name,
    segments,
    tags,
    totalDurationSeconds: computeWorkoutTotalDurationSeconds(segments),
  };
}

function getGeneratedHillinessLabel(hillinessInput) {
  const key = normalizeGeneratedHilliness(hillinessInput);
  return GENERATED_HILLINESS_LABELS[key] || GENERATED_HILLINESS_LABELS.rolling;
}

function computeSegmentElevationStats(segmentsInput = [], startElevationM = 0) {
  const segments = Array.isArray(segmentsInput) ? segmentsInput : [];
  let elevation = Number(startElevationM) || 0;
  let summit = elevation;
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxAbsGradePct = 0;
  let totalDistanceMeters = 0;
  let weightedAbsGrade = 0;

  segments.forEach((segment) => {
    const start = Number(segment.startDistance) || 0;
    const end = Number(segment.endDistance) || start;
    const distance = Math.max(0, end - start);
    const grade = Number(segment.grade) || 0;
    const delta = distance * (grade / 100);
    if (delta > 0) totalAscentM += delta;
    if (delta < 0) totalDescentM += -delta;
    elevation += delta;
    summit = Math.max(summit, elevation);
    totalDistanceMeters += distance;
    maxAbsGradePct = Math.max(maxAbsGradePct, Math.abs(grade));
    weightedAbsGrade += Math.abs(grade) * distance;
  });

  return {
    totalDistanceMeters,
    totalAscentM,
    totalDescentM,
    maxAbsGradePct,
    summitElevationM: summit,
    endElevationM: elevation,
    endDeltaM: elevation - (Number(startElevationM) || 0),
    avgAbsGradientPct: totalDistanceMeters > 0 ? weightedAbsGrade / totalDistanceMeters : 0,
  };
}

function validateGeneratedRoute(routePreset, targetDistanceKm, hillinessPreset) {
  const fallbackValidation = { valid: true, errors: [], warnings: [], metrics: null };
  if (!routePreset || typeof routePreset !== "object") {
    return { ...fallbackValidation, valid: false, errors: ["Route payload missing."] };
  }
  if (ROUTE_GENERATOR_SERVICE?.validateRoutePreset) {
    return ROUTE_GENERATOR_SERVICE.validateRoutePreset(routePreset, {
      distanceKm: targetDistanceKm,
      hillinessPreset,
    });
  }

  const metrics = computeSegmentElevationStats(routePreset.courseSegments, routePreset.startElevationM || 0);
  const totalDistanceMeters = Number(routePreset.totalDistanceMeters) || Math.round((Number(routePreset.distanceKm) || 0) * 1000);
  const errors = [];
  const targetMeters = Math.round(normalizeGeneratedRouteDistanceKm(targetDistanceKm) * 1000);
  if (Math.abs(totalDistanceMeters - targetMeters) > 10) errors.push("Distance mismatch.");
  if (Math.abs(metrics.endDeltaM) > 0.5) errors.push("End altitude mismatch.");
  if (metrics.maxAbsGradePct > 12.001) errors.push("Grade limit exceeded.");
  const ascentDescentGap = Math.abs(metrics.totalAscentM - metrics.totalDescentM);
  const maxGap = Math.max(8, Math.max(metrics.totalAscentM, metrics.totalDescentM) * 0.08);
  if (ascentDescentGap > maxGap) errors.push("Ascent and descent are not balanced.");
  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    metrics,
  };
}

function createGeneratedRoutePreset({
  distanceKm,
  hilliness,
  id = GENERATED_ROUTE_ID,
  name = GENERATED_ROUTE_NAME,
  country = GENERATED_ROUTE_COUNTRY,
} = {}) {
  if (!ROUTE_GENERATOR_SERVICE?.generateRoutePreset) return null;
  const resolvedDistanceKm = normalizeGeneratedRouteDistanceKm(distanceKm);
  const resolvedHilliness = normalizeGeneratedHilliness(hilliness);
  const generated = ROUTE_GENERATOR_SERVICE.generateRoutePreset({
    id,
    name,
    country,
    distanceKm: resolvedDistanceKm,
    hillinessPreset: resolvedHilliness,
    startElevationM: 0,
    maxAttempts: 50,
  });
  if (!generated?.routePreset) return null;

  const route = { ...generated.routePreset };
  const stats = computeSegmentElevationStats(route.courseSegments, route.startElevationM || 0);
  route.id = id;
  route.name = name;
  route.country = country;
  route.routeId = id;
  route.distanceKm = Number(route.distanceKm) || resolvedDistanceKm;
  route.totalDistanceMeters = Number(route.totalDistanceMeters) || Math.round(route.distanceKm * 1000);
  route.hillinessPreset = resolvedHilliness;
  route.generatedAt = currentMs();
  route.totalDescentM = Math.round(stats.totalDescentM);
  route.elevationGainM = Math.round(stats.totalAscentM);
  route.summitElevationM = Number.isFinite(Number(route.summitElevationM))
    ? Number(route.summitElevationM)
    : Number(stats.summitElevationM.toFixed(1));
  route.avgGradientPct = Number.isFinite(Number(route.avgGradientPct))
    ? Number(route.avgGradientPct)
    : Number(stats.avgAbsGradientPct.toFixed(1));
  route.maxGradientPct = Number.isFinite(Number(route.maxGradientPct))
    ? Number(route.maxGradientPct)
    : Number(stats.maxAbsGradePct.toFixed(1));
  route._validation = generated.validation || validateGeneratedRoute(route, resolvedDistanceKm, resolvedHilliness);
  return route;
}

function ensureRoutePresetShape(routePresetInput, fallbackPreset = DEFAULT_ROUTE_PRESET) {
  if (!routePresetInput || typeof routePresetInput !== "object") return fallbackPreset;

  const sourceSegmentsRaw = Array.isArray(routePresetInput.courseSegments)
    ? routePresetInput.courseSegments
    : Array.isArray(routePresetInput.segments)
      ? routePresetInput.segments
      : [];
  const courseSegments = sourceSegmentsRaw
    .map((segment) => ({
      startDistance: Number(segment.startDistance) || 0,
      endDistance: Number(segment.endDistance) || 0,
      grade: Number(segment.grade) || 0,
    }))
    .filter((segment) => segment.endDistance > segment.startDistance);
  if (courseSegments.length === 0) return fallbackPreset;

  const orderedSegments = courseSegments.sort((a, b) => a.startDistance - b.startDistance);
  const lengthMeters = getCourseLengthMeters(orderedSegments);
  const startElevationM = Number.isFinite(Number(routePresetInput.startElevationM))
    ? Number(routePresetInput.startElevationM)
    : 0;
  const stats = computeSegmentElevationStats(orderedSegments, startElevationM);
  const providedProfile = Array.isArray(routePresetInput.elevationProfile)
    ? routePresetInput.elevationProfile
        .map((point) => ({
          distanceFromStartM: Number(point?.distanceFromStartM) || 0,
          elevationM: Number(point?.elevationM) || 0,
          gradientPct: Number(point?.gradientPct) || 0,
        }))
        .sort((a, b) => a.distanceFromStartM - b.distanceFromStartM)
    : [];

  return {
    id: routePresetInput.id || fallbackPreset.id,
    name: routePresetInput.name || fallbackPreset.name,
    country: routePresetInput.country || fallbackPreset.country,
    distanceKm: Number.isFinite(Number(routePresetInput.distanceKm))
      ? Number(routePresetInput.distanceKm)
      : lengthMeters / 1000,
    elevationGainM: Number.isFinite(Number(routePresetInput.elevationGainM))
      ? Number(routePresetInput.elevationGainM)
      : Math.round(stats.totalAscentM),
    totalDescentM: Number.isFinite(Number(routePresetInput.totalDescentM))
      ? Number(routePresetInput.totalDescentM)
      : Math.round(stats.totalDescentM),
    startElevationM,
    summitElevationM: Number.isFinite(Number(routePresetInput.summitElevationM))
      ? Number(routePresetInput.summitElevationM)
      : Number(stats.summitElevationM.toFixed(1)),
    avgGradientPct: Number.isFinite(Number(routePresetInput.avgGradientPct))
      ? Number(routePresetInput.avgGradientPct)
      : Number(stats.avgAbsGradientPct.toFixed(1)),
    maxGradientPct: Number.isFinite(Number(routePresetInput.maxGradientPct))
      ? Number(routePresetInput.maxGradientPct)
      : Number(stats.maxAbsGradePct.toFixed(1)),
    totalDistanceMeters: Number.isFinite(Number(routePresetInput.totalDistanceMeters))
      ? Number(routePresetInput.totalDistanceMeters)
      : lengthMeters,
    courseSegments: orderedSegments,
    elevationProfile:
      providedProfile.length > 1 ? providedProfile : buildElevationProfileFromSegments(orderedSegments, startElevationM, 100),
    hillinessPreset: routePresetInput.hillinessPreset || null,
    generatedAt: routePresetInput.generatedAt || null,
  };
}

function getRoutePresetById(routeId) {
  const matched = ROUTE_PRESETS.find((route) => route.id === routeId);
  return matched || DEFAULT_ROUTE_PRESET;
}

function createCourseFromRoutePreset(routePresetInput = DEFAULT_ROUTE_PRESET) {
  const route =
    typeof routePresetInput === "string"
      ? getRoutePresetById(routePresetInput)
      : ensureRoutePresetShape(routePresetInput, getRoutePresetById(routePresetInput?.id));
  const segments = Array.isArray(route.courseSegments) ? route.courseSegments.map((segment) => ({ ...segment })) : [];
  const elevationProfile = Array.isArray(route.elevationProfile) ? route.elevationProfile.map((point) => ({ ...point })) : [];
  const lengthMeters = getCourseLengthMeters(segments);
  return {
    id: route.id,
    routeId: route.id,
    name: route.name,
    country: route.country,
    distanceKm: route.distanceKm,
    elevationGainM: route.elevationGainM,
    totalDescentM: Number.isFinite(Number(route.totalDescentM)) ? Number(route.totalDescentM) : null,
    startElevationM: route.startElevationM,
    summitElevationM: route.summitElevationM,
    avgGradientPct: route.avgGradientPct,
    maxGradientPct: route.maxGradientPct,
    hillinessPreset: route.hillinessPreset || null,
    generatedAt: route.generatedAt || null,
    totalDistanceMeters: Number(route.totalDistanceMeters) || lengthMeters,
    segments,
    elevationProfile,
    lengthMeters,
  };
}

function normalizeSessionCourse(session) {
  if (!session || typeof session !== "object") return;

  const course = session.course;
  if (!course || typeof course !== "object") {
    session.course = createCourseFromRoutePreset(DEFAULT_ROUTE_PRESET);
    return;
  }

  const fallbackRoute = getRoutePresetById(course.routeId || course.id);
  const sourceSegments =
    Array.isArray(course.segments) && course.segments.length > 0 ? course.segments : fallbackRoute.courseSegments;
  const segments = sourceSegments
    .map((segment) => ({
      startDistance: Number(segment.startDistance) || 0,
      endDistance: Number(segment.endDistance) || 0,
      grade: Number(segment.grade) || 0,
    }))
    .filter((segment) => segment.endDistance > segment.startDistance);

  if (segments.length === 0) {
    session.course = createCourseFromRoutePreset(fallbackRoute);
    return;
  }

  const lengthMeters = getCourseLengthMeters(segments);
  const startElevationM = Number.isFinite(Number(course.startElevationM))
    ? Number(course.startElevationM)
    : Number(fallbackRoute.startElevationM) || 0;
  const distanceKm = Number.isFinite(Number(course.distanceKm)) ? Number(course.distanceKm) : lengthMeters / 1000;
  const elevationGainM = Number.isFinite(Number(course.elevationGainM))
    ? Number(course.elevationGainM)
    : Number(fallbackRoute.elevationGainM) || 0;
  const totalDescentM = Number.isFinite(Number(course.totalDescentM))
    ? Number(course.totalDescentM)
    : Number.isFinite(Number(fallbackRoute.totalDescentM))
      ? Number(fallbackRoute.totalDescentM)
      : null;
  const normalizedProfile = Array.isArray(course.elevationProfile)
    ? course.elevationProfile
        .map((point) => ({
          distanceFromStartM: Number(point?.distanceFromStartM) || 0,
          elevationM: Number(point?.elevationM) || 0,
          gradientPct: Number(point?.gradientPct) || 0,
        }))
        .sort((a, b) => a.distanceFromStartM - b.distanceFromStartM)
    : [];

  session.course = {
    ...course,
    id: course.id || fallbackRoute.id,
    routeId: course.routeId || course.id || fallbackRoute.id,
    name: course.name || fallbackRoute.name,
    country: course.country || fallbackRoute.country,
    distanceKm,
    elevationGainM,
    totalDescentM,
    startElevationM,
    summitElevationM: Number.isFinite(Number(course.summitElevationM))
      ? Number(course.summitElevationM)
      : startElevationM + elevationGainM,
    avgGradientPct: Number.isFinite(Number(course.avgGradientPct))
      ? Number(course.avgGradientPct)
      : Number(fallbackRoute.avgGradientPct) || 0,
    maxGradientPct: Number.isFinite(Number(course.maxGradientPct))
      ? Number(course.maxGradientPct)
      : Number.isFinite(Number(fallbackRoute.maxGradientPct))
        ? Number(fallbackRoute.maxGradientPct)
        : null,
    hillinessPreset: course.hillinessPreset || fallbackRoute.hillinessPreset || null,
    generatedAt: course.generatedAt || fallbackRoute.generatedAt || null,
    totalDistanceMeters: Number.isFinite(Number(course.totalDistanceMeters)) ? Number(course.totalDistanceMeters) : lengthMeters,
    segments,
    elevationProfile:
      normalizedProfile.length > 1
        ? normalizedProfile
        : buildElevationProfileFromSegments(segments, startElevationM, 100),
    lengthMeters,
  };
}

function getSessionRoute(session) {
  const fallback = getRoutePresetById(session?.course?.routeId || session?.course?.id);
  const course = session?.course || {};
  return {
    ...fallback,
    ...course,
    id: course.id || fallback.id,
    routeId: course.routeId || course.id || fallback.id,
    name: course.name || fallback.name,
    country: course.country || fallback.country,
    totalDistanceMeters: Number(course.totalDistanceMeters) || Number(course.lengthMeters) || Number(fallback.totalDistanceMeters) || 0,
    elevationProfile:
      Array.isArray(course.elevationProfile) && course.elevationProfile.length > 1
        ? course.elevationProfile
        : Array.isArray(fallback.elevationProfile)
          ? fallback.elevationProfile
          : [],
  };
}

function getAverageGradientAhead(route, distanceM, lookaheadMeters = 500) {
  const totalDistanceMeters = Number(route?.totalDistanceMeters) || Math.round((Number(route?.distanceKm) || 0) * 1000);
  if (totalDistanceMeters <= 0) return 0;
  const start = clamp(Number(distanceM) || 0, 0, totalDistanceMeters);
  const end = clamp(start + Math.max(1, Number(lookaheadMeters) || 500), 0, totalDistanceMeters);
  if (end <= start) return 0;
  const startElevation = getElevationAtDistance(route, start);
  const endElevation = getElevationAtDistance(route, end);
  return ((endElevation - startElevation) / (end - start)) * 100;
}

function formatRoutePresetMeta(route) {
  const shaped = ensureRoutePresetShape(route, DEFAULT_ROUTE_PRESET);
  const maxGradient = Number.isFinite(Number(shaped?.maxGradientPct)) ? `${Number(shaped.maxGradientPct).toFixed(1)}%` : "--";
  const distanceKm = Number(shaped?.distanceKm) || 0;
  const elevationGainM = Math.round(Number(shaped?.elevationGainM) || 0);
  const avgGradientPct = Number(shaped?.avgGradientPct) || 0;
  const hillinessText = shaped?.hillinessPreset ? ` | ${getGeneratedHillinessLabel(shaped.hillinessPreset)}` : "";
  const descentText = Number.isFinite(Number(shaped?.totalDescentM)) ? ` | ${Math.round(Number(shaped.totalDescentM))} m descent` : "";
  return `${shaped?.country || "Unknown"} | ${distanceKm.toFixed(1)} km | ${elevationGainM} m climb${descentText}${hillinessText} | avg ${avgGradientPct.toFixed(
    1,
  )}% | max ${maxGradient}`;
}

function renderRoutePresetPreview(routePreset) {
  const route = ensureRoutePresetShape(routePreset, DEFAULT_ROUTE_PRESET);
  const routeProfile = buildRouteProfileFromSegments(route.courseSegments);
  const distanceKm = Number(route.distanceKm) || (Number(routeProfile.totalDistanceMeters) || 0) / 1000;
  const elevationGainM = Math.round(Number(route.elevationGainM) || 0);
  const totalDescentM = Number.isFinite(Number(route.totalDescentM)) ? Math.round(Number(route.totalDescentM)) : null;
  const avgGradientPct = Number(route.avgGradientPct) || 0;
  const maxGradientText = Number.isFinite(Number(route.maxGradientPct)) ? `${Number(route.maxGradientPct).toFixed(1)}%` : "--";
  const hillinessText = route.hillinessPreset ? getGeneratedHillinessLabel(route.hillinessPreset) : null;
  const profileHtml = renderElevationProfile({
    routeProfile,
    distanceTraveledMeters: 0,
    width: 560,
    height: 110,
  });

  return `
    <div class="small">Distance: ${distanceKm.toFixed(1)} km | Total climb: ${elevationGainM} m${totalDescentM != null ? ` | Total descent: ${totalDescentM} m` : ""}</div>
    <div class="small" style="margin-top:2px;">Average gradient: ${avgGradientPct.toFixed(1)}% | Max gradient: ${maxGradientText}</div>
    ${hillinessText ? `<div class="small" style="margin-top:2px;">Hilliness: ${hillinessText}</div>` : ""}
    <div style="margin-top:8px;">${profileHtml}</div>
  `;
}

function getElevationAtDistance(route, distanceM) {
  const points = route?.elevationProfile;
  if (!Array.isArray(points) || points.length === 0) return 0;
  const sorted = points.slice().sort((a, b) => a.distanceFromStartM - b.distanceFromStartM);
  const totalDistance = Math.max(sorted[sorted.length - 1].distanceFromStartM, 1);
  const target = clamp(Number(distanceM) || 0, 0, totalDistance);
  for (let i = 1; i < sorted.length; i += 1) {
    const p1 = sorted[i - 1];
    const p2 = sorted[i];
    if (target <= p2.distanceFromStartM) {
      const span = Math.max(p2.distanceFromStartM - p1.distanceFromStartM, 1e-6);
      const t = clamp((target - p1.distanceFromStartM) / span, 0, 1);
      return lerp(Number(p1.elevationM) || 0, Number(p2.elevationM) || 0, t);
    }
  }
  return Number(sorted[sorted.length - 1].elevationM) || 0;
}

function getGradientAtDistance(route, distanceM) {
  const points = route?.elevationProfile;
  if (!Array.isArray(points) || points.length === 0) return 0;
  const sorted = points.slice().sort((a, b) => a.distanceFromStartM - b.distanceFromStartM);
  const totalDistance = Math.max(sorted[sorted.length - 1].distanceFromStartM, 1);
  const target = clamp(Number(distanceM) || 0, 0, totalDistance);
  for (let i = 1; i < sorted.length; i += 1) {
    if (target <= sorted[i].distanceFromStartM) {
      return Number(sorted[i - 1].gradientPct) || 0;
    }
  }
  return Number(sorted[sorted.length - 1].gradientPct) || 0;
}

function getRemainingDistance(route, distanceM) {
  const totalDistance = Number(route?.totalDistanceMeters) || Math.round((Number(route?.distanceKm) || 0) * 1000);
  return Math.max(0, totalDistance - (Number(distanceM) || 0));
}

function getRemainingClimb(route, distanceM) {
  const summitElevation = Number(route?.summitElevationM);
  const currentElevation = getElevationAtDistance(route, distanceM);
  if (!Number.isFinite(summitElevation)) return 0;
  return Math.max(0, summitElevation - currentElevation);
}

function getCourseSegments(session) {
  const segments = session?.course?.segments;
  return Array.isArray(segments) && segments.length > 0 ? segments : DEFAULT_COURSE_SEGMENTS;
}

function getCourseLengthMeters(segments) {
  const resolved = Array.isArray(segments) && segments.length > 0 ? segments : DEFAULT_COURSE_SEGMENTS;
  return resolved[resolved.length - 1]?.endDistance || 0;
}

function normalizeCourseDistance(distanceMeters, segments) {
  const length = getCourseLengthMeters(segments);
  if (length <= 0) return 0;
  const raw = Number(distanceMeters) || 0;
  let normalized = raw % length;
  if (normalized < 0) normalized += length;
  return normalized;
}

function findSegmentByDistance(distanceMeters, segments) {
  const resolved = Array.isArray(segments) && segments.length > 0 ? segments : DEFAULT_COURSE_SEGMENTS;
  const distance = normalizeCourseDistance(distanceMeters, resolved);
  return (
    resolved.find((segment) => distance >= segment.startDistance && distance < segment.endDistance) ||
    resolved[resolved.length - 1] ||
    { startDistance: 0, endDistance: 1, grade: 0 }
  );
}

function getCourseGradeContext(distanceMeters, segments) {
  const resolved = Array.isArray(segments) && segments.length > 0 ? segments : DEFAULT_COURSE_SEGMENTS;
  const routeDistance = normalizeCourseDistance(distanceMeters, resolved);
  const currentSegment = findSegmentByDistance(routeDistance, resolved);
  const currentGrade = Number(currentSegment.grade) || 0;

  let nextSegment = null;
  let distanceToNext = null;
  const currentIndex = Math.max(
    0,
    resolved.findIndex((segment) => segment === currentSegment),
  );

  if (resolved.length > 1) {
    const wrappedNextIndex = (currentIndex + 1) % resolved.length;
    nextSegment = resolved[wrappedNextIndex];
    const rawDistance =
      nextSegment.startDistance >= routeDistance
        ? nextSegment.startDistance - routeDistance
        : getCourseLengthMeters(resolved) - routeDistance + nextSegment.startDistance;
    distanceToNext = Math.max(0, rawDistance);
  }

  return {
    routeDistance,
    currentSegment,
    currentGrade,
    nextSegment,
    nextGrade: Number(nextSegment?.grade) || currentGrade,
    distanceToNext,
    routeLength: getCourseLengthMeters(resolved),
  };
}

function buildRouteProfileFromSegments(segmentsInput) {
  const segments = Array.isArray(segmentsInput) ? [...segmentsInput] : [];
  if (segments.length === 0) {
    return { totalDistanceMeters: 0, points: [] };
  }

  const sorted = segments
    .map((segment) => ({
      startDistance: Number(segment.startDistance) || 0,
      endDistance: Number(segment.endDistance) || 0,
      grade: Number(segment.grade) || 0,
    }))
    .sort((a, b) => a.startDistance - b.startDistance);

  const points = [];
  let elevationMeters = 0;
  let lastEndDistance = 0;

  sorted.forEach((segment, index) => {
    const startDistance = Math.max(0, segment.startDistance);
    const endDistance = Math.max(startDistance, segment.endDistance);
    const segmentDistance = Math.max(0, endDistance - startDistance);

    if (index === 0 || startDistance !== lastEndDistance) {
      points.push({
        distanceMeters: startDistance,
        elevationMeters,
        gradientPercent: segment.grade,
      });
    }

    elevationMeters += segmentDistance * (segment.grade / 100);
    points.push({
      distanceMeters: endDistance,
      elevationMeters,
      gradientPercent: segment.grade,
    });
    lastEndDistance = endDistance;
  });

  return {
    totalDistanceMeters: Math.max(0, lastEndDistance),
    points: downsampleRoutePoints(points, 1000),
  };
}

function downsampleRoutePoints(points, maxPoints = 1000) {
  if (!Array.isArray(points) || points.length <= maxPoints) return Array.isArray(points) ? points : [];
  const sampled = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round(i * step);
    sampled.push(points[idx]);
  }
  return sampled;
}

function getElevationBounds(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { minElevationMeters: 0, maxElevationMeters: 0 };
  }
  let minElevationMeters = Number(points[0].elevationMeters) || 0;
  let maxElevationMeters = minElevationMeters;
  points.forEach((point) => {
    const elevation = Number(point.elevationMeters) || 0;
    minElevationMeters = Math.min(minElevationMeters, elevation);
    maxElevationMeters = Math.max(maxElevationMeters, elevation);
  });
  return { minElevationMeters, maxElevationMeters };
}

// Route profile rendering scales:
// - keep vertical exaggeration bounded and tunable
// - do not auto-fit every route peak to the top of the chart
const PROFILE_CHART_PADDING_PX = 4;
const PROFILE_MIN_VERTICAL_EXAGGERATION = 1.6;
const PROFILE_MAX_VERTICAL_EXAGGERATION = 12;
const PROFILE_MIN_VISUAL_RANGE_PX = 4;
const PROFILE_MAX_VISUAL_FILL_RATIO = 0.88;

function sanitizeRoutePoints(pointsInput) {
  const points = Array.isArray(pointsInput) ? [...pointsInput] : [];
  return points
    .map((point) => ({
      distanceMeters: Number(point.distanceMeters) || 0,
      elevationMeters: Number(point.elevationMeters) || 0,
      gradientPercent: Number(point.gradientPercent) || 0,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function getRouteDifficultyMetrics(pointsInput) {
  const sorted = sanitizeRoutePoints(pointsInput);
  if (sorted.length === 0) {
    return {
      totalDistanceMeters: 0,
      minElevationMeters: 0,
      maxElevationMeters: 0,
      elevationRangeMeters: 0,
      totalAscentM: 0,
      totalDescentM: 0,
      ascentPerKm: 0,
      maxPositiveGradePct: 0,
      maxAbsGradePct: 0,
      avgPositiveGradePct: 0,
      sustainedClimbMeters: 0,
      longestSustainedClimbMeters: 0,
      steepClimbShare: 0,
      sustainedClimbShare: 0,
      difficultyScore: 0,
    };
  }

  const totalDistanceMeters = Math.max(sorted[sorted.length - 1].distanceMeters, 0);
  const { minElevationMeters, maxElevationMeters } = getElevationBounds(sorted);
  let totalAscentM = 0;
  let totalDescentM = 0;
  let maxPositiveGradePct = 0;
  let maxAbsGradePct = 0;
  let weightedPositiveGrade = 0;
  let positiveDistanceMeters = 0;
  let sustainedClimbMeters = 0;
  let longestSustainedClimbMeters = 0;
  let steepClimbMeters = 0;
  let currentSustainedMeters = 0;

  for (let i = 1; i < sorted.length; i += 1) {
    const p1 = sorted[i - 1];
    const p2 = sorted[i];
    const segmentDistance = Math.max(0, p2.distanceMeters - p1.distanceMeters);
    if (segmentDistance <= 0) continue;

    const elevationDelta = p2.elevationMeters - p1.elevationMeters;
    if (elevationDelta > 0) totalAscentM += elevationDelta;
    if (elevationDelta < 0) totalDescentM += -elevationDelta;

    const gradePct = (elevationDelta / segmentDistance) * 100;
    maxAbsGradePct = Math.max(maxAbsGradePct, Math.abs(gradePct));

    if (gradePct > 0) {
      maxPositiveGradePct = Math.max(maxPositiveGradePct, gradePct);
      weightedPositiveGrade += gradePct * segmentDistance;
      positiveDistanceMeters += segmentDistance;
    }

    if (gradePct >= 4) {
      sustainedClimbMeters += segmentDistance;
      currentSustainedMeters += segmentDistance;
      longestSustainedClimbMeters = Math.max(longestSustainedClimbMeters, currentSustainedMeters);
    } else {
      currentSustainedMeters = 0;
    }

    if (gradePct >= 6) {
      steepClimbMeters += segmentDistance;
    }
  }

  const distanceKm = totalDistanceMeters > 0 ? totalDistanceMeters / 1000 : 0;
  const ascentPerKm = distanceKm > 0 ? totalAscentM / distanceKm : 0;
  const avgPositiveGradePct = positiveDistanceMeters > 0 ? weightedPositiveGrade / positiveDistanceMeters : 0;
  const elevationRangeMeters = Math.max(0, maxElevationMeters - minElevationMeters);
  const rangeDensityPct = totalDistanceMeters > 0 ? (elevationRangeMeters / totalDistanceMeters) * 100 : 0;
  const sustainedClimbShare = totalDistanceMeters > 0 ? sustainedClimbMeters / totalDistanceMeters : 0;
  const steepClimbShare = totalDistanceMeters > 0 ? steepClimbMeters / totalDistanceMeters : 0;
  const shortSteepBoost = totalDistanceMeters <= 16000 ? steepClimbShare * 0.12 : 0;
  const difficultyScore = clamp(
    clamp(ascentPerKm / 90, 0, 1) * 0.3 +
      clamp(maxPositiveGradePct / 10, 0, 1) * 0.22 +
      clamp(avgPositiveGradePct / 8, 0, 1) * 0.18 +
      clamp(rangeDensityPct / 8, 0, 1) * 0.14 +
      clamp(longestSustainedClimbMeters / 3000, 0, 1) * 0.1 +
      clamp(steepClimbShare / 0.35, 0, 1) * 0.06 +
      shortSteepBoost,
    0,
    1,
  );

  return {
    totalDistanceMeters,
    minElevationMeters,
    maxElevationMeters,
    elevationRangeMeters,
    totalAscentM,
    totalDescentM,
    ascentPerKm,
    maxPositiveGradePct,
    maxAbsGradePct,
    avgPositiveGradePct,
    sustainedClimbMeters,
    longestSustainedClimbMeters,
    steepClimbShare,
    sustainedClimbShare,
    difficultyScore,
  };
}

function getVerticalExaggerationFactor(metrics) {
  const difficulty = clamp(Number(metrics?.difficultyScore) || 0, 0, 1);
  const easedDifficulty = Math.pow(difficulty, 0.82);
  return lerp(PROFILE_MIN_VERTICAL_EXAGGERATION, PROFILE_MAX_VERTICAL_EXAGGERATION, easedDifficulty);
}

function getRouteProfileScalingConfig(pointsInput, width, height) {
  const sorted = sanitizeRoutePoints(pointsInput);
  if (sorted.length === 0) return null;

  const chartWidth = Math.max(1, Number(width) || 1);
  const chartHeight = Math.max(1, Number(height) || 1);
  const topPadding = PROFILE_CHART_PADDING_PX;
  const bottomPadding = PROFILE_CHART_PADDING_PX;
  const innerHeight = Math.max(1, chartHeight - topPadding - bottomPadding);
  const metrics = getRouteDifficultyMetrics(sorted);
  const totalDistanceMeters = Math.max(metrics.totalDistanceMeters, 1);
  const elevationRangeMeters = Math.max(metrics.elevationRangeMeters, 0);
  const centerElevation = (metrics.minElevationMeters + metrics.maxElevationMeters) / 2;
  const centerY = topPadding + innerHeight / 2;

  // Base scale keeps 1m vertical equal to 1m horizontal in chart units.
  // Exaggeration then boosts visibility while preserving route-to-route differences.
  const baseVerticalPxPerMeter = chartWidth / totalDistanceMeters;
  const minVerticalPxPerMeter = baseVerticalPxPerMeter * PROFILE_MIN_VERTICAL_EXAGGERATION;
  const maxVerticalPxPerMeter = baseVerticalPxPerMeter * PROFILE_MAX_VERTICAL_EXAGGERATION;
  let verticalPxPerMeter = clamp(
    baseVerticalPxPerMeter * getVerticalExaggerationFactor(metrics),
    minVerticalPxPerMeter,
    maxVerticalPxPerMeter,
  );

  if (elevationRangeMeters > 0) {
    const minVisualRangePx = PROFILE_MIN_VISUAL_RANGE_PX + metrics.difficultyScore * 2;
    const maxVisualRangePx = innerHeight * PROFILE_MAX_VISUAL_FILL_RATIO;
    let currentRangePx = elevationRangeMeters * verticalPxPerMeter;

    if (currentRangePx < minVisualRangePx) {
      verticalPxPerMeter = Math.min(maxVerticalPxPerMeter, minVisualRangePx / elevationRangeMeters);
      currentRangePx = elevationRangeMeters * verticalPxPerMeter;
    }
    if (currentRangePx > maxVisualRangePx) {
      verticalPxPerMeter = Math.max(minVerticalPxPerMeter, maxVisualRangePx / elevationRangeMeters);
    }
  }

  verticalPxPerMeter = clamp(verticalPxPerMeter, minVerticalPxPerMeter, maxVerticalPxPerMeter);

  return {
    chartWidth,
    chartHeight,
    topPadding,
    bottomPadding,
    minY: topPadding,
    maxY: chartHeight - bottomPadding,
    totalDistanceMeters,
    centerElevation,
    centerY,
    verticalPxPerMeter,
    baseVerticalPxPerMeter,
    visualExaggeration: verticalPxPerMeter / Math.max(baseVerticalPxPerMeter, 1e-9),
    metrics,
  };
}

function mapElevationToChartY(elevationMeters, scalingConfig) {
  if (!scalingConfig) return 0;
  const rawY =
    Number(scalingConfig.centerY) -
    (Number(elevationMeters) - Number(scalingConfig.centerElevation)) * Number(scalingConfig.verticalPxPerMeter);
  return clamp(rawY, Number(scalingConfig.minY), Number(scalingConfig.maxY));
}

function normalizeRoutePoints(pointsInput, width, height) {
  const sorted = sanitizeRoutePoints(pointsInput);
  if (sorted.length === 0) return [];
  const scalingConfig = getRouteProfileScalingConfig(sorted, width, height);
  if (!scalingConfig) return [];

  return sorted.map((point) => {
    const x = (point.distanceMeters / Math.max(scalingConfig.totalDistanceMeters, 1)) * scalingConfig.chartWidth;
    const y = mapElevationToChartY(point.elevationMeters, scalingConfig);
    return {
      ...point,
      x,
      y,
    };
  });
}

function getPlayerPosition(pointsInput, distanceTraveledMeters, width, height) {
  const normalized = normalizeRoutePoints(pointsInput, width, height);
  if (normalized.length === 0) return { x: 0, y: height };
  if (normalized.length === 1) return { x: normalized[0].x, y: normalized[0].y };

  const totalDistanceMeters = Math.max(normalized[normalized.length - 1].distanceMeters, 1);
  const clampedDistance = clamp(Number(distanceTraveledMeters) || 0, 0, totalDistanceMeters);

  for (let i = 1; i < normalized.length; i += 1) {
    const p1 = normalized[i - 1];
    const p2 = normalized[i];
    if (clampedDistance <= p2.distanceMeters) {
      const segmentDistance = Math.max(p2.distanceMeters - p1.distanceMeters, 1e-6);
      const t = clamp((clampedDistance - p1.distanceMeters) / segmentDistance, 0, 1);
      return {
        x: lerp(p1.x, p2.x, t),
        y: lerp(p1.y, p2.y, t),
      };
    }
  }

  const last = normalized[normalized.length - 1];
  return { x: last.x, y: last.y };
}

function getCompletedPath(pointsInput, distanceTraveledMeters, width, height) {
  const normalized = normalizeRoutePoints(pointsInput, width, height);
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return normalized;

  const totalDistanceMeters = Math.max(normalized[normalized.length - 1].distanceMeters, 1);
  const clampedDistance = clamp(Number(distanceTraveledMeters) || 0, 0, totalDistanceMeters);

  const completed = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const point = normalized[i];
    if (point.distanceMeters < clampedDistance) {
      completed.push(point);
      continue;
    }
    if (point.distanceMeters === clampedDistance) {
      completed.push(point);
      return completed;
    }
    if (i === 0) {
      completed.push(point);
      return completed;
    }
    const previous = normalized[i - 1];
    const segmentDistance = Math.max(point.distanceMeters - previous.distanceMeters, 1e-6);
    const t = clamp((clampedDistance - previous.distanceMeters) / segmentDistance, 0, 1);
    completed.push({
      distanceMeters: clampedDistance,
      elevationMeters: lerp(previous.elevationMeters, point.elevationMeters, t),
      gradientPercent: previous.gradientPercent,
      x: lerp(previous.x, point.x, t),
      y: lerp(previous.y, point.y, t),
    });
    return completed;
  }

  return normalized;
}

function buildLinePath(points) {
  if (!Array.isArray(points) || points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function buildAreaPath(points, baselineY) {
  if (!Array.isArray(points) || points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${buildLinePath(points)} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function renderElevationProfile({ routeProfile, distanceTraveledMeters, width = 560, height = 120 }) {
  const profile = routeProfile && typeof routeProfile === "object" ? routeProfile : { totalDistanceMeters: 0, points: [] };
  const points = Array.isArray(profile.points) ? profile.points : [];
  if (points.length === 0) {
    return `<div class="small elevation-profile-empty">Route profile unavailable.</div>`;
  }

  const normalized = normalizeRoutePoints(points, width, height);
  const completed = getCompletedPath(points, distanceTraveledMeters, width, height);
  const player = getPlayerPosition(points, distanceTraveledMeters, width, height);
  const baselineY = height - 2;

  const fullLinePath = buildLinePath(normalized);
  const completedLinePath = buildLinePath(completed);
  const fullAreaPath = buildAreaPath(normalized, baselineY);
  const completedAreaPath = buildAreaPath(completed, baselineY);
  const progressRatio = clamp((Number(distanceTraveledMeters) || 0) / Math.max(profile.totalDistanceMeters || 0, 1), 0, 1);
  const progressPct = Math.round(progressRatio * 100);

  return `
    <div class="elevation-profile">
      <svg viewBox="0 0 ${width} ${height}" aria-label="Route elevation profile">
        <path d="${fullAreaPath}" fill="rgba(255, 255, 255, 0.08)" stroke="none"></path>
        <path d="${completedAreaPath}" fill="rgba(255, 255, 255, 0.24)" stroke="none"></path>
        <path d="${fullLinePath}" fill="none" stroke="rgba(255, 255, 255, 0.38)" stroke-width="2"></path>
        <path d="${completedLinePath}" fill="none" stroke="#f5f6ff" stroke-width="2.5"></path>
        <circle cx="${player.x.toFixed(2)}" cy="${player.y.toFixed(2)}" r="4" fill="#ffffff"></circle>
      </svg>
      <div class="elevation-profile-labels">
        <span>START</span>
        <span>${progressPct}%</span>
        <span>FINISH</span>
      </div>
    </div>
  `;
}

function hashStringForColor(value) {
  const input = String(value || "");
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getSideScrollRiderAccentColor(riderId, isLocal = false) {
  if (isLocal) return "#f5f6ff";
  const index = hashStringForColor(riderId) % SIDE_SCROLL_RIDER_ACCENTS.length;
  return SIDE_SCROLL_RIDER_ACCENTS[index];
}

function mapRouteDistanceToScreenX(relativeDistanceMeters, visibleDistanceWindowMeters, width, horizontalPadding = 24) {
  const halfWindow = Math.max(1, Number(visibleDistanceWindowMeters) / 2);
  const clampedDistance = clamp(Number(relativeDistanceMeters) || 0, -halfWindow, halfWindow);
  const safeWidth = Math.max(2, Number(width) || 2);
  const usableWidth = Math.max(1, safeWidth - horizontalPadding * 2);
  const ratio = (clampedDistance + halfWindow) / (halfWindow * 2);
  return horizontalPadding + ratio * usableWidth;
}

function mapElevationToSideScrollY(elevationMeters, scaling) {
  if (!scaling) return 0;
  const centeredOffset = (Number(elevationMeters) - Number(scaling.centerElevation)) * Number(scaling.pxPerMeter);
  const y = Number(scaling.centerY) - centeredOffset;
  return clamp(y, Number(scaling.minY), Number(scaling.maxY));
}

function sampleTerrainInVisibleWindow({
  centerDistanceMeters,
  visibleDistanceWindowMeters,
  courseSegments,
  startElevationMeters = 0,
  width = SIDE_SCROLL_SVG_WIDTH,
  height = SIDE_SCROLL_SVG_HEIGHT,
  horizontalPadding = 24,
  sampleCount = SIDE_SCROLL_TERRAIN_SAMPLE_COUNT,
}) {
  const segments = Array.isArray(courseSegments) && courseSegments.length > 0 ? courseSegments : DEFAULT_COURSE_SEGMENTS;
  const halfWindow = Math.max(1, Number(visibleDistanceWindowMeters) / 2);
  const sampleTotal = Math.max(10, Math.round(Number(sampleCount) || SIDE_SCROLL_TERRAIN_SAMPLE_COUNT));
  const routeLength = Math.max(1, getCourseLengthMeters(segments));
  const terrainTopY = Math.round(height * SIDE_SCROLL_TERRAIN_TOP_RATIO);
  const terrainBottomY = Math.max(terrainTopY + 24, height - SIDE_SCROLL_TERRAIN_BOTTOM_MARGIN_PX);
  const terrainHeight = Math.max(1, terrainBottomY - terrainTopY);

  const rawPoints = [];
  for (let index = 0; index < sampleTotal; index += 1) {
    const ratio = sampleTotal <= 1 ? 0 : index / (sampleTotal - 1);
    const relativeDistance = lerp(-halfWindow, halfWindow, ratio);
    const routeDistance = normalizeCourseDistance((Number(centerDistanceMeters) || 0) + relativeDistance, segments);
    const x = mapRouteDistanceToScreenX(relativeDistance, halfWindow * 2, width, horizontalPadding);
    const elevation = getElevationAtDistanceFromSegments(segments, startElevationMeters, routeDistance);
    rawPoints.push({
      x,
      routeDistance,
      relativeDistance,
      elevation,
    });
  }

  let minElevation = Number(rawPoints[0]?.elevation) || 0;
  let maxElevation = minElevation;
  rawPoints.forEach((point) => {
    minElevation = Math.min(minElevation, point.elevation);
    maxElevation = Math.max(maxElevation, point.elevation);
  });

  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const centerElevation = (minElevation + maxElevation) / 2;
  const centerY = terrainTopY + terrainHeight / 2;
  const basePxPerMeter = terrainHeight / elevationRange;
  // Clamp exaggeration so rolling terrain is readable without becoming cartoonishly steep.
  const pxPerMeter = clamp(basePxPerMeter * 1.18, 1.2, 8);
  const scaling = {
    centerElevation,
    centerY,
    minY: terrainTopY + 2,
    maxY: terrainBottomY - 2,
    pxPerMeter,
  };

  const points = rawPoints.map((point) => ({
    ...point,
    y: mapElevationToSideScrollY(point.elevation, scaling),
  }));

  return {
    points,
    terrainTopY,
    terrainBottomY,
    scaling,
    routeLength,
  };
}

function buildTerrainPaths(points, baselineY) {
  if (!Array.isArray(points) || points.length < 2) {
    return { linePath: "", fillPath: "" };
  }
  const linePath = buildSmoothCurvePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const fillPath = `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  return { linePath, fillPath };
}

function smoothTerrainPoints(pointsInput, passes = 2) {
  const source = Array.isArray(pointsInput) ? pointsInput : [];
  if (source.length < 3) return source;

  let points = source.map((point) => ({ ...point }));
  const totalPasses = clamp(Math.round(Number(passes) || 0), 0, 4);
  for (let pass = 0; pass < totalPasses; pass += 1) {
    const previousPass = points;
    points = previousPass.map((point, index) => {
      if (index === 0 || index === previousPass.length - 1) {
        return { ...point };
      }
      const prev = previousPass[index - 1];
      const next = previousPass[index + 1];
      return {
        ...point,
        y: prev.y * 0.2 + point.y * 0.6 + next.y * 0.2,
      };
    });
  }
  return points;
}

function buildSmoothCurvePath(pointsInput) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = current.x;
    const controlY = current.y;
    const endX = (current.x + next.x) / 2;
    const endY = (current.y + next.y) / 2;
    path += ` Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return path;
}

function getTerrainPointAtX(pointsInput, xInput) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  if (points.length === 0) return { y: 0, slopeDeg: 0 };
  if (points.length === 1) return { y: points[0].y, slopeDeg: 0 };
  const x = Number(xInput) || 0;
  for (let index = 1; index < points.length; index += 1) {
    const p1 = points[index - 1];
    const p2 = points[index];
    if (x <= p2.x) {
      const span = Math.max(1e-6, p2.x - p1.x);
      const t = clamp((x - p1.x) / span, 0, 1);
      const y = lerp(p1.y, p2.y, t);
      const slopeDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
      return { y, slopeDeg };
    }
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const slopeDeg = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
  return { y: last.y, slopeDeg };
}

function filterVisibleRiders({ participants, localPlayer, visibleDistanceWindowMeters }) {
  const riders = Array.isArray(participants) ? participants : [];
  const localDistance = Number(localPlayer?.distanceTraveled) || 0;
  const halfWindow = Math.max(1, Number(visibleDistanceWindowMeters) / 2);

  return riders
    .map((rider) => {
      const riderDistance = Number(rider?.distanceTraveled) || 0;
      const relativeDistance = riderDistance - localDistance;
      const clampedRelativeDistance = clamp(relativeDistance, -halfWindow, halfWindow);
      const beyondVisibleWindow = Math.max(0, Math.abs(relativeDistance) - halfWindow);
      const edgeFade = rider.isLocal ? 1 : 1 - clamp(beyondVisibleWindow / halfWindow, 0, 0.65);
      return {
        ...rider,
        relativeDistance,
        clampedRelativeDistance,
        edgeFade,
      };
    })
    .sort((a, b) => {
      if (a.isLocal && !b.isLocal) return 1;
      if (!a.isLocal && b.isLocal) return -1;
      return a.distanceTraveled - b.distanceTraveled;
    });
}

function getPredictedTelemetryDistanceMeters(telemetryInput, nowMs = currentMs()) {
  const telemetry = telemetryInput && typeof telemetryInput === "object" ? telemetryInput : {};
  const baseDistance = Math.max(0, Number(telemetry.distance) || 0);
  const speedMps = Number(telemetry.speedMps);
  if (!Number.isFinite(speedMps) || speedMps <= 0) return baseDistance;
  const updatedAt = Number(telemetry.updatedAt) || Number(telemetry.timestamp) || nowMs;
  const lookaheadMs = clamp(Math.max(0, nowMs - updatedAt), 0, SIDE_SCROLL_MAX_EXTRAPOLATION_MS);
  return baseDistance + speedMps * (lookaheadMs / 1000);
}

function buildSessionSideScrollViewHtml(session, user, { predictMotion = true, nowMs = currentMs() } = {}) {
  if (!session || !user) {
    return `<div class="small elevation-profile-empty">Waiting for session data.</div>`;
  }

  const telemetry = session.telemetry || {};
  const courseSegments = getCourseSegments(session);
  const sessionRoute = getSessionRoute(session);
  const riders = Object.values(session.users || {})
    .map((participant) => {
      const telemetryEntry = telemetry[participant.id] || {};
      const measuredDistance = Number(telemetryEntry.distance) || 0;
      const distanceTraveled = predictMotion
        ? getPredictedTelemetryDistanceMeters(telemetryEntry, nowMs)
        : measuredDistance;
      const isLocal = participant.id === user.id;
      return {
        id: participant.id,
        name: participant.name || "Rider",
        distanceTraveled,
        isLocal,
        accentColor: getSideScrollRiderAccentColor(participant.id, isLocal),
      };
    })
    .sort((a, b) => b.distanceTraveled - a.distanceTraveled);

  if (riders.length === 0) {
    return `<div class="small elevation-profile-empty">Waiting for participant positions.</div>`;
  }

  const localRider = riders.find((rider) => rider.id === user.id) || riders[0];
  const localRouteDistanceMeters = normalizeCourseDistance(localRider.distanceTraveled, courseSegments);

  return SideScrollRaceView({
    localPlayer: {
      id: user.id,
      name: user.name || localRider.name || "You",
      distanceTraveled: localRider.distanceTraveled,
      isLocal: true,
      accentColor: getSideScrollRiderAccentColor(user.id, true),
    },
    participants: riders,
    localRouteDistanceMeters,
    courseSegments,
    startElevationMeters: Number(sessionRoute.startElevationM) || 0,
    visibleDistanceWindowMeters: SIDE_SCROLL_VISIBLE_WINDOW_METERS,
    width: SIDE_SCROLL_SVG_WIDTH,
    height: SIDE_SCROLL_SVG_HEIGHT,
  });
}

function updateSessionSideScrollMount({ predictMotion = true, nowMs = currentMs() } = {}) {
  if (state.view !== "session") return false;
  const mount = document.getElementById("sessionSideScrollMount");
  if (!mount) return false;
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user) return false;
  mount.innerHTML = buildSessionSideScrollViewHtml(session, user, { predictMotion, nowMs });
  return true;
}

function TerrainProfileRenderer({ terrainPoints, width, height, centerX }) {
  if (!Array.isArray(terrainPoints) || terrainPoints.length < 2) return "";
  const baselineY = Math.max(0, Number(height) - 4);
  const { linePath, fillPath } = buildTerrainPaths(terrainPoints, baselineY);
  const first = terrainPoints[0];
  const last = terrainPoints[terrainPoints.length - 1];
  return `
    <g class="sidescroll-terrain-layer">
      <path class="sidescroll-terrain-fill" d="${fillPath}"></path>
      <path class="sidescroll-terrain-line" d="${linePath}"></path>
      <line class="sidescroll-center-line" x1="${centerX.toFixed(2)}" y1="0" x2="${centerX.toFixed(2)}" y2="${height.toFixed(2)}"></line>
      <line class="sidescroll-edge-line" x1="${first.x.toFixed(2)}" y1="0" x2="${first.x.toFixed(2)}" y2="${height.toFixed(2)}"></line>
      <line class="sidescroll-edge-line" x1="${last.x.toFixed(2)}" y1="0" x2="${last.x.toFixed(2)}" y2="${height.toFixed(2)}"></line>
    </g>
  `;
}

function RiderVisual({ rider, x, y, slopeDeg }) {
  const safeName = escapeHtml(rider?.name || "Rider");
  const isLocal = !!rider?.isLocal;
  const accent = rider?.accentColor || getSideScrollRiderAccentColor(rider?.id, isLocal);
  const opacity = clamp(Number(rider?.edgeFade) || 1, 0.35, 1);
  const tilt = clamp(Number(slopeDeg) || 0, -10, 10);

  return `
    <g class="sidescroll-rider ${isLocal ? "is-local" : ""}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})" style="opacity:${opacity.toFixed(2)};">
      <g class="sidescroll-rider-bob">
        ${
          isLocal
            ? '<circle class="sidescroll-local-halo" cx="0" cy="-8" r="18"></circle>'
            : ""
        }
        <g class="sidescroll-bike" transform="rotate(${tilt.toFixed(2)} 0 -6)">
          <circle class="sidescroll-wheel sidescroll-wheel-spin" cx="-12" cy="-6" r="6"></circle>
          <circle class="sidescroll-wheel sidescroll-wheel-spin" cx="12" cy="-6" r="6"></circle>
          <line class="sidescroll-frame" x1="-12" y1="-6" x2="12" y2="-6" stroke="${accent}"></line>
          <line class="sidescroll-frame" x1="-12" y1="-6" x2="-1" y2="-17" stroke="${accent}"></line>
          <line class="sidescroll-frame" x1="-1" y1="-17" x2="12" y2="-6" stroke="${accent}"></line>
          <line class="sidescroll-frame" x1="-1" y1="-17" x2="-4" y2="-21" stroke="${accent}"></line>
          <line class="sidescroll-frame" x1="-1" y1="-17" x2="3" y2="-23" stroke="${accent}"></line>
          <line class="sidescroll-frame" x1="3" y1="-23" x2="8" y2="-16" stroke="${accent}"></line>
          <circle cx="3" cy="-26" r="4.5" fill="${accent}"></circle>
        </g>
        <text class="sidescroll-rider-name ${isLocal ? "is-local" : ""}" x="0" y="-40" text-anchor="middle">${safeName}</text>
      </g>
    </g>
  `;
}

function SideScrollRaceView({
  localPlayer,
  participants,
  localRouteDistanceMeters,
  courseSegments,
  startElevationMeters = 0,
  visibleDistanceWindowMeters = SIDE_SCROLL_VISIBLE_WINDOW_METERS,
  width = SIDE_SCROLL_SVG_WIDTH,
  height = SIDE_SCROLL_SVG_HEIGHT,
}) {
  const safeLocalPlayer = localPlayer && typeof localPlayer === "object" ? localPlayer : null;
  const safeParticipants = Array.isArray(participants) ? participants : [];
  if (!safeLocalPlayer || safeParticipants.length === 0) {
    return `<div class="small elevation-profile-empty">Waiting for participant positions.</div>`;
  }

  const windowMeters = Math.max(20, Number(visibleDistanceWindowMeters) || SIDE_SCROLL_VISIBLE_WINDOW_METERS);
  const halfWindow = windowMeters / 2;
  const centerX = width / 2;
  const terrain = sampleTerrainInVisibleWindow({
    centerDistanceMeters: localRouteDistanceMeters,
    visibleDistanceWindowMeters: windowMeters,
    courseSegments,
    startElevationMeters,
    width,
    height,
  });
  const smoothedTerrainPoints = smoothTerrainPoints(terrain.points, 2);
  const terrainLayerSvg = TerrainProfileRenderer({
    terrainPoints: smoothedTerrainPoints,
    width,
    height,
    centerX,
  });
  const riders = filterVisibleRiders({
    participants: safeParticipants,
    localPlayer: safeLocalPlayer,
    visibleDistanceWindowMeters: windowMeters,
  });

  const ridersSvg = riders
    .map((rider) => {
      const x = mapRouteDistanceToScreenX(rider.clampedRelativeDistance, windowMeters, width);
      const terrainPoint = getTerrainPointAtX(smoothedTerrainPoints, x);
      return RiderVisual({
        rider,
        x,
        y: terrainPoint.y,
        slopeDeg: terrainPoint.slopeDeg,
      });
    })
    .join("");

  // This prototype renderer is intentionally self-contained so final art/camera can replace it later.
  return `
    <div class="sidescroll-view">
      <svg viewBox="0 0 ${width} ${height}" aria-label="Side-scrolling race view">
        <rect class="sidescroll-sky" x="0" y="0" width="${width}" height="${height}"></rect>
        <rect
          class="sidescroll-horizon"
          x="0"
          y="${Math.round(height * SIDE_SCROLL_HORIZON_Y_RATIO)}"
          width="${width}"
          height="${Math.round(height * (1 - SIDE_SCROLL_HORIZON_Y_RATIO))}"
        ></rect>
        ${terrainLayerSvg}
        ${ridersSvg}
        <text class="sidescroll-center-label" x="${centerX.toFixed(2)}" y="18" text-anchor="middle">YOU</text>
      </svg>
      <div class="sidescroll-meta">
        <span>Window: ${Math.round(halfWindow)}m behind / ${Math.round(halfWindow)}m ahead</span>
        <span>Center rider stays fixed</span>
      </div>
    </div>
  `;
}

function lerp(fromValue, toValue, factor) {
  return fromValue + (toValue - fromValue) * factor;
}

function smoothToward(previousValue, nextValue, smoothingFactor, deltaSeconds = 1) {
  const factor = clamp(smoothingFactor, 0, 1);
  const dt = Math.max(0, Number(deltaSeconds) || 0);
  const frameAdjusted = 1 - Math.pow(1 - factor, dt);
  return lerp(previousValue, nextValue, frameAdjusted);
}

function resolveRiderMassKg(weightKg) {
  const numeric = Number(weightKg);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 78;
}

function computeTargetSpeedFromPowerAndGrade(powerWatts, gradePercent, riderMassKg, bikeIdInput = DEFAULT_BIKE_ID) {
  const power = Math.max(0, Number(powerWatts) || 0);
  const grade = Number(gradePercent) || 0;
  const riderMass = resolveRiderMassKg(riderMassKg);
  const bike = getBikeById(bikeIdInput);
  const totalMass = riderMass + (Number(bike.weightKg) || 0);

  // Basic MVP model:
  // - power drives base speed
  // - grade reduces/increases speed
  // - total system mass affects climbing (rider + bike)
  // - aero and bike role shift flat/downhill vs uphill behavior
  const baseSpeed = power <= 0 ? 0.8 : 1.6 + Math.pow(power, 0.43) * 0.85;
  const massFactor = clamp(82 / totalMass, 0.78, 1.24);
  const uphillFactor = clamp(1 - Math.max(0, grade) * (0.044 + ((totalMass - 82) / 1000) * 0.3), 0.2, 1);
  const downhillFactor = 1 + Math.max(0, -grade) * 0.018;
  const gradeFactor = grade >= 0 ? uphillFactor : downhillFactor;
  const uphillSeverity = clamp(Math.max(0, grade) / 9, 0, 1);
  const flatDownhillSeverity = clamp((Math.max(0, -grade) + 1.2) / 7.5, 0, 1);
  const climbBikeFactor = lerp(1, Number(bike.climbingModifier) || 1, uphillSeverity);
  const flatBikeFactor = lerp(1, Number(bike.flatModifier) || 1, flatDownhillSeverity);
  const aeroModifier = Number.isFinite(Number(bike.aeroModifier)) ? Number(bike.aeroModifier) : 1;
  const aeroBenefitFactor = clamp(1 / Math.max(aeroModifier, 0.7), 0.88, 1.16);
  const aeroFactor = lerp(1, aeroBenefitFactor, flatDownhillSeverity);
  const targetSpeed = baseSpeed * massFactor * gradeFactor * climbBikeFactor * flatBikeFactor * aeroFactor;

  return clamp(targetSpeed, 1.4, 22);
}

function getGradeColorClass(gradePercent) {
  const grade = Number(gradePercent) || 0;
  if (grade > 1) return "grade-uphill";
  if (grade < -1) return "grade-downhill";
  return "grade-flat";
}

function formatSignedPercent(value, decimals = 1) {
  const numeric = Number(value) || 0;
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(decimals)}%`;
}

function getResistanceFeelLabel(resistancePercent) {
  const pct = clamp(Number(resistancePercent) || 0, 0, 100);
  if (pct >= 70) return "Heavy";
  if (pct >= 35) return "Moderate";
  return "Light";
}

function getResistanceFeelClass(label) {
  if (label === "Heavy") return "resistance-heavy";
  if (label === "Moderate") return "resistance-moderate";
  return "resistance-light";
}

function mapGradeToResistancePercent(gradePercent) {
  const grade = Number(gradePercent) || 0;
  // 0% grade should still have some baseline feel.
  return clamp(20 + grade * 6, 0, 100);
}

async function writeBluetoothValue(characteristic, bytes) {
  const payload = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (typeof characteristic.writeValueWithResponse === "function") {
    await characteristic.writeValueWithResponse(payload);
    return;
  }
  await characteristic.writeValue(payload);
}

function encodeSint16LE(value) {
  const clamped = clamp(Math.round(value), -32768, 32767);
  const low = clamped & 0xff;
  const high = (clamped >> 8) & 0xff;
  return [low, high];
}

function buildFtmsSetResistanceCommand(resistancePercent) {
  const resistanceTenth = Math.round(clamp(resistancePercent, 0, 100) * 10);
  const [low, high] = encodeSint16LE(resistanceTenth);
  return Uint8Array.from([0x04, low, high]);
}

function buildFtmsSimulationCommand(gradePercent) {
  const windSpeedMs = 0;
  const gradeHundredths = Math.round((Number(gradePercent) || 0) * 100);
  const crrTenThousandths = 40; // 0.0040
  const cwHundredths = 51; // 0.51
  const windEncoded = encodeSint16LE(windSpeedMs * 1000);
  const gradeEncoded = encodeSint16LE(gradeHundredths);
  return Uint8Array.from([0x11, windEncoded[0], windEncoded[1], gradeEncoded[0], gradeEncoded[1], crrTenThousandths, cwHundredths]);
}

async function initializeTrainerControl(service) {
  try {
    const controlCharacteristic = await service.getCharacteristic("fitness_machine_control_point");
    await writeBluetoothValue(controlCharacteristic, Uint8Array.from([0x00])); // Request control.
    return {
      characteristic: controlCharacteristic,
      supported: true,
      granted: true,
      error: null,
    };
  } catch (error) {
    return {
      characteristic: null,
      supported: false,
      granted: false,
      error: error?.message || "Trainer control unavailable",
    };
  }
}

function getTrainerControlStatusText() {
  const trainer = state.devices.trainer;
  if (!trainer.connected) return "No trainer";
  if (!trainer.controlSupported) return "Trainer connected (read-only)";
  if (!trainer.controlGranted) return "Trainer control unavailable";
  if (trainer.lastControlError) return `Control issue: ${trainer.lastControlError}`;
  return "Simulation control active";
}

async function sendResistanceToTrainer(effectiveGrade) {
  const trainer = state.devices.trainer;
  if (!trainer.connected || !trainer.controlCharacteristic || !trainer.controlSupported || !trainer.controlGranted) {
    return false;
  }

  const resistancePercent = mapGradeToResistancePercent(effectiveGrade);
  const now = currentMs();
  const shouldSend =
    trainer.lastResistancePercent == null ||
    Math.abs(trainer.lastResistancePercent - resistancePercent) >= 2 ||
    now - (trainer.lastResistanceAt || 0) >= 4000;

  if (!shouldSend) return true;

  try {
    await writeBluetoothValue(trainer.controlCharacteristic, buildFtmsSetResistanceCommand(resistancePercent));
    trainer.lastResistancePercent = resistancePercent;
    trainer.lastResistanceAt = now;
    trainer.lastControlError = null;
    return true;
  } catch (setResistanceError) {
    try {
      await writeBluetoothValue(trainer.controlCharacteristic, buildFtmsSimulationCommand(effectiveGrade));
      trainer.lastResistancePercent = resistancePercent;
      trainer.lastResistanceAt = now;
      trainer.lastControlError = null;
      return true;
    } catch (simulationError) {
      trainer.lastControlError = simulationError?.message || setResistanceError?.message || "Resistance update failed";
      return false;
    }
  }
}

function updateTerrainState(terrainUpdate) {
  state.simulation.terrain = {
    ...state.simulation.terrain,
    ...terrainUpdate,
  };
}

// Placeholder thresholds for MVP color zones.
// Keep these centralized so we can replace with personalized zones later.
const HEART_RATE_ZONE_THRESHOLDS = Object.freeze({
  lowMax: 99,
  mediumMax: 150,
});

const WATTS_ZONE_THRESHOLDS = Object.freeze({
  lowMax: 99,
  mediumMax: 250,
});

function getZoneFromValue(value, thresholds) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  if (safeValue <= thresholds.lowMax) return "low";
  if (safeValue <= thresholds.mediumMax) return "medium";
  return "high";
}

function getHeartRateZone(heartRate, thresholds = HEART_RATE_ZONE_THRESHOLDS) {
  return getZoneFromValue(heartRate, thresholds);
}

function getWattsZone(watts, thresholds = WATTS_ZONE_THRESHOLDS) {
  return getZoneFromValue(watts, thresholds);
}

function getZoneColorClass(zone) {
  if (zone === "high") return "zone-high";
  if (zone === "medium") return "zone-medium";
  return "zone-low";
}

function getMockTelemetryParticipants() {
  return [
    { id: "mock_1", name: "Rider Alpha", heartRate: 92, watts: 85 },
    { id: "mock_2", name: "Rider Beta", heartRate: 132, watts: 180 },
    { id: "mock_3", name: "Rider Gamma", heartRate: 168, watts: 305 },
  ];
}

function renderTelemetryZoneRows(participants) {
  return participants
    .map((participant) => {
      const heartRate = Math.max(0, Math.round(Number(participant.heartRate) || 0));
      const watts = Math.max(0, Math.round(Number(participant.watts) || 0));
      const heartRateZone = getHeartRateZone(heartRate);
      const wattsZone = getWattsZone(watts);
      return `
        <div class="telemetry-zone-grid telemetry-zone-row">
          <div class="telemetry-zone-name">${escapeHtml(participant.name || "Rider")}</div>
          <div class="telemetry-zone-pill ${getZoneColorClass(heartRateZone)}">HR ${heartRate} bpm</div>
          <div class="telemetry-zone-pill ${getZoneColorClass(wattsZone)}">Power ${watts} W</div>
        </div>
      `;
    })
    .join("");
}

function createUser({ name, weight, bikeId = DEFAULT_BIKE_ID, isHost = false, id = null }) {
  return {
    id: id || `u_${makeId(8)}`,
    name: name?.trim() || "Rider",
    weight: weight ? Number(weight) : null,
    bikeId: normalizeBikeId(bikeId),
    isHost,
    joinedAt: currentMs(),
  };
}

function isWebBluetoothSupported() {
  return !!navigator.bluetooth;
}

function isWebRTCSupported() {
  return typeof RTCPeerConnection !== "undefined";
}

function parseHeartRateMeasurement(dataView) {
  const flags = dataView.getUint8(0);
  const hr16 = flags & 0x01;
  const offset = 1;
  const hr = hr16 ? dataView.getUint16(offset, true) : dataView.getUint8(offset);
  return { heartRate: hr };
}

function parseIndoorBikeData(dataView) {
  // Fitness Machine Service - Indoor Bike Data (0x2AD2).
  // Parse by flags so optional fields don't shift offsets and corrupt power.
  const FLAG_MORE_DATA = 1 << 0;
  const FLAG_AVERAGE_SPEED_PRESENT = 1 << 1;
  const FLAG_INSTANT_CADENCE_PRESENT = 1 << 2;
  const FLAG_AVERAGE_CADENCE_PRESENT = 1 << 3;
  const FLAG_TOTAL_DISTANCE_PRESENT = 1 << 4;
  const FLAG_RESISTANCE_LEVEL_PRESENT = 1 << 5;
  const FLAG_INSTANT_POWER_PRESENT = 1 << 6;
  const FLAG_AVERAGE_POWER_PRESENT = 1 << 7;
  const FLAG_EXPENDED_ENERGY_PRESENT = 1 << 8;
  const FLAG_HEART_RATE_PRESENT = 1 << 9;
  const FLAG_METABOLIC_EQUIVALENT_PRESENT = 1 << 10;
  const FLAG_ELAPSED_TIME_PRESENT = 1 << 11;
  const FLAG_REMAINING_TIME_PRESENT = 1 << 12;

  const flags = dataView.getUint16(0, true);
  let offset = 2;
  const canRead = (bytes) => offset + bytes <= dataView.byteLength;
  const skip = (bytes) => {
    offset = Math.min(offset + bytes, dataView.byteLength);
  };
  const readUint24LE = () => dataView.getUint8(offset) | (dataView.getUint8(offset + 1) << 8) | (dataView.getUint8(offset + 2) << 16);

  let speedMps = null;
  let cadence = null;
  let power = null;
  let totalDistanceMeters = null;

  // Instantaneous speed is present when "More Data" is NOT set.
  if ((flags & FLAG_MORE_DATA) === 0) {
    if (canRead(2)) {
      const speedKph = dataView.getUint16(offset, true) / 100;
      speedMps = speedKph / 3.6;
    }
    skip(2);
  }

  if (flags & FLAG_AVERAGE_SPEED_PRESENT) skip(2);

  if (flags & FLAG_INSTANT_CADENCE_PRESENT) {
    if (canRead(2)) cadence = dataView.getUint16(offset, true) / 2;
    skip(2);
  }

  if (flags & FLAG_AVERAGE_CADENCE_PRESENT) skip(2);

  if (flags & FLAG_TOTAL_DISTANCE_PRESENT) {
    if (canRead(3)) totalDistanceMeters = readUint24LE();
    skip(3);
  }

  if (flags & FLAG_RESISTANCE_LEVEL_PRESENT) skip(2);

  if (flags & FLAG_INSTANT_POWER_PRESENT) {
    if (canRead(2)) power = dataView.getInt16(offset, true);
    skip(2);
  }

  if (flags & FLAG_AVERAGE_POWER_PRESENT) skip(2);

  if (flags & FLAG_EXPENDED_ENERGY_PRESENT) {
    skip(2); // Total Energy
    skip(2); // Energy Per Hour
    skip(1); // Energy Per Minute
  }

  if (flags & FLAG_HEART_RATE_PRESENT) skip(1);
  if (flags & FLAG_METABOLIC_EQUIVALENT_PRESENT) skip(1);
  if (flags & FLAG_ELAPSED_TIME_PRESENT) skip(2);
  if (flags & FLAG_REMAINING_TIME_PRESENT) skip(2);

  return { speedMps, cadence, power, totalDistanceMeters };
}

async function connectTrainer() {
  if (!isWebBluetoothSupported()) {
    showToast("Web Bluetooth not supported.");
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["fitness_machine"] }],
      optionalServices: ["fitness_machine"],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("fitness_machine");
    const characteristic = await service.getCharacteristic("indoor_bike_data");
    const control = await initializeTrainerControl(service);

    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const value = event.target.value;
      const parsed = parseIndoorBikeData(value);
      state.devices.trainer.lastReading = parsed;
    });

    state.devices.trainer = {
      connected: true,
      name: device.name || "Trainer",
      device,
      server,
      characteristic,
      controlCharacteristic: control.characteristic,
      controlSupported: control.supported,
      controlGranted: control.granted,
      lastControlError: control.error,
      lastResistancePercent: null,
      lastResistanceAt: 0,
      lastReading: null,
    };

    updateTerrainState({ trainerControlStatus: getTrainerControlStatusText() });
    showToast(control.granted ? "Trainer connected (control enabled)" : "Trainer connected (read-only)");
    render();
  } catch (error) {
    console.error(error);
    showToast("Trainer pairing cancelled");
  }
}

async function connectHeartRateMonitor() {
  if (!isWebBluetoothSupported()) {
    showToast("Web Bluetooth not supported.");
    return;
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
      optionalServices: ["heart_rate"],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService("heart_rate");
    const characteristic = await service.getCharacteristic("heart_rate_measurement");

    await characteristic.startNotifications();
    characteristic.addEventListener("characteristicvaluechanged", (event) => {
      const value = event.target.value;
      const parsed = parseHeartRateMeasurement(value);
      state.devices.hrm.lastReading = parsed;
    });

    state.devices.hrm = {
      connected: true,
      name: device.name || "HRM",
      device,
      server,
      characteristic,
      lastReading: null,
    };

    showToast("Heart rate monitor connected");
    render();
  } catch (error) {
    console.error(error);
    showToast("HRM pairing cancelled");
  }
}

function disconnectDevice(type) {
  const entry = state.devices[type];
  if (!entry || !entry.device) return;
  try {
    if (entry.characteristic) {
      entry.characteristic.removeEventListener("characteristicvaluechanged", () => {});
      entry.characteristic.stopNotifications().catch(() => {});
    }
    if (entry.server && entry.server.connected) {
      entry.server.disconnect();
    }
  } catch (e) {
    // ignore
  }

  state.devices[type] = {
    connected: false,
    name: null,
    device: null,
    server: null,
    characteristic: null,
    controlCharacteristic: null,
    controlSupported: false,
    controlGranted: false,
    lastControlError: null,
    lastResistancePercent: null,
    lastResistanceAt: 0,
    lastReading: null,
  };
  if (type === "trainer") {
    updateTerrainState({ trainerControlStatus: getTrainerControlStatusText() });
  }
  render();
}

// --- WebRTC signaling (WebSocket preferred, localStorage fallback) ----------------

function getSignalingServerUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(SIGNALING_SERVER_QUERY_PARAM) || DEFAULT_SIGNALING_SERVER;
  } catch {
    return DEFAULT_SIGNALING_SERVER;
  }
}

function isWebSocketSignalingReady() {
  return !state.webrtc.useLocalStorage && state.webrtc.wsConnected && state.webrtc.ws?.readyState === WebSocket.OPEN;
}

function sendSignalingMessage(message) {
  if (!isWebSocketSignalingReady()) return false;
  try {
    state.webrtc.ws.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

function sendSessionCommand(type) {
  if (!state.session?.code || !state.user?.id) return;
  sendSignalingMessage({
    type,
    session: state.session.code,
    peerId: state.user.id,
  });
}

function sendTelemetryToServer(userId, payload) {
  if (!state.session?.code || !userId || !payload) return;
  sendSignalingMessage({
    type: "telemetry",
    session: state.session.code,
    peerId: userId,
    payload,
  });
}

function failPendingRemoteJoin(message) {
  if (!state.webrtc.awaitingSessionState) return;
  showToast(message || "Could not join session.");
  state.webrtc.awaitingSessionState = false;
  closeSignaling();
  resetPrivateRiderStats();
  resetPowerUpState();
  resetFtpProposalState();
  state.user = null;
  state.session = null;
  state.view = "lobby";
  clearLocalSession();
  render();
}

function closeSignaling() {
  if (state.webrtc.ws) {
    try {
      if (isWebSocketSignalingReady()) {
        sendSignalingMessage({
          type: "leave",
          session: state.webrtc.code,
          peerId: state.webrtc.peerId,
        });
      }
      state.webrtc.ws.close();
    } catch {
      // ignore
    }
  }
  state.webrtc.ws = null;
  state.webrtc.wsConnected = false;
  state.webrtc.awaitingSessionState = false;
}

function connectSignaling(sessionCode, peerId, isHost) {
  if (!window.WebSocket) {
    state.webrtc.useLocalStorage = true;
    return;
  }

  const url = getSignalingServerUrl();
  try {
    const ws = new WebSocket(url);
    state.webrtc.ws = ws;
    state.webrtc.wsConnected = false;

    ws.addEventListener("open", () => {
      state.webrtc.wsConnected = true;
      state.webrtc.useLocalStorage = false;
      render();
      sendSignalingMessage({
        type: "join",
        session: sessionCode,
        peerId,
        isHost,
        user: state.user
          ? { id: state.user.id, name: state.user.name, weight: state.user.weight, bikeId: normalizeBikeId(state.user.bikeId) }
          : null,
        sessionState: isHost ? state.session : null,
      });
    });

    ws.addEventListener("message", (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        handleSignalingMessage(msg);
      } catch {
        // ignore
      }
    });

    ws.addEventListener("close", () => {
      state.webrtc.wsConnected = false;
      if (state.webrtc.awaitingSessionState) {
        failPendingRemoteJoin("Unable to join session.");
        return;
      }
      render();
    });

    ws.addEventListener("error", () => {
      if (!state.webrtc.wsConnected) {
        if (state.webrtc.awaitingSessionState) {
          failPendingRemoteJoin("Signaling server unreachable.");
          return;
        }
        state.webrtc.useLocalStorage = true;
        showToast("Signaling server unreachable; falling back to localStorage.");
        const session = loadSessionFromStorage(sessionCode);
        if (session) handleNewPeerFromSession(session);
        render();
      }
    });
  } catch (e) {
    if (state.webrtc.awaitingSessionState) {
      failPendingRemoteJoin("Unable to connect to signaling server.");
      return;
    }
    state.webrtc.useLocalStorage = true;
    render();
  }
}

function sendSignalingSignal(sessionCode, targetPeerId, kind, payload) {
  if (!sessionCode || !state.user?.id) return;

  if (isWebSocketSignalingReady()) {
    sendSignalingMessage({
      type: "signal",
      session: sessionCode,
      from: state.user.id,
      to: targetPeerId,
      kind,
      payload,
    });
    return;
  }

  // LocalStorage fallback (existing demo behavior)
  let lsKind = kind;
  if (kind === "ice") {
    lsKind = state.webrtc.isHost ? "ice-to-client" : "ice-to-host";
  }
  const key = signalingKey(sessionCode, lsKind, targetPeerId);
  if (lsKind === "offer" || lsKind === "answer") {
    writeSignal(key, payload);
  } else {
    appendSignal(key, payload);
  }
}

function signalingKey(sessionCode, kind, peerId) {
  // kind: offer | answer | ice-to-host | ice-to-client
  return `${STORAGE_PREFIX}:rtc:${sessionCode}:${kind}:${peerId}`;
}

function writeSignal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readSignal(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function appendSignal(key, item) {
  const existing = readSignal(key) || [];
  existing.push(item);
  writeSignal(key, existing);
}

function cleanupSignaling(sessionCode) {
  if (!state.webrtc.useLocalStorage) return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${STORAGE_PREFIX}:rtc:${sessionCode}:`))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    // ignore
  }
}

function processPendingIce(sessionCode, peerId, kind, pc) {
  const candidates = readSignal(signalingKey(sessionCode, kind, peerId)) || [];
  candidates.forEach((c) => {
    pc.addIceCandidate(c).catch(() => {});
  });
}

function closeWebRTCPeers() {
  Object.values(state.webrtc.peers).forEach((peer) => {
    try {
      peer.pc?.close();
    } catch {
      // ignore
    }
  });
  state.webrtc.peers = {};
  closeSignaling();
}

function initWebRTC(sessionCode, isHost, options = {}) {
  const supported = isWebRTCSupported();
  state.webrtc.enabled = supported;

  if (!supported) {
    showToast("WebRTC not supported in this browser.");
    return;
  }

  closeWebRTCPeers();
  state.webrtc.code = sessionCode;
  state.webrtc.isHost = isHost;
  state.webrtc.peerId = state.user?.id;
  state.webrtc.useLocalStorage = false;
  state.webrtc.wsConnected = false;
  state.webrtc.awaitingSessionState = !!options.awaitingSessionState;

  // Clear stale signaling entries when starting a new session (fallback only).
  cleanupSignaling(sessionCode);

  connectSignaling(sessionCode, state.webrtc.peerId, isHost);
}

function createPeerConnection(sessionCode, peerId, isHost) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = (event) => {
    if (!event.candidate) return;
    sendSignalingSignal(sessionCode, peerId, "ice", event.candidate.toJSON());
  };

  pc.onconnectionstatechange = () => {
    const stateObj = state.webrtc.peers[peerId];
    if (stateObj) {
      stateObj.connected = pc.connectionState === "connected";
      render();
    }
  };

  return pc;
}

function setupHostPeer(sessionCode, peerId) {
  if (!state.webrtc.enabled) return;
  if (state.webrtc.peers[peerId]) return;

  const pc = createPeerConnection(sessionCode, peerId, true);
  const dc = pc.createDataChannel("ridesync");

  dc.onopen = () => {
    state.webrtc.peers[peerId].connected = true;
    render();
  };

  dc.onmessage = (event) => {
    // When a guest sends telemetry updates, broadcast to others (simple hub).
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === "telemetry" && state.webrtc.useLocalStorage) {
        // Write to session store so UI updates.
        updateSessionOnStorage((session) => {
          session.telemetry = session.telemetry || {};
          session.telemetry[payload.userId] = payload.data;
        });
      }
    } catch {
      // ignore
    }
  };

  state.webrtc.peers[peerId] = { pc, dc, connected: false };

  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => {
      sendSignalingSignal(sessionCode, peerId, "offer", pc.localDescription);

      // If the client already sent an answer, apply it immediately (fallback only).
      if (state.webrtc.useLocalStorage) {
        const existingAnswer = readSignal(signalingKey(sessionCode, "answer", peerId));
        if (existingAnswer) {
          pc.setRemoteDescription(existingAnswer).catch(() => {});
        }

        // Process any ICE candidates that arrived before we were ready.
        processPendingIce(sessionCode, peerId, "ice-to-host", pc);
      }
    })
    .catch((err) => console.error("WebRTC offer error", err));
}

function setupClientPeer(sessionCode, peerId) {
  if (!state.webrtc.enabled) return;

  let peer = state.webrtc.peers[peerId];
  if (!peer) {
    const pc = createPeerConnection(sessionCode, peerId, false);
    peer = { pc, dc: null, connected: false, remoteSet: false };
    state.webrtc.peers[peerId] = peer;

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload?.type === "telemetry" && state.webrtc.useLocalStorage) {
            updateSessionOnStorage((session) => {
              session.telemetry = session.telemetry || {};
              session.telemetry[payload.userId] = payload.data;
            });
          }
        } catch {
          // ignore
        }
      };

      dc.onopen = () => {
        peer.connected = true;
        render();
      };

      peer.dc = dc;
    };
  }

  // If we already processed the offer once, don't redo it.
  if (peer.remoteSet) return;

  if (state.webrtc.useLocalStorage) {
    const offer = readSignal(signalingKey(sessionCode, "offer", peerId));
    if (!offer) return;

    peer.pc
      .setRemoteDescription(offer)
      .then(() => peer.pc.createAnswer())
      .then((answer) => peer.pc.setLocalDescription(answer))
      .then(() => {
        sendSignalingSignal(sessionCode, peerId, "answer", peer.pc.localDescription);
        peer.remoteSet = true;

        // Process any ICE candidates that arrived before the peer was ready.
        processPendingIce(sessionCode, peerId, "ice-to-client", peer.pc);
      })
      .catch((err) => console.error("WebRTC answer error", err));
  }
}

function handleSignalingEvent(event) {
  if (!state.webrtc.useLocalStorage) return;
  if (!event.key || !state.session) return;
  const code = state.session.code;
  if (!event.key.startsWith(`${STORAGE_PREFIX}:rtc:${code}:`)) return;

  const parts = event.key.split(":");
  // key format: ridesync:rtc:<code>:<kind>:<peerId>
  const kind = parts[4];
  const peerId = parts[5];

  if (!peerId) return;

  // Host side: handle answer & client ICE
  if (state.webrtc.isHost && kind === "answer") {
    const answer = readSignal(event.key);
    const peer = state.webrtc.peers[peerId];
    if (peer && answer) {
      peer.pc.setRemoteDescription(answer).catch(() => {});
    }
    return;
  }

  if (state.webrtc.isHost && kind === "ice-to-host") {
    const candidates = readSignal(event.key) || [];
    const peer = state.webrtc.peers[peerId];
    if (peer) {
      candidates.forEach((c) => {
        peer.pc.addIceCandidate(c).catch(() => {});
      });
    }
    return;
  }

  // Client side: handle offer & host ICE
  if (!state.webrtc.isHost && kind === "offer") {
    setupClientPeer(code, peerId);
    return;
  }

  if (!state.webrtc.isHost && kind === "ice-to-client") {
    const candidates = readSignal(event.key) || [];
    const peer = state.webrtc.peers[peerId];
    if (peer) {
      candidates.forEach((c) => {
        peer.pc.addIceCandidate(c).catch(() => {});
      });
    }
    return;
  }
}

function handleSignalingMessage(msg) {
  if (!msg || !msg.session || msg.session !== state.webrtc.code) return;

  if (msg.type === "session-error") {
    if (state.webrtc.awaitingSessionState) {
      failPendingRemoteJoin(msg.message || "Could not join session.");
      return;
    }
    showToast(msg.message || "Session closed.");
    clearLocalSession();
    closeWebRTCPeers();
    resetPrivateRiderStats();
    resetPowerUpState();
    resetFtpProposalState();
    state.user = null;
    state.session = null;
    state.view = "lobby";
    render();
    return;
  }

  if (msg.type === "session-state") {
    if (!msg.sessionData || typeof msg.sessionData !== "object") return;
    const nextSession = cloneJson(msg.sessionData);
    if (!nextSession) return;
    normalizeSessionCourse(nextSession);

    state.session = nextSession;
    saveSessionToStorage(nextSession);
    if (nextSession.endedAt && state.view === "session") {
      state.view = "summary";
    }

    if (state.user?.id) {
      const me = nextSession.users?.[state.user.id];
      if (me) {
        state.user = {
          ...state.user,
          ...me,
          id: state.user.id,
          bikeId: normalizeBikeId(me.bikeId),
          isHost: nextSession.hostId === state.user.id,
        };
        persistLocalSession(nextSession.code, state.user.id);
        state.webrtc.awaitingSessionState = false;
      } else if (!state.webrtc.isHost) {
        clearLocalSession();
        resetPrivateRiderStats();
        resetPowerUpState();
        resetFtpProposalState();
        state.user = null;
        state.session = null;
        state.view = "lobby";
        showToast("You are no longer in this session.");
      }
    }

    if (state.webrtc.isHost) {
      handleNewPeerFromSession(nextSession);
    }

    render();
    return;
  }

  if (msg.type === "peers") {
    const { peers = [], hostId } = msg;
    if (state.webrtc.isHost) {
      peers.forEach((peerId) => {
        if (peerId !== state.user?.id) {
          setupHostPeer(msg.session, peerId);
        }
      });
    } else {
      // Guests only connect to host.
      if (hostId && hostId !== state.user?.id) {
        setupClientPeer(msg.session, hostId);
      }
    }
    return;
  }

  if (msg.type === "peer-joined") {
    if (state.webrtc.isHost && msg.peerId && msg.peerId !== state.user?.id) {
      setupHostPeer(msg.session, msg.peerId);
    }
    return;
  }

  if (msg.type === "peer-left") {
    const pid = msg.peerId;
    if (pid && state.webrtc.peers[pid]) {
      state.webrtc.peers[pid].pc?.close();
      delete state.webrtc.peers[pid];
      render();
    }
    return;
  }

  if (msg.type === "signal") {
    const { from, kind, payload } = msg;
    if (!from) return;

    // Host receives answers/ice from guests
    if (state.webrtc.isHost && kind === "answer") {
      const peer = state.webrtc.peers[from];
      if (peer && payload) {
        peer.pc.setRemoteDescription(payload).catch(() => {});
      }
      return;
    }

    if (state.webrtc.isHost && kind === "ice") {
      const peer = state.webrtc.peers[from];
      if (peer && payload) {
        peer.pc.addIceCandidate(payload).catch(() => {});
      }
      return;
    }

    // Guest receives offer/ice from host
    if (!state.webrtc.isHost && kind === "offer") {
      setupClientPeer(msg.session, from);
      const peer = state.webrtc.peers[from];
      if (peer && payload) {
        peer.pc
          .setRemoteDescription(payload)
          .then(() => peer.pc.createAnswer())
          .then((answer) => peer.pc.setLocalDescription(answer))
          .then(() => {
            sendSignalingSignal(msg.session, from, "answer", peer.pc.localDescription);
            peer.remoteSet = true;
          })
          .catch(() => {});
      }
      return;
    }

    if (!state.webrtc.isHost && kind === "ice") {
      const peer = state.webrtc.peers[from];
      if (peer && payload) {
        peer.pc.addIceCandidate(payload).catch(() => {});
      }
      return;
    }
  }
}

function broadcastTelemetryOverWebRTC(userId, data) {
  if (!state.webrtc.enabled) return;
  Object.values(state.webrtc.peers).forEach((peer) => {
    if (peer.dc && peer.dc.readyState === "open") {
      peer.dc.send(JSON.stringify({ type: "telemetry", userId, data }));
    }
  });
}

function handleNewPeerFromSession(session) {
  if (!state.webrtc.enabled || !state.webrtc.isHost) return;
  const hostId = session.hostId;
  const me = state.user?.id;
  Object.keys(session.users || {}).forEach((userId) => {
    const participant = session.users?.[userId];
    if (userId === hostId) return;
    if (userId === me) return;
    if (participant?.isBot) return;
    if (!state.webrtc.peers[userId]) {
      setupHostPeer(session.code, userId);
    }
  });
}

// --------------------------------------------------------------------

function getTelemetrySampling() {
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user) return null;

  const now = currentMs();
  const privateStats = ensurePrivateRiderStatsContext(session, user);
  const previous = session.telemetry?.[user.id] || { distance: 0, updatedAt: now };
  const previousTs = previous.updatedAt || previous.timestamp || now;
  const deltaSeconds = Math.max(1, Math.round((now - previousTs) / 1000));

  const trainer = state.devices.trainer;
  const hrm = state.devices.hrm;

  let power = null;
  let cadence = null;
  let heartRate = null;
  let speedMps = null;

  if (trainer.connected && trainer.lastReading) {
    power = trainer.lastReading.power;
    cadence = trainer.lastReading.cadence;
    speedMps = trainer.lastReading.speedMps;
  }

  if (hrm.connected && hrm.lastReading) {
    heartRate = hrm.lastReading.heartRate;
  }

  // Use mock data only when trainer/HRM are not connected.
  const mockSeed = {
    ...previous,
    speedMps: Number.isFinite(privateStats?.latestSpeedMps) ? privateStats.latestSpeedMps : previous.speedMps,
  };
  const mock = createMockTelemetryUpdate(mockSeed, now);
  if (!trainer.connected) {
    power = power ?? mock.power;
    cadence = cadence ?? mock.cadence;
    speedMps = speedMps ?? mock.speedMps;
  }
  if (!hrm.connected) {
    heartRate = heartRate ?? mock.heartRate;
  }

  return { power, cadence, heartRate, speedMps, deltaSeconds, now };
}

function createMockTelemetryUpdate(currentTelemetry, nowMs) {
  const basePower = 220;
  const drift = (Math.random() - 0.5) * 8;
  const nextPower = clamp((currentTelemetry?.power ?? basePower) + drift, 60, 500);
  const heartDrift = (Math.random() - 0.5) * 4;
  const nextHeart = clamp((currentTelemetry?.heartRate ?? 140) + heartDrift, 80, 205);
  const cadence = clamp((currentTelemetry?.cadence ?? 80) + (Math.random() - 0.5) * 6, 40, 120);
  const speedMps = clamp((currentTelemetry?.speedMps ?? 9.0) + (Math.random() - 0.5) * 0.8, 4, 16);

  return {
    power: Math.round(nextPower),
    heartRate: Math.round(nextHeart),
    cadence: Math.round(cadence),
    speedMps,
    timestamp: nowMs,
  };
}

function getBotBaseEffortFraction(levelInput) {
  const level = normalizeBotDifficultyLevel(levelInput);
  const progress = (level - 1) / Math.max(BOT_DIFFICULTY_LEVELS.length - 1, 1);
  return lerp(0.72, 0.9, progress);
}

function simulateBotPower({ bot, previousTelemetry, currentGradePercent, nowMs, deltaSeconds }) {
  const ftpWatts = Math.max(1, Number(bot?.ftpWatts) || getBotDifficultyConfig(bot?.difficultyLevel).ftpWatts);
  const previousPower = Math.max(0, Number(previousTelemetry?.power) || ftpWatts * 0.72);
  const baseFraction = getBotBaseEffortFraction(bot?.difficultyLevel);
  const grade = Number(currentGradePercent) || 0;
  const phase = (nowMs / 1000) * 0.12 + (hashStringForColor(bot?.id || bot?.name || "bot") % 360) * (Math.PI / 180);
  const variation = Math.sin(phase) * 0.018;
  const terrainAdjustment = clamp(grade * 0.003, -0.045, 0.06);
  const targetFraction = clamp(baseFraction + variation + terrainAdjustment, 0.62, 1.02);
  const targetPower = ftpWatts * targetFraction;
  const smoothedPower = smoothToward(previousPower, targetPower, 0.42, deltaSeconds);
  return Math.max(40, Math.round(smoothedPower));
}

function simulateBotTelemetry({ bot, previousTelemetry, courseSegments, nowMs, deltaSeconds }) {
  const previousDistance = Number(previousTelemetry?.distance) || 0;
  const gradeContext = getCourseGradeContext(previousDistance, courseSegments);
  const currentGrade = Number(gradeContext.currentGrade) || 0;
  const gradientScale = clamp(state.simulation.gradientScale, 0, 1);
  const effectiveGrade = currentGrade * gradientScale;
  const power = simulateBotPower({
    bot,
    previousTelemetry,
    currentGradePercent: effectiveGrade,
    nowMs,
    deltaSeconds,
  });
  const ftpWatts = Math.max(1, Number(bot?.ftpWatts) || getBotDifficultyConfig(bot?.difficultyLevel).ftpWatts);
  const powerRatio = clamp(power / ftpWatts, 0.5, 1.15);
  const cadenceWave = Math.sin((nowMs / 1000) * 0.16 + (hashStringForColor(bot?.id || "bot") % 90)) * 1.8;
  const cadence = clamp(76 + powerRatio * 13 + cadenceWave, 58, 102);
  const heartRate = clamp(98 + powerRatio * 78, 92, 194);

  const previousSpeed = Number(previousTelemetry?.speedMps);
  const fallbackSpeed = computeTargetSpeedFromPowerAndGrade(power, effectiveGrade, bot?.weight ?? BOT_DEFAULT_WEIGHT_KG, bot?.bikeId);
  const initialSpeed = Number.isFinite(previousSpeed) && previousSpeed >= 0 ? previousSpeed : fallbackSpeed;
  const targetSpeed = computeTargetSpeedFromPowerAndGrade(power, effectiveGrade, bot?.weight ?? BOT_DEFAULT_WEIGHT_KG, bot?.bikeId);
  const speedMps = smoothToward(initialSpeed, targetSpeed, state.simulation.speedSmoothing, deltaSeconds);
  const resistancePercent = mapGradeToResistancePercent(effectiveGrade);
  const resistanceLabel = getResistanceFeelLabel(resistancePercent);
  const distance = computeDistanceMeters(previousDistance, speedMps, deltaSeconds);

  return {
    telemetry: {
      power,
      heartRate: Math.round(heartRate),
      cadence: Math.round(cadence),
      speedMps,
      grade: currentGrade,
      effectiveGrade,
      resistancePercent,
      resistanceLabel,
      activePowerUp: null,
      deltaTimeSeconds: deltaSeconds,
      timestamp: nowMs,
    },
    distance,
  };
}

function simulateBotsForCurrentSession(deltaSeconds, nowMs) {
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user || !user.isHost || !isSessionRunning()) return;

  const participants = Object.values(session.users || {});
  const bots = participants.filter((participant) => participant?.isBot);
  if (bots.length === 0) return;

  const courseSegments = getCourseSegments(session);
  bots.forEach((bot) => {
    const previousTelemetry = session.telemetry?.[bot.id] || { distance: 0, updatedAt: nowMs - TELEMETRY_POLL_INTERVAL_MS };
    const { telemetry, distance } = simulateBotTelemetry({
      bot,
      previousTelemetry,
      courseSegments,
      nowMs,
      deltaSeconds,
    });
    addTelemetrySample(bot.id, telemetry, distance);
  });
}

function createSession({ hostUser, routePreset = DEFAULT_ROUTE_PRESET, botConfigs = [] }) {
  const code = makeId(6);
  const now = currentMs();
  const session = {
    code,
    hostId: hostUser.id,
    startedAt: null,
    endedAt: null,
    createdAt: now,
    users: {
      [hostUser.id]: { id: hostUser.id, name: hostUser.name, weight: hostUser.weight, bikeId: normalizeBikeId(hostUser.bikeId) },
    },
    telemetry: {
      // userId: { power, heartRate, cadence, distance, updatedAt }
    },
    aggregates: {
      // userId: { sampleCount, totalPower, maxPower, totalHeartRate, totalDistance }
    },
    xpAwards: {
      // userId: { earnedXp, breakdown, ... }
    },
    calorieAwards: {
      // userId: { caloriesBurned, metrics, ... }
    },
    totalClimbedMeters: 0,
    course: createCourseFromRoutePreset(routePreset),
  };

  normalizeBotDrafts(botConfigs).forEach((botDraft) => {
    addBotToSession(session, botDraft);
  });

  saveSessionToStorage(session);
  return session;
}

function createPlaceholderSession(code, user) {
  return {
    code,
    hostId: null,
    startedAt: null,
    endedAt: null,
    createdAt: currentMs(),
    users: {
      [user.id]: { id: user.id, name: user.name, weight: user.weight, bikeId: normalizeBikeId(user.bikeId) },
    },
    telemetry: {},
    aggregates: {},
    xpAwards: {},
    calorieAwards: {},
    totalClimbedMeters: 0,
    course: createCourseFromRoutePreset(DEFAULT_ROUTE_PRESET),
  };
}

function joinSession({ code, user }) {
  const session = loadSessionFromStorage(code);
  if (!session) return null;

  if (session.endedAt) {
    return { error: "Session already ended" };
  }

  if (!session.users) session.users = {};
  if (!session.telemetry) session.telemetry = {};
  if (!session.aggregates) session.aggregates = {};
  if (!Number.isFinite(session.totalClimbedMeters)) session.totalClimbedMeters = 0;
  normalizeSessionCourse(session);

  session.users[user.id] = { id: user.id, name: user.name, weight: user.weight, bikeId: normalizeBikeId(user.bikeId) };

  saveSessionToStorage(session);
  return session;
}

function updateSessionOnStorage(mutationFn) {
  const code = state.session?.code;
  if (!code) return;
  const session = loadSessionFromStorage(code);
  if (!session) return;
  if (!Number.isFinite(session.totalClimbedMeters)) session.totalClimbedMeters = 0;
  normalizeSessionCourse(session);
  mutationFn(session);
  saveSessionToStorage(session);
  state.session = session;
  render();
}

function setSession(session) {
  normalizeSessionCourse(session);
  state.session = session;
  render();
}

function setUser(user) {
  if (!user || typeof user !== "object") {
    state.user = user;
    render();
    return;
  }
  state.user = {
    ...user,
    bikeId: normalizeBikeId(user.bikeId),
  };
  render();
}

function getCurrentUser() {
  return state.user;
}

function getCurrentSession() {
  return state.session;
}

function canStartSession() {
  const session = getCurrentSession();
  const user = getCurrentUser();
  return session && user && session.hostId === user.id && !session.startedAt;
}

function isSessionRunning() {
  const session = getCurrentSession();
  return session && session.startedAt && !session.endedAt;
}

function isSessionEnded() {
  const session = getCurrentSession();
  return session && session.endedAt;
}

function computeDistanceMeters(prevDistance, speedMps, deltaSeconds) {
  if (speedMps == null || Number.isNaN(speedMps) || deltaSeconds <= 0) return prevDistance;
  return prevDistance + Math.max(0, speedMps) * deltaSeconds;
}

function computeWkg(power, weight) {
  if (!power || !weight) return null;
  return power / weight;
}

function ensureAggregate(userId, sessionOverride = null) {
  const session = sessionOverride || getCurrentSession();
  if (!session) return;
  session.aggregates = session.aggregates || {};
  if (!session.aggregates[userId]) {
    session.aggregates[userId] = {
      sampleCount: 0,
      totalPower: 0,
      maxPower: 0,
      totalHeartRate: 0,
      totalDistance: 0,
      totalClimb: 0,
    };
  }
  return session.aggregates[userId];
}

function ensurePrivateRiderStatsContext(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const sessionCode = sessionInput?.code || null;
  const userId = userInput?.id || null;
  const existing = state.privateRiderStats || createEmptyPrivateRiderStats();
  if (existing.sessionCode !== sessionCode || existing.userId !== userId) {
    state.privateRiderStats = createEmptyPrivateRiderStats(sessionCode, userId);
  }
  return state.privateRiderStats;
}

function sumTailValues(values, count) {
  if (!Array.isArray(values) || values.length === 0 || count <= 0) return 0;
  const fromIndex = Math.max(0, values.length - count);
  let sum = 0;
  for (let i = fromIndex; i < values.length; i += 1) {
    sum += Number(values[i]) || 0;
  }
  return sum;
}

function updatePrivateRiderRollingPeaks(privateStats) {
  const recent = privateStats.recentPowerSeconds;
  PRIVATE_RIDER_PEAK_WINDOWS.forEach((windowDef) => {
    if (recent.length < windowDef.seconds) return;
    const windowAverage = sumTailValues(recent, windowDef.seconds) / windowDef.seconds;
    const previousBest = privateStats.bestRollingWatts[windowDef.seconds];
    if (!Number.isFinite(previousBest) || windowAverage > previousBest) {
      privateStats.bestRollingWatts[windowDef.seconds] = windowAverage;
    }
  });
}

function pollPrivateRiderStats(privateStats, nowMs) {
  if (!privateStats) return;
  if (nowMs - (privateStats.lastPolledAtMs || 0) < PRIVATE_RIDER_STATS_REFRESH_MS) return;
  privateStats.lastPolledAtMs = nowMs;
  const avgWatts = privateStats.totalDurationSeconds > 0 ? privateStats.totalPowerSeconds / privateStats.totalDurationSeconds : null;
  privateStats.snapshot = {
    updatedAtMs: nowMs,
    avgWatts,
    speedMps: Number.isFinite(privateStats.latestSpeedMps) ? privateStats.latestSpeedMps : null,
    bestRollingWatts: { ...privateStats.bestRollingWatts },
    totalDurationSeconds: privateStats.totalDurationSeconds,
  };
}

function recordPrivateRiderTelemetrySample(telemetry, sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const privateStats = ensurePrivateRiderStatsContext(sessionInput, userInput);
  if (!privateStats) return;

  const sampleDurationSeconds = clamp(Math.round(Number(telemetry?.deltaTimeSeconds) || 0), 1, 30);
  const powerWatts = Math.max(0, Number(telemetry?.power) || 0);
  const speedMps = Number(telemetry?.speedMps);
  if (Number.isFinite(speedMps) && speedMps >= 0) {
    privateStats.latestSpeedMps = speedMps;
  }

  for (let i = 0; i < sampleDurationSeconds; i += 1) {
    privateStats.recentPowerSeconds.push(powerWatts);
    if (privateStats.recentPowerSeconds.length > PRIVATE_RIDER_MAX_WINDOW_SECONDS) {
      privateStats.recentPowerSeconds.shift();
    }
  }

  privateStats.totalDurationSeconds += sampleDurationSeconds;
  privateStats.totalPowerSeconds += powerWatts * sampleDurationSeconds;
  updatePrivateRiderRollingPeaks(privateStats);
  pollPrivateRiderStats(privateStats, Number(telemetry?.timestamp) || currentMs());
}

function getPrivateRiderStatsSnapshot(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const privateStats = ensurePrivateRiderStatsContext(sessionInput, userInput);
  if (!privateStats) return createEmptyPrivateRiderStats().snapshot;
  pollPrivateRiderStats(privateStats, currentMs());
  return privateStats.snapshot || createEmptyPrivateRiderStats().snapshot;
}

function resetPrivateRiderStats() {
  state.privateRiderStats = createEmptyPrivateRiderStats();
}

function createPowerUpFromType(typeInput) {
  const type = String(typeInput || POWER_UP_TYPE_SPEED_BOOST).trim().toLowerCase();
  const definition = POWER_UP_TYPES[type] || POWER_UP_TYPES[POWER_UP_TYPE_SPEED_BOOST];
  return {
    id: `pu_${makeId(10)}`,
    type: definition.type,
    label: definition.label,
    durationMs: definition.durationMs,
    effect: {
      speedMultiplier: definition.speedMultiplier,
    },
    collectedAt: currentMs(),
  };
}

function ensurePowerUpContext(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const sessionCode = sessionInput?.code || null;
  const userId = userInput?.id || null;
  const existing = state.powerUps || createEmptyPowerUpState();
  if (existing.sessionCode !== sessionCode || existing.userId !== userId) {
    // Keep inventory local to this client/session so only active usage is shared.
    const initialDistance = Number(sessionInput?.telemetry?.[userId]?.distance) || 0;
    state.powerUps = createEmptyPowerUpState(sessionCode, userId);
    state.powerUps.lastPowerUpDistanceThreshold = Math.floor(Math.max(0, initialDistance) / POWER_UP_GRANT_DISTANCE_METERS);
  }
  return state.powerUps;
}

function resetPowerUpState() {
  state.powerUps = createEmptyPowerUpState();
}

function ensureFtpProposalContext(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const sessionCode = sessionInput?.code || null;
  const scopedUserId = state.account.userId || userInput?.id || null;
  const existing = state.ftp || createEmptyFtpProposalState();
  if (existing.sessionCode !== sessionCode || existing.userId !== scopedUserId) {
    state.ftp = createEmptyFtpProposalState(sessionCode, scopedUserId);
  }
  return state.ftp;
}

function resetFtpProposalState() {
  state.ftp = createEmptyFtpProposalState();
}

function getFtpCandidateFromRollingEfforts(bestRollingWattsInput) {
  const peaks = bestRollingWattsInput && typeof bestRollingWattsInput === "object" ? bestRollingWattsInput : {};
  const candidates = [];

  // Keep this helper centralized so future FTP systems (zones/workouts/scaling) can swap in richer logic.
  const peak60m = Number(peaks[3600]);
  const peak40m = Number(peaks[2400]);
  const peak20m = Number(peaks[1200]);

  if (Number.isFinite(peak60m) && peak60m > 0) {
    candidates.push({ ftpWatts: Math.round(peak60m), sourceLabel: "Best 60m effort" });
  }
  if (Number.isFinite(peak40m) && peak40m > 0) {
    candidates.push({ ftpWatts: Math.round(peak40m * 0.98), sourceLabel: "Best 40m effort (estimated)" });
  }
  if (Number.isFinite(peak20m) && peak20m > 0) {
    candidates.push({ ftpWatts: Math.round(peak20m * 0.95), sourceLabel: "Best 20m effort (estimated)" });
  }

  if (candidates.length === 0) return null;
  return candidates.reduce((best, entry) => (entry.ftpWatts > best.ftpWatts ? entry : best), candidates[0]);
}

function evaluateFtpProposalFromCurrentEffort(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const session = sessionInput;
  const user = userInput;
  if (!session || !user || !state.account.userId) return null;

  const profile = getCurrentAccountProfile();
  const currentFtp = getUserFtp(profile);
  if (!Number.isFinite(currentFtp) || currentFtp <= 0) return null;

  const privateStats = ensurePrivateRiderStatsContext(session, user);
  const candidate = getFtpCandidateFromRollingEfforts(privateStats?.bestRollingWatts);
  if (!candidate) return null;

  const candidateValidation = validateFtp(candidate.ftpWatts, { allowNull: false });
  if (!candidateValidation.valid) return null;
  const candidateFtpWatts = candidateValidation.value;
  if (candidateFtpWatts <= currentFtp) return null;

  const ftpState = ensureFtpProposalContext(session, user);
  if (
    Number.isFinite(ftpState.lastDeclinedCandidateWatts) &&
    candidateFtpWatts <= Number(ftpState.lastDeclinedCandidateWatts) + 2
  ) {
    return ftpState.pendingProposal;
  }

  const existing = ftpState.pendingProposal;
  if (existing && candidateFtpWatts <= Number(existing.candidateFtpWatts) + 2) {
    return existing;
  }

  ftpState.pendingProposal = {
    candidateFtpWatts,
    previousFtpWatts: currentFtp,
    sourceLabel: candidate.sourceLabel,
    detectedAtMs: currentMs(),
  };
  showToast(`New FTP candidate detected: ${candidateFtpWatts} W.`);
  return ftpState.pendingProposal;
}

function getPendingFtpProposal(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const ftpState = ensureFtpProposalContext(sessionInput, userInput);
  return ftpState.pendingProposal || null;
}

function acceptPendingFtpProposal(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  if (!state.account.userId) {
    return { ok: false, error: "Log in to save FTP to your profile." };
  }
  const ftpState = ensureFtpProposalContext(sessionInput, userInput);
  const proposal = ftpState.pendingProposal;
  if (!proposal) return { ok: false, error: "No FTP update is pending." };

  const profiles = loadProfiles();
  const existingProfile = profiles[state.account.userId];
  if (!existingProfile) return { ok: false, error: "Profile not found." };

  const updated = updateUserFtp(withProfileProgression(existingProfile), proposal.candidateFtpWatts, currentMs());
  if (!updated.ok) return { ok: false, error: updated.error || "Could not update FTP." };

  profiles[state.account.userId] = withProfileProgression(updated.profile);
  saveProfiles(profiles);
  upsertPublicProfile(profiles[state.account.userId]);

  ftpState.pendingProposal = null;
  ftpState.lastDeclinedCandidateWatts = Number(proposal.candidateFtpWatts);
  return { ok: true, ftpWatts: proposal.candidateFtpWatts };
}

function declinePendingFtpProposal(sessionInput = getCurrentSession(), userInput = getCurrentUser()) {
  const ftpState = ensureFtpProposalContext(sessionInput, userInput);
  const proposal = ftpState.pendingProposal;
  if (!proposal) return { ok: false, error: "No FTP update is pending." };
  ftpState.lastDeclinedCandidateWatts = Number(proposal.candidateFtpWatts);
  ftpState.pendingProposal = null;
  return { ok: true };
}

function getActivePowerUp(powerUpState, nowMs = currentMs()) {
  if (!powerUpState) return null;
  const active = powerUpState.activePowerUp;
  if (!active) return null;
  if (nowMs >= active.endsAtMs) {
    powerUpState.activePowerUp = null;
    return null;
  }
  return active;
}

function serializeActivePowerUp(activePowerUp) {
  if (!activePowerUp) return null;
  return {
    type: activePowerUp.type,
    label: activePowerUp.label,
    startedAtMs: activePowerUp.startedAtMs,
    durationMs: activePowerUp.durationMs,
    endsAtMs: activePowerUp.endsAtMs,
  };
}

function applyPowerUpEffects(baseSpeedMps, activePowerUp) {
  const speed = Number(baseSpeedMps);
  if (!Number.isFinite(speed)) return 0;
  if (!activePowerUp) return speed;
  if (activePowerUp.type === POWER_UP_TYPE_SPEED_BOOST) {
    const multiplier = Number(activePowerUp.effect?.speedMultiplier) || 1;
    return speed * multiplier;
  }
  return speed;
}

function grantPowerUpsFromDistance(powerUpState, currentDistanceMeters) {
  if (!powerUpState) return;
  const distanceThreshold = Math.floor(Math.max(0, Number(currentDistanceMeters) || 0) / POWER_UP_GRANT_DISTANCE_METERS);
  if (distanceThreshold <= powerUpState.lastPowerUpDistanceThreshold) return;

  const thresholdsCrossed = distanceThreshold - powerUpState.lastPowerUpDistanceThreshold;
  for (let i = 0; i < thresholdsCrossed; i += 1) {
    if (powerUpState.powerUpQueue.length >= POWER_UP_QUEUE_MAX) continue;
    powerUpState.powerUpQueue.push(createPowerUpFromType(POWER_UP_TYPE_SPEED_BOOST));
  }
  powerUpState.lastPowerUpDistanceThreshold = distanceThreshold;
}

function useNextPowerUp(powerUpState, nowMs = currentMs()) {
  if (!powerUpState) return { ok: false, error: "Power-up state unavailable." };
  if (getActivePowerUp(powerUpState, nowMs)) {
    return { ok: false, error: "A power-up is already active." };
  }
  if (!Array.isArray(powerUpState.powerUpQueue) || powerUpState.powerUpQueue.length === 0) {
    return { ok: false, error: "No power-ups available." };
  }

  const next = powerUpState.powerUpQueue.shift();
  const durationMs = Math.max(1000, Number(next.durationMs) || 10000);
  powerUpState.activePowerUp = {
    ...next,
    startedAtMs: nowMs,
    durationMs,
    endsAtMs: nowMs + durationMs,
  };
  return { ok: true, powerUp: powerUpState.activePowerUp };
}

function formatActivePowerUpLabel(activePowerUp, nowMs = currentMs()) {
  if (!activePowerUp) return "--";
  const endsAtMs = Number(activePowerUp.endsAtMs);
  if (!Number.isFinite(endsAtMs) || nowMs >= endsAtMs) return "--";
  const remainingSeconds = Math.max(1, Math.ceil((endsAtMs - nowMs) / 1000));
  const label = activePowerUp.label || "POWER-UP";
  return `${label} (${remainingSeconds}s)`;
}

function addTelemetrySample(userId, telemetry, distance) {
  updateSessionOnStorage((session) => {
    session.telemetry = session.telemetry || {};
    const previousEntry = session.telemetry?.[userId] || null;
    const previousUpdatedAt = Number(previousEntry?.updatedAt) || Number(telemetry.timestamp) || currentMs();
    const explicitDeltaSeconds = Number(telemetry.deltaTimeSeconds);
    const deltaTimeSeconds =
      Number.isFinite(explicitDeltaSeconds) && explicitDeltaSeconds > 0
        ? explicitDeltaSeconds
        : Math.max(0, (Number(telemetry.timestamp) - previousUpdatedAt) / 1000);
    const effectiveGrade = Number.isFinite(telemetry.effectiveGrade)
      ? telemetry.effectiveGrade
      : Number.isFinite(telemetry.grade)
        ? telemetry.grade
        : 0;
    const climbDelta = calculateElevationGainMeters(telemetry.speedMps, effectiveGrade, deltaTimeSeconds);
    session.telemetry[userId] = {
      power: telemetry.power,
      heartRate: telemetry.heartRate,
      cadence: telemetry.cadence,
      speedMps: telemetry.speedMps ?? null,
      grade: telemetry.grade ?? null,
      effectiveGrade: telemetry.effectiveGrade ?? null,
      resistancePercent: telemetry.resistancePercent ?? null,
      resistanceLabel: telemetry.resistanceLabel ?? null,
      activePowerUp: telemetry.activePowerUp ?? null,
      distance,
      updatedAt: telemetry.timestamp,
    };

    const agg = ensureAggregate(userId, session);
    agg.sampleCount += 1;
    agg.totalPower += telemetry.power;
    agg.maxPower = Math.max(agg.maxPower, telemetry.power);
    agg.totalHeartRate += telemetry.heartRate;
    agg.totalDistance = distance;
    agg.totalClimb = (agg.totalClimb || 0) + climbDelta;
    session.totalClimbedMeters = Object.values(session.aggregates).reduce((total, value) => total + (Number(value?.totalClimb) || 0), 0);
  });

  const payload = {
    power: telemetry.power,
    heartRate: telemetry.heartRate,
    cadence: telemetry.cadence,
    speedMps: telemetry.speedMps ?? null,
    grade: telemetry.grade ?? null,
    effectiveGrade: telemetry.effectiveGrade ?? null,
    resistancePercent: telemetry.resistancePercent ?? null,
    resistanceLabel: telemetry.resistanceLabel ?? null,
    activePowerUp: telemetry.activePowerUp ?? null,
    distance,
    timestamp: telemetry.timestamp,
  };

  // Prefer server-backed telemetry across devices; keep WebRTC path for local fallback.
  if (isWebSocketSignalingReady()) {
    sendTelemetryToServer(userId, payload);
  } else {
    broadcastTelemetryOverWebRTC(userId, payload);
  }
}

function computeSummaryForUser(userId) {
  const session = getCurrentSession();
  if (!session) return null;
  const agg = session.aggregates?.[userId];
  if (!agg || agg.sampleCount === 0) return null;

  return {
    avgPower: agg.totalPower / agg.sampleCount,
    maxPower: agg.maxPower,
    avgHeartRate: agg.totalHeartRate / agg.sampleCount,
    totalDistance: agg.totalDistance,
    totalClimbMeters: agg.totalClimb || 0,
  };
}

function computeSessionSummary() {
  const session = getCurrentSession();
  if (!session) return null;

  const endedAt = session.endedAt || currentMs();
  const durationSec = Math.round((endedAt - (session.startedAt || endedAt)) / 1000);

  const users = Object.values(session.users || {});
  const participants = users.map((user) => {
    const summary = computeSummaryForUser(user.id) || {};
    const participantSummary = {
      avgPower: summary.avgPower || 0,
      maxPower: summary.maxPower || 0,
      avgHeartRate: summary.avgHeartRate || 0,
      totalDistance: summary.totalDistance || 0,
      totalClimbMeters: summary.totalClimbMeters || 0,
    };
    return {
      id: user.id,
      name: user.name,
      weight: user.weight,
      ...participantSummary,
      caloriesBurned: calculateSessionCalories({ durationSec }, participantSummary).caloriesBurned,
    };
  });
  const computedSessionClimbMeters = participants.reduce((total, participant) => total + (Number(participant.totalClimbMeters) || 0), 0);
  const totalCaloriesBurned = participants.reduce((total, participant) => total + normalizeCaloriesValue(participant.caloriesBurned), 0);
  const totalClimbedMeters = Number.isFinite(session.totalClimbedMeters) ? session.totalClimbedMeters : computedSessionClimbMeters;

  return {
    code: session.code,
    hostId: session.hostId,
    startedAt: session.startedAt,
    endedAt: session.endedAt || currentMs(),
    durationSec,
    totalClimbedMeters,
    totalCaloriesBurned,
    xpAwards: cloneJson(session.xpAwards || {}),
    calorieAwards: cloneJson(session.calorieAwards || {}),
    participants,
  };
}

function computeSummaryRollup(summary) {
  const participants = Array.isArray(summary?.participants) ? summary.participants : [];
  let totalDistanceMeters = 0;
  let totalClimbMeters = null;
  let heartRateSum = 0;
  let heartRateCount = 0;

  participants.forEach((participant) => {
    const distance = Number(participant?.totalDistance);
    if (Number.isFinite(distance) && distance > 0) {
      totalDistanceMeters += distance;
    }

    const climb = Number(participant?.totalClimbMeters);
    if (Number.isFinite(climb) && climb >= 0) {
      totalClimbMeters = (totalClimbMeters || 0) + climb;
    }

    const avgHeartRate = Number(participant?.avgHeartRate);
    if (Number.isFinite(avgHeartRate) && avgHeartRate > 0) {
      heartRateSum += avgHeartRate;
      heartRateCount += 1;
    }
  });

  const summaryTotalClimb = Number(summary?.totalClimbedMeters);
  if (Number.isFinite(summaryTotalClimb) && summaryTotalClimb >= 0) {
    totalClimbMeters = summaryTotalClimb;
  }

  return {
    totalDistanceMeters,
    averageHeartRate: heartRateCount > 0 ? heartRateSum / heartRateCount : null,
    totalClimbMeters,
  };
}

function applySessionXpForCurrentUser(summary) {
  const userId = state.account.userId;
  const session = getCurrentSession();
  if (!summary || !userId || !session) return null;
  const latestSession = loadSessionFromStorage(session.code) || session;

  latestSession.xpAwards = latestSession.xpAwards || {};
  if (latestSession.xpAwards[userId]) {
    summary.xpAwards = summary.xpAwards || {};
    summary.xpAwards[userId] = latestSession.xpAwards[userId];
    state.session = latestSession;
    return latestSession.xpAwards[userId];
  }

  const participant = (summary.participants || []).find((item) => item.id === userId);
  if (!participant) return null;

  const profiles = loadProfiles();
  const existingProfile = profiles[userId];
  if (!existingProfile) return null;

  const applied = applySessionXpToProfile(existingProfile, summary, participant);
  const updatedProfile = {
    ...applied.profile,
    updatedAt: currentMs(),
  };
  profiles[userId] = updatedProfile;
  saveProfiles(profiles);
  upsertPublicProfile(updatedProfile);

  const xpAward = {
    ...applied.xpAward,
    userId,
    sessionCode: summary.code,
  };
  latestSession.xpAwards[userId] = xpAward;
  saveSessionToStorage(latestSession);
  state.session = latestSession;

  summary.xpAwards = summary.xpAwards || {};
  summary.xpAwards[userId] = xpAward;
  return xpAward;
}

function applySessionCaloriesForCurrentUser(summary) {
  const userId = state.account.userId;
  const session = getCurrentSession();
  if (!summary || !userId || !session) return null;
  const latestSession = loadSessionFromStorage(session.code) || session;

  latestSession.calorieAwards = latestSession.calorieAwards || {};
  if (latestSession.calorieAwards[userId]) {
    summary.calorieAwards = summary.calorieAwards || {};
    summary.calorieAwards[userId] = latestSession.calorieAwards[userId];
    state.session = latestSession;
    return latestSession.calorieAwards[userId];
  }

  const participant = (summary.participants || []).find((item) => item.id === userId);
  if (!participant) return null;

  const profiles = loadProfiles();
  const existingProfile = profiles[userId];
  if (!existingProfile) return null;

  const applied = applySessionCaloriesToProfile(existingProfile, summary, participant);
  const updatedProfile = {
    ...applied.profile,
    updatedAt: currentMs(),
  };
  profiles[userId] = updatedProfile;
  saveProfiles(profiles);
  upsertPublicProfile(updatedProfile);

  const calorieAward = {
    ...applied.calorieAward,
    userId,
    sessionCode: summary.code,
  };
  latestSession.calorieAwards[userId] = calorieAward;
  saveSessionToStorage(latestSession);
  state.session = latestSession;

  summary.calorieAwards = summary.calorieAwards || {};
  summary.calorieAwards[userId] = calorieAward;
  return calorieAward;
}

function persistSessionSummary(summaryInput = null) {
  const summary = summaryInput || computeSessionSummary();
  if (!summary) return;

  const existing = loadSummaries();
  const filtered = existing.filter((item) => item.code !== summary.code);
  filtered.unshift(summary);
  saveSummaries(filtered.slice(0, 20));
  return summary;
}

function startSession() {
  updateSessionOnStorage((session) => {
    if (!session.startedAt) {
      session.startedAt = currentMs();
      session.endedAt = null;
    }
  });
  sendSessionCommand("session-start");
  state.simulation.lastSmoothedGrade = 0;
  showToast("Session started");
}

function endSession() {
  updateSessionOnStorage((session) => {
    if (session.startedAt && !session.endedAt) {
      session.endedAt = currentMs();
    }
  });
  sendSessionCommand("session-end");
  const summary = computeSessionSummary();
  if (summary) {
    applySessionXpForCurrentUser(summary);
    applySessionCaloriesForCurrentUser(summary);
    persistSessionSummary(summary);
  } else {
    persistSessionSummary();
  }
  if (state.webrtc.code) {
    cleanupSignaling(state.webrtc.code);
  }
  closeWebRTCPeers();
  resetFtpProposalState();
  state.view = "summary";
  state.simulation.lastSmoothedGrade = 0;
  showToast("Session ended");
  render();
}

function leaveSession() {
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user) return;

  updateSessionOnStorage((s) => {
    delete s.users?.[user.id];
    delete s.telemetry?.[user.id];
    delete s.aggregates?.[user.id];
  });

  clearLocalSession();
  closeWebRTCPeers();
  resetPrivateRiderStats();
  resetPowerUpState();
  resetFtpProposalState();
  state.user = null;
  state.session = null;
  state.view = "lobby";
  state.simulation.lastSmoothedGrade = 0;
  render();
}

function pollTelemetry() {
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user) return;

  const now = currentMs();
  const previous = session.telemetry?.[user.id] || { distance: 0, timestamp: now };
  const sample = getTelemetrySampling();
  if (!sample) return;

  const courseSegments = getCourseSegments(session);
  const previousDistance = Number(previous.distance) || 0;
  const gradeContext = getCourseGradeContext(previousDistance, courseSegments);
  const gradientScale = clamp(state.simulation.gradientScale, 0, 1);
  const currentGrade = gradeContext.currentGrade;
  const targetEffectiveGrade = currentGrade * gradientScale;
  const smoothedGrade = smoothToward(
    Number.isFinite(state.simulation.lastSmoothedGrade) ? state.simulation.lastSmoothedGrade : targetEffectiveGrade,
    targetEffectiveGrade,
    state.simulation.gradeSmoothing,
    sample.deltaSeconds,
  );
  state.simulation.lastSmoothedGrade = smoothedGrade;

  const power = sample.power ?? previous.power ?? 0;
  const heartRate = sample.heartRate ?? previous.heartRate ?? 0;
  const cadence = sample.cadence ?? previous.cadence ?? 0;
  const privateStats = ensurePrivateRiderStatsContext(session, user);
  const powerUpState = ensurePowerUpContext(session, user);
  const activePowerUp = getActivePowerUp(powerUpState, now);
  const previousSpeed = Number.isFinite(privateStats?.latestSpeedMps) ? privateStats.latestSpeedMps : sample.speedMps ?? 6;
  const targetSpeed = computeTargetSpeedFromPowerAndGrade(power, smoothedGrade, user.weight, user.bikeId);
  const speedAfterPhysics = smoothToward(previousSpeed, targetSpeed, state.simulation.speedSmoothing, sample.deltaSeconds);
  const speedMps = applyPowerUpEffects(speedAfterPhysics, activePowerUp);
  const resistancePercent = mapGradeToResistancePercent(smoothedGrade);
  const resistanceLabel = getResistanceFeelLabel(resistancePercent);
  const trainerControlStatus = getTrainerControlStatusText();
  const activePowerUpPayload = serializeActivePowerUp(activePowerUp);

  const telemetry = {
    power,
    heartRate,
    cadence,
    speedMps,
    grade: currentGrade,
    effectiveGrade: smoothedGrade,
    resistancePercent,
    resistanceLabel,
    activePowerUp: activePowerUpPayload,
    deltaTimeSeconds: sample.deltaSeconds,
    timestamp: now,
  };

  const distance = computeDistanceMeters(previousDistance, speedMps, sample.deltaSeconds);
  grantPowerUpsFromDistance(powerUpState, distance);
  updateTerrainState({
    currentGrade,
    effectiveGrade: smoothedGrade,
    nextGrade: gradeContext.nextGrade,
    distanceToNext: gradeContext.distanceToNext,
    routeDistance: gradeContext.routeDistance,
    resistancePercent,
    resistanceLabel,
    trainerControlStatus,
  });

  void sendResistanceToTrainer(smoothedGrade);
  // Keep rider peak-power/speed stats local only. Do not sync these to shared session data.
  recordPrivateRiderTelemetrySample(telemetry, session, user);
  evaluateFtpProposalFromCurrentEffort(session, user);
  addTelemetrySample(user.id, telemetry, distance);
  // Host simulates bot riders so all clients receive shared pacing/challenge telemetry.
  simulateBotsForCurrentSession(sample.deltaSeconds, now);
}

function syncSessionFromStorage(event) {
  if (!event.key) return;

  // Process localStorage-based WebRTC signaling only when the fallback is in use.
  if (state.webrtc.useLocalStorage) {
    handleSignalingEvent(event);
  }

  if (!state.session) return;
  const expectedKey = SESSION_STORE_KEY(state.session.code);
  if (event.key !== expectedKey) return;
  if (!event.newValue) return;
  const wasRunningBeforeUpdate = !!(state.session.startedAt && !state.session.endedAt);

  const updated = safeJsonParse(event.newValue);
  if (!updated) return;
  if (!Number.isFinite(updated.totalClimbedMeters)) {
    updated.totalClimbedMeters = 0;
  }
  normalizeSessionCourse(updated);

  state.session = updated;

  // Ensure each participant can get their own local XP award when the session transitions to ended.
  if (updated.endedAt && wasRunningBeforeUpdate) {
    const summary = computeSessionSummary();
    if (summary) {
      applySessionXpForCurrentUser(summary);
      applySessionCaloriesForCurrentUser(summary);
      persistSessionSummary(summary);
    }
  }

  // If the session just ended, move to the summary screen.
  if (updated.endedAt && state.view === "session") {
    state.view = "summary";
  }

  // When host detects a new participant, start the WebRTC handshake.
  if (state.webrtc.useLocalStorage) {
    handleNewPeerFromSession(updated);
  }
  render();
}

function stopSessionSideScrollRenderLoop() {
  if (state.visualLoop?.sideScrollRafId != null) {
    window.cancelAnimationFrame(state.visualLoop.sideScrollRafId);
  }
  state.visualLoop.sideScrollRafId = null;
  state.visualLoop.lastSideScrollFrameAt = 0;
}

function shouldDeferSessionRender() {
  if (state.view !== "session") return false;
  if (state.session?.startedAt) return false;
  const activeEl = document.activeElement;
  if (!activeEl || typeof activeEl.matches !== "function") return false;
  return activeEl.matches("[data-session-bot-difficulty]");
}

function flushDeferredSessionRender() {
  if (!state.sessionRenderDeferred) return;
  if (shouldDeferSessionRender()) return;
  state.sessionRenderDeferred = false;
  render({ force: true });
}

function startSessionSideScrollRenderLoop() {
  if (state.view !== "session") {
    stopSessionSideScrollRenderLoop();
    return;
  }
  if (state.visualLoop?.sideScrollRafId != null) return;

  const tick = (frameAtMs) => {
    if (state.view !== "session") {
      stopSessionSideScrollRenderLoop();
      return;
    }

    const lastFrameAt = Number(state.visualLoop.lastSideScrollFrameAt) || 0;
    if (lastFrameAt === 0 || frameAtMs - lastFrameAt >= SIDE_SCROLL_RENDER_INTERVAL_MS) {
      updateSessionSideScrollMount({ predictMotion: true, nowMs: currentMs() });
      state.visualLoop.lastSideScrollFrameAt = frameAtMs;
    }

    state.visualLoop.sideScrollRafId = window.requestAnimationFrame(tick);
  };

  state.visualLoop.lastSideScrollFrameAt = 0;
  state.visualLoop.sideScrollRafId = window.requestAnimationFrame(tick);
}

function render(options = {}) {
  const force = !!options?.force;
  hideWorkoutTooltip();
  const session = getCurrentSession();
  const user = getCurrentUser();

  // Keep the pairing screen independent of whether a session exists.
  if (state.view !== "pairing" && (!session || !user)) {
    state.view = "lobby";
  }

  if (!force && shouldDeferSessionRender()) {
    state.sessionRenderDeferred = true;
    return;
  }
  if (state.view !== "session") {
    state.sessionRenderDeferred = false;
  }

  if (state.view === "lobby") {
    stopSessionSideScrollRenderLoop();
    renderLobby();
  } else if (state.view === "session") {
    state.sessionRenderDeferred = false;
    renderSession();
  } else if (state.view === "summary") {
    stopSessionSideScrollRenderLoop();
    renderSummary();
  } else if (state.view === "pairing") {
    stopSessionSideScrollRenderLoop();
    renderPairing();
  }
}

function openPairing(returnView = "lobby") {
  state.pairingReturnView = returnView;
  state.view = "pairing";
  render();
}

function makePlaceholderGeneratedRoute(distanceKm, hilliness) {
  const resolvedDistanceKm = normalizeGeneratedRouteDistanceKm(distanceKm);
  const totalDistanceMeters = Math.round(resolvedDistanceKm * 1000);
  const resolvedHilliness = normalizeGeneratedHilliness(hilliness);
  return ensureRoutePresetShape(
    {
      id: GENERATED_ROUTE_ID,
      name: GENERATED_ROUTE_NAME,
      country: GENERATED_ROUTE_COUNTRY,
      distanceKm: resolvedDistanceKm,
      elevationGainM: 0,
      totalDescentM: 0,
      startElevationM: 0,
      summitElevationM: 0,
      avgGradientPct: 0,
      maxGradientPct: 0,
      totalDistanceMeters,
      courseSegments: [{ startDistance: 0, endDistance: totalDistanceMeters, grade: 0 }],
      elevationProfile: [
        { distanceFromStartM: 0, elevationM: 0, gradientPct: 0 },
        { distanceFromStartM: totalDistanceMeters, elevationM: 0, gradientPct: 0 },
      ],
      hillinessPreset: resolvedHilliness,
    },
    DEFAULT_ROUTE_PRESET,
  );
}

function generateLobbyRouteDraft(distanceKmInput, hillinessInput) {
  const resolvedDistanceKm = normalizeGeneratedRouteDistanceKm(distanceKmInput);
  const resolvedHilliness = normalizeGeneratedHilliness(hillinessInput);
  const generatedRoute = createGeneratedRoutePreset({
    distanceKm: resolvedDistanceKm,
    hilliness: resolvedHilliness,
    id: GENERATED_ROUTE_ID,
    name: GENERATED_ROUTE_NAME,
    country: GENERATED_ROUTE_COUNTRY,
  });
  if (!generatedRoute) return null;

  const validation = validateGeneratedRoute(generatedRoute, resolvedDistanceKm, resolvedHilliness);
  generatedRoute._validation = validation;
  state.lobby.generatedRouteDistanceKm = resolvedDistanceKm;
  state.lobby.generatedRouteHilliness = resolvedHilliness;
  state.lobby.generatedRouteDraft = generatedRoute;
  return generatedRoute;
}

function getLobbyGeneratedPreviewRoute() {
  const draft = state.lobby.generatedRouteDraft ? ensureRoutePresetShape(state.lobby.generatedRouteDraft) : null;
  if (draft) return draft;
  const confirmed = state.lobby.generatedRouteConfirmed ? ensureRoutePresetShape(state.lobby.generatedRouteConfirmed) : null;
  if (confirmed) return confirmed;
  return makePlaceholderGeneratedRoute(state.lobby.generatedRouteDistanceKm, state.lobby.generatedRouteHilliness);
}

function getLobbySelectedRoute(routeSelectionModeInput = null) {
  const routeSelectionMode = normalizeRouteSelectionMode(routeSelectionModeInput ?? state.lobby.routeSelectionMode);
  if (routeSelectionMode === "generated") {
    return getLobbyGeneratedPreviewRoute();
  }
  const selectedRouteId =
    state.lobby.selectedRouteId && state.lobby.selectedRouteId !== GENERATED_ROUTE_ID
      ? state.lobby.selectedRouteId
      : DEFAULT_ROUTE_PRESET.id;
  return getRoutePresetById(selectedRouteId);
}

function renderLobby() {
  const summaries = loadSummaries();
  const savedWorkouts = loadWorkouts();
  state.lobby.workoutDraftName = normalizeWorkoutName(state.lobby.workoutDraftName);
  state.lobby.workoutDraftNotes = normalizeWorkoutNotes(state.lobby.workoutDraftNotes);
  state.lobby.workoutDraftTags = normalizeWorkoutTags(state.lobby.workoutDraftTags);
  state.lobby.workoutDraftSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
  state.lobby.workoutSelection = normalizeWorkoutSelection(state.lobby.workoutSelection, state.lobby.workoutDraftSegments);
  state.lobby.workoutEditingId =
    state.lobby.workoutEditingId != null && String(state.lobby.workoutEditingId).trim()
      ? String(state.lobby.workoutEditingId).trim()
      : null;
  state.lobby.savedWorkoutNotesView =
    state.lobby.savedWorkoutNotesView &&
    typeof state.lobby.savedWorkoutNotesView === "object" &&
    String(state.lobby.savedWorkoutNotesView.workoutId || "").trim() !== ""
      ? {
          workoutId: String(state.lobby.savedWorkoutNotesView.workoutId).trim(),
          name: normalizeWorkoutName(state.lobby.savedWorkoutNotesView.name),
          notes: normalizeWorkoutNotes(state.lobby.savedWorkoutNotesView.notes),
        }
      : null;
  state.lobby.workoutRatingModal =
    state.lobby.workoutRatingModal &&
    typeof state.lobby.workoutRatingModal === "object" &&
    String(state.lobby.workoutRatingModal.workoutId || "").trim() !== ""
      ? {
          workoutId: String(state.lobby.workoutRatingModal.workoutId).trim(),
          selectedRating: normalizeWorkoutRating(state.lobby.workoutRatingModal.selectedRating, null),
        }
      : null;
  state.lobby.workoutDeleteModal =
    state.lobby.workoutDeleteModal &&
    typeof state.lobby.workoutDeleteModal === "object" &&
    String(state.lobby.workoutDeleteModal.workoutId || "").trim() !== ""
      ? {
          workoutId: String(state.lobby.workoutDeleteModal.workoutId).trim(),
          name: normalizeWorkoutName(state.lobby.workoutDeleteModal.name),
        }
      : null;
  const selectedWorkoutEntity = getSelectedWorkoutEntity(state.lobby.workoutDraftSegments, state.lobby.workoutSelection);
  const selectedWorkoutSegment = selectedWorkoutEntity.segment;
  const selectedWorkoutSet = selectedWorkoutEntity.setItem;
  const selectedWorkoutSelection = selectedWorkoutEntity.selection;
  const workoutDraftTotalDurationSeconds = computeWorkoutTotalDurationSeconds(state.lobby.workoutDraftSegments);
  const workoutConfiguredSegmentCount = countWorkoutConfiguredSegments(state.lobby.workoutDraftSegments);
  const previousSummaryCodes = Array.isArray(state.lobby.recentSessionsKnownCodes) ? state.lobby.recentSessionsKnownCodes : [];
  const currentSummaryCodes = summaries.map((summary) => String(summary?.code || ""));
  const previousCodeSet = new Set(previousSummaryCodes);
  const hasNewSummary =
    previousSummaryCodes.length > 0 && currentSummaryCodes.some((code) => code && !previousCodeSet.has(code));
  state.lobby.recentSessionsKnownCodes = currentSummaryCodes;
  const paginatedSummaries = getPaginatedSessions(
    summaries,
    hasNewSummary ? 1 : state.lobby.recentSessionsPage,
    RECENT_SESSIONS_PAGE_SIZE,
  );
  state.lobby.recentSessionsPage = paginatedSummaries.currentPage;
  const showRecentSessionsPagination = summaries.length > RECENT_SESSIONS_PAGE_SIZE;
  const showingStart = summaries.length === 0 ? 0 : paginatedSummaries.startIndex + 1;
  const showingEnd = Math.min(paginatedSummaries.endIndex, summaries.length);
  const profile = getCurrentAccountProfile();
  const loggedIn = isAuthenticated() && !!profile;
  const bluetoothSupported = isWebBluetoothSupported();
  const defaultName = profile?.displayName || "";
  const defaultWeightKg = profile?.weightKg != null && Number.isFinite(profile.weightKg) ? formatNumber(profile.weightKg, 1).replace(/\.0$/, "") : "";
  const accountGradientScalePct = Math.round(clamp(state.simulation.gradientScale, 0, 1) * 100);
  const identityLockedAttr = loggedIn ? 'readonly aria-readonly="true" class="locked-identity-field"' : "";
  const identityLockedHint = loggedIn
    ? `<div class="small" style="margin-top:8px;">Signed in account values are locked here. Use Account > Edit profile to change them.</div>`
    : "";
  state.lobby.selectedBikeId = normalizeBikeId(state.lobby.selectedBikeId || DEFAULT_BIKE_ID);
  const selectedBikeId = normalizeBikeId(state.lobby.selectedBikeId);
  const bikeOptionsHtml = buildBikeOptionsHtml(selectedBikeId);
  const selectedBikeDetailsHtml = renderBikeDetailsHtml(selectedBikeId);
  const legacyGeneratedSelected = state.lobby.selectedRouteId === GENERATED_ROUTE_ID;
  state.lobby.selectedRouteId =
    state.lobby.selectedRouteId && state.lobby.selectedRouteId !== GENERATED_ROUTE_ID ? state.lobby.selectedRouteId : DEFAULT_ROUTE_PRESET.id;
  state.lobby.routeSelectionMode =
    state.lobby.routeSelectionMode != null
      ? normalizeRouteSelectionMode(state.lobby.routeSelectionMode)
      : legacyGeneratedSelected
        ? "generated"
        : "preset";
  state.lobby.generatedRouteDistanceKm = normalizeGeneratedRouteDistanceKm(state.lobby.generatedRouteDistanceKm);
  state.lobby.generatedRouteHilliness = normalizeGeneratedHilliness(state.lobby.generatedRouteHilliness);
  const routeSelectionMode = normalizeRouteSelectionMode(state.lobby.routeSelectionMode);
  if (
    routeSelectionMode === "generated" &&
    !state.lobby.generatedRouteDraft &&
    !state.lobby.generatedRouteConfirmed &&
    ROUTE_GENERATOR_SERVICE?.generateRoutePreset
  ) {
    generateLobbyRouteDraft(state.lobby.generatedRouteDistanceKm, state.lobby.generatedRouteHilliness);
  }
  const selectedRoute = getLobbySelectedRoute(routeSelectionMode);
  const selectedRoutePreviewHtml = renderRoutePresetPreview(selectedRoute);
  const isGeneratedSelected = routeSelectionMode === "generated";
  const generatedDraft = state.lobby.generatedRouteDraft ? ensureRoutePresetShape(state.lobby.generatedRouteDraft) : null;
  const generatedConfirmed = state.lobby.generatedRouteConfirmed ? ensureRoutePresetShape(state.lobby.generatedRouteConfirmed) : null;
  const generatedDistanceKm = normalizeGeneratedRouteDistanceKm(state.lobby.generatedRouteDistanceKm);
  const generatedHilliness = normalizeGeneratedHilliness(state.lobby.generatedRouteHilliness);
  const generatedOptionsHtml = GENERATED_HILLINESS_KEYS.map(
    (key) => `<option value="${key}" ${key === generatedHilliness ? "selected" : ""}>${escapeHtml(getGeneratedHillinessLabel(key))}</option>`,
  ).join("");
  const generatedDraftMatchesInputs =
    !!generatedDraft &&
    Math.abs((Number(generatedDraft.distanceKm) || 0) - generatedDistanceKm) < 0.01 &&
    normalizeGeneratedHilliness(generatedDraft.hillinessPreset) === generatedHilliness;
  const generatedValidation =
    generatedDraft?._validation || (generatedDraft ? validateGeneratedRoute(generatedDraft, generatedDistanceKm, generatedHilliness) : null);
  const generatedConfirmMatchesDraft =
    generatedDraft &&
    generatedConfirmed &&
    generatedDraft.generatedAt &&
    generatedConfirmed.generatedAt &&
    generatedDraft.generatedAt === generatedConfirmed.generatedAt;
  const generatedStatus = !ROUTE_GENERATOR_SERVICE?.generateRoutePreset
    ? "Route generator service is unavailable. Ensure route-generator.js is loaded."
    : generatedValidation && !generatedValidation.valid
      ? `Validation: ${generatedValidation.errors[0] || "Generated route failed validation."}`
      : generatedDraft && !generatedDraftMatchesInputs
        ? "Inputs changed. Click Regenerate to update the route preview."
        : generatedDraft && !generatedConfirmMatchesDraft
          ? "Preview ready. Click Use Generated Route to confirm."
          : generatedConfirmed
            ? "Generated route confirmed and ready for session start."
            : "Generate a route, review the profile, then confirm.";
  state.lobby.botDrafts = normalizeBotDrafts(state.lobby.botDrafts);
  const botDrafts = state.lobby.botDrafts;
  const canAddMoreBots = botDrafts.length < MAX_SESSION_BOTS;
  const botRowsHtml = botDrafts
    .map((botDraft) => {
      const difficultyOptions = buildBotDifficultyOptionsHtml(botDraft.difficultyLevel);
      return `
        <div class="card" style="margin-top:10px;">
          <div class="flex-space">
            <div>
              <div><strong>${escapeHtml(botDraft.name)}</strong></div>
              <div class="small">Pacing rider | FTP target updates with difficulty.</div>
            </div>
            <button type="button" class="secondary" data-remove-bot-draft="${botDraft.id}">Remove</button>
          </div>
          <div class="flex" style="gap:12px;flex-wrap:wrap;margin-top:10px;">
            <div style="flex:1;min-width:220px;">
              <label class="label">Difficulty</label>
              <select data-bot-difficulty-id="${botDraft.id}">${difficultyOptions}</select>
            </div>
            <div style="flex:1;min-width:160px;">
              <label class="label">FTP</label>
              <div class="code">${Math.round(Number(botDraft.ftpWatts) || 0)} W</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
  const addBotButtonText = canAddMoreBots ? `Add Bot (${botDrafts.length}/${MAX_SESSION_BOTS})` : `Bots full (${MAX_SESSION_BOTS}/${MAX_SESSION_BOTS})`;
  const createRouteOptions = ROUTE_PRESETS.map(
    (route) =>
      `<option value="${route.id}" ${route.id === state.lobby.selectedRouteId ? "selected" : ""}>${escapeHtml(route.name)} (${escapeHtml(route.country)})</option>`,
  ).join("");
  const profileAge = profile ? (profile.age != null ? profile.age : computeAgeFromDob(profile.dateOfBirth)) : null;
  const profileHeightText = profile ? formatProfileHeight(profile) : "--";
  const profileHeightUnit = profile?.heightUnit === "ft_in" ? "ft_in" : "cm";
  const profileHeightCmValue = profile?.heightCm != null && Number.isFinite(profile.heightCm)
    ? formatNumber(profile.heightCm, 1).replace(/\.0$/, "")
    : profile?.height != null && Number.isFinite(profile.height) && profileHeightUnit === "cm"
      ? formatNumber(profile.height, 1).replace(/\.0$/, "")
      : "";
  const profileTotalInches = profile?.height != null && Number.isFinite(profile.height) ? profile.height : null;
  const profileHeightFeetValue = profile?.heightFeet != null && Number.isFinite(profile.heightFeet)
    ? String(Math.floor(profile.heightFeet))
    : profileTotalInches != null
      ? String(Math.floor(profileTotalInches / 12))
      : "";
  const profileHeightInchesValue = profile?.heightInches != null && Number.isFinite(profile.heightInches)
    ? formatNumber(profile.heightInches, 1).replace(/\.0$/, "")
    : profileTotalInches != null
      ? formatNumber(profileTotalInches - Math.floor(profileTotalInches / 12) * 12, 1).replace(/\.0$/, "")
      : "";
  const profileFtpWatts = profile ? getUserFtp(profile) : null;
  const profileFtpInputValue = profileFtpWatts != null ? String(profileFtpWatts) : "";
  const workoutFtpOverrideValidation = validateFtp(state.lobby.workoutFtpOverrideWatts, { allowNull: true });
  const workoutFtpOverrideWatts = workoutFtpOverrideValidation.valid ? workoutFtpOverrideValidation.value : null;
  state.lobby.workoutFtpOverrideWatts = workoutFtpOverrideWatts;
  const workoutFtpSourceWatts = workoutFtpOverrideWatts != null ? workoutFtpOverrideWatts : profileFtpWatts;
  const workoutUsingAssumedFtp = workoutFtpSourceWatts == null;
  const workoutFtpWatts = normalizeWorkoutFtpWatts(workoutFtpSourceWatts, WORKOUT_DEFAULT_FTP_WATTS);
  const profileProgress = profile ? getProgressToNextLevel(profile.totalXp) : null;
  const profileLevel = profileProgress?.currentLevel || 1;
  const profileNextLevel = profileProgress?.nextLevel || Math.min(MAX_PLAYER_LEVEL, profileLevel + 1);
  const profileXpInLevel = profileProgress?.currentXp || 0;
  const profileXpRequired = profileProgress?.xpRequiredForNextLevel || getXpRequiredForLevelTransition(1);
  const profileProgressPercent = profileProgress?.levelProgressPercent || 0;
  const isMaxProfileLevel = !!profileProgress?.isMaxLevel;

  let accountCard = "";
  if (!loggedIn) {
    accountCard = `
      <div class="card">
        <h2>Account</h2>
        <p class="small">Create an account or log in. This basic MVP stores account data locally.</p>
        <div class="flex" style="gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:240px;">
            <label class="label">Email</label>
            <input id="authEmail" placeholder="you@example.com" type="email" />
          </div>
          <div style="flex:1;min-width:240px;">
            <label class="label">Password</label>
            <input id="authPassword" placeholder="min 6 characters" type="password" />
          </div>
        </div>
        <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
          <button id="signupBtn">Sign up</button>
          <button id="loginBtn" class="secondary">Log in</button>
          <button id="resetBtn" class="secondary">Reset password</button>
        </div>
        <div class="card" style="margin-top:12px;">
          <h2>Simulation Settings</h2>
          <div class="small">Controls how strongly route grade affects simulated resistance and speed.</div>
          <div style="margin-top:10px;">
            <label class="label" for="accountGradientScaleRange">Gradient scale (<span id="accountGradientScaleValue">${accountGradientScalePct}%</span>)</label>
            <input id="accountGradientScaleRange" type="range" min="0" max="100" step="5" value="${accountGradientScalePct}" />
          </div>
        </div>
      </div>
    `;
  } else {
    const friendContext = getFriendContext(state.account.userId);
    const incomingRows = friendContext.incoming
      .map((req) => {
        const from = friendContext.getProfile(req.fromUserId) || { displayName: "Rider", email: "" };
        return `
          <tr>
            <td>${escapeHtml(from.displayName)}</td>
            <td>${escapeHtml(from.email || "")}</td>
            <td>
              <button class="secondary" data-accept-request="${req.id}">Accept</button>
              <button class="secondary" data-reject-request="${req.id}" style="margin-left:6px;">Reject</button>
            </td>
          </tr>
        `;
      })
      .join("");

    const outgoingRows = friendContext.outgoing
      .map((req) => {
        const to = friendContext.getProfile(req.toUserId) || { displayName: "Rider", email: "" };
        return `
          <tr>
            <td>${escapeHtml(to.displayName)}</td>
            <td>${escapeHtml(to.email || "")}</td>
            <td><button class="secondary" data-cancel-request="${req.id}">Cancel</button></td>
          </tr>
        `;
      })
      .join("");

    const friendRows = friendContext.friendIds
      .map((friendUserId) => {
        const friend = friendContext.getProfile(friendUserId) || { displayName: "Rider", email: "" };
        return `
          <tr>
            <td>${escapeHtml(friend.displayName)}</td>
            <td>${escapeHtml(friend.email || "")}</td>
            <td><button class="secondary" data-remove-friend="${friendUserId}">Remove</button></td>
          </tr>
        `;
      })
      .join("");

    const searchResults = searchUsers(state.account.friendSearchQuery, state.account.userId);
    const searchRows = searchResults
      .map(
        (p) => `
          <tr>
            <td>${escapeHtml(p.displayName || "Rider")}</td>
            <td>${escapeHtml(p.email || "")}</td>
            <td><button class="secondary" data-send-request="${p.userId}">Add</button></td>
          </tr>
        `,
      )
      .join("");

    const avatarCoreHtml = profile.profilePhotoUrl
      ? `<img src="${escapeHtml(profile.profilePhotoUrl)}" alt="Profile avatar" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" />`
      : `<div class="code" style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${escapeHtml(
          (profile.displayName || "R").slice(0, 2).toUpperCase(),
        )}</div>`;
    const avatarHtml = `
      <div class="profile-avatar-shell">
        ${avatarCoreHtml}
        <div class="profile-level-badge">Lv ${profileLevel}</div>
      </div>
    `;

    accountCard = `
      <div class="card">
        <div class="flex-space">
          <div>
            <h2>Account</h2>
            <div class="small">${escapeHtml(profile.email)}</div>
          </div>
          <button id="logoutBtn" class="secondary">Log out</button>
        </div>

        <div class="flex" style="gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          ${avatarHtml}
          <div>
            <div><strong>${escapeHtml(profile.displayName || "Rider")}</strong></div>
            <div class="small">
              Age: ${profileAge ?? "--"} | Weight: ${profile.weight ?? "--"} ${escapeHtml(profile.weightUnit || "kg")} | Height: ${escapeHtml(profileHeightText)}
            </div>
            <div class="small">FTP: ${profileFtpWatts != null ? `${profileFtpWatts} W` : "Set your FTP"}</div>
            <div class="small" style="margin-top:6px;"><strong>Level ${profileLevel}</strong></div>
            <div class="level-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(
              profileProgressPercent,
            )}">
              <div class="level-progress-fill" style="width:${formatNumber(profileProgressPercent, 2)}%;"></div>
            </div>
            <div class="small">
              ${
                isMaxProfileLevel
                  ? `Max level reached (${MAX_PLAYER_LEVEL})`
                  : `${formatNumber(profileXpInLevel, 0)} / ${formatNumber(profileXpRequired, 0)} XP to Level ${profileNextLevel}`
              }
            </div>
            <div class="small">Total XP: ${formatNumber(profileProgress?.totalXp || 0, 0)}</div>
            <div class="small">Total Calories Burned: ${formatCalories(profile.totalCaloriesBurned)}</div>
          </div>
        </div>

        <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
          <button id="toggleProfileBtn" class="secondary">${state.account.showProfileEditor ? "Hide profile editor" : "Edit profile"}</button>
          <button id="toggleFriendsBtn" class="secondary">${state.account.showFriendsPanel ? "Hide friends" : "Manage friends"}</button>
        </div>

        <div class="card" style="margin-top:12px;">
          <h2>Simulation Settings</h2>
          <div class="small">Controls how strongly route grade affects simulated resistance and speed.</div>
          <div style="margin-top:10px;">
            <label class="label" for="accountGradientScaleRange">Gradient scale (<span id="accountGradientScaleValue">${accountGradientScalePct}%</span>)</label>
            <input id="accountGradientScaleRange" type="range" min="0" max="100" step="5" value="${accountGradientScalePct}" />
          </div>
        </div>

        ${
          state.account.showProfileEditor
            ? `
          <div class="card" style="margin-top:12px;">
            <h2>Edit Profile</h2>
            <div class="flex" style="gap:12px;flex-wrap:wrap;">
              <div style="flex:1;min-width:220px;">
                <label class="label">Display name</label>
                <input id="profileDisplayName" value="${escapeHtml(profile.displayName || "")}" />
              </div>
              <div style="flex:1;min-width:120px;">
                <label class="label">Date of birth</label>
                <input id="profileDob" type="date" value="${escapeHtml(profile.dateOfBirth || "")}" />
              </div>
            </div>
            <div class="flex" style="gap:12px;flex-wrap:wrap;margin-top:10px;">
              <div style="flex:1;min-width:160px;">
                <label class="label">Weight</label>
                <input id="profileWeight" type="number" min="1" step="0.1" value="${profile.weight ?? ""}" />
              </div>
              <div style="flex:1;min-width:160px;">
                <label class="label">FTP (W)</label>
                <input id="profileFtpWatts" type="number" min="${FTP_MIN_WATTS}" max="${FTP_MAX_WATTS}" step="1" value="${escapeHtml(
                  profileFtpInputValue,
                )}" />
              </div>
              <div style="flex:1;min-width:120px;">
                <label class="label">Weight unit</label>
                <select id="profileWeightUnit">
                  <option value="kg" ${profile.weightUnit === "kg" ? "selected" : ""}>kg</option>
                  <option value="lb" ${profile.weightUnit === "lb" ? "selected" : ""}>lb</option>
                </select>
              </div>
              <div style="flex:1;min-width:120px;">
                <label class="label">Height unit</label>
                <select id="profileHeightUnit">
                  <option value="cm" ${profileHeightUnit === "cm" ? "selected" : ""}>cm</option>
                  <option value="ft_in" ${profileHeightUnit === "ft_in" ? "selected" : ""}>ft_in</option>
                </select>
              </div>
              <div id="profileHeightCmWrap" style="flex:1;min-width:160px;${profileHeightUnit === "cm" ? "" : "display:none;"}">
                <label class="label">Height (cm)</label>
                <input id="profileHeightCm" type="number" min="1" step="0.1" value="${escapeHtml(profileHeightCmValue)}" />
              </div>
              <div id="profileHeightFtWrap" style="flex:1;min-width:130px;${profileHeightUnit === "ft_in" ? "" : "display:none;"}">
                <label class="label">Height (ft)</label>
                <input id="profileHeightFeet" type="number" min="0" step="1" value="${escapeHtml(profileHeightFeetValue)}" />
              </div>
              <div id="profileHeightInWrap" style="flex:1;min-width:130px;${profileHeightUnit === "ft_in" ? "" : "display:none;"}">
                <label class="label">Height (in)</label>
                <input id="profileHeightInches" type="number" min="0" max="11.9" step="0.1" value="${escapeHtml(profileHeightInchesValue)}" />
              </div>
            </div>
            <div class="small" style="margin-top:8px;">Functional Threshold Power - the maximum power you can theoretically sustain for about one hour.</div>
            <div class="small" style="margin-top:8px;">Age is calculated automatically from date of birth.</div>
            <div style="margin-top:10px;">
              <label class="label">Profile picture (jpg/png/webp)</label>
              <input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" />
            </div>
            <div style="margin-top:12px;">
              <button id="saveProfileBtn">Save profile</button>
            </div>
          </div>
        `
            : ""
        }

        ${
          state.account.showFriendsPanel
            ? `
          <div class="card" style="margin-top:12px;">
            <h2>Friends</h2>
            <div class="flex" style="gap:8px;flex-wrap:wrap;">
              <input id="friendSearchInput" placeholder="Search by email or display name" value="${escapeHtml(state.account.friendSearchQuery)}" />
              <button id="friendSearchBtn" class="secondary">Search</button>
            </div>
            <table class="table" style="margin-top:10px;">
              <thead><tr><th>Search Results</th><th>Email</th><th></th></tr></thead>
              <tbody>${searchRows || "<tr><td colspan='3' class='small'>No matches.</td></tr>"}</tbody>
            </table>

            <table class="table" style="margin-top:14px;">
              <thead><tr><th>Incoming Requests</th><th>Email</th><th></th></tr></thead>
              <tbody>${incomingRows || "<tr><td colspan='3' class='small'>No incoming requests.</td></tr>"}</tbody>
            </table>

            <table class="table" style="margin-top:14px;">
              <thead><tr><th>Outgoing Requests</th><th>Email</th><th></th></tr></thead>
              <tbody>${outgoingRows || "<tr><td colspan='3' class='small'>No outgoing requests.</td></tr>"}</tbody>
            </table>

            <table class="table" style="margin-top:14px;">
              <thead><tr><th>Friends</th><th>Email</th><th></th></tr></thead>
              <tbody>${friendRows || "<tr><td colspan='3' class='small'>No friends yet.</td></tr>"}</tbody>
            </table>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  const defaultLobbySection = loggedIn ? "create" : "account";
  state.lobby.activeSection = normalizeLobbySection(state.lobby.activeSection, defaultLobbySection);
  const activeLobbySection = state.lobby.activeSection;
  const lobbyMenuSections = [
    { id: "account", label: "Account" },
    { id: "create", label: "Create a session" },
    { id: "join", label: "Join a session" },
    { id: "devices", label: "Devices" },
    { id: "workouts", label: "Workouts" },
  ];
  const lobbyMenuHtml = `
    <div class="card lobby-menu-card">
      <div class="lobby-menu" role="tablist" aria-label="Lobby sections">
        ${lobbyMenuSections
          .map(
            (section) => `
          <button
            type="button"
            class="secondary lobby-menu-btn ${activeLobbySection === section.id ? "is-active" : ""}"
            data-lobby-section="${section.id}"
            aria-pressed="${activeLobbySection === section.id ? "true" : "false"}"
          >
            ${escapeHtml(section.label)}
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
  const createSessionCard = `
    <div class="card">
      <h2>Create a session</h2>
      <p class="small">Share the code with your friends to join. With signaling enabled, this works across devices.</p>
      <div class="flex" style="gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:240px;">
          <label class="label">Your name</label>
          <input id="createName" placeholder="e.g. Hugh" value="${escapeHtml(defaultName)}" ${identityLockedAttr} />
        </div>
        <div style="flex:1;min-width:240px;">
          <label class="label">Your weight (kg, optional)</label>
          <input id="createWeight" placeholder="e.g. 75" type="number" min="1" value="${escapeHtml(defaultWeightKg)}" ${identityLockedAttr} />
        </div>
      </div>
      <div class="flex" style="gap:12px;flex-wrap:wrap;margin-top:12px;">
        <div style="flex:1;min-width:260px;">
          <label class="label">Route type</label>
          <div class="route-source-toggle" style="margin-top:8px;">
            <label class="route-source-option">
              <input id="routeModePreset" type="radio" name="routeMode" value="preset" ${routeSelectionMode === "preset" ? "checked" : ""} />
              Preset routes
            </label>
            <label class="route-source-option">
              <input id="routeModeGenerated" type="radio" name="routeMode" value="generated" ${routeSelectionMode === "generated" ? "checked" : ""} />
              Generated route
            </label>
          </div>
        </div>
        ${
          routeSelectionMode === "preset"
            ? `
        <div style="flex:1;min-width:260px;">
          <label class="label">Map preset</label>
          <select id="createRoute">${createRouteOptions}</select>
        </div>
        `
            : ""
        }
      </div>
      ${identityLockedHint}
      ${
        isGeneratedSelected
          ? `
      <div class="generated-route-controls" style="margin-top:12px;">
        <div class="flex" style="gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div style="flex:1;min-width:170px;">
            <label class="label">Total route distance (km)</label>
            <input id="generatedRouteDistance" type="number" min="2" max="300" step="0.1" value="${escapeHtml(
              generatedDistanceKm.toFixed(1).replace(/\.0$/, ""),
            )}" />
          </div>
          <div style="flex:1;min-width:170px;">
            <label class="label">Hilliness</label>
            <select id="generatedRouteHilliness">${generatedOptionsHtml}</select>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="regenerateRouteBtn" class="secondary">Regenerate</button>
            <button id="confirmGeneratedRouteBtn">Use Generated Route</button>
          </div>
        </div>
        <div id="generatedRouteStatus" class="small" style="margin-top:8px;">${escapeHtml(generatedStatus)}</div>
      </div>
      `
          : ""
      }
      <div id="createRouteMeta" class="small" style="margin-top:8px;">
        ${escapeHtml(formatRoutePresetMeta(selectedRoute))}
      </div>
      <div id="createRouteProfile" class="elevation-profile-card" style="margin-top:10px;">
        ${selectedRoutePreviewHtml}
      </div>
      <div style="margin-top:12px;max-width:320px;">
        <label class="label">Bike choice</label>
        <select id="createBike">${bikeOptionsHtml}</select>
      </div>
      <div class="bike-choice-card" style="margin-top:12px;">
        ${selectedBikeDetailsHtml}
      </div>
      <div class="card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Bot Riders (MVP)</h2>
        <div class="small">Add up to ${MAX_SESSION_BOTS} bots before the ride starts. Each level maps to a fixed FTP target.</div>
        <div style="margin-top:10px;">
          <button id="addBotDraftBtn" type="button" class="secondary" ${canAddMoreBots ? "" : "disabled"}>${addBotButtonText}</button>
        </div>
        ${botRowsHtml || "<div class='small' style='margin-top:10px;'>No bots added yet.</div>"}
      </div>
      <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
        <button id="createBtn">Create session</button>
      </div>
    </div>
  `;
  const joinSessionCard = `
    <div class="card">
      <h2>Join a session</h2>
      <div class="flex" style="gap:12px;flex-wrap:wrap;">
        <div style="flex:1;min-width:220px;">
          <label class="label">Session code</label>
          <input id="joinCode" placeholder="ABC123" maxlength="6" />
        </div>
        <div style="flex:1;min-width:220px;">
          <label class="label">Your name</label>
          <input id="joinName" placeholder="e.g. Alex" value="${escapeHtml(defaultName)}" ${identityLockedAttr} />
        </div>
        <div style="flex:1;min-width:220px;">
          <label class="label">Your weight (kg, optional)</label>
          <input id="joinWeight" placeholder="e.g. 70" type="number" min="1" value="${escapeHtml(defaultWeightKg)}" ${identityLockedAttr} />
        </div>
        <div style="flex:1;min-width:220px;">
          <label class="label">Bike choice</label>
          <select id="joinBike">${bikeOptionsHtml}</select>
        </div>
      </div>
      ${identityLockedHint}
      <div class="bike-choice-card" style="margin-top:12px;">
        ${selectedBikeDetailsHtml}
      </div>
      <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
        <button id="joinBtn" class="secondary">Join session</button>
      </div>
    </div>
  `;
  const devicesCard = `
    <div class="card">
      <h2>Devices</h2>
      <p class="small">Connect a trainer and/or heart rate monitor to use real telemetry.</p>
      ${!bluetoothSupported ? "<p class='small'>This browser does not support Web Bluetooth.</p>" : ""}
      <div class="flex" style="gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <div class="small">Trainer</div>
          ${
            state.devices.trainer.connected
              ? `
          <div class="code">${escapeHtml(state.devices.trainer.name || "Trainer")}</div>
          <button id="disconnectTrainerInline" class="secondary" style="margin-top:8px;width:100%;">Disconnect trainer</button>
          `
              : bluetoothSupported
                ? `<button id="connectTrainerInline" class="secondary" style="margin-top:8px;width:100%;">Not connected - Pair trainer</button>`
                : `<div class="code">Not connected</div>`
          }
        </div>
        <div style="flex:1; min-width:220px;">
          <div class="small">Heart rate</div>
          ${
            state.devices.hrm.connected
              ? `
          <div class="code">${escapeHtml(state.devices.hrm.name || "Heart rate monitor")}</div>
          <button id="disconnectHrmInline" class="secondary" style="margin-top:8px;width:100%;">Disconnect HRM</button>
          `
              : bluetoothSupported
                ? `<button id="connectHrmInline" class="secondary" style="margin-top:8px;width:100%;">Not connected - Pair HRM</button>`
                : `<div class="code">Not connected</div>`
          }
        </div>
      </div>
    </div>
  `;
  const selectedWorkoutTargetWatts = selectedWorkoutSegment
    ? getWorkoutSegmentTargetWatts(selectedWorkoutSegment, workoutFtpWatts)
    : null;
  const selectedWorkoutResolvedZone = selectedWorkoutSegment ? getWorkoutSegmentZone(selectedWorkoutSegment, workoutFtpWatts) : null;
  const selectedWorkoutZone = selectedWorkoutResolvedZone != null ? getWorkoutZoneConfig(selectedWorkoutResolvedZone) : null;
  const selectedWorkoutDuration = selectedWorkoutSegment ? getWorkoutDurationParts(selectedWorkoutSegment.durationSeconds) : null;
  const selectedWorkoutSetRepetitions = selectedWorkoutSet ? normalizeWorkoutSetRepetitions(selectedWorkoutSet.repetitions) : null;
  const workoutDraftDifficulty = calculateWorkoutDifficulty(state.lobby.workoutDraftSegments, workoutFtpWatts);
  const workoutTimelineWindowSeconds = Math.max(
    WORKOUT_TIMELINE_BASE_WINDOW_SECONDS,
    Math.ceil(Math.max(workoutDraftTotalDurationSeconds, WORKOUT_TIMELINE_BASE_WINDOW_SECONDS) / WORKOUT_TIMELINE_MARKER_STEP_SECONDS) *
      WORKOUT_TIMELINE_MARKER_STEP_SECONDS,
  );
  const workoutTimelineTrackWidthPercent = Math.max(
    100,
    (workoutTimelineWindowSeconds / WORKOUT_TIMELINE_BASE_WINDOW_SECONDS) * 100,
  );
  const workoutTimelineMarkerCount = Math.floor(workoutTimelineWindowSeconds / WORKOUT_TIMELINE_MARKER_STEP_SECONDS);
  const workoutTimelineMarkersHtml = Array.from({ length: workoutTimelineMarkerCount + 1 }, (_, markerIndex) => {
    const markerSeconds = markerIndex * WORKOUT_TIMELINE_MARKER_STEP_SECONDS;
    const markerPositionPercent = (markerSeconds / workoutTimelineWindowSeconds) * 100;
    const isFirstMarker = markerIndex === 0;
    const isLastMarker = markerIndex === workoutTimelineMarkerCount;
    return `
      <div
        class="workout-timeline-marker${isFirstMarker ? " is-first" : ""}${isLastMarker ? " is-last" : ""}"
        style="left:${markerPositionPercent.toFixed(4)}%;"
      >
        <span>${formatWorkoutTimelineMarker(markerSeconds)}</span>
      </div>
    `;
  }).join("");
  const workoutSecondsOptionsHtml = Array.from({ length: Math.floor(60 / WORKOUT_SEGMENT_SECOND_STEP) }, (_, index) => {
    const value = index * WORKOUT_SEGMENT_SECOND_STEP;
    const isSelected = selectedWorkoutDuration && selectedWorkoutDuration.seconds === value;
    const label = String(value).padStart(2, "0");
    return `<option value="${value}" ${isSelected ? "selected" : ""}>${label}s</option>`;
  }).join("");
  const workoutTagsHtml = WORKOUT_TAG_OPTIONS.map((tag) => {
    const isSelectedTag = state.lobby.workoutDraftTags.includes(tag);
    return `
      <button
        type="button"
        class="secondary workout-tag-btn ${isSelectedTag ? "is-selected" : ""}"
        data-workout-tag="${escapeHtml(tag)}"
        aria-pressed="${isSelectedTag ? "true" : "false"}"
      >${escapeHtml(tag)}</button>
    `;
  }).join("");
  const workoutZonePaletteHtml =
    WORKOUT_ZONES.map(
      (zoneDef) => {
        const zoneWatts = getWorkoutZoneWatts(zoneDef.zone, workoutFtpWatts);
        return `
      <div class="workout-zone-chip ${getWorkoutEffortClass(zoneDef.zone)}" draggable="true" data-workout-zone="${zoneDef.zone}">
        <div><strong>Zone ${zoneDef.zone}</strong></div>
        <div class="small">${escapeHtml(zoneDef.label)} (${zoneWatts.targetWatts} W)</div>
      </div>
    `;
      },
    ).join("") +
    `
      <div
        class="workout-zone-chip workout-set-palette workout-tooltip-trigger"
        draggable="true"
        data-workout-add-set="true"
        data-tooltip="Create repeatable set container"
        aria-label="Add Set"
      >
        <div><strong>Add Set</strong></div>
      </div>
    `;
  const workoutTimelineBlocksHtml = state.lobby.workoutDraftSegments
    .map((item, index) => {
      if (item.type === WORKOUT_ITEM_TYPE_SET) {
        const setRepetitions = normalizeWorkoutSetRepetitions(item.repetitions);
        const setCycleDurationSeconds = item.segments.reduce((total, segment) => total + (Number(segment.durationSeconds) || 0), 0);
        const totalSetDurationSeconds = Math.max(WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS, setCycleDurationSeconds * setRepetitions);
        const widthPercent = Math.max(0.001, (totalSetDurationSeconds / workoutTimelineWindowSeconds) * 100);
        const isSelectedSet =
          selectedWorkoutSelection?.kind === "set"
            ? selectedWorkoutSelection.setIndex === index
            : selectedWorkoutSelection?.kind === "set-segment"
              ? selectedWorkoutSelection.setIndex === index
              : false;
        const setSegmentsHtml = item.segments
          .map((segment, segmentIndex) => {
            const segmentZone = getWorkoutSegmentZone(segment, workoutFtpWatts);
            const zoneDef = getWorkoutZoneConfig(segmentZone);
            const segmentTargetWatts = getWorkoutSegmentTargetWatts(segment, workoutFtpWatts);
            const isSelectedSetSegment =
              selectedWorkoutSelection?.kind === "set-segment" &&
              selectedWorkoutSelection.setIndex === index &&
              selectedWorkoutSelection.segmentIndex === segmentIndex;
            const segmentDuration = normalizeWorkoutDurationSeconds(segment.durationSeconds);
            const segmentWidthPercent = Math.max(
              0.001,
              (segmentDuration / Math.max(setCycleDurationSeconds || WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS, 1)) * 100,
            );
            return `
              <button
                type="button"
                class="workout-set-segment-block ${getWorkoutEffortClass(segmentZone)} ${isSelectedSetSegment ? "is-selected" : ""}"
                data-workout-set-segment-index="${segmentIndex}"
                data-workout-set-parent-index="${index}"
                style="width:${segmentWidthPercent.toFixed(4)}%; flex-basis:${segmentWidthPercent.toFixed(4)}%;"
                title="Set ${index + 1}, Segment ${segmentIndex + 1}: Zone ${zoneDef.zone} (${zoneDef.label}), ${segmentTargetWatts} W target, ${formatDuration(segment.durationSeconds)}"
                aria-label="Set ${index + 1}, Segment ${segmentIndex + 1}: Zone ${zoneDef.zone} (${zoneDef.label}), ${segmentTargetWatts} watts target, ${formatDuration(segment.durationSeconds)}"
              ></button>
            `;
          })
          .join("");
        return `
          <div
            class="workout-set-container ${isSelectedSet ? "is-selected" : ""}"
            data-workout-set-index="${index}"
            data-workout-set-drop-index="${index}"
            style="width:${widthPercent.toFixed(4)}%; flex-basis:${widthPercent.toFixed(4)}%;"
          >
            <div
              class="workout-set-header"
              data-workout-set-index="${index}"
              title="Set ${index + 1}: ${setRepetitions} rep${setRepetitions === 1 ? "" : "s"}"
            >
              <input
                type="number"
                class="workout-set-header-input"
                data-workout-set-repetitions-index="${index}"
                min="${WORKOUT_SET_REPETITIONS_MIN}"
                max="${WORKOUT_SET_REPETITIONS_MAX}"
                step="1"
                value="${setRepetitions}"
                title="Set ${index + 1} repetitions"
                aria-label="Set ${index + 1} repetitions"
              />
            </div>
            <div class="workout-set-segments">
              ${
                setSegmentsHtml ||
                `<div class="small workout-set-empty">Drop zones here</div>`
              }
            </div>
          </div>
        `;
      }

      const itemZone = getWorkoutSegmentZone(item, workoutFtpWatts);
      const zoneDef = getWorkoutZoneConfig(itemZone);
      const itemTargetWatts = getWorkoutSegmentTargetWatts(item, workoutFtpWatts);
      const isSelected = selectedWorkoutSelection?.kind === "segment" && selectedWorkoutSelection.index === index;
      const durationSeconds = normalizeWorkoutDurationSeconds(item.durationSeconds);
      const widthPercent = Math.max(0.001, (durationSeconds / workoutTimelineWindowSeconds) * 100);
      return `
        <button
          type="button"
          class="workout-segment-block ${getWorkoutEffortClass(itemZone)} ${isSelected ? "is-selected" : ""}"
          data-workout-segment-index="${index}"
          style="width:${widthPercent.toFixed(4)}%; flex-basis:${widthPercent.toFixed(4)}%;"
          title="Segment ${index + 1}: Zone ${zoneDef.zone} (${zoneDef.label}), ${itemTargetWatts} W target, ${formatDuration(item.durationSeconds)}"
          aria-label="Segment ${index + 1}: Zone ${zoneDef.zone} (${zoneDef.label}), ${itemTargetWatts} watts target, ${formatDuration(item.durationSeconds)}"
        ></button>
      `;
    })
    .join("");
  const workoutSavedRows = savedWorkouts
    .map((workout) => {
      const isEditing = workout.id === state.lobby.workoutEditingId;
      const workoutDifficulty = calculateWorkoutDifficulty(workout.segments, workoutFtpWatts);
      const isFavorite = normalizeWorkoutFavorite(workout.isFavorite);
      const rating = normalizeWorkoutRating(workout.rating, null);
      const ratingButtonLabel = rating == null ? "Rate ★" : `★ ${rating}`;
      const tags = normalizeWorkoutTags(workout.tags);
      const tagCount = tags.length;
      const tagCountLabel = `${tagCount} tag${tagCount === 1 ? "" : "s"}`;
      const tagHoverText = tagCount > 0 ? tags.join(", ") : "No tags";
      return `
        <tr class="${isEditing ? "highlight" : ""}">
          <td class="workout-favorite-cell">
            <button
              type="button"
              class="secondary workout-favorite-btn ${isFavorite ? "is-favorite" : ""}"
              data-workout-favorite-id="${escapeHtml(workout.id)}"
              title="${isFavorite ? "Remove favorite" : "Mark as favorite"}"
              aria-label="${isFavorite ? "Remove favorite" : "Mark as favorite"}"
            >${isFavorite ? "★" : "☆"}</button>
          </td>
          <td>${escapeHtml(workout.name)}</td>
          <td>${workoutDifficulty}/10</td>
          <td>${formatDuration(workout.totalDurationSeconds)}</td>
          <td>${countWorkoutConfiguredSegments(workout.segments)}</td>
          <td>
            <div class="flex" style="gap:8px; justify-content:flex-end; flex-wrap:wrap;">
              <button type="button" class="secondary workout-rate-btn ${rating != null ? "is-rated" : ""}" data-workout-rate-id="${escapeHtml(workout.id)}">${ratingButtonLabel}</button>
              <button type="button" class="secondary" data-workout-view-notes-id="${escapeHtml(workout.id)}">View Notes</button>
              <span class="workout-tags-count workout-tooltip-trigger" data-tooltip="${escapeHtml(tagHoverText)}">${tagCountLabel}</span>
              <button type="button" class="secondary" data-workout-load-id="${escapeHtml(workout.id)}">Edit</button>
              <button
                type="button"
                class="danger workout-delete-btn"
                data-workout-delete-id="${escapeHtml(workout.id)}"
                title="Remove ${escapeHtml(workout.name)}"
                aria-label="Remove ${escapeHtml(workout.name)}"
              >🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
  const workoutFtpEditorModalHtml = state.lobby.showWorkoutFtpModal
    ? `
      <div class="workout-modal-backdrop" id="workoutFtpModalBackdrop">
        <div class="workout-modal">
          <h2 style="margin-bottom:8px;">Edit Workout FTP</h2>
          <div class="small">Used to calculate zone watt targets in Workout Creator.</div>
          <label class="label" for="workoutFtpModalInput" style="margin-top:10px;">FTP (W)</label>
          <input
            id="workoutFtpModalInput"
            type="number"
            min="${FTP_MIN_WATTS}"
            max="${FTP_MAX_WATTS}"
            step="1"
            value="${workoutFtpWatts}"
          />
          <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end;">
            <button id="workoutFtpModalCancelBtn" class="secondary">Cancel</button>
            <button id="workoutFtpModalConfirmBtn">Confirm</button>
          </div>
        </div>
      </div>
    `
    : "";
  const workoutNotesEditorModalHtml = state.lobby.showWorkoutNotesModal
    ? `
      <div class="workout-modal-backdrop" id="workoutNotesModalBackdrop">
        <div class="workout-modal workout-modal-wide">
          <h2 style="margin-bottom:8px;">Workout Notes</h2>
          <div class="small">Add any context for this workout plan.</div>
          <label class="label" for="workoutNotesModalInput" style="margin-top:10px;">Notes</label>
          <textarea
            id="workoutNotesModalInput"
            rows="10"
            maxlength="${WORKOUT_NOTES_MAX_LENGTH}"
            placeholder="Add notes..."
          >${escapeHtml(state.lobby.workoutDraftNotes)}</textarea>
          <div class="small" style="margin-top:6px;">
            ${state.lobby.workoutDraftNotes.length}/${WORKOUT_NOTES_MAX_LENGTH}
          </div>
          <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end;">
            <button id="workoutNotesModalCancelBtn" class="secondary">Cancel</button>
            <button id="workoutNotesModalSaveBtn">Save Notes</button>
          </div>
        </div>
      </div>
    `
    : "";
  const selectedSavedWorkoutNotes = state.lobby.savedWorkoutNotesView;
  const savedWorkoutNotesModalHtml = selectedSavedWorkoutNotes
    ? `
      <div class="workout-modal-backdrop" id="savedWorkoutNotesModalBackdrop">
        <div class="workout-modal workout-modal-wide">
          <h2 style="margin-bottom:8px;">${escapeHtml(selectedSavedWorkoutNotes.name || "Workout")} Notes</h2>
          <label class="label" for="savedWorkoutNotesText" style="margin-top:10px;">Notes</label>
          <textarea
            id="savedWorkoutNotesText"
            rows="10"
            maxlength="${WORKOUT_NOTES_MAX_LENGTH}"
            placeholder="No notes added."
          >${escapeHtml(selectedSavedWorkoutNotes.notes || "")}</textarea>
          <div class="small" style="margin-top:6px;">
            ${(selectedSavedWorkoutNotes.notes || "").length}/${WORKOUT_NOTES_MAX_LENGTH}
          </div>
          <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end;">
            <button id="savedWorkoutNotesCloseBtn" class="secondary">Cancel</button>
            <button id="savedWorkoutNotesSaveBtn">Save Notes</button>
          </div>
        </div>
      </div>
    `
    : "";
  const selectedWorkoutRatingModal = state.lobby.workoutRatingModal;
  const selectedWorkoutRatingEntry = selectedWorkoutRatingModal
    ? savedWorkouts.find((entry) => entry.id === selectedWorkoutRatingModal.workoutId) || null
    : null;
  const selectedWorkoutRatingValue = selectedWorkoutRatingModal
    ? normalizeWorkoutRating(
        selectedWorkoutRatingModal.selectedRating,
        selectedWorkoutRatingEntry ? normalizeWorkoutRating(selectedWorkoutRatingEntry.rating, null) : null,
      )
    : null;
  const workoutRatingModalStarsHtml = Array.from({ length: WORKOUT_RATING_MAX }, (_, index) => {
    const ratingValue = index + 1;
    const isSelected = selectedWorkoutRatingValue != null && selectedWorkoutRatingValue >= ratingValue;
    return `
      <button
        type="button"
        class="secondary workout-rating-star ${isSelected ? "is-selected" : ""}"
        data-workout-rating-value="${ratingValue}"
        aria-label="Set rating ${ratingValue}"
      >★</button>
    `;
  }).join("");
  const workoutRatingModalHtml = selectedWorkoutRatingEntry
    ? `
      <div class="workout-modal-backdrop" id="workoutRatingModalBackdrop">
        <div class="workout-modal">
          <h2 style="margin-bottom:8px;">Rate Workout</h2>
          <div class="small">${escapeHtml(selectedWorkoutRatingEntry.name)}</div>
          <div class="workout-rating-stars">
            ${workoutRatingModalStarsHtml}
          </div>
          <div class="small" style="margin-top:8px;">
            ${selectedWorkoutRatingValue == null ? "Select a rating from 1 to 5." : `Selected rating: ${selectedWorkoutRatingValue}/5`}
          </div>
          <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end;">
            <button id="workoutRatingModalCancelBtn" class="secondary">Cancel</button>
            <button id="workoutRatingModalSaveBtn">Save</button>
          </div>
        </div>
      </div>
    `
    : "";
  const selectedWorkoutDeleteModal = state.lobby.workoutDeleteModal;
  const selectedWorkoutDeleteEntry = selectedWorkoutDeleteModal
    ? savedWorkouts.find((entry) => entry.id === selectedWorkoutDeleteModal.workoutId) || null
    : null;
  const selectedWorkoutDeleteName = normalizeWorkoutName(
    selectedWorkoutDeleteEntry?.name || selectedWorkoutDeleteModal?.name || "this workout",
  );
  const workoutDeleteModalHtml = selectedWorkoutDeleteModal
    ? `
      <div class="workout-modal-backdrop" id="workoutDeleteModalBackdrop">
        <div class="workout-modal">
          <h2 style="margin-bottom:8px;">Remove Workout</h2>
          <div class="small">Remove workout "${escapeHtml(selectedWorkoutDeleteName)}"? This cannot be undone.</div>
          <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end;">
            <button id="workoutDeleteModalCancelBtn" class="secondary">Cancel</button>
            <button id="workoutDeleteModalConfirmBtn" class="danger">Remove</button>
          </div>
        </div>
      </div>
    `
    : "";
  const workoutsCard = `
    <div class="card">
      <div class="flex-space">
        <div>
          <h2>Workout Creator</h2>
          <div class="small">Build FTP zone workouts by dragging zones onto the timeline.</div>
        </div>
        <div style="text-align:right;">
          <div class="small">FTP</div>
          <div class="flex" style="gap:6px; align-items:center; justify-content:flex-end;">
            <div class="code">${workoutFtpWatts} W${workoutUsingAssumedFtp ? " (assumed)" : ""}</div>
            <button
              id="workoutEditFtpBtn"
              type="button"
              class="secondary workout-ftp-edit-btn"
              aria-label="Edit workout FTP"
              title="Edit workout FTP"
            >
              <span aria-hidden="true">✎</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex" style="margin-top:12px; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:240px;">
          <label class="label" for="workoutNameInput">Workout name</label>
          <input id="workoutNameInput" value="${escapeHtml(state.lobby.workoutDraftName)}" placeholder="e.g. Tempo Builder 45" />
        </div>
      </div>
      <div style="margin-top:12px;">
        <div class="workout-tag-list">${workoutTagsHtml}</div>
      </div>

      <div class="workout-creator-grid">
        <div class="workout-zone-palette">
          <h2 style="margin-bottom:8px;">Zone Palette</h2>
          <div class="small">Drag zones into the timeline. Use Add Set to create a repeatable container.</div>
          <div class="workout-zone-list">${workoutZonePaletteHtml}</div>
        </div>

        <div class="workout-timeline-panel">
          <h2 style="margin-bottom:8px;">Workout Timeline</h2>
          <div class="small">Linear sequence of segments and sets in ride order. Scroll horizontally; ruler markers are every 5 minutes.</div>
          <div class="workout-timeline-scroll">
            <div class="workout-timeline-track" style="width:${workoutTimelineTrackWidthPercent.toFixed(4)}%;">
              <div class="workout-timeline-ruler">${workoutTimelineMarkersHtml}</div>
              <div id="workoutTimelineDrop" class="workout-timeline-drop">
                ${
                  workoutTimelineBlocksHtml
                    ? workoutTimelineBlocksHtml
                    : `<div class="small">Drop zones here to build your workout.</div>`
                }
              </div>
            </div>
          </div>
        </div>

        <div class="workout-segment-editor">
          ${
            selectedWorkoutSelection?.kind === "set" && selectedWorkoutSet
              ? `
            <div class="small"><strong>Set:</strong></div>
            <div class="workout-set-readonly">
              Set ${selectedWorkoutSelection.setIndex + 1}
            </div>
            <div style="margin-top:10px;">
              <label class="label" for="workoutSetRepetitionsInput">Repetitions</label>
              <input
                id="workoutSetRepetitionsInput"
                type="number"
                min="${WORKOUT_SET_REPETITIONS_MIN}"
                max="${WORKOUT_SET_REPETITIONS_MAX}"
                step="1"
                value="${selectedWorkoutSetRepetitions}"
              />
            </div>
            <div class="small" style="margin-top:8px;">
              Set segments: ${selectedWorkoutSet.segments.length}
            </div>
            <button id="workoutDeleteSelectionBtn" class="danger" style="margin-top:12px;">Delete Set</button>
          `
              : selectedWorkoutSegment
              ? `
            <div class="workout-zone-readonly ${getWorkoutEffortClass(selectedWorkoutZone.zone)}">
              <strong>Zone ${selectedWorkoutZone.zone}</strong> - ${escapeHtml(selectedWorkoutZone.label)} (${selectedWorkoutTargetWatts ?? 0} W target)
            </div>
            <div class="flex" style="margin-top:10px; gap:10px; align-items:flex-end; flex-wrap:wrap;">
              <div style="width:140px;">
                <label class="label" for="workoutSegmentWattsInput">Target Watts</label>
                <input
                  id="workoutSegmentWattsInput"
                  type="number"
                  min="0"
                  step="1"
                  value="${selectedWorkoutTargetWatts ?? 0}"
                />
              </div>
              <div style="width:120px;">
                <label class="label" for="workoutSegmentMinutesInput">Minutes</label>
                <input
                  id="workoutSegmentMinutesInput"
                  type="number"
                  min="0"
                  max="${Math.floor(WORKOUT_MAX_SEGMENT_DURATION_SECONDS / 60)}"
                  step="1"
                  value="${selectedWorkoutDuration.minutes}"
                />
              </div>
              <div style="width:120px;">
                <label class="label" for="workoutSegmentSecondsSelect">Seconds</label>
                <select id="workoutSegmentSecondsSelect">${workoutSecondsOptionsHtml}</select>
              </div>
              <button id="workoutDeleteSelectionBtn" class="danger" style="height:42px;">Delete Segment</button>
            </div>
            <div class="small" style="margin-top:8px;">
              ${
                selectedWorkoutSelection?.kind === "set-segment"
                  ? `Set ${selectedWorkoutSelection.setIndex + 1}, Segment ${selectedWorkoutSelection.segmentIndex + 1} of ${selectedWorkoutSet?.segments?.length || 0}`
                  : `Segment ${selectedWorkoutSelection?.index + 1} of ${state.lobby.workoutDraftSegments.length}`
              }
            </div>
          `
              : `<div class="small">Select a timeline segment to edit duration or delete it.</div>`
          }
        </div>
      </div>

      <table class="table" style="margin-top:12px;">
        <thead>
          <tr>
            <th>Total Duration</th>
            <th>Difficulty</th>
            <th>Segments</th>
            <th>Timeline Entries</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${formatDuration(workoutDraftTotalDurationSeconds)}</td>
            <td>${workoutDraftDifficulty}/10</td>
            <td>${workoutConfiguredSegmentCount}</td>
            <td>${state.lobby.workoutDraftSegments.length}</td>
          </tr>
        </tbody>
      </table>

      <div class="flex" style="margin-top:12px; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button id="workoutEditNotesBtn" class="secondary">
          ${state.lobby.workoutDraftNotes.trim() ? "Edit Notes" : "Add Notes"}
        </button>
        <button id="workoutCreateNewBtn" class="secondary">Create New</button>
        <button id="workoutSaveBtn">Save Workout</button>
      </div>

      ${workoutFtpEditorModalHtml}
      ${workoutNotesEditorModalHtml}
      ${savedWorkoutNotesModalHtml}
      ${workoutRatingModalHtml}
      ${workoutDeleteModalHtml}
    </div>

    <div class="card">
      <h2>Saved Workouts</h2>
      <div class="small">Stored locally on this device for now.</div>
      ${
        savedWorkouts.length === 0
          ? "<p class='small' style='margin-top:10px;'>No saved workouts yet.</p>"
          : `
      <table class="table" style="margin-top:10px;">
        <thead>
          <tr><th></th><th>Name</th><th>Difficulty</th><th>Total Duration</th><th>Segments</th><th>Actions</th></tr>
        </thead>
        <tbody>${workoutSavedRows}</tbody>
      </table>
      `
      }
    </div>
  `;

  appEl.innerHTML = `
    ${lobbyMenuHtml}
    ${activeLobbySection === "account" ? accountCard : ""}
    ${activeLobbySection === "create" ? createSessionCard : ""}
    ${activeLobbySection === "join" ? joinSessionCard : ""}
    ${activeLobbySection === "devices" ? devicesCard : ""}
    ${activeLobbySection === "workouts" ? workoutsCard : ""}
    <div class="card">
      <h2>Recent sessions</h2>
      <p class="small">Tap a code to reopen a completed summary.</p>
      ${summaries.length === 0 ? "<p class='small'>No completed sessions yet.</p>" : ""}
      <table class="table">
        <thead>
          <tr><th>Code</th><th>When</th><th>Participants</th><th>Duration</th><th>Total Distance</th><th>Avg HR</th><th>Total Climb</th></tr>
        </thead>
        <tbody>
          ${paginatedSummaries.sessions
            .map((s) => {
              const when = new Date(s.startedAt).toLocaleString();
              const duration = formatDuration(s.durationSec);
              const count = s.participants?.length || 0;
              const rollup = computeSummaryRollup(s);
              const totalDistance = formatDistanceKmFloor(rollup.totalDistanceMeters);
              const averageHeartRate = rollup.averageHeartRate != null ? `${Math.round(rollup.averageHeartRate)} bpm` : "--";
              const totalClimb = rollup.totalClimbMeters != null ? formatClimbedMeters(rollup.totalClimbMeters) : "--";
              return `
                <tr class="clickable" data-code="${s.code}">
                  <td><span class="code">${s.code}</span></td>
                  <td>${when}</td>
                  <td>${count}</td>
                  <td>${duration}</td>
                  <td>${totalDistance}</td>
                  <td>${averageHeartRate}</td>
                  <td>${totalClimb}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
      ${
        showRecentSessionsPagination
          ? `
      <div class="flex-space" style="margin-top:12px; gap:10px; flex-wrap:wrap;">
        <button id="recentSessionsPrevBtn" class="secondary" ${paginatedSummaries.currentPage <= 1 ? "disabled" : ""}>Previous</button>
        <div class="small">Page ${paginatedSummaries.currentPage} of ${paginatedSummaries.totalPages}</div>
        <button id="recentSessionsNextBtn" class="secondary" ${paginatedSummaries.currentPage >= paginatedSummaries.totalPages ? "disabled" : ""}>Next</button>
      </div>
      <div class="small" style="margin-top:6px;">Showing ${showingStart}-${showingEnd} of ${summaries.length} sessions</div>
      `
          : ""
      }
    </div>
  `;

  document.querySelectorAll("[data-lobby-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextSection = normalizeLobbySection(btn.getAttribute("data-lobby-section"), activeLobbySection);
      if (nextSection === state.lobby.activeSection) return;
      state.lobby.activeSection = nextSection;
      render();
    });
  });

  const authEmailEl = document.getElementById("authEmail");
  if (authEmailEl) {
    const signupBtn = document.getElementById("signupBtn");
    const loginBtn = document.getElementById("loginBtn");
    const resetBtn = document.getElementById("resetBtn");
    signupBtn?.addEventListener("click", () => {
      const email = authEmailEl.value.trim();
      const password = document.getElementById("authPassword").value;
      const result = signUpWithEmail(email, password);
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Account created and logged in.");
      render();
    });
    loginBtn?.addEventListener("click", () => {
      const email = authEmailEl.value.trim();
      const password = document.getElementById("authPassword").value;
      const result = logInWithEmail(email, password);
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Logged in.");
      render();
    });
    resetBtn?.addEventListener("click", () => {
      const result = sendPasswordReset(authEmailEl.value.trim());
      showToast(result.error || result.message);
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearAuthenticatedUser();
      showToast("Logged out.");
      render();
    });
  }

  const toggleProfileBtn = document.getElementById("toggleProfileBtn");
  if (toggleProfileBtn) {
    toggleProfileBtn.addEventListener("click", () => {
      state.account.showProfileEditor = !state.account.showProfileEditor;
      render();
    });
  }

  const toggleFriendsBtn = document.getElementById("toggleFriendsBtn");
  if (toggleFriendsBtn) {
    toggleFriendsBtn.addEventListener("click", () => {
      state.account.showFriendsPanel = !state.account.showFriendsPanel;
      render();
    });
  }

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", () => {
      const result = updateProfile({
        displayName: document.getElementById("profileDisplayName").value,
        dateOfBirth: document.getElementById("profileDob").value,
        weight: document.getElementById("profileWeight").value,
        ftpWatts: document.getElementById("profileFtpWatts")?.value ?? "",
        weightUnit: document.getElementById("profileWeightUnit").value,
        heightCm: document.getElementById("profileHeightCm")?.value ?? "",
        heightFeet: document.getElementById("profileHeightFeet")?.value ?? "",
        heightInches: document.getElementById("profileHeightInches")?.value ?? "",
        heightUnit: document.getElementById("profileHeightUnit").value,
      });
      if (result.error) {
        showToast(result.error);
        return;
      }
      showToast("Profile saved.");
      render();
    });
  }

  const profileHeightUnitEl = document.getElementById("profileHeightUnit");
  if (profileHeightUnitEl) {
    const profileHeightCmWrap = document.getElementById("profileHeightCmWrap");
    const profileHeightFtWrap = document.getElementById("profileHeightFtWrap");
    const profileHeightInWrap = document.getElementById("profileHeightInWrap");
    const syncHeightInputs = () => {
      const isImperial = profileHeightUnitEl.value === "ft_in";
      if (profileHeightCmWrap) profileHeightCmWrap.style.display = isImperial ? "none" : "";
      if (profileHeightFtWrap) profileHeightFtWrap.style.display = isImperial ? "" : "none";
      if (profileHeightInWrap) profileHeightInWrap.style.display = isImperial ? "" : "none";
    };
    syncHeightInputs();
    profileHeightUnitEl.addEventListener("change", syncHeightInputs);
  }

  const profilePhotoInput = document.getElementById("profilePhotoInput");
  if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        showToast("Only jpg, png, and webp are supported.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image must be 5MB or smaller.");
        return;
      }
      try {
        const dataUrl = await fileToResizedDataUrl(file, 512, 0.85);
        const profiles = loadProfiles();
        const profile = profiles[state.account.userId];
        if (!profile) return;
        profile.profilePhotoUrl = dataUrl;
        profile.updatedAt = currentMs();
        profiles[state.account.userId] = profile;
        saveProfiles(profiles);
        upsertPublicProfile(profile);
        showToast("Profile picture updated.");
        render();
      } catch {
        showToast("Image upload failed.");
      }
    });
  }

  const friendSearchBtn = document.getElementById("friendSearchBtn");
  if (friendSearchBtn) {
    friendSearchBtn.addEventListener("click", () => {
      state.account.friendSearchQuery = document.getElementById("friendSearchInput").value.trim();
      render();
    });
  }

  const accountGradientScaleRange = document.getElementById("accountGradientScaleRange");
  if (accountGradientScaleRange) {
    const accountGradientScaleValue = document.getElementById("accountGradientScaleValue");
    const applyAccountGradientScale = () => {
      const nextPct = clamp(Number(accountGradientScaleRange.value), 0, 100);
      state.simulation.gradientScale = clamp(nextPct / 100, 0, 1);
      if (accountGradientScaleValue) {
        accountGradientScaleValue.textContent = `${Math.round(nextPct)}%`;
      }
    };
    accountGradientScaleRange.addEventListener("input", applyAccountGradientScale);
    accountGradientScaleRange.addEventListener("change", () => {
      applyAccountGradientScale();
      render();
    });
  }

  document.querySelectorAll("[data-send-request]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = sendFriendRequest(btn.getAttribute("data-send-request"));
      showToast(result.error || "Friend request sent.");
      render();
    });
  });
  document.querySelectorAll("[data-accept-request]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = acceptFriendRequest(btn.getAttribute("data-accept-request"));
      showToast(result.error || "Friend request accepted.");
      render();
    });
  });
  document.querySelectorAll("[data-reject-request]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = rejectFriendRequest(btn.getAttribute("data-reject-request"));
      showToast(result.error || "Friend request rejected.");
      render();
    });
  });
  document.querySelectorAll("[data-cancel-request]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = cancelFriendRequest(btn.getAttribute("data-cancel-request"));
      showToast(result.error || "Friend request cancelled.");
      render();
    });
  });
  document.querySelectorAll("[data-remove-friend]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const result = removeFriend(btn.getAttribute("data-remove-friend"));
      showToast(result.error || "Friend removed.");
      render();
    });
  });

  const routeModePresetEl = document.getElementById("routeModePreset");
  if (routeModePresetEl) {
    routeModePresetEl.addEventListener("change", () => {
      if (!routeModePresetEl.checked) return;
      state.lobby.routeSelectionMode = "preset";
      render();
    });
  }

  const routeModeGeneratedEl = document.getElementById("routeModeGenerated");
  if (routeModeGeneratedEl) {
    routeModeGeneratedEl.addEventListener("change", () => {
      if (!routeModeGeneratedEl.checked) return;
      state.lobby.routeSelectionMode = "generated";
      if (!state.lobby.generatedRouteDraft && !state.lobby.generatedRouteConfirmed && ROUTE_GENERATOR_SERVICE?.generateRoutePreset) {
        generateLobbyRouteDraft(state.lobby.generatedRouteDistanceKm, state.lobby.generatedRouteHilliness);
      }
      render();
    });
  }

  const createBikeEl = document.getElementById("createBike");
  if (createBikeEl) {
    createBikeEl.addEventListener("change", () => {
      state.lobby.selectedBikeId = normalizeBikeId(createBikeEl.value);
      render();
    });
  }

  const joinBikeEl = document.getElementById("joinBike");
  if (joinBikeEl) {
    joinBikeEl.addEventListener("change", () => {
      state.lobby.selectedBikeId = normalizeBikeId(joinBikeEl.value);
      render();
    });
  }

  const addBotDraftBtn = document.getElementById("addBotDraftBtn");
  if (addBotDraftBtn) {
    addBotDraftBtn.addEventListener("click", () => {
      const result = addBotDraft(4);
      if (!result.ok) {
        showToast(result.error || "Could not add bot.");
      }
      render();
    });
  }

  document.querySelectorAll("[data-remove-bot-draft]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const botDraftId = btn.getAttribute("data-remove-bot-draft");
      const result = removeBotDraft(botDraftId);
      if (!result.ok) {
        showToast(result.error || "Could not remove bot.");
      }
      render();
    });
  });

  document.querySelectorAll("[data-bot-difficulty-id]").forEach((selectEl) => {
    selectEl.addEventListener("change", () => {
      const botDraftId = selectEl.getAttribute("data-bot-difficulty-id");
      const result = updateBotDraftDifficulty(botDraftId, selectEl.value);
      if (!result.ok) {
        showToast(result.error || "Could not update bot difficulty.");
      }
      render();
    });
  });

  const createRouteEl = document.getElementById("createRoute");
  if (createRouteEl) {
    createRouteEl.addEventListener("change", () => {
      const selectedValue = createRouteEl.value || DEFAULT_ROUTE_PRESET.id;
      state.lobby.selectedRouteId = selectedValue;
      render();
    });
  }

  const generatedRouteDistanceEl = document.getElementById("generatedRouteDistance");
  if (generatedRouteDistanceEl) {
    generatedRouteDistanceEl.addEventListener("change", () => {
      state.lobby.generatedRouteDistanceKm = normalizeGeneratedRouteDistanceKm(generatedRouteDistanceEl.value);
      render();
    });
  }

  const generatedRouteHillinessEl = document.getElementById("generatedRouteHilliness");
  if (generatedRouteHillinessEl) {
    generatedRouteHillinessEl.addEventListener("change", () => {
      state.lobby.generatedRouteHilliness = normalizeGeneratedHilliness(generatedRouteHillinessEl.value);
      render();
    });
  }

  const regenerateRouteBtn = document.getElementById("regenerateRouteBtn");
  if (regenerateRouteBtn) {
    regenerateRouteBtn.addEventListener("click", () => {
      if (!ROUTE_GENERATOR_SERVICE?.generateRoutePreset) {
        showToast("Route generator unavailable.");
        return;
      }
      const distanceKm = normalizeGeneratedRouteDistanceKm(document.getElementById("generatedRouteDistance")?.value);
      const hilliness = normalizeGeneratedHilliness(document.getElementById("generatedRouteHilliness")?.value);
      const generated = generateLobbyRouteDraft(distanceKm, hilliness);
      if (!generated) {
        showToast("Failed to generate route.");
        return;
      }
      const validation = generated._validation || validateGeneratedRoute(generated, distanceKm, hilliness);
      if (!validation.valid) {
        showToast(validation.errors[0] || "Generated route failed validation.");
      } else {
        showToast("Generated a new route preview.");
      }
      render();
    });
  }

  const confirmGeneratedRouteBtn = document.getElementById("confirmGeneratedRouteBtn");
  if (confirmGeneratedRouteBtn) {
    confirmGeneratedRouteBtn.addEventListener("click", () => {
      if (!ROUTE_GENERATOR_SERVICE?.generateRoutePreset) {
        showToast("Route generator unavailable.");
        return;
      }
      const distanceKm = normalizeGeneratedRouteDistanceKm(document.getElementById("generatedRouteDistance")?.value);
      const hilliness = normalizeGeneratedHilliness(document.getElementById("generatedRouteHilliness")?.value);
      const needsRegenerate =
        !state.lobby.generatedRouteDraft ||
        Math.abs((Number(state.lobby.generatedRouteDraft.distanceKm) || 0) - distanceKm) >= 0.01 ||
        normalizeGeneratedHilliness(state.lobby.generatedRouteDraft.hillinessPreset) !== hilliness;
      const draft = needsRegenerate ? generateLobbyRouteDraft(distanceKm, hilliness) : state.lobby.generatedRouteDraft;
      if (!draft) {
        showToast("No generated route to confirm.");
        return;
      }
      const validation = draft._validation || validateGeneratedRoute(draft, distanceKm, hilliness);
      if (!validation.valid) {
        showToast(validation.errors[0] || "Generated route failed validation.");
        return;
      }
      state.lobby.generatedRouteConfirmed = cloneJson(draft);
      state.lobby.routeSelectionMode = "generated";
      showToast("Generated route confirmed.");
      render();
    });
  }

  const createBtn = document.getElementById("createBtn");
  if (createBtn) {
    createBtn.addEventListener("click", () => {
      const name = document.getElementById("createName").value.trim();
      const weight = Number(document.getElementById("createWeight").value.trim());
      const bikeId = normalizeBikeId(document.getElementById("createBike")?.value || state.lobby.selectedBikeId);
      state.lobby.selectedBikeId = bikeId;
      const routeSelectionMode = normalizeRouteSelectionMode(state.lobby.routeSelectionMode);
      let routePreset = null;
      if (routeSelectionMode === "generated") {
        const confirmed = state.lobby.generatedRouteConfirmed ? ensureRoutePresetShape(state.lobby.generatedRouteConfirmed) : null;
        if (!confirmed) {
          showToast("Generate and confirm a route first.");
          return;
        }
        const activeDraft = state.lobby.generatedRouteDraft ? ensureRoutePresetShape(state.lobby.generatedRouteDraft) : null;
        const previewDiffersFromConfirmed =
          activeDraft &&
          activeDraft.generatedAt &&
          confirmed.generatedAt &&
          activeDraft.generatedAt !== confirmed.generatedAt;
        if (previewDiffersFromConfirmed) {
          showToast("Confirm the latest generated route before creating the session.");
          return;
        }
        const settingsDrifted =
          Math.abs((Number(confirmed.distanceKm) || 0) - normalizeGeneratedRouteDistanceKm(state.lobby.generatedRouteDistanceKm)) >= 0.01 ||
          normalizeGeneratedHilliness(confirmed.hillinessPreset) !== normalizeGeneratedHilliness(state.lobby.generatedRouteHilliness);
        if (settingsDrifted) {
          showToast("Regenerate and confirm to match the current generated-route settings.");
          return;
        }
        const validation =
          confirmed._validation ||
          validateGeneratedRoute(confirmed, state.lobby.generatedRouteDistanceKm, state.lobby.generatedRouteHilliness);
        if (!validation.valid) {
          showToast(validation.errors[0] || "Generated route is invalid. Regenerate and confirm again.");
          return;
        }
        routePreset = confirmed;
      } else {
        const routeId = document.getElementById("createRoute")?.value || state.lobby.selectedRouteId || DEFAULT_ROUTE_PRESET.id;
        routePreset = getRoutePresetById(routeId);
        state.lobby.selectedRouteId = routeId;
      }
      const accountProfile = getCurrentAccountProfile();
      const resolvedName = name || accountProfile?.displayName || "";
      const resolvedWeight = Number.isFinite(weight) ? weight : Number.isFinite(accountProfile?.weightKg) ? accountProfile.weightKg : null;
      const user = createUser({
        id: state.account.userId,
        name: resolvedName,
        weight: resolvedWeight,
        bikeId,
        isHost: true,
      });
      const session = createSession({
        hostUser: user,
        routePreset,
        botConfigs: normalizeBotDrafts(state.lobby.botDrafts),
      });
      persistLocalSession(session.code, user.id);
      setUser(user);
      setSession(session);
      initWebRTC(session.code, true);
      state.view = "session";
      render();
    });
  }

  const joinBtn = document.getElementById("joinBtn");
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      const code = document.getElementById("joinCode").value.trim().toUpperCase();
      const name = document.getElementById("joinName").value.trim();
      const weight = Number(document.getElementById("joinWeight").value.trim());
      const bikeId = normalizeBikeId(document.getElementById("joinBike")?.value || state.lobby.selectedBikeId);
      state.lobby.selectedBikeId = bikeId;

      if (!code) {
        showToast("Enter a session code to join.");
        return;
      }

      const accountProfile = getCurrentAccountProfile();
      const resolvedName = name || accountProfile?.displayName || "";
      const resolvedWeight = Number.isFinite(weight) ? weight : Number.isFinite(accountProfile?.weightKg) ? accountProfile.weightKg : null;
      const user = createUser({
        id: state.account.userId,
        name: resolvedName,
        weight: resolvedWeight,
        bikeId,
        isHost: false,
      });
      const result = joinSession({ code, user });
      if (result?.error) {
        showToast(result.error);
        return;
      }

      // If the session exists locally, keep the original flow.
      if (result) {
        persistLocalSession(code, user.id);
        setUser(user);
        setSession(result);
        initWebRTC(code, false);
        state.view = "session";
        render();
        return;
      }

      // Cross-device path: connect to signaling server and wait for session-state.
      setUser(user);
      setSession(createPlaceholderSession(code, user));
      initWebRTC(code, false, { awaitingSessionState: true });
      state.view = "session";
      showToast("Trying to join via signaling server...");
      render();
    });
  }

  const connectTrainerInlineBtn = document.getElementById("connectTrainerInline");
  if (connectTrainerInlineBtn) {
    connectTrainerInlineBtn.addEventListener("click", () => connectTrainer());
  }

  const connectHrmInlineBtn = document.getElementById("connectHrmInline");
  if (connectHrmInlineBtn) {
    connectHrmInlineBtn.addEventListener("click", () => connectHeartRateMonitor());
  }

  const disconnectTrainerInlineBtn = document.getElementById("disconnectTrainerInline");
  if (disconnectTrainerInlineBtn) {
    disconnectTrainerInlineBtn.addEventListener("click", () => disconnectDevice("trainer"));
  }

  const disconnectHrmInlineBtn = document.getElementById("disconnectHrmInline");
  if (disconnectHrmInlineBtn) {
    disconnectHrmInlineBtn.addEventListener("click", () => disconnectDevice("hrm"));
  }

  const addWorkoutDraftSegment = (zoneInput, setIndex = null) => {
    const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
    const hasExplicitSetTarget = setIndex !== null && setIndex !== undefined && String(setIndex).trim() !== "";
    if (hasExplicitSetTarget && Number.isFinite(Number(setIndex))) {
      const targetSetIndex = Math.round(Number(setIndex));
      const targetSet = currentSegments[targetSetIndex];
      if (targetSet?.type === WORKOUT_ITEM_TYPE_SET) {
        const nextSegment = createWorkoutSegment(zoneInput, WORKOUT_DEFAULT_SET_SEGMENT_DURATION_SECONDS, workoutFtpWatts);
        const nextSegments = currentSegments.map((item, index) =>
          index === targetSetIndex
            ? {
                ...item,
                segments: [...item.segments, nextSegment],
              }
            : item,
        );
        state.lobby.workoutDraftSegments = nextSegments;
        state.lobby.workoutSelection = {
          kind: "set-segment",
          setIndex: targetSetIndex,
          segmentIndex: targetSet.segments.length,
        };
        return;
      }
    }

    const nextSegment = createWorkoutSegment(zoneInput, WORKOUT_DEFAULT_SEGMENT_DURATION_SECONDS, workoutFtpWatts);
    const nextSegments = [...currentSegments, nextSegment];
    state.lobby.workoutDraftSegments = nextSegments;
    state.lobby.workoutSelection = {
      kind: "segment",
      index: nextSegments.length - 1,
    };
  };

  const addWorkoutDraftSet = () => {
    const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
    const nextSet = createWorkoutSet(2);
    const nextSegments = [...currentSegments, nextSet];
    state.lobby.workoutDraftSegments = nextSegments;
    state.lobby.workoutSelection = {
      kind: "set",
      setIndex: nextSegments.length - 1,
    };
  };

  const workoutNameInput = document.getElementById("workoutNameInput");
  if (workoutNameInput) {
    workoutNameInput.addEventListener("input", () => {
      state.lobby.workoutDraftName = workoutNameInput.value;
    });
  }

  document.querySelectorAll("[data-workout-tag]").forEach((tagBtn) => {
    tagBtn.addEventListener("click", () => {
      const tag = normalizeWorkoutTag(tagBtn.getAttribute("data-workout-tag"));
      if (!tag) return;
      const currentTags = normalizeWorkoutTags(state.lobby.workoutDraftTags);
      const hasTag = currentTags.includes(tag);
      state.lobby.workoutDraftTags = hasTag ? currentTags.filter((entry) => entry !== tag) : [...currentTags, tag];
      render();
    });
  });

  const workoutEditNotesBtn = document.getElementById("workoutEditNotesBtn");
  if (workoutEditNotesBtn) {
    workoutEditNotesBtn.addEventListener("click", () => {
      state.lobby.showWorkoutNotesModal = true;
      render();
    });
  }

  const workoutCreateNewBtn = document.getElementById("workoutCreateNewBtn");
  if (workoutCreateNewBtn) {
    workoutCreateNewBtn.addEventListener("click", () => {
      const currentName = normalizeWorkoutName(state.lobby.workoutDraftName);
      if (state.lobby.workoutEditingId && currentName && !/\bcopy$/i.test(currentName)) {
        state.lobby.workoutDraftName = `${currentName} Copy`;
      }
      state.lobby.workoutEditingId = null;
      showToast("Create New enabled. Saving now will create a new workout.");
      render();
    });
  }

  const workoutSaveBtn = document.getElementById("workoutSaveBtn");
  if (workoutSaveBtn) {
    workoutSaveBtn.addEventListener("click", () => {
      const validation = validateWorkoutDraft(state.lobby.workoutDraftName, state.lobby.workoutDraftSegments, state.lobby.workoutDraftTags);
      if (!validation.valid) {
        showToast(validation.errors[0] || "Workout draft is incomplete.");
        return;
      }

      const existingWorkouts = loadWorkouts();
      const editingId = state.lobby.workoutEditingId;
      const editingIndex = editingId ? existingWorkouts.findIndex((workout) => workout.id === editingId) : -1;
      const existingWorkout = editingIndex >= 0 ? existingWorkouts[editingIndex] : null;
      const workoutId = existingWorkout?.id || `workout_${currentMs()}_${makeId(6).toLowerCase()}`;
      const workoutRecord = normalizeWorkoutRecord({
        id: workoutId,
        name: validation.name,
        createdAt: existingWorkout?.createdAt || currentMs(),
        ftpReferenceWatts: workoutFtpWatts,
        notes: state.lobby.workoutDraftNotes,
        isFavorite: existingWorkout?.isFavorite === true,
        rating: normalizeWorkoutRating(existingWorkout?.rating, null),
        tags: validation.tags,
        segments: validation.segments,
        totalDurationSeconds: validation.totalDurationSeconds,
      });

      const nextWorkouts = existingWorkouts.slice();
      if (editingIndex >= 0) {
        nextWorkouts[editingIndex] = workoutRecord;
      } else {
        nextWorkouts.unshift(workoutRecord);
      }
      saveWorkouts(nextWorkouts);
      state.lobby.workoutEditingId = workoutRecord.id;
      state.lobby.workoutDraftName = workoutRecord.name;
      state.lobby.workoutDraftNotes = normalizeWorkoutNotes(workoutRecord.notes);
      state.lobby.workoutDraftTags = normalizeWorkoutTags(workoutRecord.tags);
      state.lobby.workoutDraftSegments = normalizeWorkoutSegments(workoutRecord.segments);
      state.lobby.workoutSelection = findFirstWorkoutSelection(state.lobby.workoutDraftSegments);
      showToast(editingIndex >= 0 ? "Workout updated." : "Workout saved.");
      render();
    });
  }

  const workoutNotesModalCancelBtn = document.getElementById("workoutNotesModalCancelBtn");
  if (workoutNotesModalCancelBtn) {
    workoutNotesModalCancelBtn.addEventListener("click", () => {
      state.lobby.showWorkoutNotesModal = false;
      render();
    });
  }

  const workoutNotesModalBackdrop = document.getElementById("workoutNotesModalBackdrop");
  if (workoutNotesModalBackdrop) {
    workoutNotesModalBackdrop.addEventListener("click", (event) => {
      if (event.target !== workoutNotesModalBackdrop) return;
      state.lobby.showWorkoutNotesModal = false;
      render();
    });
  }

  const workoutNotesModalSaveBtn = document.getElementById("workoutNotesModalSaveBtn");
  if (workoutNotesModalSaveBtn) {
    workoutNotesModalSaveBtn.addEventListener("click", () => {
      const notesInput = document.getElementById("workoutNotesModalInput")?.value ?? "";
      state.lobby.workoutDraftNotes = normalizeWorkoutNotes(notesInput);
      state.lobby.showWorkoutNotesModal = false;
      showToast("Workout notes updated.");
      render();
    });
  }

  const workoutEditFtpBtn = document.getElementById("workoutEditFtpBtn");
  if (workoutEditFtpBtn) {
    workoutEditFtpBtn.addEventListener("click", () => {
      state.lobby.showWorkoutFtpModal = true;
      render();
    });
  }

  const workoutFtpModalCancelBtn = document.getElementById("workoutFtpModalCancelBtn");
  if (workoutFtpModalCancelBtn) {
    workoutFtpModalCancelBtn.addEventListener("click", () => {
      state.lobby.showWorkoutFtpModal = false;
      render();
    });
  }

  const workoutFtpModalBackdrop = document.getElementById("workoutFtpModalBackdrop");
  if (workoutFtpModalBackdrop) {
    workoutFtpModalBackdrop.addEventListener("click", (event) => {
      if (event.target !== workoutFtpModalBackdrop) return;
      state.lobby.showWorkoutFtpModal = false;
      render();
    });
  }

  const workoutFtpModalConfirmBtn = document.getElementById("workoutFtpModalConfirmBtn");
  if (workoutFtpModalConfirmBtn) {
    workoutFtpModalConfirmBtn.addEventListener("click", () => {
      const nextFtpInput = document.getElementById("workoutFtpModalInput")?.value ?? "";
      const validation = validateFtp(nextFtpInput, { allowNull: false });
      if (!validation.valid) {
        showToast(validation.error || "Enter a valid FTP.");
        return;
      }
      const userId = state.account.userId;
      if (userId) {
        const profiles = loadProfiles();
        const existingProfile = profiles[userId];
        if (existingProfile) {
          const updated = updateUserFtp(withProfileProgression(existingProfile), validation.value, currentMs());
          if (!updated.ok) {
            showToast(updated.error || "Could not update FTP.");
            return;
          }
          profiles[userId] = withProfileProgression(updated.profile);
          saveProfiles(profiles);
          upsertPublicProfile(profiles[userId]);
          // Keep Workout Creator FTP sourced from the account value.
          state.lobby.workoutFtpOverrideWatts = null;
        } else {
          state.lobby.workoutFtpOverrideWatts = validation.value;
        }
      } else {
        state.lobby.workoutFtpOverrideWatts = validation.value;
      }
      state.lobby.showWorkoutFtpModal = false;
      showToast(`FTP updated to ${validation.value} W.`);
      render();
    });
  }

  document.querySelectorAll("[data-workout-zone]").forEach((zoneEl) => {
    const zone = getWorkoutZoneConfig(zoneEl.getAttribute("data-workout-zone")).zone;
    zoneEl.addEventListener("dragstart", (event) => {
      if (event.dataTransfer) {
        event.dataTransfer.setData("text/plain", `zone:${zone}`);
        event.dataTransfer.effectAllowed = "copy";
      }
      zoneEl.classList.add("is-dragging");
    });
    zoneEl.addEventListener("dragend", () => {
      zoneEl.classList.remove("is-dragging");
    });
    zoneEl.addEventListener("click", () => {
      addWorkoutDraftSegment(zone);
      render();
    });
  });

  document.querySelectorAll("[data-workout-add-set]").forEach((setEl) => {
    setEl.addEventListener("dragstart", (event) => {
      if (event.dataTransfer) {
        event.dataTransfer.setData("text/plain", "set");
        event.dataTransfer.effectAllowed = "copy";
      }
      setEl.classList.add("is-dragging");
    });
    setEl.addEventListener("dragend", () => {
      setEl.classList.remove("is-dragging");
    });
    setEl.addEventListener("click", () => {
      addWorkoutDraftSet();
      render();
    });
  });

  document.querySelectorAll(".workout-tooltip-trigger[data-tooltip]").forEach((tooltipTrigger) => {
    tooltipTrigger.addEventListener("pointerenter", () => {
      showWorkoutTooltipForTrigger(tooltipTrigger);
    });
    tooltipTrigger.addEventListener("pointerleave", () => {
      hideWorkoutTooltip();
    });
    tooltipTrigger.addEventListener("focus", () => {
      showWorkoutTooltipForTrigger(tooltipTrigger);
    });
    tooltipTrigger.addEventListener("blur", () => {
      hideWorkoutTooltip();
    });
    tooltipTrigger.addEventListener("pointerdown", () => {
      hideWorkoutTooltip();
    });
  });

  const parseWorkoutPaletteDropPayload = (payloadInput) => {
    const payload = String(payloadInput || "").trim().toLowerCase();
    if (payload === "set") return { kind: "set" };
    if (payload.startsWith("zone:")) {
      const zoneValue = payload.slice("zone:".length);
      const zone = getWorkoutZoneConfig(zoneValue).zone;
      return { kind: "zone", zone };
    }
    return null;
  };

  const workoutTimelineDrop = document.getElementById("workoutTimelineDrop");
  if (workoutTimelineDrop) {
    workoutTimelineDrop.addEventListener("dragover", (event) => {
      event.preventDefault();
      workoutTimelineDrop.classList.add("is-drag-over");
    });
    workoutTimelineDrop.addEventListener("dragleave", () => {
      workoutTimelineDrop.classList.remove("is-drag-over");
    });
    workoutTimelineDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      workoutTimelineDrop.classList.remove("is-drag-over");
      const dropPayload = parseWorkoutPaletteDropPayload(event.dataTransfer?.getData("text/plain"));
      if (!dropPayload) return;
      if (dropPayload.kind === "set") {
        addWorkoutDraftSet();
      } else if (dropPayload.kind === "zone") {
        addWorkoutDraftSegment(dropPayload.zone);
      }
      render();
    });
  }

  document.querySelectorAll("[data-workout-set-drop-index]").forEach((setDropEl) => {
    setDropEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      setDropEl.classList.add("is-drag-over");
    });
    setDropEl.addEventListener("dragleave", () => {
      setDropEl.classList.remove("is-drag-over");
    });
    setDropEl.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDropEl.classList.remove("is-drag-over");
      const dropPayload = parseWorkoutPaletteDropPayload(event.dataTransfer?.getData("text/plain"));
      if (!dropPayload || dropPayload.kind !== "zone") return;
      const setIndex = Math.round(Number(setDropEl.getAttribute("data-workout-set-drop-index")) || 0);
      addWorkoutDraftSegment(dropPayload.zone, setIndex);
      render();
    });
  });

  document.querySelectorAll("[data-workout-segment-index]").forEach((segmentBtn) => {
    segmentBtn.addEventListener("click", () => {
      const segmentIndex = clamp(
        Math.round(Number(segmentBtn.getAttribute("data-workout-segment-index")) || 0),
        0,
        Math.max(0, state.lobby.workoutDraftSegments.length - 1),
      );
      state.lobby.workoutSelection = { kind: "segment", index: segmentIndex };
      render();
    });
  });

  document.querySelectorAll("[data-workout-set-index]").forEach((setBtn) => {
    setBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const setIndex = Math.round(Number(setBtn.getAttribute("data-workout-set-index")) || 0);
      state.lobby.workoutSelection = { kind: "set", setIndex };
      render();
    });
  });

  document.querySelectorAll("[data-workout-set-segment-index]").forEach((setSegmentBtn) => {
    setSegmentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const setIndex = Math.round(Number(setSegmentBtn.getAttribute("data-workout-set-parent-index")) || 0);
      const segmentIndex = Math.round(Number(setSegmentBtn.getAttribute("data-workout-set-segment-index")) || 0);
      state.lobby.workoutSelection = { kind: "set-segment", setIndex, segmentIndex };
      render();
    });
  });

  const workoutSegmentMinutesInput = document.getElementById("workoutSegmentMinutesInput");
  const workoutSegmentSecondsSelect = document.getElementById("workoutSegmentSecondsSelect");
  const workoutSegmentWattsInput = document.getElementById("workoutSegmentWattsInput");
  const applyWorkoutSegmentDurationFromInputs = () => {
    const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
    const selected = normalizeWorkoutSelection(state.lobby.workoutSelection, currentSegments);
    if (!selected || (selected.kind !== "segment" && selected.kind !== "set-segment")) return;
    const existing =
      selected.kind === "segment"
        ? currentSegments[selected.index]
        : currentSegments[selected.setIndex]?.segments?.[selected.segmentIndex];
    if (!existing) return;
    const rawMinutes = Math.floor(Number(workoutSegmentMinutesInput?.value));
    const minutes = Number.isFinite(rawMinutes) ? Math.max(0, rawMinutes) : Math.floor(existing.durationSeconds / 60);
    const rawSeconds = Math.floor(Number(workoutSegmentSecondsSelect?.value));
    const snappedSeconds = Number.isFinite(rawSeconds)
      ? clamp(Math.round(rawSeconds / WORKOUT_SEGMENT_SECOND_STEP) * WORKOUT_SEGMENT_SECOND_STEP, 0, 55)
      : existing.durationSeconds % 60;
    const nextDuration = normalizeWorkoutDurationSeconds(minutes * 60 + snappedSeconds, existing.durationSeconds);
    if (selected.kind === "segment") {
      state.lobby.workoutDraftSegments = currentSegments.map((segment, segmentIndex) =>
        segmentIndex === selected.index
          ? {
              ...segment,
              durationSeconds: nextDuration,
            }
          : segment,
      );
    } else {
      state.lobby.workoutDraftSegments = currentSegments.map((item, itemIndex) =>
        itemIndex === selected.setIndex
          ? {
              ...item,
              segments: item.segments.map((segment, segmentIndex) =>
                segmentIndex === selected.segmentIndex
                  ? {
                      ...segment,
                      durationSeconds: nextDuration,
                    }
                  : segment,
              ),
            }
          : item,
      );
    }
    render();
  };
  if (workoutSegmentMinutesInput) {
    workoutSegmentMinutesInput.addEventListener("change", applyWorkoutSegmentDurationFromInputs);
  }
  if (workoutSegmentSecondsSelect) {
    workoutSegmentSecondsSelect.addEventListener("change", applyWorkoutSegmentDurationFromInputs);
  }

  const applyWorkoutSegmentWattsFromInput = () => {
    const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
    const selected = normalizeWorkoutSelection(state.lobby.workoutSelection, currentSegments);
    if (!selected || (selected.kind !== "segment" && selected.kind !== "set-segment")) return;
    const existing =
      selected.kind === "segment"
        ? currentSegments[selected.index]
        : currentSegments[selected.setIndex]?.segments?.[selected.segmentIndex];
    if (!existing) return;
    const existingTargetWatts = getWorkoutSegmentTargetWatts(existing, workoutFtpWatts);
    const nextTargetWatts = normalizeWorkoutTargetWatts(workoutSegmentWattsInput?.value, existingTargetWatts);
    if (nextTargetWatts == null) return;
    const nextTargetFtpPct = getWorkoutTargetFtpPctFromWatts(nextTargetWatts, workoutFtpWatts);
    const nextZone = getWorkoutZoneForWatts(nextTargetWatts, workoutFtpWatts);
    if (selected.kind === "segment") {
      state.lobby.workoutDraftSegments = currentSegments.map((segment, segmentIndex) =>
        segmentIndex === selected.index
          ? {
              ...segment,
              zone: nextZone,
              targetFtpPct: nextTargetFtpPct,
            }
          : segment,
      );
    } else {
      state.lobby.workoutDraftSegments = currentSegments.map((item, itemIndex) =>
        itemIndex === selected.setIndex
          ? {
              ...item,
              segments: item.segments.map((segment, segmentIndex) =>
                segmentIndex === selected.segmentIndex
                  ? {
                      ...segment,
                      zone: nextZone,
                      targetFtpPct: nextTargetFtpPct,
                    }
                  : segment,
              ),
            }
          : item,
      );
    }
    render();
  };
  if (workoutSegmentWattsInput) {
    workoutSegmentWattsInput.addEventListener("change", applyWorkoutSegmentWattsFromInput);
  }

  const applyWorkoutSetRepetitions = (setIndexInput, repetitionsInput) => {
    const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
    const setIndex = Math.round(Number(setIndexInput));
    const targetSet = currentSegments[setIndex];
    if (!targetSet || targetSet.type !== WORKOUT_ITEM_TYPE_SET) return false;
    const nextRepetitions = normalizeWorkoutSetRepetitions(repetitionsInput);
    state.lobby.workoutDraftSegments = currentSegments.map((item, itemIndex) =>
      itemIndex === setIndex
        ? {
            ...item,
            repetitions: nextRepetitions,
          }
        : item,
    );
    state.lobby.workoutSelection = { kind: "set", setIndex };
    return true;
  };

  document.querySelectorAll("[data-workout-set-repetitions-index]").forEach((setRepetitionsEl) => {
    const stopSelectionBubbling = (event) => {
      event.stopPropagation();
    };
    setRepetitionsEl.addEventListener("pointerdown", stopSelectionBubbling);
    setRepetitionsEl.addEventListener("click", stopSelectionBubbling);
    setRepetitionsEl.addEventListener("change", () => {
      const setIndex = Math.round(Number(setRepetitionsEl.getAttribute("data-workout-set-repetitions-index")) || 0);
      if (!applyWorkoutSetRepetitions(setIndex, setRepetitionsEl.value)) return;
      render();
    });
  });

  const workoutSetRepetitionsInput = document.getElementById("workoutSetRepetitionsInput");
  if (workoutSetRepetitionsInput) {
    workoutSetRepetitionsInput.addEventListener("change", () => {
      const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
      const selected = normalizeWorkoutSelection(state.lobby.workoutSelection, currentSegments);
      if (!selected || selected.kind !== "set") return;
      if (!applyWorkoutSetRepetitions(selected.setIndex, workoutSetRepetitionsInput.value)) return;
      render();
    });
  }

  const workoutDeleteSelectionBtn = document.getElementById("workoutDeleteSelectionBtn");
  if (workoutDeleteSelectionBtn) {
    workoutDeleteSelectionBtn.addEventListener("click", () => {
      const currentSegments = normalizeWorkoutSegments(state.lobby.workoutDraftSegments);
      const selected = normalizeWorkoutSelection(state.lobby.workoutSelection, currentSegments);
      if (!selected) return;

      if (selected.kind === "segment") {
        const nextSegments = currentSegments.filter((_, segmentIndex) => segmentIndex !== selected.index);
        state.lobby.workoutDraftSegments = nextSegments;
        state.lobby.workoutSelection = findFirstWorkoutSelection(nextSegments);
        render();
        return;
      }

      if (selected.kind === "set") {
        const nextSegments = currentSegments.filter((_, setIndex) => setIndex !== selected.setIndex);
        state.lobby.workoutDraftSegments = nextSegments;
        state.lobby.workoutSelection = findFirstWorkoutSelection(nextSegments);
        render();
        return;
      }

      const targetSet = currentSegments[selected.setIndex];
      if (!targetSet || targetSet.type !== WORKOUT_ITEM_TYPE_SET) return;
      const nextSetSegments = targetSet.segments.filter((_, segmentIndex) => segmentIndex !== selected.segmentIndex);
      const nextSegments = currentSegments.map((item, itemIndex) =>
        itemIndex === selected.setIndex
          ? {
              ...item,
              segments: nextSetSegments,
            }
          : item,
      );
      state.lobby.workoutDraftSegments = nextSegments;
      state.lobby.workoutSelection =
        nextSetSegments.length > 0
          ? {
              kind: "set-segment",
              setIndex: selected.setIndex,
              segmentIndex: clamp(selected.segmentIndex, 0, nextSetSegments.length - 1),
            }
          : {
              kind: "set",
              setIndex: selected.setIndex,
            };
      render();
    });
  }

  document.querySelectorAll("[data-workout-load-id]").forEach((loadBtn) => {
    loadBtn.addEventListener("click", () => {
      const workoutId = String(loadBtn.getAttribute("data-workout-load-id") || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        return;
      }
      state.lobby.workoutEditingId = workout.id;
      state.lobby.workoutDraftName = workout.name;
      state.lobby.workoutDraftNotes = normalizeWorkoutNotes(workout.notes);
      state.lobby.workoutDraftTags = normalizeWorkoutTags(workout.tags);
      state.lobby.workoutDraftSegments = normalizeWorkoutSegments(workout.segments);
      state.lobby.workoutSelection = findFirstWorkoutSelection(state.lobby.workoutDraftSegments);
      showToast(`Loaded ${workout.name}.`);
      render();
    });
  });

  document.querySelectorAll("[data-workout-rate-id]").forEach((rateBtn) => {
    rateBtn.addEventListener("click", () => {
      const workoutId = String(rateBtn.getAttribute("data-workout-rate-id") || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        return;
      }
      state.lobby.workoutRatingModal = {
        workoutId: workout.id,
        selectedRating: normalizeWorkoutRating(workout.rating, null),
      };
      render();
    });
  });

  document.querySelectorAll("[data-workout-rating-value]").forEach((ratingBtn) => {
    ratingBtn.addEventListener("click", () => {
      const selectedRating = normalizeWorkoutRating(ratingBtn.getAttribute("data-workout-rating-value"), null);
      if (selectedRating == null || !state.lobby.workoutRatingModal) return;
      state.lobby.workoutRatingModal = {
        ...state.lobby.workoutRatingModal,
        selectedRating,
      };
      render();
    });
  });

  const workoutRatingModalCancelBtn = document.getElementById("workoutRatingModalCancelBtn");
  if (workoutRatingModalCancelBtn) {
    workoutRatingModalCancelBtn.addEventListener("click", () => {
      state.lobby.workoutRatingModal = null;
      render();
    });
  }

  const workoutRatingModalBackdrop = document.getElementById("workoutRatingModalBackdrop");
  if (workoutRatingModalBackdrop) {
    workoutRatingModalBackdrop.addEventListener("click", (event) => {
      if (event.target !== workoutRatingModalBackdrop) return;
      state.lobby.workoutRatingModal = null;
      render();
    });
  }

  const workoutRatingModalSaveBtn = document.getElementById("workoutRatingModalSaveBtn");
  if (workoutRatingModalSaveBtn) {
    workoutRatingModalSaveBtn.addEventListener("click", () => {
      const modalState = state.lobby.workoutRatingModal;
      if (!modalState) return;
      const workout = savedWorkouts.find((entry) => entry.id === modalState.workoutId);
      if (!workout) {
        showToast("Workout not found.");
        state.lobby.workoutRatingModal = null;
        render();
        return;
      }
      const selectedRating = normalizeWorkoutRating(modalState.selectedRating, null);
      if (selectedRating == null) {
        showToast("Select a rating from 1 to 5.");
        return;
      }
      const nextWorkouts = savedWorkouts.map((entry) =>
        entry.id === workout.id
          ? normalizeWorkoutRecord({
              ...entry,
              rating: selectedRating,
            })
          : entry,
      );
      saveWorkouts(nextWorkouts);
      state.lobby.workoutRatingModal = null;
      showToast(`${workout.name} rated ${selectedRating}/5.`);
      render();
    });
  }

  document.querySelectorAll("[data-workout-favorite-id]").forEach((favoriteBtn) => {
    favoriteBtn.addEventListener("click", () => {
      const workoutId = String(favoriteBtn.getAttribute("data-workout-favorite-id") || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        return;
      }
      const nextFavoriteValue = !normalizeWorkoutFavorite(workout.isFavorite);
      const nextWorkouts = savedWorkouts.map((entry) =>
        entry.id === workoutId
          ? normalizeWorkoutRecord({
              ...entry,
              isFavorite: nextFavoriteValue,
            })
          : entry,
      );
      saveWorkouts(nextWorkouts);
      showToast(nextFavoriteValue ? `${workout.name} favorited.` : `${workout.name} unfavorited.`);
      render();
    });
  });

  document.querySelectorAll("[data-workout-view-notes-id]").forEach((notesBtn) => {
    notesBtn.addEventListener("click", () => {
      const workoutId = String(notesBtn.getAttribute("data-workout-view-notes-id") || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        return;
      }
      state.lobby.savedWorkoutNotesView = {
        workoutId: workout.id,
        name: workout.name,
        notes: normalizeWorkoutNotes(workout.notes),
      };
      render();
    });
  });

  const savedWorkoutNotesCloseBtn = document.getElementById("savedWorkoutNotesCloseBtn");
  if (savedWorkoutNotesCloseBtn) {
    savedWorkoutNotesCloseBtn.addEventListener("click", () => {
      state.lobby.savedWorkoutNotesView = null;
      render();
    });
  }

  const savedWorkoutNotesSaveBtn = document.getElementById("savedWorkoutNotesSaveBtn");
  if (savedWorkoutNotesSaveBtn) {
    savedWorkoutNotesSaveBtn.addEventListener("click", () => {
      const modalState = state.lobby.savedWorkoutNotesView;
      if (!modalState) return;
      const workout = savedWorkouts.find((entry) => entry.id === modalState.workoutId);
      if (!workout) {
        showToast("Workout not found.");
        state.lobby.savedWorkoutNotesView = null;
        render();
        return;
      }
      const nextNotesInput = document.getElementById("savedWorkoutNotesText")?.value ?? "";
      const nextNotes = normalizeWorkoutNotes(nextNotesInput);
      const nextWorkouts = savedWorkouts.map((entry) =>
        entry.id === workout.id
          ? normalizeWorkoutRecord({
              ...entry,
              notes: nextNotes,
            })
          : entry,
      );
      saveWorkouts(nextWorkouts);
      if (state.lobby.workoutEditingId === workout.id) {
        state.lobby.workoutDraftNotes = nextNotes;
      }
      state.lobby.savedWorkoutNotesView = null;
      showToast("Notes updated.");
      render();
    });
  }

  const savedWorkoutNotesModalBackdrop = document.getElementById("savedWorkoutNotesModalBackdrop");
  if (savedWorkoutNotesModalBackdrop) {
    savedWorkoutNotesModalBackdrop.addEventListener("click", (event) => {
      if (event.target !== savedWorkoutNotesModalBackdrop) return;
      state.lobby.savedWorkoutNotesView = null;
      render();
    });
  }

  document.querySelectorAll("[data-workout-delete-id]").forEach((deleteBtn) => {
    deleteBtn.addEventListener("click", () => {
      const workoutId = String(deleteBtn.getAttribute("data-workout-delete-id") || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        return;
      }
      state.lobby.workoutDeleteModal = {
        workoutId: workout.id,
        name: workout.name,
      };
      render();
    });
  });

  const workoutDeleteModalCancelBtn = document.getElementById("workoutDeleteModalCancelBtn");
  if (workoutDeleteModalCancelBtn) {
    workoutDeleteModalCancelBtn.addEventListener("click", () => {
      state.lobby.workoutDeleteModal = null;
      render();
    });
  }

  const workoutDeleteModalBackdrop = document.getElementById("workoutDeleteModalBackdrop");
  if (workoutDeleteModalBackdrop) {
    workoutDeleteModalBackdrop.addEventListener("click", (event) => {
      if (event.target !== workoutDeleteModalBackdrop) return;
      state.lobby.workoutDeleteModal = null;
      render();
    });
  }

  const workoutDeleteModalConfirmBtn = document.getElementById("workoutDeleteModalConfirmBtn");
  if (workoutDeleteModalConfirmBtn) {
    workoutDeleteModalConfirmBtn.addEventListener("click", () => {
      const modalState = state.lobby.workoutDeleteModal;
      if (!modalState) return;
      const workoutId = String(modalState.workoutId || "").trim();
      const workout = savedWorkouts.find((entry) => entry.id === workoutId);
      if (!workout) {
        showToast("Workout not found.");
        state.lobby.workoutDeleteModal = null;
        render();
        return;
      }
      const nextWorkouts = savedWorkouts.filter((entry) => entry.id !== workoutId);
      saveWorkouts(nextWorkouts);
      if (state.lobby.workoutEditingId === workoutId) {
        state.lobby.workoutEditingId = null;
      }
      if (state.lobby.savedWorkoutNotesView?.workoutId === workoutId) {
        state.lobby.savedWorkoutNotesView = null;
      }
      if (state.lobby.workoutRatingModal?.workoutId === workoutId) {
        state.lobby.workoutRatingModal = null;
      }
      if (state.lobby.workoutDeleteModal?.workoutId === workoutId) {
        state.lobby.workoutDeleteModal = null;
      }
      showToast(`Removed ${workout.name}.`);
      render();
    });
  }

  const recentSessionsPrevBtn = document.getElementById("recentSessionsPrevBtn");
  if (recentSessionsPrevBtn) {
    recentSessionsPrevBtn.addEventListener("click", () => {
      state.lobby.recentSessionsPage = clampPage(state.lobby.recentSessionsPage - 1, paginatedSummaries.totalPages);
      render();
    });
  }

  const recentSessionsNextBtn = document.getElementById("recentSessionsNextBtn");
  if (recentSessionsNextBtn) {
    recentSessionsNextBtn.addEventListener("click", () => {
      state.lobby.recentSessionsPage = clampPage(state.lobby.recentSessionsPage + 1, paginatedSummaries.totalPages);
      render();
    });
  }
}

function renderPairing() {
  const trainer = state.devices.trainer;
  const hrm = state.devices.hrm;
  const supported = isWebBluetoothSupported();
  const returnView = state.pairingReturnView === "session" && state.session && state.user ? "session" : "lobby";
  const backLabel = returnView === "session" ? "Back to session" : "Back to lobby";

  appEl.innerHTML = `
    <div class="card">
      <div class="flex-space">
        <div>
          <h2>Pair devices</h2>
          <div class="small">Use Bluetooth to connect a trainer and/or heart rate monitor.</div>
        </div>
        <button id="backFromPairing" class="secondary">${backLabel}</button>
      </div>

      ${!supported ? "<p class='small'>This browser does not support Web Bluetooth.</p>" : ""}

      <div class="card" style="margin-top:12px;">
        <h2>Trainer</h2>
        <div class="small">${trainer.connected ? `Connected: ${trainer.name}` : "Not connected"}</div>
        <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;">
          ${trainer.connected ? `<button id="disconnectTrainer" class="secondary">Disconnect</button>` : `<button id="connectTrainer">Pair trainer</button>`}
        </div>
      </div>

      <div class="card" style="margin-top:12px;">
        <h2>Heart rate</h2>
        <div class="small">${hrm.connected ? `Connected: ${hrm.name}` : "Not connected"}</div>
        <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;">
          ${hrm.connected ? `<button id="disconnectHrm" class="secondary">Disconnect</button>` : `<button id="connectHrm">Pair HRM</button>`}
        </div>
      </div>
    </div>
  `;

  document.getElementById("backFromPairing").addEventListener("click", () => {
    state.view = returnView;
    render();
  });

  if (supported) {
    const connectTrainerBtn = document.getElementById("connectTrainer");
    if (connectTrainerBtn) {
      connectTrainerBtn.addEventListener("click", () => connectTrainer());
    }

    const connectHrmBtn = document.getElementById("connectHrm");
    if (connectHrmBtn) {
      connectHrmBtn.addEventListener("click", () => connectHeartRateMonitor());
    }

    const disconnectTrainerBtn = document.getElementById("disconnectTrainer");
    if (disconnectTrainerBtn) {
      disconnectTrainerBtn.addEventListener("click", () => disconnectDevice("trainer"));
    }

    const disconnectHrmBtn = document.getElementById("disconnectHrm");
    if (disconnectHrmBtn) {
      disconnectHrmBtn.addEventListener("click", () => disconnectDevice("hrm"));
    }
  }
}

function renderSession() {
  const session = getCurrentSession();
  const user = getCurrentUser();
  if (!session || !user) {
    state.view = "lobby";
    render();
    return;
  }
  normalizeSessionCourse(session);
  user.bikeId = normalizeBikeId(user.bikeId);

  const now = currentMs();
  const startedAt = session.startedAt;
  const durationSec = startedAt ? Math.round((now - startedAt) / 1000) : 0;
  const timerLabel = startedAt ? formatDuration(durationSec) : "00:00";

  const users = Object.values(session.users || {});

  const telemetry = session.telemetry || {};
  const courseSegments = getCourseSegments(session);

  const connectedPeers = Object.values(state.webrtc.peers).filter((p) => p.connected).length;
  let webrtcStatus = "WebRTC not supported";
  if (state.webrtc.enabled) {
    if (state.webrtc.useLocalStorage) {
      webrtcStatus = `${connectedPeers} peer${connectedPeers === 1 ? "" : "s"} connected (localStorage)`;
    } else if (state.webrtc.wsConnected) {
      webrtcStatus = `${connectedPeers} peer${connectedPeers === 1 ? "" : "s"} connected (signaling)`;
    } else {
      webrtcStatus = `connecting signaling...`;
    }
  }

  const rows = users
    .map((u) => {
      const t = telemetry[u.id] || {};
      const distance = t.distance || 0;
      const climbMeters = Number(session.aggregates?.[u.id]?.totalClimb) || 0;
      const wkg = computeWkg(t.power, u.weight);
      const isMe = user.id === u.id;
      const gradeFromDistance = getCourseGradeContext(distance, courseSegments).currentGrade;
      const participantName = u.isBot
        ? `${u.name} (Bot L${normalizeBotDifficultyLevel(u.difficultyLevel)} - ${Math.round(Number(u.ftpWatts) || 0)}W)`
        : u.name;
      return {
        ...u,
        participantLabel: participantName,
        power: t.power || 0,
        heartRate: t.heartRate || 0,
        cadence: t.cadence || 0,
        activePowerUp: t.activePowerUp || null,
        distance,
        climbMeters,
        grade: Number.isFinite(t.grade) ? t.grade : gradeFromDistance,
        wkg,
        isMe,
      };
    })
    .sort((a, b) => b.distance - a.distance);
  const currentRider = rows.find((row) => row.id === user.id) || rows[0] || null;
  const currentDistanceMeters = currentRider ? currentRider.distance : 0;
  const sessionRoute = getSessionRoute(session);
  const routeDistanceMeters = normalizeCourseDistance(currentDistanceMeters, courseSegments);
  const currentElevationMeters = getElevationAtDistance(sessionRoute, routeDistanceMeters);
  const next500mGradient = getAverageGradientAhead(sessionRoute, routeDistanceMeters, 500);
  const remainingDistanceMeters = getRemainingDistance(sessionRoute, routeDistanceMeters);
  const remainingClimbMeters = getRemainingClimb(sessionRoute, routeDistanceMeters);
  const routeDistanceKm = Number.isFinite(Number(sessionRoute.distanceKm))
    ? Number(sessionRoute.distanceKm)
    : (Number(sessionRoute.totalDistanceMeters) || 0) / 1000;
  const routeProfile = buildRouteProfileFromSegments(courseSegments);
  const elevationProfileHtml = renderElevationProfile({
    routeProfile,
    distanceTraveledMeters: currentDistanceMeters,
    width: 560,
    height: 120,
  });
  const sideScrollRaceViewHtml = buildSessionSideScrollViewHtml(session, user, {
    predictMotion: true,
    nowMs: now,
  });

  const telemetryZoneParticipants = rows.map((row) => ({
    id: row.id,
    name: row.participantLabel || row.name,
    heartRate: row.heartRate,
    watts: row.power,
  }));
  const hasLiveTelemetry = telemetryZoneParticipants.some((participant) => participant.heartRate > 0 || participant.watts > 0);
  const zoneParticipants = hasLiveTelemetry ? telemetryZoneParticipants : getMockTelemetryParticipants();
  const zoneStatusLabel = hasLiveTelemetry
    ? "Live values. Colors only: green (low), yellow (medium), red (high)."
    : "No live values yet. Showing mock participant data for testing.";
  const terrain = state.simulation.terrain;
  const currentGradeText = formatSignedPercent(terrain.currentGrade, 1);
  const effectiveGradeText = formatSignedPercent(terrain.effectiveGrade, 1);
  const nextGradeText = formatSignedPercent(terrain.nextGrade, 1);
  const distanceToNextText =
    terrain.distanceToNext == null || Number.isNaN(terrain.distanceToNext) ? "--" : `${Math.max(0, Math.round(terrain.distanceToNext))}m`;
  const routeLength = getCourseLengthMeters(courseSegments);
  const routeDistanceText = `${Math.round(terrain.routeDistance || 0)}m / ${Math.round(routeLength)}m`;
  const sessionClimbedText = formatClimbedMeters(session.totalClimbedMeters || 0);
  const privateRiderStats = getPrivateRiderStatsSnapshot(session, user);
  const sessionAvgWattsText = Number.isFinite(privateRiderStats.avgWatts) ? `${Math.round(privateRiderStats.avgWatts)} W` : "--";
  const privateSpeedText = formatSpeedMpsAsKph(privateRiderStats.speedMps);
  const accountProfile = getCurrentAccountProfile();
  const currentFtpWatts = getUserFtp(accountProfile);
  const pendingFtpProposal = getPendingFtpProposal(session, user);
  const currentBike = getBikeById(user.bikeId);
  const sessionBikeOptionsHtml = buildBikeOptionsHtml(currentBike.id);
  const bikeSwitchAllowed = !isSessionRunning() || canSwitchBikeAtSpeed(privateRiderStats.speedMps);
  const bikeSwitchReason = bikeSwitchAllowed
    ? "Bike can be changed now."
    : `Slow to ${BIKE_SWITCH_SPEED_LIMIT_KPH.toFixed(1)} km/h or less to change bikes during a ride.`;
  const powerUpState = ensurePowerUpContext(session, user);
  const activePowerUp = getActivePowerUp(powerUpState, now);
  const canActivatePowerUp = powerUpState.powerUpQueue.length > 0 && !activePowerUp;
  const activePowerUpText = formatActivePowerUpLabel(activePowerUp, now);
  const powerUpSlotsHtml = Array.from({ length: POWER_UP_QUEUE_MAX }, (_, index) => {
    const queued = powerUpState.powerUpQueue[index];
    return `<div class="powerup-slot ${queued ? "filled" : ""}">${queued ? escapeHtml(queued.label) : "EMPTY"}</div>`;
  }).join("");
  const sessionBots = Object.values(session.users || {}).filter((participant) => participant?.isBot);
  const sessionBotRowsHtml = sessionBots
    .map((bot) => {
      const difficultyOptions = buildBotDifficultyOptionsHtml(bot.difficultyLevel);
      return `
        <div class="card" style="margin-top:10px;">
          <div class="flex-space">
            <div>
              <div><strong>${escapeHtml(bot.name)}</strong></div>
              <div class="small">${escapeHtml(getBotDifficultyConfig(bot.difficultyLevel).label)} | ${Math.round(Number(bot.ftpWatts) || 0)} W FTP</div>
            </div>
            <button type="button" class="secondary" data-remove-session-bot="${bot.id}">Remove</button>
          </div>
          <div style="margin-top:10px;max-width:320px;">
            <label class="label">Difficulty</label>
            <select data-session-bot-difficulty="${bot.id}">${difficultyOptions}</select>
          </div>
        </div>
      `;
    })
    .join("");
  const canConfigureSessionBots = user.isHost && !session.startedAt;
  const sessionBotConfigHtml = canConfigureSessionBots
    ? `
      <div class="card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Bot Riders (Pre-start)</h2>
        <div class="small">Add up to ${MAX_SESSION_BOTS} pacing/challenge bots before starting the session.</div>
        <div style="margin-top:10px;">
          <button id="addSessionBotBtn" class="secondary" ${sessionBots.length < MAX_SESSION_BOTS ? "" : "disabled"}>Add Bot (${sessionBots.length}/${MAX_SESSION_BOTS})</button>
        </div>
        ${sessionBotRowsHtml || "<div class='small' style='margin-top:10px;'>No bots configured for this session.</div>"}
      </div>
    `
    : "";
  const privatePeakRows = PRIVATE_RIDER_PEAK_WINDOWS.map((windowDef) => {
    const peakValue = privateRiderStats.bestRollingWatts?.[windowDef.seconds];
    return `
      <tr>
        <td>${windowDef.label}</td>
        <td>${Number.isFinite(peakValue) ? `${Math.round(peakValue)} W` : "--"}</td>
      </tr>
    `;
  }).join("");
  const ftpUpdateCardHtml =
    state.account.userId && Number.isFinite(currentFtpWatts) && pendingFtpProposal
      ? `
      <div class="card ftp-update-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">FTP Update Available</h2>
        <div class="small">
          Your recent effort suggests a higher FTP.
          Current: <strong>${Math.round(currentFtpWatts)} W</strong> |
          Suggested: <strong>${Math.round(pendingFtpProposal.candidateFtpWatts)} W</strong>
        </div>
        <div class="small" style="margin-top:6px;">Source: ${escapeHtml(pendingFtpProposal.sourceLabel || "Recent effort")}</div>
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="acceptFtpUpdateBtn">Accept new FTP</button>
          <button id="declineFtpUpdateBtn" class="secondary">Decline</button>
        </div>
      </div>
    `
      : "";

  appEl.innerHTML = `
    <div class="card">
      <div class="flex-space">
        <div>
          <h2>Session <span class="code">${session.code}</span></h2>
          <div class="small">${session.users ? Object.keys(session.users).length : 0} rider(s)</div>
          <div class="small">${escapeHtml(sessionRoute.name || "Route")} (${escapeHtml(sessionRoute.country || "Unknown")}) • ${routeDistanceKm.toFixed(1)} km</div>
        </div>
        <div class="flex" style="align-items:center; gap:12px;">
          <div class="small">Timer</div>
          <div class="code">${timerLabel}</div>
          <button id="leaveBtn" class="secondary">Leave</button>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <label class="label">Your role</label>
          <div class="code">${user.isHost ? "Host" : "Guest"}</div>
        </div>
        <div style="flex:1; min-width:220px;">
          <label class="label">Your name</label>
          <div class="code">${user.name}</div>
        </div>
        <div style="flex:1; min-width:220px;">
          <label class="label">Your weight</label>
          <div class="code">${user.weight ? `${user.weight} kg` : "--"}</div>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
        <button id="copyCodeBtn" class="secondary">Copy code</button>
        <button id="pairSessionBtn" class="secondary">Pair devices</button>
        ${canStartSession() ? `<button id="startBtn">Start session</button>` : ""}
        ${isSessionRunning() && user.isHost ? `<button id="endBtn" class="danger">End session</button>` : ""}
        <div class="small" style="margin-left:auto;">${isSessionRunning() ? "Running" : session.endedAt ? "Ended" : "Waiting"}</div>
      </div>

      <div class="small" style="margin-top:8px;">
        Trainer: ${state.devices.trainer.connected ? state.devices.trainer.name : "Not connected"} | HR: ${state.devices.hrm.connected ? state.devices.hrm.name : "Not connected"}
      </div>
      <div class="small" style="margin-top:4px;">WebRTC: ${webrtcStatus}</div>

      ${sessionBotConfigHtml}

      <div class="terrain-panel" style="margin-top:12px;">
        <div class="terrain-grid">
          <div>
            <div class="small">Current grade</div>
            <div class="grade-readout ${getGradeColorClass(terrain.currentGrade)}">${currentGradeText}</div>
          </div>
          <div>
            <div class="small">Effective grade</div>
            <div class="grade-readout ${getGradeColorClass(terrain.effectiveGrade)}">${effectiveGradeText}</div>
          </div>
          <div>
            <div class="small">Lookahead</div>
            <div class="grade-next">${nextGradeText} in ${distanceToNextText}</div>
          </div>
          <div>
            <div class="small">Resistance feel</div>
            <div class="resistance-readout ${getResistanceFeelClass(terrain.resistanceLabel)}">
              ${terrain.resistanceLabel || "--"} (${Math.round(terrain.resistancePercent || 0)}%)
            </div>
          </div>
        </div>
        <div class="small" style="margin-top:8px;">Route position: ${routeDistanceText}</div>
        <div class="small" style="margin-top:2px;">
          Elevation: ${Math.round(currentElevationMeters)}m | Next 500m: ${formatSignedPercent(next500mGradient, 1)} | Remaining: ${formatDistanceKmFloor(
            remainingDistanceMeters,
          )} / ${Math.round(remainingClimbMeters)}m climb
        </div>
        <div class="small" style="margin-top:2px;">${sessionClimbedText}</div>
        <div class="small" style="margin-top:2px;">Trainer control: ${escapeHtml(terrain.trainerControlStatus || "--")}</div>
      </div>

      <div class="elevation-profile-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Session Side-Scroller (Prototype)</h2>
        <div class="small">Local rider is centered. Riders ahead are right, behind are left.</div>
        <div id="sessionSideScrollMount">${sideScrollRaceViewHtml}</div>
      </div>

      <div class="elevation-profile-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Route Side View</h2>
        <div class="small">Live progress along the route elevation profile.</div>
        ${elevationProfileHtml}
      </div>

      <div class="card private-rider-stats-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Your Private Rider Stats</h2>
        <div class="small">Visible only to you. Refreshed every 5 seconds.</div>
        <div class="flex" style="margin-top:10px; gap:12px; flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <label class="label">Session average power</label>
            <div class="code">${sessionAvgWattsText}</div>
          </div>
          <div style="flex:1;min-width:180px;">
            <label class="label">Current speed</label>
            <div class="code">${privateSpeedText}</div>
          </div>
        </div>
        <table class="table" style="margin-top:12px;">
          <thead>
            <tr>
              <th>Peak Window</th>
              <th>Best Avg Watts</th>
            </tr>
          </thead>
          <tbody>
            ${privatePeakRows}
          </tbody>
        </table>
      </div>

      ${ftpUpdateCardHtml}

      <div class="bike-choice-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Bike Selection</h2>
        <div class="small">Choose your bike before a ride, or during a ride only at low speed.</div>
        <div class="flex" style="gap:12px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;">
          <div style="flex:1;min-width:240px;">
            <label class="label">Current bike</label>
            <select id="sessionBikeSelect">${sessionBikeOptionsHtml}</select>
          </div>
          <div>
            <button id="applySessionBikeBtn" class="secondary" ${bikeSwitchAllowed ? "" : "disabled"}>Apply Bike</button>
          </div>
        </div>
        <div class="small" style="margin-top:8px;">${escapeHtml(bikeSwitchReason)}</div>
        <div class="small" style="margin-top:8px;"><strong>${escapeHtml(currentBike.name)}</strong> - ${escapeHtml(currentBike.description)}</div>
        <div class="small" style="margin-top:2px;">Pros: ${escapeHtml(currentBike.pros)}</div>
        <div class="small" style="margin-top:2px;">Cons: ${escapeHtml(currentBike.cons)}</div>
      </div>

      <div class="card powerup-card" style="margin-top:12px;">
        <h2 style="margin-bottom:8px;">Power-Ups</h2>
        <div class="small">Gain 1 BOOST every ${Math.round(POWER_UP_GRANT_DISTANCE_METERS / 1000)} km. Queue is FIFO (left slot is used first).</div>
        <div class="powerup-slots" style="margin-top:10px;">
          ${powerUpSlotsHtml}
        </div>
        <div class="small" style="margin-top:8px;">Active: ${escapeHtml(activePowerUpText)}</div>
        <div style="margin-top:10px;">
          <button id="activatePowerUpBtn" ${canActivatePowerUp ? "" : "disabled"}>Activate Next Power-Up</button>
        </div>
        <div class="small" style="margin-top:8px;">Other riders can see active usage only, not your inventory.</div>
      </div>

      <div style="margin-top:18px;">
        <h2 style="margin-bottom:8px;">Participant Telemetry Zones (MVP)</h2>
        <div class="small">${zoneStatusLabel}</div>
        <div class="telemetry-zone-grid telemetry-zone-header" style="margin-top:10px;">
          <div>Participant</div>
          <div>Heart Rate</div>
          <div>Watts</div>
        </div>
        <div class="telemetry-zone-list">
          ${renderTelemetryZoneRows(zoneParticipants)}
        </div>
      </div>

      <table class="table" style="margin-top: 16px;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Watts</th>
            <th>W/kg</th>
            <th>HR</th>
            <th>Grade</th>
            <th>Power-Up</th>
            <th>Distance / Climb</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr class="${row.isMe ? "highlight" : ""}">
              <td>${row.participantLabel || row.name}</td>
              <td>${row.power ? `${row.power}W` : "--"}</td>
              <td>${row.wkg ? formatNumber(row.wkg, 1) : "--"}</td>
              <td>${row.heartRate ? `${row.heartRate} bpm` : "--"}</td>
              <td><span class="grade-chip ${getGradeColorClass(row.grade)}">${formatSignedPercent(row.grade, 1)}</span></td>
              <td>${escapeHtml(formatActivePowerUpLabel(row.activePowerUp, now))}</td>
              <td>${formatDistanceKmFloor(row.distance)} | ${Math.round(row.climbMeters)} m climbed</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <div class="small" style="margin-top: 16px;">
        <strong>Note:</strong> This demo uses mock telemetry and WebSocket signaling (with localStorage fallback).
      </div>
    </div>
  `;

  document.getElementById("leaveBtn").addEventListener("click", () => {
    leaveSession();
  });

  const copyBtn = document.getElementById("copyCodeBtn");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(session.code);
      showToast("Code copied");
    } catch {
      showToast("Copy failed");
    }
  });

  document.getElementById("pairSessionBtn").addEventListener("click", () => {
    openPairing("session");
  });

  const addSessionBotBtn = document.getElementById("addSessionBotBtn");
  if (addSessionBotBtn) {
    addSessionBotBtn.addEventListener("click", () => {
      if (!user.isHost || session.startedAt) return;
      updateSessionOnStorage((sessionState) => {
        const existingBots = Object.values(sessionState.users || {}).filter((participant) => participant?.isBot);
        if (existingBots.length >= MAX_SESSION_BOTS) return;
        const botDraft = createBotDraft(existingBots.length + 1, 4);
        botDraft.name = getNextBotName(existingBots);
        addBotToSession(sessionState, botDraft);
      });
    });
  }

  document.querySelectorAll("[data-remove-session-bot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!user.isHost || session.startedAt) return;
      const botId = btn.getAttribute("data-remove-session-bot");
      updateSessionOnStorage((sessionState) => {
        removeBotFromSession(sessionState, botId);
      });
    });
  });

  document.querySelectorAll("[data-session-bot-difficulty]").forEach((selectEl) => {
    selectEl.addEventListener("change", () => {
      if (!user.isHost || session.startedAt) return;
      const botId = selectEl.getAttribute("data-session-bot-difficulty");
      const nextLevel = selectEl.value;
      updateSessionOnStorage((sessionState) => {
        updateBotDifficulty(sessionState, botId, nextLevel);
      });
      window.setTimeout(() => {
        flushDeferredSessionRender();
      }, 0);
    });
    selectEl.addEventListener("blur", () => {
      window.setTimeout(() => {
        flushDeferredSessionRender();
      }, 0);
    });
  });

  const activatePowerUpBtn = document.getElementById("activatePowerUpBtn");
  if (activatePowerUpBtn) {
    activatePowerUpBtn.addEventListener("click", () => {
      const powerUpRuntime = ensurePowerUpContext(session, user);
      const activation = useNextPowerUp(powerUpRuntime, currentMs());
      if (!activation.ok) {
        showToast(activation.error || "Could not activate power-up.");
        render();
        return;
      }
      showToast(`${activation.powerUp.label} activated for ${Math.round(activation.powerUp.durationMs / 1000)}s.`);
      render();
    });
  }

  const acceptFtpUpdateBtn = document.getElementById("acceptFtpUpdateBtn");
  if (acceptFtpUpdateBtn) {
    acceptFtpUpdateBtn.addEventListener("click", () => {
      const result = acceptPendingFtpProposal(session, user);
      if (!result.ok) {
        showToast(result.error || "Could not update FTP.");
        render();
        return;
      }
      showToast(`FTP updated to ${Math.round(result.ftpWatts)} W.`);
      render();
    });
  }

  const declineFtpUpdateBtn = document.getElementById("declineFtpUpdateBtn");
  if (declineFtpUpdateBtn) {
    declineFtpUpdateBtn.addEventListener("click", () => {
      const result = declinePendingFtpProposal(session, user);
      if (!result.ok) {
        showToast(result.error || "Could not dismiss FTP suggestion.");
        return;
      }
      showToast("FTP suggestion dismissed.");
      render();
    });
  }

  const applySessionBikeBtn = document.getElementById("applySessionBikeBtn");
  if (applySessionBikeBtn) {
    applySessionBikeBtn.addEventListener("click", () => {
      const nextBikeId = normalizeBikeId(document.getElementById("sessionBikeSelect")?.value || user.bikeId);
      const latestPrivateStats = getPrivateRiderStatsSnapshot(session, user);
      const canSwitchNow = !isSessionRunning() || canSwitchBikeAtSpeed(latestPrivateStats.speedMps);
      if (!canSwitchNow) {
        showToast(`Bike can only be changed at ${BIKE_SWITCH_SPEED_LIMIT_KPH.toFixed(1)} km/h or less.`);
        render();
        return;
      }
      if (normalizeBikeId(user.bikeId) === nextBikeId) {
        showToast("Bike already selected.");
        return;
      }

      state.user = {
        ...state.user,
        bikeId: nextBikeId,
      };
      state.lobby.selectedBikeId = nextBikeId;
      updateSessionOnStorage((sessionState) => {
        sessionState.users = sessionState.users || {};
        const existingUser = sessionState.users[user.id] || {};
        sessionState.users[user.id] = {
          id: user.id,
          name: existingUser.name || user.name,
          weight: existingUser.weight ?? user.weight ?? null,
          bikeId: nextBikeId,
        };
      });
      showToast(`${getBikeById(nextBikeId).name} selected.`);
    });
  }

  if (canStartSession()) {
    document.getElementById("startBtn").addEventListener("click", () => {
      startSession();
    });
  }

  if (isSessionRunning() && user.isHost) {
    document.getElementById("endBtn").addEventListener("click", () => {
      endSession();
    });
  }

  startSessionSideScrollRenderLoop();
}

function renderSummary() {
  const session = getCurrentSession();
  if (!session) {
    state.view = "lobby";
    render();
    return;
  }

  const summaries = loadSummaries();
  const selected = summaries.find((s) => s.code === session.code);
  if (!selected) {
    // If we don't have a saved summary, attempt to compute from the live session data
    const computed = computeSessionSummary();
    if (computed) {
      renderSummaryFromData(computed);
      return;
    }
    state.view = "lobby";
    render();
    return;
  }

  renderSummaryFromData(selected);
}

function renderSummaryFromData(summary) {
  const rows = summary.participants
    .map((u) => {
      const participantCalories = normalizeCaloriesValue(
        u.caloriesBurned != null ? u.caloriesBurned : calculateSessionCalories(summary, u).caloriesBurned,
      );
      return `
        <tr>
          <td>${u.name}</td>
          <td>${u.maxPower ? `${Math.round(u.maxPower)}W` : "--"}</td>
          <td>${u.avgPower ? `${Math.round(u.avgPower)}W` : "--"}</td>
          <td>${u.avgHeartRate ? `${Math.round(u.avgHeartRate)} bpm` : "--"}</td>
          <td>${formatDistanceKmFloor(u.totalDistance)}</td>
          <td>${Number.isFinite(u.totalClimbMeters) && u.totalClimbMeters >= 0 ? `${Math.round(u.totalClimbMeters)} m` : "--"}</td>
          <td>${formatCalories(participantCalories)}</td>
        </tr>
      `;
    })
    .join("");
  const viewerProfileId = state.account.userId || state.user?.id || null;
  const viewerXpAward = viewerProfileId && summary?.xpAwards ? summary.xpAwards[viewerProfileId] : null;
  const viewerParticipant = viewerProfileId ? (summary.participants || []).find((item) => item.id === viewerProfileId) : null;
  const viewerCaloriesFallback = viewerParticipant ? calculateSessionCalories(summary, viewerParticipant).caloriesBurned : 0;
  const viewerCaloriesAward = viewerProfileId && summary?.calorieAwards ? summary.calorieAwards[viewerProfileId] : null;
  const viewerCaloriesBurned = normalizeCaloriesValue(
    viewerCaloriesAward?.caloriesBurned != null
      ? viewerCaloriesAward.caloriesBurned
      : viewerParticipant?.caloriesBurned != null
        ? viewerParticipant.caloriesBurned
        : viewerCaloriesFallback,
  );
  const summaryTotalCalories = normalizeCaloriesValue(
    summary.totalCaloriesBurned != null
      ? summary.totalCaloriesBurned
      : (summary.participants || []).reduce(
          (total, participant) =>
            total +
            normalizeCaloriesValue(
              participant?.caloriesBurned != null
                ? participant.caloriesBurned
                : calculateSessionCalories(summary, participant).caloriesBurned,
            ),
          0,
        ),
  );
  const xpSummaryHtml = viewerXpAward
    ? `
      <div class="card" style="margin-top:14px;">
        <h2>Experience Earned</h2>
        <div class="small"><strong>+${formatNumber(viewerXpAward.earnedXp, 0)} XP</strong> this session</div>
        <div class="small" style="margin-top:8px;">Time ridden: +${formatNumber(viewerXpAward.breakdown?.durationXp || 0, 0)} XP</div>
        <div class="small">Distance: +${formatNumber(viewerXpAward.breakdown?.distanceXp || 0, 0)} XP</div>
        <div class="small">Climb: +${formatNumber(viewerXpAward.breakdown?.climbXp || 0, 0)} XP</div>
        <div class="small" style="margin-top:8px;">
          Level ${viewerXpAward.beforeLevel} -> Level ${viewerXpAward.afterLevel}
          ${
            viewerXpAward.levelsGained > 0
              ? `(+${viewerXpAward.levelsGained} level${viewerXpAward.levelsGained === 1 ? "" : "s"})`
              : ""
          }
        </div>
      </div>
    `
    : `
      <div class="card" style="margin-top:14px;">
        <h2>Experience Earned</h2>
        <div class="small">No XP summary is available for this session/user.</div>
      </div>
    `;
  const caloriesSummaryHtml = `
    <div class="card" style="margin-top:14px;">
      <h2>Calories Burned</h2>
      <div class="small"><strong>${formatCalories(viewerCaloriesBurned)}</strong> this session</div>
      <div class="small" style="margin-top:8px;">Session total across riders: ${formatCalories(summaryTotalCalories)}</div>
    </div>
  `;

  appEl.innerHTML = `
    <div class="card">
      <div class="flex-space">
        <div>
          <h2>Session summary <span class="code">${summary.code}</span></h2>
          <div class="small">Duration: ${formatDuration(summary.durationSec)}</div>
          <div class="small">${formatClimbedMeters(summary.totalClimbedMeters)}</div>
          <div class="small">Calories: ${formatCalories(summaryTotalCalories)}</div>
        </div>
        <button id="backBtn" class="secondary">Back to lobby</button>
      </div>

      ${xpSummaryHtml}
      ${caloriesSummaryHtml}

      <table class="table" style="margin-top:16px;">
        <thead>
          <tr>
            <th>Name</th>
            <th>Max power</th>
            <th>Avg power</th>
            <th>Avg HR</th>
            <th>Distance (KM)</th>
            <th>Climb (m)</th>
            <th>Calories</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("backBtn").addEventListener("click", () => {
    state.view = "lobby";
    resetPrivateRiderStats();
    resetPowerUpState();
    resetFtpProposalState();
    state.session = null;
    state.user = null;
    clearLocalSession();
    render();
  });
}

function loadExistingSession() {
  const saved = loadLocalSession();
  if (!saved.code || !saved.userId) return false;

  const session = loadSessionFromStorage(saved.code);
  if (!session) return false;
  const userRecord = session.users?.[saved.userId];
  if (!userRecord) return false;
  normalizeSessionCourse(session);
  if (!Number.isFinite(session.totalClimbedMeters)) {
    session.totalClimbedMeters = 0;
  }
  saveSessionToStorage(session);

  state.session = session;
  state.user = { ...userRecord, id: userRecord.id, bikeId: normalizeBikeId(userRecord.bikeId), isHost: saved.userId === session.hostId };
  state.view = "session";
  initWebRTC(session.code, state.user.isHost);
  return true;
}

function startLoop() {
  if (state.timer) return;
  state.lastTick = currentMs();

  const step = () => {
    const session = getCurrentSession();
    const sessionRunning = !!(session && isSessionRunning());
    if (sessionRunning) {
      pollTelemetry();
    }

    // Avoid rebuilding the entire session DOM while waiting to start,
    // so open controls (like bot difficulty selects) don't get closed.
    if (state.view === "session" && sessionRunning) {
      render();
    }

    state.timer = window.setTimeout(step, TELEMETRY_POLL_INTERVAL_MS);
  };

  step();
}

function init() {
  window.addEventListener("storage", syncSessionFromStorage);
  restoreAuthSession();
  const progressionValidation = validateProgressionMath();
  if (!progressionValidation.valid) {
    console.warn("Progression validation issues:", progressionValidation.issues);
  }

  if (!loadExistingSession()) {
    state.view = "lobby";
  }

  render();
  startLoop();
}

init();


