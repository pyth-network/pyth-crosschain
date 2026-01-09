import { GearSix, X } from "@phosphor-icons/react/dist/ssr";
import type { Props as ButtonProps } from "@pythnetwork/component-library/Button";
import { Button } from "@pythnetwork/component-library/Button";
import { Input } from "@pythnetwork/component-library/Input";
import { ModalDialog } from "@pythnetwork/component-library/ModalDialog";
import { Tooltip } from "@pythnetwork/component-library/Tooltip";
import { sentenceCase } from "change-case";
import { useState } from "react";
import { Label } from "react-aria-components";

import classes from "./index.module.scss";
import { usePythProApiTokensContext } from "../../context/pyth-pro-demo";
import { DATA_SOURCES_REQUIRING_API_TOKENS } from "../../schemas/pyth/pyth-pro-demo-schema";

type PythProApiTokensMenuProps = Partial<Pick<ButtonProps<never>, "variant">>;

export function PythProApiTokensMenu({
  variant = "outline",
}: PythProApiTokensMenuProps) {
  /** context */
  const { tokens, updateApiToken } = usePythProApiTokensContext();

  /** state */
  const [open, setOpen] = useState(false);

  /** local variables */
  const tooltip = "Configure your API keys";
  const closeTooltip = "Close API keys config";

  return (
    <>
      <Tooltip delay={0} label={tooltip}>
        <Button
          aria-label={tooltip}
          onClick={() => {
            setOpen(true);
          }}
          size="sm"
          variant={variant}
        >
          <GearSix />
        </Button>
      </Tooltip>
      <ModalDialog
        className={classes.modal ?? ""}
        isOpen={open}
        onOpenChange={setOpen}
        overlayClassName={classes.modalOverlay ?? ""}
      >
        <div className={classes.apiTokensMenu}>
          <div className={classes.apiTokensMenuHeader}>
            <span>{tooltip}</span>
            <Button
              aria-label={closeTooltip}
              onClick={() => {
                setOpen(false);
              }}
              size="md"
              variant="ghost"
            >
              <X />
            </Button>
          </div>
          <div className={classes.apiTokensModalBody}>
            <div className={classes.fyi}>
              In order to provide a quality demo of Pyth Pro real-time
              performance relative to other sources, you will need to provide
              API keys to interact with these APIs.
            </div>
            <div className={classes.fyi}>
              They will be saved securely to your browser for future use here.
            </div>
            <div className={classes.apiTokensForm}>
              {Object.values(DATA_SOURCES_REQUIRING_API_TOKENS.Values).map(
                (dataSource) => {
                  const inputId = `input-${dataSource}`;
                  const tokenVal = tokens[dataSource] ?? "";

                  return (
                    <div className={classes.tokenInputWrapper} key={dataSource}>
                      <Label htmlFor={inputId}>
                        {sentenceCase(dataSource)}
                      </Label>
                      <Input
                        autoComplete="off"
                        fullWidth
                        id={inputId}
                        onChange={(e) => {
                          const {
                            currentTarget: { value },
                          } = e;
                          updateApiToken(dataSource, value);
                        }}
                        placeholder="Enter an API token"
                        type="password"
                        value={tokenVal}
                      />
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
