import clsx from "clsx";

import styles from "./index.module.scss";

type YouTubeEmbedProps = {
  id: string;
  title?: string;
  className?: string;
};

export const YouTubeEmbed = ({
  id,
  title = "YouTube video player",
  className,
}: YouTubeEmbedProps) => (
  <div className={clsx(styles.container, className)}>
    <iframe
      className={styles.iframe}
      src={`https://www.youtube.com/embed/${id}`}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  </div>
);

export default YouTubeEmbed;
