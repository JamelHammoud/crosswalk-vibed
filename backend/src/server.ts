import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ServerWebSocket } from "bun";
import auth from "./routes/auth";
import drops from "./routes/drops";
import notifications from "./routes/notifications";
import vibe from "./routes/vibe";
import { addClient, removeClient } from "./ws";

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

let server: any;

export default {
  port: 3000,
  fetch(req: Request, s: any) {
    server = s;
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return undefined;
    }
    return app.fetch(req);
  },
  websocket: {
    open(ws: ServerWebSocket<unknown>) {
      addClient(ws);
    },
    close(ws: ServerWebSocket<unknown>) {
      removeClient(ws);
    },
    message() {},
  },
};
