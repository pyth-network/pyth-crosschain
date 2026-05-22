import clsx from "clsx";

import styles from "./index.module.scss";

type MermaidDiagramProps = {
  src: string;
  alt?: string;
  className?: string;
};

export const MermaidDiagram = ({
  src,
  alt = "Mermaid diagram",
  className,
}: MermaidDiagramProps) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} className={clsx(styles.diagram, className)} />
);

export default MermaidDiagram;
