"use client";

import {
  createContext,
  use,
  useEffect,
  useState
} from "react";

import { PythSubscriber } from '../services/pyth-stream';

type PublisherFeedData = Record<string, {
    price: string;
    slot: bigint;
  }>
  
const LivePublishersDataContext = createContext<
  PublisherFeedData | undefined
>(undefined);

type LivePublishersDataProviderProps = {
  publisherKey: string;
  children: React.ReactNode;
}

export const LivePublishersDataProvider = ({ publisherKey, children }: LivePublishersDataProviderProps) => {
  const [localPublishersData, setLocalPublishersData] = useState<PublisherFeedData>({});
  useEffect(() => {
    const pythSubscriber = new PythSubscriber();
    
    pythSubscriber.onPublisherUpdate((update) => {
      setLocalPublishersData((prev) => {
        const newData = { ...prev };
        for (const u of update.updates) {
          if(u.feed_id === '7jAVut34sgRj6erznsYvLYvjc9GJwXTpN88ThZSDJ65G') {
            console.log("update", u);
          }
          newData[u.feed_id] = { price: u.price, slot: BigInt(u.slot) };
        }
        return newData;
      });
    });
    pythSubscriber.connect().then(
      () => {pythSubscriber.subscribePublisher([publisherKey]);}
    ).catch((error) => {
      console.error("Failed to subscribe to publisher", error);
    });
    return () => {
      pythSubscriber.disconnect();
    };
  }, [publisherKey]);
  return <LivePublishersDataContext value={localPublishersData} >{children}</LivePublishersDataContext>;
};

export const useLivePublishersData = (feedKey: string) => {
  const publisherData =  useLivePublishersDataContext()
  return publisherData[feedKey];
};

const useLivePublishersDataContext = () => {
  const publisherData = use(LivePublishersDataContext);
  if (publisherData === undefined) {
    throw new LivePublishersDataProviderNotInitializedError();
  }
  return publisherData;
};

class LivePublishersDataProviderNotInitializedError extends Error {
  constructor() {
    super("This component must be a child of <LivePublishersDataProvider>");
    this.name = "LivePublishersDataProviderNotInitializedError";
  }
}