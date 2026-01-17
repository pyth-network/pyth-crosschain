/**
 * T defines the "Event Map".
 * Example: `{ 'data': (payload: string) => void; 'error': (err: Error) => void; }`
 */
export abstract class IsomorphicEventEmitter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, (...args: any[]) => void>,
> {
  private listeners = new Map<keyof T, T[keyof T][]>();

  /**
   * Register a callback for a specific event.
   */
  public on<K extends keyof T>(eventName: K, callback: T[K]): void {
    const currentListeners = this.listeners.get(eventName) ?? [];
    this.listeners.set(eventName, [...currentListeners, callback]);
  }

  /**
   * Registers a callback for a specific event that
   * will only be executed a single time i.e. the first occurence.
   * After this, the handler will be automatically removed and cleaned up.
   */
  public once<K extends keyof T>(eventName: K, callback: T[K]): void {
    const wrappedCallback = ((...args) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      callback(...args);

      this.off(eventName, wrappedCallback);
    }) as typeof callback;

    this.on(eventName, wrappedCallback);
  }

  /**
   * Remove a callback from a specific event.
   * If no specific callback is specified when off() is called,
   * ALL event handler callbacks for the given eventName will be removed
   * at once.
   */
  public off<K extends keyof T>(eventName: K, callback?: T[K]): void {
    const cbIsFunc = typeof callback === "function";

    const currentListeners = this.listeners.get(eventName) ?? [];
    this.listeners.set(
      eventName,
      currentListeners.filter((cb) => cbIsFunc && cb !== callback),
    );
  }

  /**
   * Protected method to retrieve listeners for internal triggering.
   * This allows the child class to decide how/when to execute them.
   */
  protected getListeners<K extends keyof T>(eventName: K): T[K][] {
    return (this.listeners.get(eventName) ?? []) as T[K][];
  }
}
