import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "shopbook_auth_token";

/**
 * Decodes a base64url encoded string into a raw string.
 * This is a pure-JS helper to avoid Node environment dependencies in React Native.
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let decoded = '';
  let buffer = 0;
  let bits = 0;
  
  for (let i = 0; i < base64.length; i++) {
    const char = base64[i];
    if (char === '=') break;
    const idx = chars.indexOf(char);
    if (idx === -1) continue;
    
    buffer = (buffer << 6) | idx;
    bits += 6;
    
    if (bits >= 8) {
      bits -= 8;
      decoded += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return decoded;
}

/**
 * Decodes a JWT token payload to retrieve its expiry time (exp) in milliseconds.
 */
export function getJwtExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const decodedPayload = base64UrlDecode(parts[1]);
    const parsed = JSON.parse(decodedPayload);
    
    return parsed.exp ? parsed.exp * 1000 : null;
  } catch (err) {
    console.error("Failed to parse JWT payload expiry:", err);
    return null;
  }
}

/**
 * Checks if a JWT token is expired.
 */
export function isTokenExpired(token: string): boolean {
  const expiry = getJwtExpiry(token);
  if (!expiry) return false;
  return Date.now() >= expiry;
}

/**
 * Saves the session token securely to device storage.
 */
export async function saveSessionToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    console.error("Failed to save auth token to SecureStore:", err);
  }
}

/**
 * Retrieves the session token securely from device storage.
 */
export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    console.error("Failed to retrieve auth token from SecureStore:", err);
    return null;
  }
}

/**
 * Clears the session token from device storage.
 */
export async function deleteSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.error("Failed to delete auth token from SecureStore:", err);
  }
}
