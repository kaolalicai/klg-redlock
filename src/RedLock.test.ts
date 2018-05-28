import * as redis from 'redis'
import * as bluebird from 'bluebird'
import {Redlock} from './Redlock'

describe('redlock test', async function () {
  let client

  beforeAll((done) => {
    client = redis.createClient('redis://joda:6379')
    done()
  })

  it(' test buffer ', async () => {
    const bufferLock = new Redlock({
      client,
      retryConfig: {
        retryCount: Math.floor(1000 * 60 * 5 / 400), // 重试次数 这里需要重试一分钟
        retryDelay: 400   // 重试间隔
      }
    })
    let count = 0
    const spy1 = jest.fn()

    async function tester () {
      await bufferLock.using(async (lock) => {
        const old = count
        count++
        bluebird.delay(100)
        expect(lock.unlock)
        spy1()
        expect(count).toEqual(old + 1)
      }, {ttl: 1000 * 30, resource: 'key'})
    }

    const list = []
    for (let i = 0; i < 10; i++) {
      list.push(tester())
    }
    await Promise.all(list)
    expect(spy1).toHaveBeenCalledTimes(10)
  })

  it(' test mutex ', async () => {
    const mutexLock = new Redlock({
      client,
      retryConfig: {
        retryCount: 0
      }
    })
    const spy1 = jest.fn()

    async function tester () {
      try {
        await mutexLock.using(async (lock) => {
          bluebird.delay(1000)
          expect(lock.unlock)
          spy1()
        }, {ttl: 1000 * 30, resource: 'key-mutex'})
      } catch (e) {
        // do nothing
      }
    }

    const list = []
    for (let i = 0; i < 10; i++) {
      list.push(tester())
    }
    await Promise.all(list)
    expect(spy1).toHaveBeenCalledTimes(1)
  })

  afterAll((done) => {
    client.quit(done)
  })
})
