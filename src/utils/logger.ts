import chalk from "chalk";

const getTimestamp = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export const log = (msg: string) =>
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} ${chalk.magentaBright("log")} ${msg}`);
export const warn = (msg: string) =>
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} ${chalk.yellowBright("warn")} ${msg}`);
export const err = (msg: string | Error, exit?: number) => {
  const timestamp = chalk.gray(`[${getTimestamp()}]`);
  if (msg instanceof Error) {
    console.log(`${timestamp} ${chalk.redBright("err")} ${msg.message}`);
    if (msg.stack) {
      console.log(chalk.gray(msg.stack));
    }
  } else {
    console.log(`${timestamp} ${chalk.redBright("err")} ${msg}`);
  }
  if (exit) {
    process.exit(exit);
  }
};
export const info = (msg: string) =>
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} ${chalk.blueBright("info")} ${msg}`);
export const success = (msg: string) =>
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} ${chalk.greenBright("success")} ${msg}`);
export const debug = (msg: string) =>
  console.log(`${chalk.gray(`[${getTimestamp()}]`)} ${chalk.dim("debug")} ${chalk.dim(msg)}`);
