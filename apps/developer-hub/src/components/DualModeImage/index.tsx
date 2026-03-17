import clsx from "clsx";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import type Image from "next/image";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

type ImageProps = ComponentProps<typeof Image>;
type Props = Omit<ImageProps, "src"> & {
  darkSrc: string;
  lightSrc: string;
};

const DualModeImage = ({
  darkSrc,
  lightSrc,
  className,
  alt,
  width = 800,
  height = 600,
  sizes = "100vw",
  ...props
}: Props) => {
  const commonProps = {
    alt,
    height,
    sizes,
    width,
    ...props,
  };

  return (
    <>
      <ImageZoom
        className={clsx(styles.lightImage, className)}
        src={lightSrc}
        {...commonProps}
      />
      <ImageZoom
        className={clsx(styles.darkImage, className)}
        src={darkSrc}
        {...commonProps}
      />
    </>
  );
};

export default DualModeImage;
