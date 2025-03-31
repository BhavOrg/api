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

  // Sentiment analysis API configuration
  sentimentApi: {
    url: process.env.SENTIMENT_API_URL,
    apiKey: process.env.SENTIMENT_API_KEY,
    timeout: 5000, // 5 seconds timeout for API calls
  },

  // Feed settings
  feed: {
    defaultPageSize: 10,
    maxPageSize: 50,
    cacheTime: 300, // 5 minutes in seconds
  },

  // Content moderation settings
  moderation: {
    enabled: process.env.ENABLE_MODERATION === "true",
    apiUrl: process.env.MODERATION_API_URL,
    apiKey: process.env.MODERATION_API_KEY,
  },
};
