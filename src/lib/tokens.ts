import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes as base64url is always 43 characters. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const newToken = () => randomBytes(32).toString("base64url");

/** Only the hash is ever stored. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");