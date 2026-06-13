import bcrypt from "bcrypt";
import crypto from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import MySQLStoreFactory from "express-mysql-session";
import { pool } from "./db";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 10;
const TIMESHEETS_API_URL = (process.env.TIMESHEETS_API_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMESHEETS_LAUNCH_ALLOWED_ORIGINS = [
  "https://timesheets.deckfamilyfarm.com",
  "https://timesheets-test.deckfamilyfarm.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

type HerdlistSessionUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isAdmin: "yes" | "no";
  authProvider?: "local" | "timesheets";
  username?: string;
  employeeId?: string;
  timesheetsUserId?: string;
  role?: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function stripSensitiveUser(user: User): HerdlistSessionUser {
  const { passwordHash, passwordResetToken, passwordResetExpires, ...userWithoutSensitive } = user;
  return { ...userWithoutSensitive, authProvider: "local" } as HerdlistSessionUser;
}

function normalizeRole(value: unknown) {
  return String(value ?? "").trim();
}

function getAllowedTimesheetsRoles() {
  return String(process.env.HERDLIST_TIMESHEETS_ALLOWED_ROLES || "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function assertTimesheetsRoleAllowed(role: string) {
  const allowedRoles = getAllowedTimesheetsRoles();
  if (!allowedRoles.length || allowedRoles.includes(role)) return;
  throw new Error("Your timesheets account is not authorized for Herd List.");
}

function assertTimesheetsConfigured() {
  if (!TIMESHEETS_API_URL || !/^https?:\/\//i.test(TIMESHEETS_API_URL)) {
    throw new Error("TIMESHEETS_API_URL must be configured for Herd List login.");
  }
}

function extractJwtClaims(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Timesheets token format is invalid.");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
}

async function readJsonResponse(response: globalThis.Response) {
  return response.json().catch(() => null) as Promise<any>;
}

function deriveRole(payload: any) {
  return normalizeRole(payload?.data?.user_role ?? payload?.user_role ?? payload?.role ?? "0") || "0";
}

async function fetchTimesheetsRole(accessToken: string) {
  assertTimesheetsConfigured();

  const response = await fetch(`${TIMESHEETS_API_URL}/auth/getUserRole`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: "{}",
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "Failed to verify timesheets user role.");
  }

  const role = deriveRole(payload);
  assertTimesheetsRoleAllowed(role);
  return role;
}

function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function fallbackEmail(username: string, employeeId: string) {
  const localPart = (username || employeeId || "timesheets-user")
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${localPart || "timesheets-user"}@timesheets.local`;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function sessionUserFromTimesheetsToken(
  accessToken: string,
  role: string,
  fallbackUsername = "",
): HerdlistSessionUser {
  const claims = extractJwtClaims(accessToken);
  const employeeId = String(claims.employee_id ?? "").trim();
  const username = String(claims.username ?? fallbackUsername ?? "").trim();
  const timesheetsUserId = String(claims.id ?? "").trim();

  if (!employeeId || !username) {
    throw new Error("Timesheets token is missing username or employee_id.");
  }

  const fullName = String(claims.name ?? "").trim();
  const split = splitName(fullName);
  const firstName = String(claims.first_name ?? split.firstName ?? "").trim() || null;
  const lastName = String(claims.last_name ?? split.lastName ?? "").trim() || null;
  const email = cleanEmail(claims.email) || cleanEmail(username) || fallbackEmail(username, employeeId);

  return {
    id: `timesheets:${employeeId}`,
    email,
    firstName,
    lastName,
    isAdmin: "yes",
    authProvider: "timesheets",
    username,
    employeeId,
    timesheetsUserId,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function isTimesheetsLaunchOriginAllowed(origin: string | undefined) {
  if (!origin) return false;
  const allowed = String(process.env.TIMESHEETS_LAUNCH_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = allowed.length ? allowed : DEFAULT_TIMESHEETS_LAUNCH_ALLOWED_ORIGINS;
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

export async function loginAgainstTimesheets(username: string, password: string): Promise<HerdlistSessionUser> {
  assertTimesheetsConfigured();

  const response = await fetch(`${TIMESHEETS_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "Invalid username or password.");
  }

  const accessToken = payload?.data?.token;
  if (!accessToken) throw new Error("Timesheets login did not return an access token.");

  const role = await fetchTimesheetsRole(accessToken);
  return sessionUserFromTimesheetsToken(accessToken, role, username);
}

export async function authenticateTimesheetsAccessToken(
  accessToken: string,
  fallbackUsername = "",
): Promise<HerdlistSessionUser> {
  const role = await fetchTimesheetsRole(accessToken);
  return sessionUserFromTimesheetsToken(accessToken, role, fallbackUsername);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60; // 1 week in seconds
  
  // Create MySQL session store
  const MySQLStore = MySQLStoreFactory(session);
  const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: sessionTtl * 1000, // in milliseconds
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  }, pool as any);
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
	  secure: "auto",
      sameSite: "lax",
      maxAge: sessionTtl * 1000, // in milliseconds
    },
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function hashResetToken(token: string): Promise<string> {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValidPassword = await verifyPassword(password, user.passwordHash);
          
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, stripSensitiveUser(user));
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    if (user?.authProvider === "timesheets") {
      return done(null, user);
    }
    return done(null, user.id);
  });

  passport.deserializeUser(async (serializedUser: any, done) => {
    if (serializedUser?.authProvider === "timesheets") {
      return done(null, serializedUser);
    }

    try {
      const user = await storage.getUser(serializedUser);
      if (!user) {
        return done(null, false);
      }
      done(null, stripSensitiveUser(user));
    } catch (error) {
      done(error);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = async (req: any, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    if (req.user.authProvider === "timesheets") {
      if (req.user.isAdmin === "yes") return next();
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    const user = await storage.getUser(req.user.id);
    
    if (!user || user.isAdmin !== "yes") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    
    return next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
