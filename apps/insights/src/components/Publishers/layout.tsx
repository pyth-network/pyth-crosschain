import { Info } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import type { ReactNode } from "react";

import { EpochSelect } from "./epoch-select";
import { H1 } from "../H1";
import { MaxWidth } from "../MaxWidth";

type Props = {
  children: ReactNode | undefined;
};

export const PublishersLayout = ({ children }: Props) => (
  <MaxWidth>
    <div className="mb-12 flex flex-row items-center justify-between">
      <H1>Publishers</H1>
      <EpochSelect />
    </div>
    <Card
      header="Publishers"
      toolbarLabel="Publishers"
      full
      toolbar={
        <>
          <Button size="xs" variant="outline">
            Show rankings
          </Button>
          <Button
            size="xs"
            variant="ghost"
            beforeIcon={(props) => <Info weight="fill" {...props} />}
            hideText
          >
            Help
          </Button>
        </>
      }
    >
      {children}
    </Card>
  </MaxWidth>
);
