export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  passphrase_hash: string;
  created_at: Date;
  last_login: Date | null;
  account_status: "active" | "locked" | "suspended";
}

export interface UserCreationData {
  username: string;
  password: string;
  passphrase: string;
}

export interface UserResponseData {
  user_id: string;
  username: string;
  created_at: Date;
  last_login: Date | null;
  account_status: string;
}
