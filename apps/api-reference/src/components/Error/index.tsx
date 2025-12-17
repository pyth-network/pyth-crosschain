type Props = {
  error: Error & { digest?: string };
  reset?: () => void;
};

export const ErrorComponent = ({ error, reset }: Props) => (
  <main>
    <h1>Uh oh!</h1>
    <h2>Something went wrong</h2>
    <p>Error Code: {error.digest}</p>
    {reset && (
      <button onClick={reset} type="button">
        Reset
      </button>
    )}
  </main>
);
