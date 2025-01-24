
import styles from "./price-feed-items.module.scss";
import { PriceFeedTag } from "../PriceFeedTag";
import { StructuredList } from "../StructuredList";

export const PriceFeedItems = () => {
    return (
        <div className={styles.priceFeedItemsWrapper}>
            {Array.from({ length: 20 }).map((item, index) => {
                return (
                    <div className={styles.priceFeedItem} key={index}>
                        <StructuredList items={[
                            {
                                label: <PriceFeedTag compact isLoading />,
                                value: "$32,323.22"
                            },
                            {
                                label: "Last Price",
                                value: "$10,000.00"
                            },
                            {
                                label: "Last Updated",
                                value: "2022-01-01"
                            },
                        ]} />
                    </div>
                )
            })}
        </div>
    );
};

