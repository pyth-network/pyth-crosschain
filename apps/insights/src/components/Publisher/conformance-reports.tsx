'use client';

import { Download } from '@phosphor-icons/react/dist/ssr/Download';
import { Button } from '@pythnetwork/component-library/Button';
import { Select } from '@pythnetwork/component-library/Select';
import { useState } from 'react';
import styles from "./conformance-reports.module.scss";

const ConformanceReports = () => {
  const [timeframe, setTimeframe] = useState("Daily");
  const handleReport = () => {
    console.log("Report", timeframe);
  }
  return (
    <div className={styles.conformanceReports}>
      <Select
          options={[{ id: "Daily" }, { id: "Weekly" }, { id: "Monthly" }]}
          placement="bottom end"
          selectedKey={timeframe}
          onSelectionChange={(value) => setTimeframe(value as string)}
          size="sm"
          label="Timeframe"
          variant="outline"
          hideLabel
        />
        <Button variant='outline' size='sm' onClick={handleReport} afterIcon={<Download key="download"/>}>Report</Button>
    </div>
  )
}

export default ConformanceReports;