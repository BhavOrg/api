import * as crypto from "crypto";
import { DeviceInfo } from "../types/auth.types";

// Generating a device fingerprint from DeviceInfo
export const generateDeviceFingerprint = (deviceInfo: DeviceInfo): string => {
  // Creating a string from all device info properties
  const deviceString = JSON.stringify({
    userAgent: deviceInfo.userAgent,
    screenResolution: deviceInfo.screenResolution,
    colorDepth: deviceInfo.colorDepth,
    timezone: deviceInfo.timezone,
    language: deviceInfo.language,
    platform: deviceInfo.platform,
  });

  // Creating a hash of the device string
  return crypto.createHash("sha256").update(deviceString).digest("hex");
};

// Checking if device is familiar by comparing fingerprints
export const isDeviceFamiliar = (
  storedFingerprint: string,
  currentFingerprint: string
): boolean => {
  return storedFingerprint === currentFingerprint;
};

// Extracting device info from request headers and body
export const extractDeviceInfo = (req: any): DeviceInfo => {
  const userAgent = req.headers["user-agent"] || "";

  // Trying to get device info from request body if provided
  const deviceInfo = req.body.deviceInfo || {};

  return {
    userAgent,
    screenResolution: deviceInfo.screenResolution,
    colorDepth: deviceInfo.colorDepth,
    timezone: deviceInfo.timezone,
    language: deviceInfo.language || req.headers["accept-language"],
    platform: deviceInfo.platform,
    additionalInfo: deviceInfo.additionalInfo,
  };
};
