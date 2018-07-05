# klg-redlock
一个基于 redis 的分布式锁

## Quick Start
准备好 redis client

```js
let client = redis.createClient('redis://localhost:6379')
```

### 排队锁

```js
const bufferLock = new Redlock({
  client,
  retryConfig: {
    retryCount: Math.floor(1000 * 60 * 5 / 400), // 重试次数 这里需要重试一分钟
    retryDelay: 400   // 重试间隔
  }
})

await bufferLock.using(async (lock) => {
    // code
}, {ttl: 1000 * 30, resource: 'key'})
```

相同 key 的操作会排队执行，遇到冲突会重试，默认重试总时长是 1 分钟，注意重试的实现是非公平的，有可能某个操作会一直无法执行，直至超时。


### 排他锁

把重试功能关闭就是排它锁了
```js
const mutexLock = new Redlock({
  client,
  retryConfig: {
    retryCount: 0
  }
})

await mutexLock.using(async (lock) => {
    // code
}, {ttl: 1000 * 30, resource: 'key'})
```

相同 key 的操作具有排他性，遇到冲突会 throw 一个 Error 对象， message 为‘系统繁忙，请稍后再试’

### 占位锁

去掉自动解锁功能就是占位锁了。

```js
const lockConfig = {
  retryCount: 0,
  retryDelay: 0
}
const ttl = 60*100
const redLock = new Redlock(lockConfig)
try {
    return await redLock.lock(param.message, async function () {
      // code
    }, ttl)
} catch (err) {
    logger.info('lock Error ', err)
    return
}
```

不管执行成功与否，都不释放锁，等待资源自然到期释放。
应用场景一般是控制单位之间内只做一次操作的业务，例如发送报警短信，10min 内有重复的需要忽略，控制短信发送频率。

## Test

```bash
$ npm i
$ npm test
```

