type Listener = (payload: any) => void;

export class SimplePubSub {
  private listeners = new Map<string, Set<Listener>>();

  publish(topic: string, payload: any) {
    const set = this.listeners.get(topic);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  asyncIterator(topic: string) {
    const queue: any[] = [];
    let resolveNext: ((v: IteratorResult<any>) => void) | null = null;
    let isDone = false;

    const pushValue = (payload: any) => {
      if (isDone) return;

      if (resolveNext) {
        resolveNext({ value: payload, done: false });
        resolveNext = null;
      } else {
        queue.push(payload);
      }
    };

    const subscribe = () => {
      const set = this.listeners.get(topic) ?? new Set<Listener>();
      set.add(pushValue);
      this.listeners.set(topic, set);

      return () => {
        set.delete(pushValue);
        // ✅ cleanup empty topic sets (prevents memory leak)
        if (set.size === 0) this.listeners.delete(topic);
      };
    };

    const unsubscribe = subscribe();

    const finish = () => {
      if (isDone) return;
      isDone = true;
      unsubscribe();

      // ✅ if someone is waiting on next(), unblock them
      if (resolveNext) {
        resolveNext({ value: undefined, done: true });
        resolveNext = null;
      }
    };

    return {
      [Symbol.asyncIterator]() {
        return this;
      },

      next(): Promise<IteratorResult<any>> {
        if (isDone) return Promise.resolve({ value: undefined, done: true });

        if (queue.length > 0) {
          return Promise.resolve({ value: queue.shift(), done: false });
        }

        return new Promise((resolve) => (resolveNext = resolve));
      },

      return(): Promise<IteratorResult<any>> {
        finish();
        return Promise.resolve({ value: undefined, done: true });
      },

      throw(err: any): Promise<IteratorResult<any>> {
        finish();
        return Promise.reject(err);
      },
    };
  }
}
