import {createLogger, transports, format, Logger} from 'winston';
let logger: Logger;

const myFormat = format.printf(({level, message, timestamp}) => {
  let toLog = message;
  if (message && message.constructor === Object) {
    toLog = JSON.stringify(message, null, 4);
  }
  return `${timestamp} ${level}: ${toLog}`;
});

if (process.env.NODE_ENV === 'production') {
  logger = createLogger({
    transports: [
      new transports.Console({
        level:            'info',
        handleExceptions: true,
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.timestamp(),
          myFormat
        )
      }),
      new (transports.File)({
        filename:    process.env.LOGGER_INFO_PATH,
        level:       process.env.LOGGER_INFO_LEVEL,
        format: format.combine(
          format.json(),
          myFormat                    
        ),
        maxsize:     Number(process.env.LOGGER_FILE_MAX_SIZE),
        maxFiles:    Number(process.env.LOGGER_MAX_FILES)
      }),
      new (transports.File)({
        filename:    process.env.LOGGER_ERROR_PATH,
        level:       process.env.LOGGER_ERROR_LEVEL,
        format: format.combine(
          format.json(),
          myFormat
        ),
        maxsize:     Number(process.env.LOGGER_FILE_MAX_SIZE),
        maxFiles:    Number(process.env.LOGGER_MAX_FILES)
      })
    ],
    exitOnError: true
  });
} else {
  logger = createLogger({
    transports: [
      new (transports.Console)({
        level:     'debug',
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.timestamp(),
          myFormat
        )
      })
    ]
  });
}

export default logger;
