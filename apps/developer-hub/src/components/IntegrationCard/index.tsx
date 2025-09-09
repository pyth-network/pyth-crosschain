type IntegrationCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  colorScheme?: "blue" | "green" | "purple";
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

export const IntegrationCard = ({
  href,
  icon,
  title,
  description,
  colorScheme = "blue",
}: IntegrationCardProps) => {
  const colors = colorClasses[colorScheme];

  return (
    <a
      href={href}
      className="block group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}
        >
          <div className={`w-4 h-4 ${colors.text}`}>{icon}</div>
        </div>
        <h3
          className={`text-lg font-semibold text-gray-900 dark:text-white ${colors.hoverText}`}
        >
          {title}
        </h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </a>
  );
};
