import { query } from "../config/database";
import { User, UserCreationData, UserResponseData } from "../types/user.types";
import { hashPassword } from "../utils/auth.utils";

// Creating a new user
export const createUser = async (userData: UserCreationData): Promise<User> => {
  const { username, password, passphrase } = userData;

  // Hashing the password and passphrase
  const passwordHash = await hashPassword(password);
  const passphraseHash = await hashPassword(passphrase);

  const result = await query(
    `INSERT INTO users 
     (username, password_hash, passphrase_hash) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [username, passwordHash, passphraseHash]
  );

  return result.rows[0] as User;
};

// Finding a user by username
export const findUserByUsername = async (
  username: string
): Promise<User | null> => {
  const result = await query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);

  return (result.rows[0] as User) || null;
};

// Finding a user by ID
export const findUserById = async (userId: string): Promise<User | null> => {
  const result = await query("SELECT * FROM users WHERE user_id = $1", [
    userId,
  ]);

  return (result.rows[0] as User) || null;
};

// Updating user's last login time
export const updateLastLogin = async (userId: string): Promise<void> => {
  await query("UPDATE users SET last_login = NOW() WHERE user_id = $1", [
    userId,
  ]);
};

// Formating user for response
export const formatUserResponse = (user: User): UserResponseData => {
  return {
    user_id: user.user_id,
    username: user.username,
    created_at: user.created_at,
    last_login: user.last_login,
    account_status: user.account_status,
  };
};
