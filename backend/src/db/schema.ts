import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  appleUserId: text("apple_user_id").notNull().unique(),
  email: text("email"),
  name: text("name"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const drops = sqliteTable("drops", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  range: text("range").notNull().default("close"),
  effect: text("effect").notNull().default("none"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const highfives = sqliteTable("highfives", {
  id: text("id").primaryKey(),
  dropId: text("drop_id")
    .notNull()
    .references(() => drops.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  dropId: text("drop_id").references(() => drops.id),
  fromUserId: text("from_user_id").references(() => users.id),
  read: integer("read").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Drop = typeof drops.$inferSelect;
export type NewDrop = typeof drops.$inferInsert;
export type Highfive = typeof highfives.$inferSelect;
export type NewHighfive = typeof highfives.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
