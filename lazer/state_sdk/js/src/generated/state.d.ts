import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace lazer. */
export namespace lazer {

    /** Properties of a State. */
    interface IState {

        /** State shardId */
        shardId?: (number|null);

        /** State lastSequenceNo */
        lastSequenceNo?: (number|Long|null);

        /** State lastTimestamp */
        lastTimestamp?: (google.protobuf.ITimestamp|null);

        /** State shardName */
        shardName?: (string|null);

        /** State minRate */
        minRate?: (google.protobuf.IDuration|null);

        /** State feeds */
        feeds?: (lazer.IFeed[]|null);

        /** State publishers */
        publishers?: (lazer.IPublisher[]|null);
    }

    /** Represents a State. */
    class State implements IState {

        /**
         * Constructs a new State.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IState);

        /** State shardId. */
        public shardId?: (number|null);

        /** State lastSequenceNo. */
        public lastSequenceNo?: (number|Long|null);

        /** State lastTimestamp. */
        public lastTimestamp?: (google.protobuf.ITimestamp|null);

        /** State shardName. */
        public shardName?: (string|null);

        /** State minRate. */
        public minRate?: (google.protobuf.IDuration|null);

        /** State feeds. */
        public feeds: lazer.IFeed[];

        /** State publishers. */
        public publishers: lazer.IPublisher[];

        /** State _shardId. */
        public _shardId?: "shardId";

        /** State _lastSequenceNo. */
        public _lastSequenceNo?: "lastSequenceNo";

        /** State _lastTimestamp. */
        public _lastTimestamp?: "lastTimestamp";

        /** State _shardName. */
        public _shardName?: "shardName";

        /** State _minRate. */
        public _minRate?: "minRate";

        /**
         * Creates a new State instance using the specified properties.
         * @param [properties] Properties to set
         * @returns State instance
         */
        public static create(properties?: lazer.IState): lazer.State;

        /**
         * Encodes the specified State message. Does not implicitly {@link lazer.State.verify|verify} messages.
         * @param message State message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified State message, length delimited. Does not implicitly {@link lazer.State.verify|verify} messages.
         * @param message State message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a State message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns State
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.State;

        /**
         * Decodes a State message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns State
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.State;

        /**
         * Verifies a State message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a State message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns State
         */
        public static fromObject(object: { [k: string]: any }): lazer.State;

        /**
         * Creates a plain object from a State message. Also converts values to other types if specified.
         * @param message State
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.State, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this State to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for State
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Publisher. */
    interface IPublisher {

        /** Publisher publisherId */
        publisherId?: (number|null);

        /** Publisher name */
        name?: (string|null);

        /** Publisher publicKeys */
        publicKeys?: (Uint8Array[]|null);

        /** Publisher isActive */
        isActive?: (boolean|null);
    }

    /** Represents a Publisher. */
    class Publisher implements IPublisher {

        /**
         * Constructs a new Publisher.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IPublisher);

        /** Publisher publisherId. */
        public publisherId?: (number|null);

        /** Publisher name. */
        public name?: (string|null);

        /** Publisher publicKeys. */
        public publicKeys: Uint8Array[];

        /** Publisher isActive. */
        public isActive?: (boolean|null);

        /** Publisher _publisherId. */
        public _publisherId?: "publisherId";

        /** Publisher _name. */
        public _name?: "name";

        /** Publisher _isActive. */
        public _isActive?: "isActive";

        /**
         * Creates a new Publisher instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Publisher instance
         */
        public static create(properties?: lazer.IPublisher): lazer.Publisher;

        /**
         * Encodes the specified Publisher message. Does not implicitly {@link lazer.Publisher.verify|verify} messages.
         * @param message Publisher message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IPublisher, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Publisher message, length delimited. Does not implicitly {@link lazer.Publisher.verify|verify} messages.
         * @param message Publisher message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IPublisher, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Publisher message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Publisher
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.Publisher;

        /**
         * Decodes a Publisher message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Publisher
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.Publisher;

        /**
         * Verifies a Publisher message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Publisher message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Publisher
         */
        public static fromObject(object: { [k: string]: any }): lazer.Publisher;

        /**
         * Creates a plain object from a Publisher message. Also converts values to other types if specified.
         * @param message Publisher
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.Publisher, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Publisher to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Publisher
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** AssetType enum. */
    enum AssetType {
        CRYPTO = 0,
        FUNDING_RATE = 1,
        FX = 2,
        COMMODITY = 3,
        NAV = 4,
        CRYPTO_INDEX = 5,
        CRYPTO_REDEMPTION_RATE = 6,
        EQUITY = 7,
        METAL = 8,
        RATES = 9
    }

    /** Properties of a FeedMetadata. */
    interface IFeedMetadata {

        /** FeedMetadata priceFeedId */
        priceFeedId?: (number|null);

        /** FeedMetadata name */
        name?: (string|null);

        /** FeedMetadata symbol */
        symbol?: (string|null);

        /** FeedMetadata description */
        description?: (string|null);

        /** FeedMetadata assetType */
        assetType?: (lazer.AssetType|null);

        /** FeedMetadata exponent */
        exponent?: (number|null);

        /** FeedMetadata cmcId */
        cmcId?: (number|null);

        /** FeedMetadata fundingRateInterval */
        fundingRateInterval?: (google.protobuf.IDuration|null);

        /** FeedMetadata minPublishers */
        minPublishers?: (number|null);

        /** FeedMetadata minRate */
        minRate?: (google.protobuf.IDuration|null);

        /** FeedMetadata expiryTime */
        expiryTime?: (google.protobuf.IDuration|null);

        /** FeedMetadata isActivated */
        isActivated?: (boolean|null);

        /** FeedMetadata hermesId */
        hermesId?: (string|null);

        /** FeedMetadata quoteCurrency */
        quoteCurrency?: (string|null);

        /** FeedMetadata marketSchedule */
        marketSchedule?: (string|null);
    }

    /** Represents a FeedMetadata. */
    class FeedMetadata implements IFeedMetadata {

        /**
         * Constructs a new FeedMetadata.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IFeedMetadata);

        /** FeedMetadata priceFeedId. */
        public priceFeedId?: (number|null);

        /** FeedMetadata name. */
        public name?: (string|null);

        /** FeedMetadata symbol. */
        public symbol?: (string|null);

        /** FeedMetadata description. */
        public description?: (string|null);

        /** FeedMetadata assetType. */
        public assetType?: (lazer.AssetType|null);

        /** FeedMetadata exponent. */
        public exponent?: (number|null);

        /** FeedMetadata cmcId. */
        public cmcId?: (number|null);

        /** FeedMetadata fundingRateInterval. */
        public fundingRateInterval?: (google.protobuf.IDuration|null);

        /** FeedMetadata minPublishers. */
        public minPublishers?: (number|null);

        /** FeedMetadata minRate. */
        public minRate?: (google.protobuf.IDuration|null);

        /** FeedMetadata expiryTime. */
        public expiryTime?: (google.protobuf.IDuration|null);

        /** FeedMetadata isActivated. */
        public isActivated?: (boolean|null);

        /** FeedMetadata hermesId. */
        public hermesId?: (string|null);

        /** FeedMetadata quoteCurrency. */
        public quoteCurrency?: (string|null);

        /** FeedMetadata marketSchedule. */
        public marketSchedule?: (string|null);

        /** FeedMetadata _priceFeedId. */
        public _priceFeedId?: "priceFeedId";

        /** FeedMetadata _name. */
        public _name?: "name";

        /** FeedMetadata _symbol. */
        public _symbol?: "symbol";

        /** FeedMetadata _description. */
        public _description?: "description";

        /** FeedMetadata _assetType. */
        public _assetType?: "assetType";

        /** FeedMetadata _exponent. */
        public _exponent?: "exponent";

        /** FeedMetadata _cmcId. */
        public _cmcId?: "cmcId";

        /** FeedMetadata _fundingRateInterval. */
        public _fundingRateInterval?: "fundingRateInterval";

        /** FeedMetadata _minPublishers. */
        public _minPublishers?: "minPublishers";

        /** FeedMetadata _minRate. */
        public _minRate?: "minRate";

        /** FeedMetadata _expiryTime. */
        public _expiryTime?: "expiryTime";

        /** FeedMetadata _isActivated. */
        public _isActivated?: "isActivated";

        /** FeedMetadata _hermesId. */
        public _hermesId?: "hermesId";

        /** FeedMetadata _quoteCurrency. */
        public _quoteCurrency?: "quoteCurrency";

        /** FeedMetadata _marketSchedule. */
        public _marketSchedule?: "marketSchedule";

        /**
         * Creates a new FeedMetadata instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FeedMetadata instance
         */
        public static create(properties?: lazer.IFeedMetadata): lazer.FeedMetadata;

        /**
         * Encodes the specified FeedMetadata message. Does not implicitly {@link lazer.FeedMetadata.verify|verify} messages.
         * @param message FeedMetadata message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IFeedMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FeedMetadata message, length delimited. Does not implicitly {@link lazer.FeedMetadata.verify|verify} messages.
         * @param message FeedMetadata message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IFeedMetadata, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FeedMetadata message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FeedMetadata
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.FeedMetadata;

        /**
         * Decodes a FeedMetadata message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FeedMetadata
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.FeedMetadata;

        /**
         * Verifies a FeedMetadata message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FeedMetadata message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FeedMetadata
         */
        public static fromObject(object: { [k: string]: any }): lazer.FeedMetadata;

        /**
         * Creates a plain object from a FeedMetadata message. Also converts values to other types if specified.
         * @param message FeedMetadata
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.FeedMetadata, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FeedMetadata to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FeedMetadata
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Feed. */
    interface IFeed {

        /** Feed metadata */
        metadata?: (lazer.IFeedMetadata|null);

        /** Feed pendingActivation */
        pendingActivation?: (google.protobuf.ITimestamp|null);

        /** Feed pendingDeactivation */
        pendingDeactivation?: (google.protobuf.ITimestamp|null);

        /** Feed perPublisher */
        perPublisher?: (lazer.IFeedPublisherState[]|null);
    }

    /** Represents a Feed. */
    class Feed implements IFeed {

        /**
         * Constructs a new Feed.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IFeed);

        /** Feed metadata. */
        public metadata?: (lazer.IFeedMetadata|null);

        /** Feed pendingActivation. */
        public pendingActivation?: (google.protobuf.ITimestamp|null);

        /** Feed pendingDeactivation. */
        public pendingDeactivation?: (google.protobuf.ITimestamp|null);

        /** Feed perPublisher. */
        public perPublisher: lazer.IFeedPublisherState[];

        /** Feed _metadata. */
        public _metadata?: "metadata";

        /** Feed _pendingActivation. */
        public _pendingActivation?: "pendingActivation";

        /** Feed _pendingDeactivation. */
        public _pendingDeactivation?: "pendingDeactivation";

        /**
         * Creates a new Feed instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Feed instance
         */
        public static create(properties?: lazer.IFeed): lazer.Feed;

        /**
         * Encodes the specified Feed message. Does not implicitly {@link lazer.Feed.verify|verify} messages.
         * @param message Feed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IFeed, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Feed message, length delimited. Does not implicitly {@link lazer.Feed.verify|verify} messages.
         * @param message Feed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IFeed, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Feed message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Feed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.Feed;

        /**
         * Decodes a Feed message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Feed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.Feed;

        /**
         * Verifies a Feed message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Feed message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Feed
         */
        public static fromObject(object: { [k: string]: any }): lazer.Feed;

        /**
         * Creates a plain object from a Feed message. Also converts values to other types if specified.
         * @param message Feed
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.Feed, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Feed to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Feed
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FeedPublisherState. */
    interface IFeedPublisherState {

        /** FeedPublisherState publisherId */
        publisherId?: (number|null);

        /** FeedPublisherState lastUpdateTimestamp */
        lastUpdateTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedPublisherState lastPublisherTimestamp */
        lastPublisherTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedPublisherState lastFeedData */
        lastFeedData?: (lazer.IFeedData|null);
    }

    /** Represents a FeedPublisherState. */
    class FeedPublisherState implements IFeedPublisherState {

        /**
         * Constructs a new FeedPublisherState.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IFeedPublisherState);

        /** FeedPublisherState publisherId. */
        public publisherId?: (number|null);

        /** FeedPublisherState lastUpdateTimestamp. */
        public lastUpdateTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedPublisherState lastPublisherTimestamp. */
        public lastPublisherTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedPublisherState lastFeedData. */
        public lastFeedData?: (lazer.IFeedData|null);

        /** FeedPublisherState _publisherId. */
        public _publisherId?: "publisherId";

        /** FeedPublisherState _lastUpdateTimestamp. */
        public _lastUpdateTimestamp?: "lastUpdateTimestamp";

        /** FeedPublisherState _lastPublisherTimestamp. */
        public _lastPublisherTimestamp?: "lastPublisherTimestamp";

        /** FeedPublisherState _lastFeedData. */
        public _lastFeedData?: "lastFeedData";

        /**
         * Creates a new FeedPublisherState instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FeedPublisherState instance
         */
        public static create(properties?: lazer.IFeedPublisherState): lazer.FeedPublisherState;

        /**
         * Encodes the specified FeedPublisherState message. Does not implicitly {@link lazer.FeedPublisherState.verify|verify} messages.
         * @param message FeedPublisherState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IFeedPublisherState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FeedPublisherState message, length delimited. Does not implicitly {@link lazer.FeedPublisherState.verify|verify} messages.
         * @param message FeedPublisherState message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IFeedPublisherState, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FeedPublisherState message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FeedPublisherState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.FeedPublisherState;

        /**
         * Decodes a FeedPublisherState message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FeedPublisherState
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.FeedPublisherState;

        /**
         * Verifies a FeedPublisherState message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FeedPublisherState message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FeedPublisherState
         */
        public static fromObject(object: { [k: string]: any }): lazer.FeedPublisherState;

        /**
         * Creates a plain object from a FeedPublisherState message. Also converts values to other types if specified.
         * @param message FeedPublisherState
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.FeedPublisherState, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FeedPublisherState to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FeedPublisherState
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FeedData. */
    interface IFeedData {

        /** FeedData sourceTimestamp */
        sourceTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedData publisherTimestamp */
        publisherTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedData price */
        price?: (number|Long|null);

        /** FeedData bestBidPrice */
        bestBidPrice?: (number|Long|null);

        /** FeedData bestAskPrice */
        bestAskPrice?: (number|Long|null);

        /** FeedData fundingRate */
        fundingRate?: (number|Long|null);
    }

    /** Represents a FeedData. */
    class FeedData implements IFeedData {

        /**
         * Constructs a new FeedData.
         * @param [properties] Properties to set
         */
        constructor(properties?: lazer.IFeedData);

        /** FeedData sourceTimestamp. */
        public sourceTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedData publisherTimestamp. */
        public publisherTimestamp?: (google.protobuf.ITimestamp|null);

        /** FeedData price. */
        public price?: (number|Long|null);

        /** FeedData bestBidPrice. */
        public bestBidPrice?: (number|Long|null);

        /** FeedData bestAskPrice. */
        public bestAskPrice?: (number|Long|null);

        /** FeedData fundingRate. */
        public fundingRate?: (number|Long|null);

        /** FeedData _sourceTimestamp. */
        public _sourceTimestamp?: "sourceTimestamp";

        /** FeedData _publisherTimestamp. */
        public _publisherTimestamp?: "publisherTimestamp";

        /** FeedData _price. */
        public _price?: "price";

        /** FeedData _bestBidPrice. */
        public _bestBidPrice?: "bestBidPrice";

        /** FeedData _bestAskPrice. */
        public _bestAskPrice?: "bestAskPrice";

        /** FeedData _fundingRate. */
        public _fundingRate?: "fundingRate";

        /**
         * Creates a new FeedData instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FeedData instance
         */
        public static create(properties?: lazer.IFeedData): lazer.FeedData;

        /**
         * Encodes the specified FeedData message. Does not implicitly {@link lazer.FeedData.verify|verify} messages.
         * @param message FeedData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: lazer.IFeedData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FeedData message, length delimited. Does not implicitly {@link lazer.FeedData.verify|verify} messages.
         * @param message FeedData message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: lazer.IFeedData, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FeedData message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FeedData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): lazer.FeedData;

        /**
         * Decodes a FeedData message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FeedData
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): lazer.FeedData;

        /**
         * Verifies a FeedData message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FeedData message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FeedData
         */
        public static fromObject(object: { [k: string]: any }): lazer.FeedData;

        /**
         * Creates a plain object from a FeedData message. Also converts values to other types if specified.
         * @param message FeedData
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: lazer.FeedData, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FeedData to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FeedData
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace google. */
export namespace google {

    /** Namespace protobuf. */
    namespace protobuf {

        /** Properties of a Duration. */
        interface IDuration {

            /** Duration seconds */
            seconds?: (number|Long|null);

            /** Duration nanos */
            nanos?: (number|null);
        }

        /** Represents a Duration. */
        class Duration implements IDuration {

            /**
             * Constructs a new Duration.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.IDuration);

            /** Duration seconds. */
            public seconds: (number|Long);

            /** Duration nanos. */
            public nanos: number;

            /**
             * Creates a new Duration instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Duration instance
             */
            public static create(properties?: google.protobuf.IDuration): google.protobuf.Duration;

            /**
             * Encodes the specified Duration message. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Duration message, length delimited. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
             * @param message Duration message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.IDuration, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Duration message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Duration;

            /**
             * Decodes a Duration message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Duration
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Duration;

            /**
             * Verifies a Duration message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Duration message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Duration
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Duration;

            /**
             * Creates a plain object from a Duration message. Also converts values to other types if specified.
             * @param message Duration
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Duration, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Duration to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Duration
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }

        /** Properties of a Timestamp. */
        interface ITimestamp {

            /** Timestamp seconds */
            seconds?: (number|Long|null);

            /** Timestamp nanos */
            nanos?: (number|null);
        }

        /** Represents a Timestamp. */
        class Timestamp implements ITimestamp {

            /**
             * Constructs a new Timestamp.
             * @param [properties] Properties to set
             */
            constructor(properties?: google.protobuf.ITimestamp);

            /** Timestamp seconds. */
            public seconds: (number|Long);

            /** Timestamp nanos. */
            public nanos: number;

            /**
             * Creates a new Timestamp instance using the specified properties.
             * @param [properties] Properties to set
             * @returns Timestamp instance
             */
            public static create(properties?: google.protobuf.ITimestamp): google.protobuf.Timestamp;

            /**
             * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encode(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
             * @param message Timestamp message or plain object to encode
             * @param [writer] Writer to encode to
             * @returns Writer
             */
            public static encodeDelimited(message: google.protobuf.ITimestamp, writer?: $protobuf.Writer): $protobuf.Writer;

            /**
             * Decodes a Timestamp message from the specified reader or buffer.
             * @param reader Reader or buffer to decode from
             * @param [length] Message length if known beforehand
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): google.protobuf.Timestamp;

            /**
             * Decodes a Timestamp message from the specified reader or buffer, length delimited.
             * @param reader Reader or buffer to decode from
             * @returns Timestamp
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): google.protobuf.Timestamp;

            /**
             * Verifies a Timestamp message.
             * @param message Plain object to verify
             * @returns `null` if valid, otherwise the reason why it is not
             */
            public static verify(message: { [k: string]: any }): (string|null);

            /**
             * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
             * @param object Plain object
             * @returns Timestamp
             */
            public static fromObject(object: { [k: string]: any }): google.protobuf.Timestamp;

            /**
             * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
             * @param message Timestamp
             * @param [options] Conversion options
             * @returns Plain object
             */
            public static toObject(message: google.protobuf.Timestamp, options?: $protobuf.IConversionOptions): { [k: string]: any };

            /**
             * Converts this Timestamp to JSON.
             * @returns JSON object
             */
            public toJSON(): { [k: string]: any };

            /**
             * Gets the default type url for Timestamp
             * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns The default type url
             */
            public static getTypeUrl(typeUrlPrefix?: string): string;
        }
    }
}
