import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/config";
import { JwtPayload } from "../types/auth.types";

// Hashing a password and passphrase
export const hashPassword = async (plaintext: string): Promise<string> => {
  const salt = await bcrypt.genSalt(config.auth.saltRounds);
  return bcrypt.hash(plaintext, salt);
};

// Verifying a password or passphrase
export const verifyPassword = async (
  plaintext: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(plaintext, hash);
};

// Generate a JWT token
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

// Verifying a JWT token
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch (error) {
    return null;
  }
};

// Generating a random username (for anonymous users)
export const generateRandomUsername = (): string => {
  // Generating a random string with prefix
  const randomId = uuidv4().substring(0, 8);
  return `user_${randomId}`;
};

// Generate a secure random passphrase (12 words)
export const generatePassphrase = (): string => {
  // TODO: This is for testing purpose only, for production we have to come up with better solutions
  const wordList = [
    "apple",
    "ocean",
    "mountain",
    "forest",
    "river",
    "sunset",
    "dawn",
    "valley",
    "desert",
    "cloud",
    "rain",
    "snow",
    "wind",
    "thunder",
    "lightning",
    "beach",
    "island",
    "moon",
    "star",
    "planet",
    "galaxy",
    "universe",
    "tree",
    "flower",
    "meadow",
    "path",
    "road",
    "journey",
    "silence",
    "whisper",
    "echo",
    "shadow",
    "light",
    "darkness",
    "dream",
    "horizon",
    "freedom",
    "truth",
    "wisdom",
    "courage",
    "hope",
    "peace",
  ];

  const passphrase: string[] = [];
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    passphrase.push(wordList[randomIndex]);
  }

  return passphrase.join(" ");
};
