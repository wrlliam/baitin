import CoreBot from "./core/Core";
import { err, info } from "./utils/logger";
import Elysia from "elysia";
import cors from "@elysiajs/cors";

export const app = new CoreBot();

// HTTP API Server
const api = new Elysia({ prefix: "/api" })
  .use(cors())
  .get("/commands", ({ query }) => {
    const limit = Math.min(Math.max(parseInt(query.limit as string) || 20, 1), 100);
    const offset = Math.max(parseInt(query.offset as string) || 0, 0);
    const category = (query.category as string)?.toLowerCase();

    let commands = Array.from(app.commands.values());

    if (category) {
      commands = commands.filter((cmd) => cmd.category?.toLowerCase() === category);
    }

    const total = commands.length;
    const paginated = commands.slice(offset, offset + limit);

    return {
      success: true,
      data: {
        total,
        limit,
        offset,
        count: paginated.length,
        commands: paginated.map((cmd) => ({
          name: cmd.name,
          description: cmd.description,
          category: cmd.category || "uncategorized",
          usage: cmd.usage,
          adminOnly: cmd.adminOnly ?? false,
          devOnly: cmd.devOnly ?? false,
          options: cmd.options || [],
        })),
      },
    };
  })
  .get("/commands/:name", ({ params }) => {
    const cmd = app.commands.get(params.name);

    if (!cmd) {
      return (
        {
          success: false,
          error: "Command not found",
        },
        { status: 404 }
      );
    }

    return {
      success: true,
      data: {
        name: cmd.name,
        description: cmd.description,
        category: cmd.category || "uncategorized",
        usage: cmd.usage,
        adminOnly: cmd.adminOnly ?? false,
        devOnly: cmd.devOnly ?? false,
        options: cmd.options || [],
      },
    };
  })
  .get("/health", () => ({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

process.on("unhandledRejection", (reason) => {
  err(`Unhandled rejection: ${reason}`, 0);
});

app.init();

api.listen(3000, () => {
  info(`HTTP API running on http://localhost:3000/api`);
});
