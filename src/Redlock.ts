import * as Lock from 'redlock'
import * as _ from 'lodash'
import {Logger} from 'klg-logger'

const logger = new Logger({
  level: 'info',
  dateformat: 'yyyy-mm-dd HH:MM:ss.L'
})

export interface LockConfig {
  client?: any,
  prefix?: string,
  retryConfig?: {
    retryCount: number
    retryDelay?: number
  }

}

export const defaultConfig = {
  client: null,
  prefix: 'redLock:',
  retryConfig: {
    retryCount: 0,
    retryDelay: 400
  }
}

export class Redlock {
  redlock: any
  lockConfig: LockConfig

  constructor (lockConfig: LockConfig) {
    this.lockConfig = _.defaults(lockConfig, defaultConfig)
    if (!this.lockConfig.client) throw new Error('必须提供 redis client')
    const {retryCount, retryDelay} = this.lockConfig.retryConfig
    this.redlock = new Lock(
      [lockConfig.client],
      {
        // the expected clock drift; for more details
        // see http://redis.io/topics/distlock
        driftFactor: 0.01, // time in ms
        // the max number of times Redlock will attempt
        // to lock a resource before erroring
        retryCount,

        // the time in ms between attempts
        retryDelay, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter: 400 // time in ms
      }
    )
  }

  /**
   * 分布式锁
   * 默认锁一分钟
   * @param func 待执行的函数
   * @param lockParam 待执行函数的参数列表
   */
  async using (func: Function, lockParam: { ttl?: number, resource: string }) {
    lockParam.ttl = _.toInteger(lockParam.ttl) || 1000 * 60
    let lock = null
    try {
      lock = await this.redlock.lock(this.lockConfig.prefix + lockParam.resource, lockParam.ttl)
      logger.info('lock success ', lock.resource)
    } catch (err) {
      logger.info('系统繁忙，请稍后再试 lock Error ', err)
      // if (this.lockConfig.handle) this.lockConfig.handle(err)
      throw new Error('系统繁忙，请稍后再试')
    }
    // 执行业务逻辑
    let result
    try {
      result = await func(lock)
    } catch (err) {
      // 出现业务错误也要解锁
      await lock.unlock()
      logger.info('business error，unlock success ', lock.resource)
      throw err
    }
    // 记得解锁
    try {
      await lock.unlock()
      logger.info('unlock success ', lock.resource)
    } catch (err) {
      logger.error('unlock Error ', err)
    }
    return result
  }

  /**
   * 锁住某个资源不能执行, 完成后不解锁，应用于控制间隔时间，例如每 10min 发一次短信，其他时间的忽略。
   * @param resource  锁的唯一 ID
   * @param next
   * @param ttl ms
   * @returns {Promise.<void>}
   */
  async lock (resource, next, ttl = 1000 * 60) {
    let lock = null
    try {
      lock = await
        this.redlock.lock(this.lockConfig.prefix + resource, ttl)
      logger.info('lock success ', lock.resource)
    } catch (err) {
      logger.info('lock Error ', err)
      // if (this.lockConfig.handle) this.lockConfig.handle(err)
      throw err
    }
    // 执行业务逻辑
    try {
      await next()
    } catch (err) {
      throw err
    }
  }

}
