/**
 * waits for the provided number of milliseconds
 * before resolving the promise and allowing
 * your code to continue.
 * Spiritually similar to C#'s Thread.Sleep(amount)
 */
export function wait(amount: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, amount);
  });
}
