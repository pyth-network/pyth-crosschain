import "server-only";

import type { lookup as lookupPublisher } from "@pythnetwork/known-publishers";

import styles from "./index.module.scss";

type Props = {
  knownPublisher: NonNullable<ReturnType<typeof lookupPublisher>>;
};

export const PublisherIcon = ({ knownPublisher }: Props) => {
  if ("dark" in knownPublisher.icon) {
    const { dark: Dark, light: Light } = knownPublisher.icon;
    return (
      <>
        <Dark className={styles.darkIcon} />
        <Light className={styles.lightIcon} />
      </>
    );
  } else {
    const Icon =
      "color" in knownPublisher.icon
        ? knownPublisher.icon.color
        : knownPublisher.icon.monochrome;
    return <Icon />;
  }
};
