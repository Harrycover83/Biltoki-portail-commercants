import pino from 'pino'
import type { Config } from '../config'

export function createLogger(config: Config) {
  return pino({
    level: config.logging.level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: config.server.nodeEnv === 'development',
        singleLine: false,
      },
    },
  })
}

export type Logger = ReturnType<typeof createLogger>
