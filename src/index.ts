import CoreBot from "./core/Core";
import { err } from "./utils/logger";

export const app = new CoreBot();

process.on("unhandledRejection", (reason) => {
  err(`Unhandled rejection: ${reason}`, 0);
});

app.init();
