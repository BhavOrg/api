import { query } from "../config/database";

// Recording a failed login attempt
export const recordFailedAttempt = async (
  ipAddress: string,
  username?: string
): Promise<void> => {
  await query(
    "INSERT INTO failed_attempts (ip_address, username) VALUES ($1, $2)",
    [ipAddress, username || null]
  );
};

// Check if IP address is rate limited
export const isIpRateLimited = async (ipAddress: string): Promise<boolean> => {
  const result = await query(
    `SELECT COUNT(*) as attempt_count 
     FROM failed_attempts 
     WHERE ip_address = $1 
     AND attempt_time > NOW() - INTERVAL '15 minutes'`,
    [ipAddress]
  );

  const attemptCount = parseInt(result.rows[0].attempt_count);
  // Rate limit after 5 failed attempts in 15 minutes
  return attemptCount >= 5;
};

// Checking if account is under brute force attack
export const isAccountUnderAttack = async (
  username: string
): Promise<boolean> => {
  const result = await query(
    `SELECT COUNT(*) as attempt_count 
     FROM failed_attempts 
     WHERE username = $1 
     AND attempt_time > NOW() - INTERVAL '1 hour'`,
    [username]
  );

  const attemptCount = parseInt(result.rows[0].attempt_count);
  // Considering account under attack after 10 failed attempts in 1 hour
  return attemptCount >= 10;
};
