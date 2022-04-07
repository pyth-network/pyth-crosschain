import * as winston from "winston";

export let logger = winston.createLogger();

// Logger should be initialized before using logger
export function initLogger(config?: {logLevel?: string}) {
  let logLevel = "info";
  if (config?.logLevel) {
    logLevel = config.logLevel;
  }

  let transport: any;
  console.log("p2w_api is logging to the console at level [%s]", logLevel);

  transport = new winston.transports.Console({
    level: logLevel,
  });


  const logConfiguration = {
    transports: [transport],
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.simple(),
      winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss.SSS",
      }),
      winston.format.printf(
        (info: any) => `${[info.timestamp]}|${info.level}|${info.message}`
      )
    ),
  };

  logger = winston.createLogger(logConfiguration);
}
