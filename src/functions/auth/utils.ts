import { HttpRequest } from "@azure/functions";
import jwksClient from "jwks-rsa";
import jwt from "jsonwebtoken";

const sessionCookieName = process.env.SESSION_COOKIE_NAME;
export function createAuthCookieHeader(
  token: string,
  options: { maxAge?: number } = {},
): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure" : "Secure";
  const maxAge = options.maxAge || 60 * 60 * 24 * 7;
  return `${sessionCookieName}=${token}; HttpOnly; Max-Age=${maxAge}; ${secure}; SameSite=None; Path=/`;
}

export function clearAuthCookieHeader(): string {
  return `${sessionCookieName}=; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
}

export const getCookie = (
  headers: HttpRequest["headers"],
  cookieName: string = process.env.SESSION_COOKIE_NAME!,
): string | null => {
  try {
    const cookieHeader = headers.get("cookie") || headers.get("Cookie") || "";

    if (!cookieHeader) return null;

    const cookies = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);

    const target = cookies.find((c) =>
      c.toLowerCase().startsWith(`${cookieName.toLowerCase()}=`),
    );

    if (!target) return null;

    const value = target.substring(cookieName.length + 1);
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
});

export function getKey(
  header: jwt.JwtHeader,
  callback: jwt.SigningKeyCallback,
) {
  client.getSigningKey(header.kid!, (err, key) => {
    if (err) return callback(err, undefined);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}
