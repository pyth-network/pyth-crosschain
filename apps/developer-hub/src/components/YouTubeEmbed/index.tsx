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
  <iframe
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowFullScreen
    className={clsx(styles.iframe, className)}
    referrerPolicy="strict-origin-when-cross-origin"
    src={`https://www.youtube.com/embed/${id}?enablejsapi=1`}
    title={title}
  />
);

export default YouTubeEmbed;
