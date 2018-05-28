# klg-redlock
一个基于 redis 的分布式锁

## Quick Start
准备好 redis client

```
let client = redis.createClient('redis://localhost:6379')
```

### 排队锁

```
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

```
const bufferLock = new Redlock({
  client,
  retryConfig: {
    retryCount: 0
  }
})

await bufferLock.using(async (lock) => {
    // code
}, {ttl: 1000 * 30, resource: 'key'})
```

相同 key 的操作具有排他性，遇到冲突会 throw 一个 Error 对象， message 为‘系统繁忙，请稍后再试’

## Test

```bash
$ npm i
$ npm test
```

