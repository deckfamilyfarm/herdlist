import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, hashPassword, verifyPassword, generateResetToken, hashResetToken } from "./auth";
import {
  insertAnimalSchema,
  insertPropertySchema,
  insertFieldSchema,
  insertMovementSchema,
  insertVaccinationSchema,
  insertEventSchema,
  insertCalvingRecordSchema,
  insertSlaughterRecordSchema,
  insertNoteSchema,
  insertBreedingRecordSchema,
  csvAnimalSchema,
  csvPropertySchema,
  csvFieldSchema,
  csvVaccinationSchema,
  csvEventSchema,
  csvCalvingRecordSchema,
  csvSlaughterRecordSchema,
  signupSchema,
  loginSchema,
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  type ImportResult,
  type InsertAnimal,
  type InsertProperty,
  type InsertField,
  type InsertVaccination,
  type InsertEvent,
  type InsertCalvingRecord,
  type InsertSlaughterRecord,
  type InsertNote,
  type Note,
  type BreedingRecord,
  type InsertBreedingRecord,
} from "@shared/schema";
import { z } from "zod";
import Papa from "papaparse";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const validated = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validated.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      // Hash password and create user
      const passwordHash = await hashPassword(validated.password);
      const user = await storage.createUser({
        email: validated.email,
        passwordHash,
        firstName: validated.firstName,
        lastName: validated.lastName,
      });
      
      // Don't send password hash to client
      const { passwordHash: _, passwordResetToken, passwordResetExpires, ...userWithoutSensitive } = user;
      res.status(201).json(userWithoutSensitive);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      const validated = loginSchema.parse(req.body);
      
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          console.error("Login error:", err);
          return res.status(500).json({ message: "Internal server error" });
        }
        
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid credentials" });
        }
        
        req.logIn(user, (err) => {
          if (err) {
            console.error("Session error:", err);
            return res.status(500).json({ message: "Failed to create session" });
          }
          
          res.json(user);
        });
      })(req, res, next);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

    app.post("/api/auth/logout", isAuthenticated, (req, res) => {
    // express-session default cookie name is "connect.sid"
    const cookieName = "connect.sid";

    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }

      // Destroy the session in the MySQL store
      req.session?.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error on logout:", destroyErr);
          // we still continue to clear the cookie + respond
        }

        // Clear the browser cookie (options must match auth.ts getSession())
        res.clearCookie(cookieName, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/", // default cookie path
        });

        return res.json({ message: "Logged out successfully" });
      });
    });
  });
 
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      res.json(req.user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const isValid = await verifyPassword(validated.currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }
      
      // Hash and update new password
      const newPasswordHash = await hashPassword(validated.newPassword);
      await storage.updateUserPassword(user.id, newPasswordHash);
      
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post('/api/auth/request-password-reset', async (req, res) => {
    try {
      const validated = requestPasswordResetSchema.parse(req.body);
      const user = await storage.getUserByEmail(validated.email);
      
      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link will be sent" });
      }
      
      // Generate reset token (expires in 1 hour)
      const resetToken = generateResetToken();
      const hashedToken = await hashResetToken(resetToken);
      const expires = new Date(Date.now() + 3600000); // 1 hour
      await storage.setPasswordResetToken(validated.email, hashedToken, expires);
      
      // TODO: In production, send email with reset link
      // For now, log it (in production this would be sent via email)
      console.log(`Password reset token for ${validated.email}: ${resetToken}`);
      console.log(`Reset link: /reset-password?token=${resetToken}`);
      
      res.json({ message: "If an account exists with that email, a reset link will be sent" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Request password reset error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      
      // Hash the submitted token to compare with stored hash
      const hashedToken = await hashResetToken(validated.token);
      const user = await storage.getUserByResetToken(hashedToken);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash new password and update
      const newPasswordHash = await hashPassword(validated.newPassword);
      await storage.updateUserPassword(user.id, newPasswordHash);
      
      // Clear token after use (single-use token)
      await storage.clearPasswordResetToken(user.id);
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Admin routes for user management
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password hashes from response
      const usersWithoutPasswords = users.map(u => {
        const { passwordHash, passwordResetToken, passwordResetExpires, ...user } = u;
        return user;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id', isAdmin, async (req: any, res) => {
    try {
      const { isAdmin: adminStatus } = req.body;
      if (!adminStatus || !["yes", "no"].includes(adminStatus)) {
        return res.status(400).json({ message: "isAdmin must be 'yes' or 'no'" });
      }
      
      const user = await storage.updateUserAdminStatus(req.params.id, adminStatus);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { passwordHash, passwordResetToken, passwordResetExpires, ...userWithoutSensitive } = user;
      res.json(userWithoutSensitive);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Notes routes
  app.get("/api/notes/animal/:id", isAdmin, async (req, res) => {
    try {
      const notes = await storage.getNotesByAnimalId(req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/notes", isAdmin, async (req, res) => {
    try {
      const validated: InsertNote = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validated);
      res.status(201).json(note);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.put("/api/notes/:id", isAdmin, async (req, res) => {
    try {
      const validated = insertNoteSchema.partial().parse(req.body);
      const note = await storage.updateNote(req.params.id, validated);
      if (!note) {
        res.status(404).json({ message: "Note not found" });
        return;
      }
      res.json(note);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/notes/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteNote(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Breeding records
  app.get("/api/breeding/animal/:id", isAdmin, async (req, res) => {
    try {
      const records = await storage.getBreedingRecordsByAnimalId(req.params.id);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/breeding", isAdmin, async (req, res) => {
    try {
      const validated = insertBreedingRecordSchema.parse(req.body);
      const record = await storage.createBreedingRecord(validated);
      res.status(201).json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.put("/api/breeding/:id", isAdmin, async (req, res) => {
    try {
      const validated = insertBreedingRecordSchema.partial().parse(req.body);
      const record = await storage.updateBreedingRecord(req.params.id, validated);
      if (!record) {
        res.status(404).json({ message: "Breeding record not found" });
        return;
      }
      res.json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/breeding/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteBreedingRecord(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Animals routes (protected by isAdmin)
  app.get("/api/animals", isAdmin, async (req, res) => {
    try {
      const animals = await storage.getAllAnimals();
      res.json(animals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/animals", isAdmin, async (req, res) => {
    try {
      const validatedData = insertAnimalSchema.parse(req.body);
      const animal = await storage.createAnimal(validatedData);
      res.status(201).json(animal);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/animals/:id", isAdmin, async (req, res) => {
    try {
      const animal = await storage.getAnimalById(req.params.id);
      if (!animal) {
        res.status(404).json({ message: "Animal not found" });
        return;
      }
      res.json(animal);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/animals/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertAnimalSchema.partial().parse(req.body);
      const animal = await storage.updateAnimal(req.params.id, validatedData);
      if (!animal) {
        res.status(404).json({ message: "Animal not found" });
        return;
      }
      res.json(animal);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/animals/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteAnimal(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/animals/:id/offspring", isAdmin, async (req, res) => {
    try {
      const offspring = await storage.getOffspringByParentId(req.params.id);
      res.json(offspring);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Properties routes
  app.get("/api/properties", isAdmin, async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/properties", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(validatedData);
      res.status(201).json(property);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/properties/:id", isAdmin, async (req, res) => {
    try {
      const property = await storage.getPropertyById(req.params.id);
      if (!property) {
        res.status(404).json({ message: "Property not found" });
        return;
      }
      res.json(property);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/properties/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPropertySchema.partial().parse(req.body);
      const property = await storage.updateProperty(req.params.id, validatedData);
      if (!property) {
        res.status(404).json({ message: "Property not found" });
        return;
      }
      res.json(property);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/properties/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fields routes
  app.get("/api/fields", isAdmin, async (req, res) => {
    try {
      const fields = await storage.getAllFields();
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/fields", isAdmin, async (req, res) => {
    try {
      const validatedData = insertFieldSchema.parse(req.body);
      const field = await storage.createField(validatedData);
      res.status(201).json(field);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/fields/property/:propertyId", isAdmin, async (req, res) => {
    try {
      const fields = await storage.getFieldsByPropertyId(req.params.propertyId);
      res.json(fields);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/fields/:id", isAdmin, async (req, res) => {
    try {
      const field = await storage.getFieldById(req.params.id);
      if (!field) {
        res.status(404).json({ message: "Field not found" });
        return;
      }
      res.json(field);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/fields/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertFieldSchema.partial().parse(req.body);
      const field = await storage.updateField(req.params.id, validatedData);
      if (!field) {
        res.status(404).json({ message: "Field not found" });
        return;
      }
      res.json(field);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/fields/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteField(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      const message = error?.message || "Failed to delete field";
      res.status(400).json({ message });
    }
  });

  // Movements routes
  app.post("/api/movements", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMovementSchema.parse(req.body);
      const movement = await storage.createMovement(validatedData);
      res.status(201).json(movement);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/movements/animal/:animalId", isAdmin, async (req, res) => {
    try {
      const movements = await storage.getMovementsByAnimalId(req.params.animalId);
      res.json(movements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/movements/recent", isAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const movements = await storage.getRecentMovements(limit);
      res.json(movements);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vaccinations routes
  app.post("/api/vaccinations", isAdmin, async (req, res) => {
    try {
      const validatedData = insertVaccinationSchema.parse(req.body);
      const vaccination = await storage.createVaccination(validatedData);
      res.status(201).json(vaccination);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/vaccinations/animal/:animalId", isAdmin, async (req, res) => {
    try {
      const vaccinations = await storage.getVaccinationsByAnimalId(req.params.animalId);
      res.json(vaccinations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/vaccinations/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertVaccinationSchema.partial().parse(req.body);
      const vaccination = await storage.updateVaccination(req.params.id, validatedData);
      if (!vaccination) {
        res.status(404).json({ message: "Vaccination not found" });
        return;
      }
      res.json(vaccination);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/vaccinations/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteVaccination(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Events routes
  app.post("/api/events", isAdmin, async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/events/animal/:animalId", isAdmin, async (req, res) => {
    try {
      const events = await storage.getEventsByAnimalId(req.params.animalId);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/events/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
      if (!event) {
        res.status(404).json({ message: "Event not found" });
        return;
      }
      res.json(event);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/events/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calving Records routes
  app.post("/api/calving-records", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCalvingRecordSchema.parse(req.body);
      const record = await storage.createCalvingRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/calving-records/dam/:damId", isAdmin, async (req, res) => {
    try {
      const records = await storage.getCalvingRecordsByDamId(req.params.damId);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/calving-records/:id", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCalvingRecordSchema.partial().parse(req.body);
      const record = await storage.updateCalvingRecord(req.params.id, validatedData);
      if (!record) {
        res.status(404).json({ message: "Calving record not found" });
        return;
      }
      res.json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.delete("/api/calving-records/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteCalvingRecord(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Slaughter Records routes
  app.get("/api/slaughter-records", isAdmin, async (req, res) => {
    try {
      const records = await storage.getAllSlaughterRecords();
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/slaughter-records", isAdmin, async (req, res) => {
    try {
      const validatedData = insertSlaughterRecordSchema.parse(req.body);
      const record = await storage.createSlaughterRecord(validatedData);
      res.status(201).json(record);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  app.get("/api/slaughter-records/:id", isAdmin, async (req, res) => {
    try {
      const record = await storage.getSlaughterRecordById(req.params.id);
      if (!record) {
        res.status(404).json({ message: "Slaughter record not found" });
        return;
      }
      res.json(record);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/slaughter-records/:id", isAdmin, async (req, res) => {
    try {
      await storage.deleteSlaughterRecord(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAdmin, async (req, res) => {
    try {
      const [allAnimals, readyToBreed] = await Promise.all([
        storage.getAllAnimals(),
        storage.getAnimalsReadyToBreed(),
      ]);

      const stats = {
        totalAnimals: allAnimals.length,
        cowsReadyToBreed: readyToBreed.length,
        animalsByType: allAnimals.reduce((acc, animal) => {
          acc[animal.type] = (acc[animal.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        animalsBySex: allAnimals.reduce((acc, animal) => {
          acc[animal.sex] = (acc[animal.sex] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/dashboard/property-counts", isAdmin, async (req, res) => {
    try {
      const fieldCounts = await storage.getCurrentAnimalCountByField();
      res.json(fieldCounts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Import endpoint
  app.post("/api/import/:type", isAdmin, async (req, res) => {
    try {
      const { type } = req.params;
      const { csvData } = req.body;

      if (!csvData || typeof csvData !== 'string') {
        res.status(400).json({ message: "CSV data is required" });
        return;
      }

      const result: ImportResult = { success: 0, failed: 0, errors: [] };

      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
      
      if (parsed.errors.length > 0) {
        res.status(400).json({ 
          message: "CSV parsing error", 
          errors: parsed.errors.map((err: any) => ({ row: err.row, error: err.message, data: {} }))
        });
        return;
      }

      switch (type) {
        case "animals": {
          const validAnimals: InsertAnimal[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvAnimalSchema.parse(row);
              
              let sireId: string | undefined;
              let damId: string | undefined;
              
              if (csvRow.sireTag) {
                const sire = await storage.getAnimalByTagNumber(csvRow.sireTag);
                sireId = sire?.id;
              }
              
              if (csvRow.damTag) {
                const dam = await storage.getAnimalByTagNumber(csvRow.damTag);
                damId = dam?.id;
              }
              
              validAnimals.push({
                tagNumber: csvRow.tagNumber,
                type: csvRow.type,
                sex: csvRow.sex,
                dateOfBirth: csvRow.dateOfBirth || null,
                sireId: sireId || null,
                damId: damId || null,
                currentFieldId: null,
                herdName: csvRow.herdName || null,
                organic: csvRow.organic || false,
                phenotype: csvRow.phenotype || null,
                betacasein: csvRow.betacasein || null,
                polled: csvRow.polled || false,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validAnimals.length > 0) {
            await storage.bulkCreateAnimals(validAnimals);
            result.success = validAnimals.length;
          }
          break;
        }

        case "properties": {
          const validProperties: InsertProperty[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvPropertySchema.parse(row);
              
              validProperties.push({
                name: csvRow.name,
                isLeased: csvRow.isLeased,
                leaseStartDate: csvRow.leaseStartDate || null,
                leaseEndDate: csvRow.leaseEndDate || null,
                leaseholder: csvRow.leaseholder || null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validProperties.length > 0) {
            await storage.bulkCreateProperties(validProperties);
            result.success = validProperties.length;
          }
          break;
        }

        case "fields": {
          const validFields: InsertField[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvFieldSchema.parse(row);
              
              const property = await storage.getPropertyByName(csvRow.propertyName);
              
              if (!property) {
                throw new Error(`Property "${csvRow.propertyName}" not found`);
              }
              
              validFields.push({
                name: csvRow.name,
                propertyId: property.id,
                capacity: csvRow.capacity ? parseInt(csvRow.capacity) : null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validFields.length > 0) {
            await storage.bulkCreateFields(validFields);
            result.success = validFields.length;
          }
          break;
        }

        case "vaccinations": {
          const validVaccinations: InsertVaccination[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvVaccinationSchema.parse(row);
              
              const animal = await storage.getAnimalByTagNumber(csvRow.animalTag);
              
              if (!animal) {
                throw new Error(`Animal with tag "${csvRow.animalTag}" not found`);
              }
              
              validVaccinations.push({
                animalId: animal.id,
                vaccineName: csvRow.vaccineName,
                administeredDate: csvRow.administeredDate,
                administeredBy: csvRow.administeredBy || null,
                nextDueDate: csvRow.nextDueDate || null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validVaccinations.length > 0) {
            await storage.bulkCreateVaccinations(validVaccinations);
            result.success = validVaccinations.length;
          }
          break;
        }

        case "events": {
          const validEvents: InsertEvent[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvEventSchema.parse(row);
              
              const animal = await storage.getAnimalByTagNumber(csvRow.animalTag);
              
              if (!animal) {
                throw new Error(`Animal with tag "${csvRow.animalTag}" not found`);
              }
              
              validEvents.push({
                animalId: animal.id,
                eventType: csvRow.eventType,
                eventDate: csvRow.eventDate,
                description: csvRow.description || null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validEvents.length > 0) {
            await storage.bulkCreateEvents(validEvents);
            result.success = validEvents.length;
          }
          break;
        }

        case "calving-records": {
          const validRecords: InsertCalvingRecord[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvCalvingRecordSchema.parse(row);
              
              const dam = await storage.getAnimalByTagNumber(csvRow.damTag);
              
              if (!dam) {
                throw new Error(`Dam with tag "${csvRow.damTag}" not found`);
              }
              
              let calfId: string | undefined;
              if (csvRow.calfTag) {
                const calf = await storage.getAnimalByTagNumber(csvRow.calfTag);
                calfId = calf?.id;
              }
              
              validRecords.push({
                damId: dam.id,
                calvingDate: csvRow.calvingDate,
                calfId: calfId || null,
                calfTagNumber: csvRow.calfTag || null,
                calfSex: csvRow.calfSex || null,
                notes: csvRow.notes || null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validRecords.length > 0) {
            await storage.bulkCreateCalvingRecords(validRecords);
            result.success = validRecords.length;
          }
          break;
        }

        case "slaughter-records": {
          const validRecords: InsertSlaughterRecord[] = [];
          
          for (let i = 0; i < parsed.data.length; i++) {
            const row = parsed.data[i];
            try {
              const csvRow = csvSlaughterRecordSchema.parse(row);
              
              const animal = await storage.getAnimalByTagNumber(csvRow.animalTag);
              
              if (!animal) {
                throw new Error(`Animal with tag "${csvRow.animalTag}" not found`);
              }
              
              validRecords.push({
                animalId: animal.id,
                slaughterDate: csvRow.slaughterDate,
                ageMonths: csvRow.ageMonths ? parseInt(csvRow.ageMonths) : null,
                liveWeight: csvRow.liveWeight || null,
                hangingWeight: csvRow.hangingWeight || null,
                processor: csvRow.processor || null,
              });
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                row: i + 1,
                data: row,
                error: error.message || "Validation failed"
              });
            }
          }
          
          if (validRecords.length > 0) {
            await storage.bulkCreateSlaughterRecords(validRecords);
            result.success = validRecords.length;
          }
          break;
        }

        default:
          res.status(400).json({ message: "Invalid import type" });
          return;
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
