import Link from "next/link";

type IntegrationCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorScheme?: "blue" | "green" | "purple";
  external?: boolean;
  showArrow?: boolean;
};

const colorClasses = {
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-600 dark:text-blue-400",
    hoverText: "group-hover:text-blue-600 dark:group-hover:text-blue-400",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900",
    text: "text-green-600 dark:text-green-400",
    hoverText: "group-hover:text-green-600 dark:group-hover:text-green-400",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900",
    text: "text-purple-600 dark:text-purple-400",
    hoverText: "group-hover:text-purple-600 dark:group-hover:text-purple-400",
  },
};

export function IntegrationCard({
  href,
  icon,
  title,
  description,
  colorScheme = "blue",
  external,
  showArrow = true,
}: IntegrationCardProps) {
  const colors = colorClasses[colorScheme];
  const Wrapper = external ? "a" : Link;
  const wrapperProps = external
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { href };

  return (
    <Wrapper
      {...(wrapperProps as { href: string } | { href: string; target: string; rel: string })}
      className="not-prose group no-underline grid h-full grid-rows-[auto_1fr] gap-3 rounded-xl border bg-[var(--color-fd-card)] border-[var(--color-fd-border)] p-5 md:p-6 shadow-sm outline-none transition-colors hover:border-[var(--color-fd-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-fd-accent)]"
      aria-label={title}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-md ${colors.bg}`}
        >
          <div className={`h-4 w-4 ${colors.text}`}>{icon}</div>
        </div>
        <h3 className={`m-0 text-base font-semibold text-[var(--color-fd-foreground)] ${colors.hoverText}`}>{title}</h3>
        {showArrow && (
          <span
            className="ml-auto translate-x-0 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:opacity-100"
            aria-hidden="true"
          >
            →
          </span>
        )}
      </div>
      <p className="m-0 text-sm text-[var(--color-fd-muted-foreground)] line-clamp-2">{description}</p>
    </Wrapper>
  );
}
