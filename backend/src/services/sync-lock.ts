type SyncTask<T> = () => Promise<T>

class SyncLock {
  private readonly runningByKey = new Set<string>()

  isRunning(key: string): boolean {
    return this.runningByKey.has(key)
  }

  async runExclusive<T>(key: string, task: SyncTask<T>): Promise<T> {
    if (this.runningByKey.has(key)) {
      throw new Error(`sync already running for key=${key}`)
    }

    this.runningByKey.add(key)
    try {
      return await task()
    } finally {
      this.runningByKey.delete(key)
    }
  }
}

export const syncLock = new SyncLock()
