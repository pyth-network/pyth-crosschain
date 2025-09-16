import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import Image from "next/image";
import type { ComponentProps } from "react";

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
        className={`dark:hidden ${className ?? ""}`}
        {...commonProps}
      />
      <ImageZoom
        src={darkSrc}
        className={`hidden dark:block ${className ?? ""}`}
        {...commonProps}
      />
    </>
  );
};

export default DualModeImage;
