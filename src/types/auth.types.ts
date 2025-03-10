export interface LoginPasswordRequest {
  username: string;
  password: string;
  deviceInfo: DeviceInfo;
}

export interface LoginPassphraseRequest {
  username: string;
  passphrase: string;
  deviceInfo: DeviceInfo;
}

export interface RegistrationRequest {
  username?: string;
  password: string;
}

export interface DeviceInfo {
  userAgent: string;
  screenResolution?: string;
  colorDepth?: number;
  timezone?: string;
  language?: string;
  platform?: string;
  additionalInfo?: Record<string, any>;
}

export interface JwtPayload {
  user_id: string;
  username: string;
  session_id: string;
  iat?: number;
  exp?: number;
}

export interface Session {
  session_id: string;
  user_id: string;
  device_fingerprint: string;
  ip_address: string;
  is_active: boolean;
  created_at: Date;
  expires_at: Date;
}

export interface AuthResponse {
  token: string;
  user: {
    user_id: string;
    username: string;
  };
  expiresAt: number;
  isNewDevice: boolean;
}
