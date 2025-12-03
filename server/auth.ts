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
		  console.log("starting...")
          const user = await storage.getUserByEmail(email);
		  console.log(user)
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
		  console.log("checking password...")

          const isValidPassword = await verifyPassword(password, user.passwordHash);
          
          if (!isValidPassword) {
		  	console.log("password is bad...")
            return done(null, false, { message: "Invalid email or password" });
          }
		  	console.log("password is good...")

          // Don't include password hash in session
          const { passwordHash, passwordResetToken, passwordResetExpires, ...userWithoutSensitive } = user;
          return done(null, userWithoutSensitive);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      const { passwordHash, passwordResetToken, passwordResetExpires, ...userWithoutSensitive } = user;
      done(null, userWithoutSensitive);
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
