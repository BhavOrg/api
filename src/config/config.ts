import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  // Server configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database configuration
  database: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST || "localhost",
    name: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || "our_secret_key",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  // Authentication configuration
  auth: {
    saltRounds: 10,
    sessionTimeout: 86400000, // 24 hours in milliseconds
  },
};
