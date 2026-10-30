export class FeedReadError extends Error {
  readonly collection: string

  constructor(collection: string, cause: unknown) {
    super(`Unable to load ${collection} from the database`, { cause })
    this.name = 'FeedReadError'
    this.collection = collection
  }
}

export async function readFeedCollection<T>(collection: string, read: () => Promise<T>): Promise<T> {
  try {
    return await read()
  } catch (cause) {
    console.error(`[feed] database read failed for ${collection}:`, cause)
    throw new FeedReadError(collection, cause)
  }
}
