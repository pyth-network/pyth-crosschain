import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace pyth_lazer_transaction. */
export namespace pyth_lazer_transaction {

    /** Properties of a PublisherUpdate. */
    interface IPublisherUpdate {

        /** PublisherUpdate updates */
        updates?: (pyth_lazer_transaction.IFeedUpdate[]|null);

        /** PublisherUpdate batchTimestampUs */
        batchTimestampUs?: (number|Long|null);
    }

    /** Represents a PublisherUpdate. */
    class PublisherUpdate implements IPublisherUpdate {

        /**
         * Constructs a new PublisherUpdate.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.IPublisherUpdate);

        /** PublisherUpdate updates. */
        public updates: pyth_lazer_transaction.IFeedUpdate[];

        /** PublisherUpdate batchTimestampUs. */
        public batchTimestampUs: (number|Long);

        /**
         * Creates a new PublisherUpdate instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PublisherUpdate instance
         */
        public static create(properties?: pyth_lazer_transaction.IPublisherUpdate): pyth_lazer_transaction.PublisherUpdate;

        /**
         * Encodes the specified PublisherUpdate message. Does not implicitly {@link pyth_lazer_transaction.PublisherUpdate.verify|verify} messages.
         * @param message PublisherUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.IPublisherUpdate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PublisherUpdate message, length delimited. Does not implicitly {@link pyth_lazer_transaction.PublisherUpdate.verify|verify} messages.
         * @param message PublisherUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.IPublisherUpdate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PublisherUpdate message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PublisherUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.PublisherUpdate;

        /**
         * Decodes a PublisherUpdate message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PublisherUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.PublisherUpdate;

        /**
         * Verifies a PublisherUpdate message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PublisherUpdate message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PublisherUpdate
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.PublisherUpdate;

        /**
         * Creates a plain object from a PublisherUpdate message. Also converts values to other types if specified.
         * @param message PublisherUpdate
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.PublisherUpdate, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PublisherUpdate to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PublisherUpdate
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FeedUpdate. */
    interface IFeedUpdate {

        /** FeedUpdate priceUpdateV1 */
        priceUpdateV1?: (pyth_lazer_transaction.IPriceUpdateV1|null);

        /** FeedUpdate fundingRateUpdateV1 */
        fundingRateUpdateV1?: (pyth_lazer_transaction.IFundingRateUpdateV1|null);
    }

    /** Represents a FeedUpdate. */
    class FeedUpdate implements IFeedUpdate {

        /**
         * Constructs a new FeedUpdate.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.IFeedUpdate);

        /** FeedUpdate priceUpdateV1. */
        public priceUpdateV1?: (pyth_lazer_transaction.IPriceUpdateV1|null);

        /** FeedUpdate fundingRateUpdateV1. */
        public fundingRateUpdateV1?: (pyth_lazer_transaction.IFundingRateUpdateV1|null);

        /** FeedUpdate update. */
        public update?: ("priceUpdateV1"|"fundingRateUpdateV1");

        /**
         * Creates a new FeedUpdate instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FeedUpdate instance
         */
        public static create(properties?: pyth_lazer_transaction.IFeedUpdate): pyth_lazer_transaction.FeedUpdate;

        /**
         * Encodes the specified FeedUpdate message. Does not implicitly {@link pyth_lazer_transaction.FeedUpdate.verify|verify} messages.
         * @param message FeedUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.IFeedUpdate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FeedUpdate message, length delimited. Does not implicitly {@link pyth_lazer_transaction.FeedUpdate.verify|verify} messages.
         * @param message FeedUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.IFeedUpdate, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FeedUpdate message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FeedUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.FeedUpdate;

        /**
         * Decodes a FeedUpdate message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FeedUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.FeedUpdate;

        /**
         * Verifies a FeedUpdate message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FeedUpdate message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FeedUpdate
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.FeedUpdate;

        /**
         * Creates a plain object from a FeedUpdate message. Also converts values to other types if specified.
         * @param message FeedUpdate
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.FeedUpdate, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FeedUpdate to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FeedUpdate
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PriceUpdateV1. */
    interface IPriceUpdateV1 {

        /** PriceUpdateV1 feedId */
        feedId?: (number|null);

        /** PriceUpdateV1 sourceTimestampUs */
        sourceTimestampUs?: (number|Long|null);

        /** PriceUpdateV1 publisherTimestampUs */
        publisherTimestampUs?: (number|Long|null);

        /** PriceUpdateV1 price */
        price?: (number|Long|null);

        /** PriceUpdateV1 bestBidPrice */
        bestBidPrice?: (number|Long|null);

        /** PriceUpdateV1 bestAskPrice */
        bestAskPrice?: (number|Long|null);
    }

    /** Represents a PriceUpdateV1. */
    class PriceUpdateV1 implements IPriceUpdateV1 {

        /**
         * Constructs a new PriceUpdateV1.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.IPriceUpdateV1);

        /** PriceUpdateV1 feedId. */
        public feedId: number;

        /** PriceUpdateV1 sourceTimestampUs. */
        public sourceTimestampUs: (number|Long);

        /** PriceUpdateV1 publisherTimestampUs. */
        public publisherTimestampUs: (number|Long);

        /** PriceUpdateV1 price. */
        public price?: (number|Long|null);

        /** PriceUpdateV1 bestBidPrice. */
        public bestBidPrice?: (number|Long|null);

        /** PriceUpdateV1 bestAskPrice. */
        public bestAskPrice?: (number|Long|null);

        /**
         * Creates a new PriceUpdateV1 instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PriceUpdateV1 instance
         */
        public static create(properties?: pyth_lazer_transaction.IPriceUpdateV1): pyth_lazer_transaction.PriceUpdateV1;

        /**
         * Encodes the specified PriceUpdateV1 message. Does not implicitly {@link pyth_lazer_transaction.PriceUpdateV1.verify|verify} messages.
         * @param message PriceUpdateV1 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.IPriceUpdateV1, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified PriceUpdateV1 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.PriceUpdateV1.verify|verify} messages.
         * @param message PriceUpdateV1 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.IPriceUpdateV1, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a PriceUpdateV1 message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PriceUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.PriceUpdateV1;

        /**
         * Decodes a PriceUpdateV1 message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PriceUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.PriceUpdateV1;

        /**
         * Verifies a PriceUpdateV1 message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a PriceUpdateV1 message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PriceUpdateV1
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.PriceUpdateV1;

        /**
         * Creates a plain object from a PriceUpdateV1 message. Also converts values to other types if specified.
         * @param message PriceUpdateV1
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.PriceUpdateV1, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this PriceUpdateV1 to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PriceUpdateV1
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FundingRateUpdateV1. */
    interface IFundingRateUpdateV1 {

        /** FundingRateUpdateV1 feedId */
        feedId?: (number|null);

        /** FundingRateUpdateV1 sourceTimestampUs */
        sourceTimestampUs?: (number|Long|null);

        /** FundingRateUpdateV1 publisherTimestampUs */
        publisherTimestampUs?: (number|Long|null);

        /** FundingRateUpdateV1 price */
        price?: (number|Long|null);

        /** FundingRateUpdateV1 rate */
        rate?: (number|Long|null);
    }

    /** Represents a FundingRateUpdateV1. */
    class FundingRateUpdateV1 implements IFundingRateUpdateV1 {

        /**
         * Constructs a new FundingRateUpdateV1.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.IFundingRateUpdateV1);

        /** FundingRateUpdateV1 feedId. */
        public feedId: number;

        /** FundingRateUpdateV1 sourceTimestampUs. */
        public sourceTimestampUs: (number|Long);

        /** FundingRateUpdateV1 publisherTimestampUs. */
        public publisherTimestampUs: (number|Long);

        /** FundingRateUpdateV1 price. */
        public price?: (number|Long|null);

        /** FundingRateUpdateV1 rate. */
        public rate?: (number|Long|null);

        /**
         * Creates a new FundingRateUpdateV1 instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FundingRateUpdateV1 instance
         */
        public static create(properties?: pyth_lazer_transaction.IFundingRateUpdateV1): pyth_lazer_transaction.FundingRateUpdateV1;

        /**
         * Encodes the specified FundingRateUpdateV1 message. Does not implicitly {@link pyth_lazer_transaction.FundingRateUpdateV1.verify|verify} messages.
         * @param message FundingRateUpdateV1 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.IFundingRateUpdateV1, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FundingRateUpdateV1 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.FundingRateUpdateV1.verify|verify} messages.
         * @param message FundingRateUpdateV1 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.IFundingRateUpdateV1, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FundingRateUpdateV1 message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FundingRateUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.FundingRateUpdateV1;

        /**
         * Decodes a FundingRateUpdateV1 message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FundingRateUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.FundingRateUpdateV1;

        /**
         * Verifies a FundingRateUpdateV1 message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FundingRateUpdateV1 message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FundingRateUpdateV1
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.FundingRateUpdateV1;

        /**
         * Creates a plain object from a FundingRateUpdateV1 message. Also converts values to other types if specified.
         * @param message FundingRateUpdateV1
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.FundingRateUpdateV1, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FundingRateUpdateV1 to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FundingRateUpdateV1
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** TransactionSignatureType enum. */
    enum TransactionSignatureType {
        ed25519 = 0
    }

    /** Properties of a SignedLazerTransaction. */
    interface ISignedLazerTransaction {

        /** SignedLazerTransaction signatureType */
        signatureType?: (pyth_lazer_transaction.TransactionSignatureType|null);

        /** SignedLazerTransaction signature */
        signature?: (Uint8Array|null);

        /** SignedLazerTransaction transaction */
        transaction?: (Uint8Array|null);
    }

    /** Represents a SignedLazerTransaction. */
    class SignedLazerTransaction implements ISignedLazerTransaction {

        /**
         * Constructs a new SignedLazerTransaction.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.ISignedLazerTransaction);

        /** SignedLazerTransaction signatureType. */
        public signatureType: pyth_lazer_transaction.TransactionSignatureType;

        /** SignedLazerTransaction signature. */
        public signature: Uint8Array;

        /** SignedLazerTransaction transaction. */
        public transaction: Uint8Array;

        /**
         * Creates a new SignedLazerTransaction instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SignedLazerTransaction instance
         */
        public static create(properties?: pyth_lazer_transaction.ISignedLazerTransaction): pyth_lazer_transaction.SignedLazerTransaction;

        /**
         * Encodes the specified SignedLazerTransaction message. Does not implicitly {@link pyth_lazer_transaction.SignedLazerTransaction.verify|verify} messages.
         * @param message SignedLazerTransaction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.ISignedLazerTransaction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SignedLazerTransaction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SignedLazerTransaction.verify|verify} messages.
         * @param message SignedLazerTransaction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.ISignedLazerTransaction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SignedLazerTransaction message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SignedLazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.SignedLazerTransaction;

        /**
         * Decodes a SignedLazerTransaction message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SignedLazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.SignedLazerTransaction;

        /**
         * Verifies a SignedLazerTransaction message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SignedLazerTransaction message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SignedLazerTransaction
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.SignedLazerTransaction;

        /**
         * Creates a plain object from a SignedLazerTransaction message. Also converts values to other types if specified.
         * @param message SignedLazerTransaction
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.SignedLazerTransaction, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SignedLazerTransaction to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SignedLazerTransaction
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a LazerTransaction. */
    interface ILazerTransaction {

        /** LazerTransaction publisherUpdates */
        publisherUpdates?: (pyth_lazer_transaction.IPublisherUpdate|null);
    }

    /** Represents a LazerTransaction. */
    class LazerTransaction implements ILazerTransaction {

        /**
         * Constructs a new LazerTransaction.
         * @param [properties] Properties to set
         */
        constructor(properties?: pyth_lazer_transaction.ILazerTransaction);

        /** LazerTransaction publisherUpdates. */
        public publisherUpdates?: (pyth_lazer_transaction.IPublisherUpdate|null);

        /** LazerTransaction payload. */
        public payload?: "publisherUpdates";

        /**
         * Creates a new LazerTransaction instance using the specified properties.
         * @param [properties] Properties to set
         * @returns LazerTransaction instance
         */
        public static create(properties?: pyth_lazer_transaction.ILazerTransaction): pyth_lazer_transaction.LazerTransaction;

        /**
         * Encodes the specified LazerTransaction message. Does not implicitly {@link pyth_lazer_transaction.LazerTransaction.verify|verify} messages.
         * @param message LazerTransaction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: pyth_lazer_transaction.ILazerTransaction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified LazerTransaction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.LazerTransaction.verify|verify} messages.
         * @param message LazerTransaction message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: pyth_lazer_transaction.ILazerTransaction, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a LazerTransaction message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns LazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): pyth_lazer_transaction.LazerTransaction;

        /**
         * Decodes a LazerTransaction message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns LazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): pyth_lazer_transaction.LazerTransaction;

        /**
         * Verifies a LazerTransaction message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a LazerTransaction message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns LazerTransaction
         */
        public static fromObject(object: { [k: string]: any }): pyth_lazer_transaction.LazerTransaction;

        /**
         * Creates a plain object from a LazerTransaction message. Also converts values to other types if specified.
         * @param message LazerTransaction
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: pyth_lazer_transaction.LazerTransaction, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this LazerTransaction to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for LazerTransaction
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
