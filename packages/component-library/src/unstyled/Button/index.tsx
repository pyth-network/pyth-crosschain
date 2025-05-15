"use client";

import type { ComponentProps } from "react";
import { useCallback } from "react";
import type { PressEvent } from "react-aria-components";
import { Button as BaseButton } from "react-aria-components";

import type { OpenAlertArgs } from "../../useAlert/index.jsx";
import { useAlert } from "../../useAlert/index.jsx";
import type { OpenDrawerArgs } from "../../useDrawer/index.jsx";
import { useDrawer } from "../../useDrawer/index.jsx";

export type Props = ComponentProps<typeof BaseButton> & {
  alert?: OpenAlertArgs | undefined;
  drawer?: OpenDrawerArgs | undefined;
};

export const Button = ({ drawer, alert, ...props }: Props) => {
  if (drawer !== undefined) {
    return <DrawerButton {...props} drawer={drawer} />;
  } else if (alert === undefined) {
    return <BaseButton {...props} />;
  } else {
    return <AlertButton {...props} alert={alert} />;
  }
};

const DrawerButton = ({
  onPress,
  drawer: drawerConfig,
  ...props
}: Props & { drawer: OpenDrawerArgs }) => {
  const drawer = useDrawer();
  const openDrawer = useCallback(
    (event: PressEvent) => {
      onPress?.(event);
      drawer.open(drawerConfig);
    },
    [drawer, drawerConfig, onPress],
  );

  return <BaseButton {...props} onPress={openDrawer} />;
};

const AlertButton = ({
  onPress,
  alert: alertConfig,
  ...props
}: Props & { alert: OpenAlertArgs }) => {
  const alert = useAlert();
  const openDrawer = useCallback(
    (event: PressEvent) => {
      onPress?.(event);
      alert.open(alertConfig);
    },
    [alert, alertConfig, onPress],
  );

  return <BaseButton {...props} onPress={openDrawer} />;
};
