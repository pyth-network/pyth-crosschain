import styles from "./index.module.scss";

export type Props = {
  text: string;
};

const TruncateToMiddle = ({ text }: Props) => {
  return (
    <span
      className={styles.truncateToMiddle}
      data-text-start={text.slice(0, Math.floor(text.length / 2))}
      data-text-end={text.slice(Math.floor(text.length / 2) * -1)}
    />
  );
};

export default TruncateToMiddle;
