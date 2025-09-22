import { ChartLine } from "@phosphor-icons/react/dist/ssr";

import { IntegrationCard } from "../../components/IntegrationCard";

export default function PriceFeedsPage() {
  return (
    <>
      <p>This page is a placeholder for the price feeds landing page.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <IntegrationCard
          href="/price-feeds/core"
          title="Core"
          description="Core"
          icon={<ChartLine size={16} />}
        />

        <IntegrationCard
          href="/price-feeds/pro"
          title="Pro"
          description="Pro"
          icon={<ChartLine size={16} />}
        />
      </div>
    </>
  );
}
