/**
 * 日志工具模块
 *
 * 提供统一的日志记录功能，支持不同日志级别和上下文信息
 *
 * 使用示例:
 * ```typescript
 * import { logger } from '@/utils/logger';
 *
 * logger.info('用户登录', { userId: '123' });
 * logger.warn('配额即将用完', { tenantId: 'abc', usage: 95 });
 * logger.error('数据库连接失败', error, { database: 'main' });
 * ```
 */

// 日志级别
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// 日志配置
export interface LoggerConfig {
  level: LogLevel
  prefix?: string
  showTimestamp?: boolean
}

// 默认配置
const defaultConfig: LoggerConfig = {
  level: 'info',
  prefix: '',
  showTimestamp: true,
}

// 当前配置
let currentConfig = { ...defaultConfig }

/**
 * 格式化日志消息
 */
function formatMessage(level: LogLevel, message: string, context?: any, prefix?: string): string {
  const timestamp = currentConfig.showTimestamp ? new Date().toISOString() : ''

  const prefixStr = prefix || currentConfig.prefix || ''
  const levelStr = level.toUpperCase()

  let formatted = ''

  if (timestamp) {
    formatted += `[${timestamp}] `
  }

  if (prefixStr) {
    formatted += `[${prefixStr}] `
  }

  formatted += `[${levelStr}] ${message}`

  if (context) {
    try {
      const contextStr = typeof context === 'object' ? JSON.stringify(context) : String(context)
      formatted += ` ${contextStr}`
    } catch {
      formatted += ` [Context serialization failed]`
    }
  }

  return formatted
}

/**
 * 日志记录器类
 */
class Logger {
  private prefix: string

  constructor(prefix: string = '') {
    this.prefix = prefix
  }

  /**
   * 调试日志 (仅在开发环境使用)
   */
  debug(message: string, context?: any): void {
    if (this.shouldLog('debug')) {
      console.log(formatMessage('debug', message, context, this.prefix))
    }
  }

  /**
   * 信息日志 (正常业务流程)
   */
  info(message: string, context?: any): void {
    if (this.shouldLog('info')) {
      console.log(formatMessage('info', message, context, this.prefix))
    }
  }

  /**
   * 警告日志 (需要注意的情况)
   */
  warn(message: string, context?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context, this.prefix))
    }
  }

  /**
   * 错误日志 (错误和异常)
   */
  error(message: string, error?: any, context?: any): void {
    if (this.shouldLog('error')) {
      const errorContext =
        error instanceof Error
          ? { ...context, error: error.message, stack: error.stack }
          : { ...context, error }

      console.error(formatMessage('error', message, errorContext, this.prefix))
    }
  }

  /**
   * 创建带前缀的子日志记录器
   */
  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix
    return new Logger(childPrefix)
  }

  /**
   * 检查是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(currentConfig.level)
    const targetLevelIndex = levels.indexOf(level)

    return targetLevelIndex >= currentLevelIndex
  }
}

/**
 * 主日志记录器实例
 */
export const logger = new Logger()

/**
 * 创建带模块前缀的日志记录器
 *
 * @param moduleName - 模块名称，用于日志前缀
 *
 * @example
 * const authLogger = createLogger('Auth');
 * authLogger.info('用户登录成功');
 * // 输出：[2024-01-01T00:00:00.000Z] [Auth] [INFO] 用户登录成功
 */
export function createLogger(moduleName: string): Logger {
  return logger.child(moduleName)
}

/**
 * 配置日志器
 *
 * @param config - 日志配置
 *
 * @example
 * configureLogger({ level: 'debug', showTimestamp: true });
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

/**
 * 根据环境自动配置日志级别
 *
 * - 开发环境：debug
 * - 生产环境：info
 * - 测试环境：error
 */
export function autoConfigureLogger(env?: string): void {
  const environment = env || process.env.NODE_ENV || 'development'

  switch (environment) {
    case 'production':
      configureLogger({ level: 'info', showTimestamp: true })
      break
    case 'test':
      configureLogger({ level: 'error', showTimestamp: false })
      break
    case 'development':
    default:
      configureLogger({ level: 'debug', showTimestamp: true })
      break
  }
}

// 自动根据环境配置
autoConfigureLogger()

export default logger
