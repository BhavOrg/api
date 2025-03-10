import { query } from "../config/database";
import { Session } from "../types/auth.types";

// Creating a new session
export const createSession = async (
  userId: string,
  deviceFingerprint: string,
  ipAddress: string,
  expiresAt: Date
): Promise<Session> => {
  const result = await query(
    `INSERT INTO sessions 
     (user_id, device_fingerprint, ip_address, expires_at) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [userId, deviceFingerprint, ipAddress, expiresAt]
  );

  return result.rows[0] as Session;
};

// Finding a session by ID
export const findSessionById = async (
  sessionId: string
): Promise<Session | null> => {
  const result = await query(
    "SELECT * FROM sessions WHERE session_id = $1 AND is_active = TRUE",
    [sessionId]
  );

  return (result.rows[0] as Session) || null;
};

// Finding active sessions for a user by device fingerprint
export const findSessionByDevice = async (
  userId: string,
  deviceFingerprint: string
): Promise<Session | null> => {
  const result = await query(
    `SELECT * FROM sessions 
     WHERE user_id = $1 
     AND device_fingerprint = $2 
     AND is_active = TRUE 
     AND expires_at > NOW()`,
    [userId, deviceFingerprint]
  );

  return (result.rows[0] as Session) || null;
};

// Invalidating a session (logout)
export const invalidateSession = async (sessionId: string): Promise<void> => {
  await query("UPDATE sessions SET is_active = FALSE WHERE session_id = $1", [
    sessionId,
  ]);
};

// Invalidating all sessions for a user (force logout from all devices)
export const invalidateAllUserSessions = async (
  userId: string
): Promise<void> => {
  await query("UPDATE sessions SET is_active = FALSE WHERE user_id = $1", [
    userId,
  ]);
};

// Clean up expired sessions
export const cleanupExpiredSessions = async (): Promise<void> => {
  await query(
    "UPDATE sessions SET is_active = FALSE WHERE expires_at < NOW()",
    []
  );
};
