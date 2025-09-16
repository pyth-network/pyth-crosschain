import clsx from "clsx";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import Image from "next/image";
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
    width,
    height,
    sizes,
    ...props,
  };

  return (
    <>
      <ImageZoom
        src={lightSrc}
        className={clsx(styles.lightImage, className)}
        {...commonProps}
      />
      <ImageZoom
        src={darkSrc}
        className={clsx(styles.darkImage, className)}
        {...commonProps}
      />
    </>
  );
};

export default DualModeImage;
