import { GearSix, X } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Input } from "@pythnetwork/component-library/Input";
import { ModalDialog } from "@pythnetwork/component-library/ModalDialog";
import { sentenceCase } from "change-case";
import { useState } from "react";
import { Label, Tooltip, TooltipTrigger } from "react-aria-components";

import classes from "./index.module.scss";
import { usePythProApiTokensContext } from "../../context/pyth-pro-demo";
import { DATA_SOURCES_REQUIRING_API_TOKENS } from "../../schemas/pyth/pyth-pro-demo-schema";

export function PythProApiTokensMenu() {
  /** context */
  const { tokens, updateApiToken } = usePythProApiTokensContext();

  /** state */
  const [open, setOpen] = useState(false);

  /** local variables */
  const tooltip = "Configure your API tokens";
  const closeTooltip = "Close API tokens config";

  return (
    <>
      <TooltipTrigger delay={0}>
        <Button
          aria-label={tooltip}
          onClick={() => {
            setOpen(true);
          }}
          variant="outline"
        >
          <GearSix />
        </Button>
        <Tooltip className={classes.tooltip ?? ""} placement="bottom">
          {tooltip}
        </Tooltip>
      </TooltipTrigger>
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
              API tokens to interact with these APIs.
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
