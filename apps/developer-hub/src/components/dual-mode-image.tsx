import type { ComponentProps } from "react";
import Image from "next/image";

type ImageProps = ComponentProps<typeof Image>;
type Props = Omit<ImageProps, "src"> & {
  darkSrc: string;
  lightSrc: string;
  alt: string;
};

const DualModeImage = ({
  darkSrc,
  lightSrc,
  className,
  alt,
  width = 800,
  height = 600,
  ...props
}: Props) => {
  return (
    <>
      <Image
        src={lightSrc}
        className={`dark:hidden ${className ?? ""}`}
        alt={alt}
        width={width}
        height={height}
        {...props}
      />
      <Image
        src={darkSrc}
        className={`hidden dark:block ${className ?? ""}`}
        alt={alt}
        width={width}
        height={height}
        {...props}
      />
    </>
  );
};

export default DualModeImage;
