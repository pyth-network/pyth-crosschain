"use client";

import type { ReactNode } from "react";

import { HeroContent } from "./HeroContent";
import { HeroGraphic } from "./HeroGraphic";
import styles from "./index.module.scss";

type Props = {
  children?: ReactNode;
};

export const HomepageHero = ({ children }: Props) => {
  return (
    <section className={styles.homepageHero}>
      <div className={styles.container}>
        <HeroContent />
        <HeroGraphic />
        {children}
      </div>
    </section>
  );
};
