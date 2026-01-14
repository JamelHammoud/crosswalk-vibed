import { handle } from "@hono/node-server/vercel";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./routes/auth";
import drops from "./routes/drops";
import notifications from "./routes/notifications";
import vibe from "./routes/vibe";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "https://player.scrns.io",
        "https://server.scrns.io",
        "https://crswlk.vercel.app",
        "https://crswlk-be.vercel.app",
        "capacitor://localhost",
        "ionic://localhost",
      ];
      if (!origin) return allowedOrigins[0];
      if (allowedOrigins.includes(origin)) return origin;
      if (origin.includes("crswlk") && origin.includes("vercel.app")) {
        return origin;
      }
      return allowedOrigins[0];
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.route("/auth", auth);
app.route("/drops", drops);
app.route("/notifications", notifications);
app.route("/vibe", vibe);

app.get("/", (c) => c.json({ status: "ok", name: "Crosswalk API" }));

export default handle(app);
