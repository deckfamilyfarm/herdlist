import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seedUsers() {
  try {
    console.log("Seeding initial users...");
    
    // Create admin user: jdeck88@gmail.com
    const adminPassword = await hashPassword("admin123"); // Default password - should be changed after first login
    await db.insert(users).values({
      email: "jdeck88@gmail.com",
      passwordHash: adminPassword,
      firstName: "Admin",
      lastName: "User",
      isAdmin: "yes",
    }).onConflictDoNothing();
    console.log("✓ Created admin user: jdeck88@gmail.com (password: admin123)");
    
    // Create regular user: deckfamilyfarm@gmail.com
    const userPassword = await hashPassword("user123"); // Default password - should be changed after first login
    await db.insert(users).values({
      email: "deckfamilyfarm@gmail.com",
      passwordHash: userPassword,
      firstName: "Deck Family",
      lastName: "Farm",
      isAdmin: "no",
    }).onConflictDoNothing();
    console.log("✓ Created regular user: deckfamilyfarm@gmail.com (password: user123)");
    
    console.log("\nUsers seeded successfully!");
    console.log("Please change the default passwords after first login.");
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding users:", error);
    process.exit(1);
  }
}

seedUsers();
