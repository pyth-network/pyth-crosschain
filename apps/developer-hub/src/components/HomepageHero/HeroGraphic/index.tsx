"use client";

import Rive from "@rive-app/react-canvas";

import styles from "./index.module.scss";

export const HeroGraphic = () => {
  return (
    <div className={styles.heroGraphic}>
      <div className={styles.graphicContainer}>
        <Rive
          src="/price_feeds_stack.riv"
          style={{ width: "500px", height: "700px" }}
        />
      </div>
    </div>
  );
};
