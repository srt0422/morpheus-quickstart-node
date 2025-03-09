import { initRateLimit, CountFn } from './rate-limit'
import getIP from './get-ip'
import { incr, expire } from './redis-adapter'

export const ipRateLimit = initRateLimit((request) => ({
  id: `ip:${getIP(request)}`,
  count: increment,
  limit: 5,
  timeframe: 10,
}))

const increment: CountFn = async ({ response, key, timeframe }) => {
  // Latency logging
  const start = Date.now()

  // Use our Redis adapter instead of direct Upstash calls
  const count = await incr(key)
  await expire(key, timeframe)

  // Temporal logging
  const latency = Date.now() - start
  response.headers.set('x-upstash-latency', `${latency}`)

  return count
}
