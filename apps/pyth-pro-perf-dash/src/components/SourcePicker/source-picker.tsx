"use client";

import { Select } from "@pythnetwork/component-library/Select";

import classes from "./source-picker.module.scss";
import {
  SOURCE_PICKER_DROPDOWN_GROUPS,
  SOURCE_PICKER_DROPDOWN_OPTIONS,
} from "../../constants";
import { useUIStateStore } from "../../state/ui-state";

export function SourcePicker() {
  /** store */
  const selectedSource = useUIStateStore((state) => state.selectedSource);
  const updateSelectedSource = useUIStateStore(
    (state) => state.setSelectedSource,
  );

  return (
    <div className={classes.sourcePickerRoot}>
      <Select
        className={String(classes.sourcePickerSelect)}
        label="Choose what to monitor"
        optionGroups={SOURCE_PICKER_DROPDOWN_GROUPS}
        onSelectionChange={(optId) => {
          const opt = SOURCE_PICKER_DROPDOWN_OPTIONS.find(
            (opt) => opt.id === optId,
          );
          if (opt) updateSelectedSource(opt);
        }}
        selectedKey={selectedSource.id}
        placeholder="Choose what to monitor"
      />
    </div>
  );
}
