export default function InlineError({ message, id, className = "" }) {
  if (!message) return null;
  return <p id={id} role="alert" className={`mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 ${className}`}>{message}</p>;
}
