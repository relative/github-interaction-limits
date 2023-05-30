import { ok } from 'assert'
import EventEmitter from 'eventemitter3'
import ms from 'ms'

export class Collector<T = {}> extends EventEmitter<{
  newItem: [T]
}> {
  sets = [new Set<T>(), new Set<T>(), new Set<T>(), new Set<T>(), new Set<T>()]
  times = [ms('30s'), ms('1m'), ms('5m'), ms('30m'), ms('1h')]
  timeouts: NodeJS.Timeout[] = []

  constructor() {
    super()
    ok(
      this.sets.length === this.times.length,
      'Collector: sets.length !== times.length'
    )
  }

  get time30sec() {
    return this.sets[0]
  }
  get time1min() {
    return this.sets[1]
  }
  get time5min() {
    return this.sets[2]
  }
  get time30min() {
    return this.sets[3]
  }
  get time1hr() {
    return this.sets[4]
  }

  addItem(item: T) {
    for (let i = 0; i < this.sets.length; ++i) {
      const time = this.times[i]
      const set = this.sets[i]
      set.add(item)
      this.timeouts.push(
        setTimeout(() => {
          set.delete(item)
        }, time)
      )
    }
    this.emit('newItem', item)
  }

  clear() {
    let timeout: NodeJS.Timeout | undefined
    while ((timeout = this.timeouts.shift())) {
      clearTimeout(timeout)
    }

    for (const set of this.sets) {
      set.clear()
    }
  }
}
