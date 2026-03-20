#!/usr/bin/env node

// Minimal WebSocket signaling server for RideSync WebRTC demo.
// Usage:
//   npm install
//   node signaling-server.js

const WebSocket = require("ws");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const wss = new WebSocket.Server({ port: PORT });

// rooms: sessionCode -> Map(peerId -> ws)
const rooms = new Map();
// sessions: sessionCode -> sessionState
const sessions = new Map();

function safeSend(ws, msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // ignore
  }
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function broadcastRoom(session, msg, excludeWs = null) {
  const room = rooms.get(session);
  if (!room) return;
  for (const ws of room.values()) {
    if (ws !== excludeWs) {
      safeSend(ws, msg);
    }
  }
}

function getHostId(session) {
  const sessionState = sessions.get(session);
  if (sessionState?.hostId) return sessionState.hostId;
  const room = rooms.get(session);
  if (!room) return null;
  for (const [peerId, ws] of room.entries()) {
    if (ws.isHost) return peerId;
  }
  return null;
}

function sendSessionState(session, targetWs = null) {
  const sessionState = sessions.get(session);
  if (!sessionState) return;
  const msg = {
    type: "session-state",
    session,
    sessionData: sessionState,
  };
  if (targetWs) {
    safeSend(targetWs, msg);
    return;
  }
  broadcastRoom(session, msg);
}

function ensureAggregate(sessionState, userId) {
  sessionState.aggregates = sessionState.aggregates || {};
  if (!sessionState.aggregates[userId]) {
    sessionState.aggregates[userId] = {
      sampleCount: 0,
      totalPower: 0,
      maxPower: 0,
      totalHeartRate: 0,
      totalDistance: 0,
      totalClimb: 0,
    };
  }
  return sessionState.aggregates[userId];
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

function applyTelemetry(sessionState, userId, payload) {
  if (!payload || typeof payload !== "object") return;

  const power = Number(payload.power) || 0;
  const heartRate = Number(payload.heartRate) || 0;
  const cadence = Number(payload.cadence) || 0;
  const speedMps = Number(payload.speedMps);
  const grade = Number(payload.grade);
  const effectiveGrade = Number(payload.effectiveGrade);
  const resistancePercent = Number(payload.resistancePercent);
  const resistanceLabel = typeof payload.resistanceLabel === "string" ? payload.resistanceLabel : null;
  const activePowerUpPayload = payload.activePowerUp && typeof payload.activePowerUp === "object" ? payload.activePowerUp : null;
  const activePowerUp =
    activePowerUpPayload && typeof activePowerUpPayload.type === "string"
      ? {
          type: activePowerUpPayload.type,
          label: typeof activePowerUpPayload.label === "string" ? activePowerUpPayload.label : "POWER-UP",
          startedAtMs: Number(activePowerUpPayload.startedAtMs) || null,
          durationMs: Number(activePowerUpPayload.durationMs) || null,
          endsAtMs: Number(activePowerUpPayload.endsAtMs) || null,
        }
      : null;
  const distance = Number(payload.distance) || 0;
  const updatedAt = Number(payload.timestamp) || Date.now();
  const previousUpdatedAt = Number(sessionState.telemetry?.[userId]?.updatedAt) || updatedAt;
  const deltaTimeSeconds = Math.max(0, (updatedAt - previousUpdatedAt) / 1000);
  const gradeForClimb = Number.isFinite(effectiveGrade) ? effectiveGrade : Number.isFinite(grade) ? grade : 0;
  const climbDelta = calculateElevationGainMeters(speedMps, gradeForClimb, deltaTimeSeconds);

  sessionState.telemetry = sessionState.telemetry || {};
  sessionState.telemetry[userId] = {
    power,
    heartRate,
    cadence,
    speedMps: Number.isFinite(speedMps) ? speedMps : null,
    grade: Number.isFinite(grade) ? grade : null,
    effectiveGrade: Number.isFinite(effectiveGrade) ? effectiveGrade : null,
    resistancePercent: Number.isFinite(resistancePercent) ? resistancePercent : null,
    resistanceLabel,
    activePowerUp,
    distance,
    updatedAt,
  };

  const agg = ensureAggregate(sessionState, userId);
  agg.sampleCount += 1;
  agg.totalPower += power;
  agg.maxPower = Math.max(agg.maxPower, power);
  agg.totalHeartRate += heartRate;
  agg.totalDistance = distance;
  agg.totalClimb = (agg.totalClimb || 0) + climbDelta;
  sessionState.totalClimbedMeters = Object.values(sessionState.aggregates || {}).reduce(
    (total, value) => total + (Number(value?.totalClimb) || 0),
    0,
  );
}

function removePeer(session, peerId, expectedWs = null) {
  const room = rooms.get(session);
  if (!room) return false;
  const existing = room.get(peerId);
  if (!existing) return false;
  if (expectedWs && existing !== expectedWs) return false;

  room.delete(peerId);
  if (room.size === 0) {
    rooms.delete(session);
  }
  return true;
}

function removeUserFromSession(session, peerId) {
  const sessionState = sessions.get(session);
  if (!sessionState) return;

  if (peerId === sessionState.hostId) {
    if (sessionState.endedAt) {
      delete sessionState.users?.[peerId];
      return;
    }
    sessions.delete(session);
    broadcastRoom(session, {
      type: "session-error",
      session,
      message: "Host ended or left the session.",
    });
    return;
  }

  delete sessionState.users?.[peerId];
  delete sessionState.telemetry?.[peerId];
  delete sessionState.aggregates?.[peerId];

  if (!sessionState.users || Object.keys(sessionState.users).length === 0) {
    sessions.delete(session);
  }
}

function leaveSession(session, peerId, ws) {
  const removed = removePeer(session, peerId, ws);
  if (!removed) return;

  removeUserFromSession(session, peerId);
  broadcastRoom(session, { type: "peer-left", session, peerId });
  const room = rooms.get(session);
  if (!room || room.size === 0) {
    sessions.delete(session);
  }
  sendSessionState(session);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8"));
    } catch {
      return;
    }

    const { type, session, peerId } = msg || {};
    if (!type) return;

    if (type === "join") {
      if (!session || !peerId) return;

      let room = rooms.get(session);
      if (!room) {
        room = new Map();
        rooms.set(session, room);
      }

      const previousWs = room.get(peerId);
      if (previousWs && previousWs !== ws) {
        previousWs.replacedByNewConnection = true;
        try {
          previousWs.close();
        } catch {
          // ignore
        }
      }

      ws.session = session;
      ws.peerId = peerId;
      ws.isHost = !!msg.isHost;
      room.set(peerId, ws);

      let sessionState = sessions.get(session);
      const userFromClient = msg.user && typeof msg.user === "object" ? msg.user : null;

      if (!sessionState) {
        if (!ws.isHost) {
          safeSend(ws, {
            type: "session-error",
            session,
            message: "Session not found.",
          });
          removePeer(session, peerId, ws);
          try {
            ws.close();
          } catch {
            // ignore
          }
          return;
        }

        const fromClient = msg.sessionState && typeof msg.sessionState === "object" ? cloneJson(msg.sessionState) : null;
        sessionState =
          fromClient ||
          {
            code: session,
            hostId: peerId,
            startedAt: null,
            endedAt: null,
            createdAt: Date.now(),
            users: {},
            telemetry: {},
            aggregates: {},
            totalClimbedMeters: 0,
          };

        sessionState.code = session;
        sessionState.hostId = sessionState.hostId || peerId;
        sessionState.users = sessionState.users || {};
        sessionState.telemetry = sessionState.telemetry || {};
        sessionState.aggregates = sessionState.aggregates || {};
        if (!Number.isFinite(sessionState.totalClimbedMeters)) {
          sessionState.totalClimbedMeters = 0;
        }
        sessions.set(session, sessionState);
      }

      const existingUser = sessionState.users?.[peerId] || {};
      sessionState.users = sessionState.users || {};
      if (!Number.isFinite(sessionState.totalClimbedMeters)) {
        sessionState.totalClimbedMeters = 0;
      }
      sessionState.users[peerId] = {
        id: peerId,
        name: userFromClient?.name || existingUser.name || (ws.isHost ? "Host" : "Rider"),
        weight:
          userFromClient && Object.prototype.hasOwnProperty.call(userFromClient, "weight")
            ? userFromClient.weight
            : existingUser.weight ?? null,
      };

      // Notify the joiner about who is already in the room.
      safeSend(ws, {
        type: "peers",
        session,
        peers: Array.from(room.keys()).filter((id) => id !== peerId),
        hostId: getHostId(session),
      });

      sendSessionState(session, ws);

      // Notify others about the new peer.
      broadcastRoom(
        session,
        {
          type: "peer-joined",
          session,
          peerId,
          isHost: !!msg.isHost,
        },
        ws,
      );
      sendSessionState(session);

      return;
    }

    if (type === "signal") {
      if (!session) return;
      const { to, kind, payload } = msg;
      const from = ws.peerId || msg.from;
      if (!to || !from || !kind) return;
      const room = rooms.get(session);
      if (!room) return;
      const target = room.get(to);
      if (!target) return;

      safeSend(target, {
        type: "signal",
        session,
        from,
        kind,
        payload,
      });
      return;
    }

    if (type === "session-start") {
      if (!session || !peerId) return;
      const sessionState = sessions.get(session);
      if (!sessionState || sessionState.hostId !== peerId) return;
      if (!sessionState.startedAt) sessionState.startedAt = Date.now();
      sessionState.endedAt = null;
      sendSessionState(session);
      return;
    }

    if (type === "session-end") {
      if (!session || !peerId) return;
      const sessionState = sessions.get(session);
      if (!sessionState || sessionState.hostId !== peerId) return;
      if (!sessionState.endedAt) sessionState.endedAt = Date.now();
      sendSessionState(session);
      return;
    }

    if (type === "telemetry") {
      if (!session || !peerId) return;
      const sessionState = sessions.get(session);
      if (!sessionState) return;
      if (!sessionState.users?.[peerId]) return;
      applyTelemetry(sessionState, peerId, msg.payload);
      sendSessionState(session);
      return;
    }

    if (type === "leave") {
      if (!session || !peerId) return;
      leaveSession(session, peerId, ws);
      return;
    }
  });

  ws.on("close", () => {
    if (!ws.session || !ws.peerId) return;
    if (ws.replacedByNewConnection) return;
    leaveSession(ws.session, ws.peerId, ws);
  });
});

console.log(`Signaling server listening on ws://localhost:${PORT}`);
