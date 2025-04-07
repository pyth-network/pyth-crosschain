/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const pyth_lazer_transaction = $root.pyth_lazer_transaction = (() => {

    /**
     * Namespace pyth_lazer_transaction.
     * @exports pyth_lazer_transaction
     * @namespace
     */
    const pyth_lazer_transaction = {};

    pyth_lazer_transaction.PublisherUpdate = (function() {

        /**
         * Properties of a PublisherUpdate.
         * @memberof pyth_lazer_transaction
         * @interface IPublisherUpdate
         * @property {Array.<pyth_lazer_transaction.IFeedUpdate>|null} [updates] PublisherUpdate updates
         * @property {number|Long|null} [batchTimestampUs] PublisherUpdate batchTimestampUs
         */

        /**
         * Constructs a new PublisherUpdate.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a PublisherUpdate.
         * @implements IPublisherUpdate
         * @constructor
         * @param {pyth_lazer_transaction.IPublisherUpdate=} [properties] Properties to set
         */
        function PublisherUpdate(properties) {
            this.updates = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PublisherUpdate updates.
         * @member {Array.<pyth_lazer_transaction.IFeedUpdate>} updates
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @instance
         */
        PublisherUpdate.prototype.updates = $util.emptyArray;

        /**
         * PublisherUpdate batchTimestampUs.
         * @member {number|Long} batchTimestampUs
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @instance
         */
        PublisherUpdate.prototype.batchTimestampUs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new PublisherUpdate instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {pyth_lazer_transaction.IPublisherUpdate=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.PublisherUpdate} PublisherUpdate instance
         */
        PublisherUpdate.create = function create(properties) {
            return new PublisherUpdate(properties);
        };

        /**
         * Encodes the specified PublisherUpdate message. Does not implicitly {@link pyth_lazer_transaction.PublisherUpdate.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {pyth_lazer_transaction.IPublisherUpdate} message PublisherUpdate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PublisherUpdate.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.updates != null && message.updates.length)
                for (let i = 0; i < message.updates.length; ++i)
                    $root.pyth_lazer_transaction.FeedUpdate.encode(message.updates[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.batchTimestampUs != null && Object.hasOwnProperty.call(message, "batchTimestampUs"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.batchTimestampUs);
            return writer;
        };

        /**
         * Encodes the specified PublisherUpdate message, length delimited. Does not implicitly {@link pyth_lazer_transaction.PublisherUpdate.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {pyth_lazer_transaction.IPublisherUpdate} message PublisherUpdate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PublisherUpdate.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PublisherUpdate message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.PublisherUpdate} PublisherUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PublisherUpdate.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.PublisherUpdate();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.updates && message.updates.length))
                            message.updates = [];
                        message.updates.push($root.pyth_lazer_transaction.FeedUpdate.decode(reader, reader.uint32()));
                        break;
                    }
                case 2: {
                        message.batchTimestampUs = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PublisherUpdate message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.PublisherUpdate} PublisherUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PublisherUpdate.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PublisherUpdate message.
         * @function verify
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PublisherUpdate.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.updates != null && message.hasOwnProperty("updates")) {
                if (!Array.isArray(message.updates))
                    return "updates: array expected";
                for (let i = 0; i < message.updates.length; ++i) {
                    let error = $root.pyth_lazer_transaction.FeedUpdate.verify(message.updates[i]);
                    if (error)
                        return "updates." + error;
                }
            }
            if (message.batchTimestampUs != null && message.hasOwnProperty("batchTimestampUs"))
                if (!$util.isInteger(message.batchTimestampUs) && !(message.batchTimestampUs && $util.isInteger(message.batchTimestampUs.low) && $util.isInteger(message.batchTimestampUs.high)))
                    return "batchTimestampUs: integer|Long expected";
            return null;
        };

        /**
         * Creates a PublisherUpdate message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.PublisherUpdate} PublisherUpdate
         */
        PublisherUpdate.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.PublisherUpdate)
                return object;
            let message = new $root.pyth_lazer_transaction.PublisherUpdate();
            if (object.updates) {
                if (!Array.isArray(object.updates))
                    throw TypeError(".pyth_lazer_transaction.PublisherUpdate.updates: array expected");
                message.updates = [];
                for (let i = 0; i < object.updates.length; ++i) {
                    if (typeof object.updates[i] !== "object")
                        throw TypeError(".pyth_lazer_transaction.PublisherUpdate.updates: object expected");
                    message.updates[i] = $root.pyth_lazer_transaction.FeedUpdate.fromObject(object.updates[i]);
                }
            }
            if (object.batchTimestampUs != null)
                if ($util.Long)
                    (message.batchTimestampUs = $util.Long.fromValue(object.batchTimestampUs)).unsigned = true;
                else if (typeof object.batchTimestampUs === "string")
                    message.batchTimestampUs = parseInt(object.batchTimestampUs, 10);
                else if (typeof object.batchTimestampUs === "number")
                    message.batchTimestampUs = object.batchTimestampUs;
                else if (typeof object.batchTimestampUs === "object")
                    message.batchTimestampUs = new $util.LongBits(object.batchTimestampUs.low >>> 0, object.batchTimestampUs.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a PublisherUpdate message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {pyth_lazer_transaction.PublisherUpdate} message PublisherUpdate
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PublisherUpdate.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.arrays || options.defaults)
                object.updates = [];
            if (options.defaults)
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.batchTimestampUs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.batchTimestampUs = options.longs === String ? "0" : 0;
            if (message.updates && message.updates.length) {
                object.updates = [];
                for (let j = 0; j < message.updates.length; ++j)
                    object.updates[j] = $root.pyth_lazer_transaction.FeedUpdate.toObject(message.updates[j], options);
            }
            if (message.batchTimestampUs != null && message.hasOwnProperty("batchTimestampUs"))
                if (typeof message.batchTimestampUs === "number")
                    object.batchTimestampUs = options.longs === String ? String(message.batchTimestampUs) : message.batchTimestampUs;
                else
                    object.batchTimestampUs = options.longs === String ? $util.Long.prototype.toString.call(message.batchTimestampUs) : options.longs === Number ? new $util.LongBits(message.batchTimestampUs.low >>> 0, message.batchTimestampUs.high >>> 0).toNumber(true) : message.batchTimestampUs;
            return object;
        };

        /**
         * Converts this PublisherUpdate to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PublisherUpdate.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PublisherUpdate
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.PublisherUpdate
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PublisherUpdate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.PublisherUpdate";
        };

        return PublisherUpdate;
    })();

    pyth_lazer_transaction.FeedUpdate = (function() {

        /**
         * Properties of a FeedUpdate.
         * @memberof pyth_lazer_transaction
         * @interface IFeedUpdate
         * @property {pyth_lazer_transaction.IPriceUpdateV1|null} [priceUpdateV1] FeedUpdate priceUpdateV1
         * @property {pyth_lazer_transaction.IFundingRateUpdateV1|null} [fundingRateUpdateV1] FeedUpdate fundingRateUpdateV1
         */

        /**
         * Constructs a new FeedUpdate.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a FeedUpdate.
         * @implements IFeedUpdate
         * @constructor
         * @param {pyth_lazer_transaction.IFeedUpdate=} [properties] Properties to set
         */
        function FeedUpdate(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FeedUpdate priceUpdateV1.
         * @member {pyth_lazer_transaction.IPriceUpdateV1|null|undefined} priceUpdateV1
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @instance
         */
        FeedUpdate.prototype.priceUpdateV1 = null;

        /**
         * FeedUpdate fundingRateUpdateV1.
         * @member {pyth_lazer_transaction.IFundingRateUpdateV1|null|undefined} fundingRateUpdateV1
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @instance
         */
        FeedUpdate.prototype.fundingRateUpdateV1 = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * FeedUpdate update.
         * @member {"priceUpdateV1"|"fundingRateUpdateV1"|undefined} update
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @instance
         */
        Object.defineProperty(FeedUpdate.prototype, "update", {
            get: $util.oneOfGetter($oneOfFields = ["priceUpdateV1", "fundingRateUpdateV1"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new FeedUpdate instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {pyth_lazer_transaction.IFeedUpdate=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.FeedUpdate} FeedUpdate instance
         */
        FeedUpdate.create = function create(properties) {
            return new FeedUpdate(properties);
        };

        /**
         * Encodes the specified FeedUpdate message. Does not implicitly {@link pyth_lazer_transaction.FeedUpdate.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {pyth_lazer_transaction.IFeedUpdate} message FeedUpdate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FeedUpdate.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.priceUpdateV1 != null && Object.hasOwnProperty.call(message, "priceUpdateV1"))
                $root.pyth_lazer_transaction.PriceUpdateV1.encode(message.priceUpdateV1, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.fundingRateUpdateV1 != null && Object.hasOwnProperty.call(message, "fundingRateUpdateV1"))
                $root.pyth_lazer_transaction.FundingRateUpdateV1.encode(message.fundingRateUpdateV1, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified FeedUpdate message, length delimited. Does not implicitly {@link pyth_lazer_transaction.FeedUpdate.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {pyth_lazer_transaction.IFeedUpdate} message FeedUpdate message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FeedUpdate.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FeedUpdate message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.FeedUpdate} FeedUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FeedUpdate.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.FeedUpdate();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 3: {
                        message.priceUpdateV1 = $root.pyth_lazer_transaction.PriceUpdateV1.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.fundingRateUpdateV1 = $root.pyth_lazer_transaction.FundingRateUpdateV1.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FeedUpdate message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.FeedUpdate} FeedUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FeedUpdate.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FeedUpdate message.
         * @function verify
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FeedUpdate.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.priceUpdateV1 != null && message.hasOwnProperty("priceUpdateV1")) {
                properties.update = 1;
                {
                    let error = $root.pyth_lazer_transaction.PriceUpdateV1.verify(message.priceUpdateV1);
                    if (error)
                        return "priceUpdateV1." + error;
                }
            }
            if (message.fundingRateUpdateV1 != null && message.hasOwnProperty("fundingRateUpdateV1")) {
                if (properties.update === 1)
                    return "update: multiple values";
                properties.update = 1;
                {
                    let error = $root.pyth_lazer_transaction.FundingRateUpdateV1.verify(message.fundingRateUpdateV1);
                    if (error)
                        return "fundingRateUpdateV1." + error;
                }
            }
            return null;
        };

        /**
         * Creates a FeedUpdate message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.FeedUpdate} FeedUpdate
         */
        FeedUpdate.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.FeedUpdate)
                return object;
            let message = new $root.pyth_lazer_transaction.FeedUpdate();
            if (object.priceUpdateV1 != null) {
                if (typeof object.priceUpdateV1 !== "object")
                    throw TypeError(".pyth_lazer_transaction.FeedUpdate.priceUpdateV1: object expected");
                message.priceUpdateV1 = $root.pyth_lazer_transaction.PriceUpdateV1.fromObject(object.priceUpdateV1);
            }
            if (object.fundingRateUpdateV1 != null) {
                if (typeof object.fundingRateUpdateV1 !== "object")
                    throw TypeError(".pyth_lazer_transaction.FeedUpdate.fundingRateUpdateV1: object expected");
                message.fundingRateUpdateV1 = $root.pyth_lazer_transaction.FundingRateUpdateV1.fromObject(object.fundingRateUpdateV1);
            }
            return message;
        };

        /**
         * Creates a plain object from a FeedUpdate message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {pyth_lazer_transaction.FeedUpdate} message FeedUpdate
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FeedUpdate.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.priceUpdateV1 != null && message.hasOwnProperty("priceUpdateV1")) {
                object.priceUpdateV1 = $root.pyth_lazer_transaction.PriceUpdateV1.toObject(message.priceUpdateV1, options);
                if (options.oneofs)
                    object.update = "priceUpdateV1";
            }
            if (message.fundingRateUpdateV1 != null && message.hasOwnProperty("fundingRateUpdateV1")) {
                object.fundingRateUpdateV1 = $root.pyth_lazer_transaction.FundingRateUpdateV1.toObject(message.fundingRateUpdateV1, options);
                if (options.oneofs)
                    object.update = "fundingRateUpdateV1";
            }
            return object;
        };

        /**
         * Converts this FeedUpdate to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FeedUpdate.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FeedUpdate
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.FeedUpdate
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FeedUpdate.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.FeedUpdate";
        };

        return FeedUpdate;
    })();

    pyth_lazer_transaction.PriceUpdateV1 = (function() {

        /**
         * Properties of a PriceUpdateV1.
         * @memberof pyth_lazer_transaction
         * @interface IPriceUpdateV1
         * @property {number|null} [feedId] PriceUpdateV1 feedId
         * @property {number|Long|null} [sourceTimestampUs] PriceUpdateV1 sourceTimestampUs
         * @property {number|Long|null} [publisherTimestampUs] PriceUpdateV1 publisherTimestampUs
         * @property {number|Long|null} [price] PriceUpdateV1 price
         * @property {number|Long|null} [bestBidPrice] PriceUpdateV1 bestBidPrice
         * @property {number|Long|null} [bestAskPrice] PriceUpdateV1 bestAskPrice
         */

        /**
         * Constructs a new PriceUpdateV1.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a PriceUpdateV1.
         * @implements IPriceUpdateV1
         * @constructor
         * @param {pyth_lazer_transaction.IPriceUpdateV1=} [properties] Properties to set
         */
        function PriceUpdateV1(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * PriceUpdateV1 feedId.
         * @member {number} feedId
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.feedId = 0;

        /**
         * PriceUpdateV1 sourceTimestampUs.
         * @member {number|Long} sourceTimestampUs
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.sourceTimestampUs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * PriceUpdateV1 publisherTimestampUs.
         * @member {number|Long} publisherTimestampUs
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.publisherTimestampUs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * PriceUpdateV1 price.
         * @member {number|Long|null|undefined} price
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.price = null;

        /**
         * PriceUpdateV1 bestBidPrice.
         * @member {number|Long|null|undefined} bestBidPrice
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.bestBidPrice = null;

        /**
         * PriceUpdateV1 bestAskPrice.
         * @member {number|Long|null|undefined} bestAskPrice
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         */
        PriceUpdateV1.prototype.bestAskPrice = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(PriceUpdateV1.prototype, "_price", {
            get: $util.oneOfGetter($oneOfFields = ["price"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(PriceUpdateV1.prototype, "_bestBidPrice", {
            get: $util.oneOfGetter($oneOfFields = ["bestBidPrice"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(PriceUpdateV1.prototype, "_bestAskPrice", {
            get: $util.oneOfGetter($oneOfFields = ["bestAskPrice"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new PriceUpdateV1 instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IPriceUpdateV1=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.PriceUpdateV1} PriceUpdateV1 instance
         */
        PriceUpdateV1.create = function create(properties) {
            return new PriceUpdateV1(properties);
        };

        /**
         * Encodes the specified PriceUpdateV1 message. Does not implicitly {@link pyth_lazer_transaction.PriceUpdateV1.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IPriceUpdateV1} message PriceUpdateV1 message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PriceUpdateV1.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.feedId != null && Object.hasOwnProperty.call(message, "feedId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.feedId);
            if (message.sourceTimestampUs != null && Object.hasOwnProperty.call(message, "sourceTimestampUs"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.sourceTimestampUs);
            if (message.publisherTimestampUs != null && Object.hasOwnProperty.call(message, "publisherTimestampUs"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.publisherTimestampUs);
            if (message.price != null && Object.hasOwnProperty.call(message, "price"))
                writer.uint32(/* id 4, wireType 0 =*/32).int64(message.price);
            if (message.bestBidPrice != null && Object.hasOwnProperty.call(message, "bestBidPrice"))
                writer.uint32(/* id 5, wireType 0 =*/40).int64(message.bestBidPrice);
            if (message.bestAskPrice != null && Object.hasOwnProperty.call(message, "bestAskPrice"))
                writer.uint32(/* id 6, wireType 0 =*/48).int64(message.bestAskPrice);
            return writer;
        };

        /**
         * Encodes the specified PriceUpdateV1 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.PriceUpdateV1.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IPriceUpdateV1} message PriceUpdateV1 message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        PriceUpdateV1.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a PriceUpdateV1 message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.PriceUpdateV1} PriceUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PriceUpdateV1.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.PriceUpdateV1();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.feedId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.sourceTimestampUs = reader.uint64();
                        break;
                    }
                case 3: {
                        message.publisherTimestampUs = reader.uint64();
                        break;
                    }
                case 4: {
                        message.price = reader.int64();
                        break;
                    }
                case 5: {
                        message.bestBidPrice = reader.int64();
                        break;
                    }
                case 6: {
                        message.bestAskPrice = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a PriceUpdateV1 message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.PriceUpdateV1} PriceUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        PriceUpdateV1.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a PriceUpdateV1 message.
         * @function verify
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        PriceUpdateV1.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.feedId != null && message.hasOwnProperty("feedId"))
                if (!$util.isInteger(message.feedId))
                    return "feedId: integer expected";
            if (message.sourceTimestampUs != null && message.hasOwnProperty("sourceTimestampUs"))
                if (!$util.isInteger(message.sourceTimestampUs) && !(message.sourceTimestampUs && $util.isInteger(message.sourceTimestampUs.low) && $util.isInteger(message.sourceTimestampUs.high)))
                    return "sourceTimestampUs: integer|Long expected";
            if (message.publisherTimestampUs != null && message.hasOwnProperty("publisherTimestampUs"))
                if (!$util.isInteger(message.publisherTimestampUs) && !(message.publisherTimestampUs && $util.isInteger(message.publisherTimestampUs.low) && $util.isInteger(message.publisherTimestampUs.high)))
                    return "publisherTimestampUs: integer|Long expected";
            if (message.price != null && message.hasOwnProperty("price")) {
                properties._price = 1;
                if (!$util.isInteger(message.price) && !(message.price && $util.isInteger(message.price.low) && $util.isInteger(message.price.high)))
                    return "price: integer|Long expected";
            }
            if (message.bestBidPrice != null && message.hasOwnProperty("bestBidPrice")) {
                properties._bestBidPrice = 1;
                if (!$util.isInteger(message.bestBidPrice) && !(message.bestBidPrice && $util.isInteger(message.bestBidPrice.low) && $util.isInteger(message.bestBidPrice.high)))
                    return "bestBidPrice: integer|Long expected";
            }
            if (message.bestAskPrice != null && message.hasOwnProperty("bestAskPrice")) {
                properties._bestAskPrice = 1;
                if (!$util.isInteger(message.bestAskPrice) && !(message.bestAskPrice && $util.isInteger(message.bestAskPrice.low) && $util.isInteger(message.bestAskPrice.high)))
                    return "bestAskPrice: integer|Long expected";
            }
            return null;
        };

        /**
         * Creates a PriceUpdateV1 message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.PriceUpdateV1} PriceUpdateV1
         */
        PriceUpdateV1.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.PriceUpdateV1)
                return object;
            let message = new $root.pyth_lazer_transaction.PriceUpdateV1();
            if (object.feedId != null)
                message.feedId = object.feedId >>> 0;
            if (object.sourceTimestampUs != null)
                if ($util.Long)
                    (message.sourceTimestampUs = $util.Long.fromValue(object.sourceTimestampUs)).unsigned = true;
                else if (typeof object.sourceTimestampUs === "string")
                    message.sourceTimestampUs = parseInt(object.sourceTimestampUs, 10);
                else if (typeof object.sourceTimestampUs === "number")
                    message.sourceTimestampUs = object.sourceTimestampUs;
                else if (typeof object.sourceTimestampUs === "object")
                    message.sourceTimestampUs = new $util.LongBits(object.sourceTimestampUs.low >>> 0, object.sourceTimestampUs.high >>> 0).toNumber(true);
            if (object.publisherTimestampUs != null)
                if ($util.Long)
                    (message.publisherTimestampUs = $util.Long.fromValue(object.publisherTimestampUs)).unsigned = true;
                else if (typeof object.publisherTimestampUs === "string")
                    message.publisherTimestampUs = parseInt(object.publisherTimestampUs, 10);
                else if (typeof object.publisherTimestampUs === "number")
                    message.publisherTimestampUs = object.publisherTimestampUs;
                else if (typeof object.publisherTimestampUs === "object")
                    message.publisherTimestampUs = new $util.LongBits(object.publisherTimestampUs.low >>> 0, object.publisherTimestampUs.high >>> 0).toNumber(true);
            if (object.price != null)
                if ($util.Long)
                    (message.price = $util.Long.fromValue(object.price)).unsigned = false;
                else if (typeof object.price === "string")
                    message.price = parseInt(object.price, 10);
                else if (typeof object.price === "number")
                    message.price = object.price;
                else if (typeof object.price === "object")
                    message.price = new $util.LongBits(object.price.low >>> 0, object.price.high >>> 0).toNumber();
            if (object.bestBidPrice != null)
                if ($util.Long)
                    (message.bestBidPrice = $util.Long.fromValue(object.bestBidPrice)).unsigned = false;
                else if (typeof object.bestBidPrice === "string")
                    message.bestBidPrice = parseInt(object.bestBidPrice, 10);
                else if (typeof object.bestBidPrice === "number")
                    message.bestBidPrice = object.bestBidPrice;
                else if (typeof object.bestBidPrice === "object")
                    message.bestBidPrice = new $util.LongBits(object.bestBidPrice.low >>> 0, object.bestBidPrice.high >>> 0).toNumber();
            if (object.bestAskPrice != null)
                if ($util.Long)
                    (message.bestAskPrice = $util.Long.fromValue(object.bestAskPrice)).unsigned = false;
                else if (typeof object.bestAskPrice === "string")
                    message.bestAskPrice = parseInt(object.bestAskPrice, 10);
                else if (typeof object.bestAskPrice === "number")
                    message.bestAskPrice = object.bestAskPrice;
                else if (typeof object.bestAskPrice === "object")
                    message.bestAskPrice = new $util.LongBits(object.bestAskPrice.low >>> 0, object.bestAskPrice.high >>> 0).toNumber();
            return message;
        };

        /**
         * Creates a plain object from a PriceUpdateV1 message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {pyth_lazer_transaction.PriceUpdateV1} message PriceUpdateV1
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        PriceUpdateV1.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.feedId = 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.sourceTimestampUs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.sourceTimestampUs = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.publisherTimestampUs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.publisherTimestampUs = options.longs === String ? "0" : 0;
            }
            if (message.feedId != null && message.hasOwnProperty("feedId"))
                object.feedId = message.feedId;
            if (message.sourceTimestampUs != null && message.hasOwnProperty("sourceTimestampUs"))
                if (typeof message.sourceTimestampUs === "number")
                    object.sourceTimestampUs = options.longs === String ? String(message.sourceTimestampUs) : message.sourceTimestampUs;
                else
                    object.sourceTimestampUs = options.longs === String ? $util.Long.prototype.toString.call(message.sourceTimestampUs) : options.longs === Number ? new $util.LongBits(message.sourceTimestampUs.low >>> 0, message.sourceTimestampUs.high >>> 0).toNumber(true) : message.sourceTimestampUs;
            if (message.publisherTimestampUs != null && message.hasOwnProperty("publisherTimestampUs"))
                if (typeof message.publisherTimestampUs === "number")
                    object.publisherTimestampUs = options.longs === String ? String(message.publisherTimestampUs) : message.publisherTimestampUs;
                else
                    object.publisherTimestampUs = options.longs === String ? $util.Long.prototype.toString.call(message.publisherTimestampUs) : options.longs === Number ? new $util.LongBits(message.publisherTimestampUs.low >>> 0, message.publisherTimestampUs.high >>> 0).toNumber(true) : message.publisherTimestampUs;
            if (message.price != null && message.hasOwnProperty("price")) {
                if (typeof message.price === "number")
                    object.price = options.longs === String ? String(message.price) : message.price;
                else
                    object.price = options.longs === String ? $util.Long.prototype.toString.call(message.price) : options.longs === Number ? new $util.LongBits(message.price.low >>> 0, message.price.high >>> 0).toNumber() : message.price;
                if (options.oneofs)
                    object._price = "price";
            }
            if (message.bestBidPrice != null && message.hasOwnProperty("bestBidPrice")) {
                if (typeof message.bestBidPrice === "number")
                    object.bestBidPrice = options.longs === String ? String(message.bestBidPrice) : message.bestBidPrice;
                else
                    object.bestBidPrice = options.longs === String ? $util.Long.prototype.toString.call(message.bestBidPrice) : options.longs === Number ? new $util.LongBits(message.bestBidPrice.low >>> 0, message.bestBidPrice.high >>> 0).toNumber() : message.bestBidPrice;
                if (options.oneofs)
                    object._bestBidPrice = "bestBidPrice";
            }
            if (message.bestAskPrice != null && message.hasOwnProperty("bestAskPrice")) {
                if (typeof message.bestAskPrice === "number")
                    object.bestAskPrice = options.longs === String ? String(message.bestAskPrice) : message.bestAskPrice;
                else
                    object.bestAskPrice = options.longs === String ? $util.Long.prototype.toString.call(message.bestAskPrice) : options.longs === Number ? new $util.LongBits(message.bestAskPrice.low >>> 0, message.bestAskPrice.high >>> 0).toNumber() : message.bestAskPrice;
                if (options.oneofs)
                    object._bestAskPrice = "bestAskPrice";
            }
            return object;
        };

        /**
         * Converts this PriceUpdateV1 to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        PriceUpdateV1.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for PriceUpdateV1
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.PriceUpdateV1
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        PriceUpdateV1.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.PriceUpdateV1";
        };

        return PriceUpdateV1;
    })();

    pyth_lazer_transaction.FundingRateUpdateV1 = (function() {

        /**
         * Properties of a FundingRateUpdateV1.
         * @memberof pyth_lazer_transaction
         * @interface IFundingRateUpdateV1
         * @property {number|null} [feedId] FundingRateUpdateV1 feedId
         * @property {number|Long|null} [sourceTimestampUs] FundingRateUpdateV1 sourceTimestampUs
         * @property {number|Long|null} [publisherTimestampUs] FundingRateUpdateV1 publisherTimestampUs
         * @property {number|Long|null} [price] FundingRateUpdateV1 price
         * @property {number|Long|null} [rate] FundingRateUpdateV1 rate
         */

        /**
         * Constructs a new FundingRateUpdateV1.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a FundingRateUpdateV1.
         * @implements IFundingRateUpdateV1
         * @constructor
         * @param {pyth_lazer_transaction.IFundingRateUpdateV1=} [properties] Properties to set
         */
        function FundingRateUpdateV1(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FundingRateUpdateV1 feedId.
         * @member {number} feedId
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         */
        FundingRateUpdateV1.prototype.feedId = 0;

        /**
         * FundingRateUpdateV1 sourceTimestampUs.
         * @member {number|Long} sourceTimestampUs
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         */
        FundingRateUpdateV1.prototype.sourceTimestampUs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * FundingRateUpdateV1 publisherTimestampUs.
         * @member {number|Long} publisherTimestampUs
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         */
        FundingRateUpdateV1.prototype.publisherTimestampUs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * FundingRateUpdateV1 price.
         * @member {number|Long|null|undefined} price
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         */
        FundingRateUpdateV1.prototype.price = null;

        /**
         * FundingRateUpdateV1 rate.
         * @member {number|Long|null|undefined} rate
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         */
        FundingRateUpdateV1.prototype.rate = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FundingRateUpdateV1.prototype, "_price", {
            get: $util.oneOfGetter($oneOfFields = ["price"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FundingRateUpdateV1.prototype, "_rate", {
            get: $util.oneOfGetter($oneOfFields = ["rate"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new FundingRateUpdateV1 instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IFundingRateUpdateV1=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.FundingRateUpdateV1} FundingRateUpdateV1 instance
         */
        FundingRateUpdateV1.create = function create(properties) {
            return new FundingRateUpdateV1(properties);
        };

        /**
         * Encodes the specified FundingRateUpdateV1 message. Does not implicitly {@link pyth_lazer_transaction.FundingRateUpdateV1.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IFundingRateUpdateV1} message FundingRateUpdateV1 message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FundingRateUpdateV1.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.feedId != null && Object.hasOwnProperty.call(message, "feedId"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.feedId);
            if (message.sourceTimestampUs != null && Object.hasOwnProperty.call(message, "sourceTimestampUs"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.sourceTimestampUs);
            if (message.publisherTimestampUs != null && Object.hasOwnProperty.call(message, "publisherTimestampUs"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.publisherTimestampUs);
            if (message.price != null && Object.hasOwnProperty.call(message, "price"))
                writer.uint32(/* id 4, wireType 0 =*/32).int64(message.price);
            if (message.rate != null && Object.hasOwnProperty.call(message, "rate"))
                writer.uint32(/* id 5, wireType 0 =*/40).int64(message.rate);
            return writer;
        };

        /**
         * Encodes the specified FundingRateUpdateV1 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.FundingRateUpdateV1.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {pyth_lazer_transaction.IFundingRateUpdateV1} message FundingRateUpdateV1 message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FundingRateUpdateV1.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a FundingRateUpdateV1 message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.FundingRateUpdateV1} FundingRateUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FundingRateUpdateV1.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.FundingRateUpdateV1();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.feedId = reader.uint32();
                        break;
                    }
                case 2: {
                        message.sourceTimestampUs = reader.uint64();
                        break;
                    }
                case 3: {
                        message.publisherTimestampUs = reader.uint64();
                        break;
                    }
                case 4: {
                        message.price = reader.int64();
                        break;
                    }
                case 5: {
                        message.rate = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FundingRateUpdateV1 message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.FundingRateUpdateV1} FundingRateUpdateV1
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FundingRateUpdateV1.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FundingRateUpdateV1 message.
         * @function verify
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FundingRateUpdateV1.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.feedId != null && message.hasOwnProperty("feedId"))
                if (!$util.isInteger(message.feedId))
                    return "feedId: integer expected";
            if (message.sourceTimestampUs != null && message.hasOwnProperty("sourceTimestampUs"))
                if (!$util.isInteger(message.sourceTimestampUs) && !(message.sourceTimestampUs && $util.isInteger(message.sourceTimestampUs.low) && $util.isInteger(message.sourceTimestampUs.high)))
                    return "sourceTimestampUs: integer|Long expected";
            if (message.publisherTimestampUs != null && message.hasOwnProperty("publisherTimestampUs"))
                if (!$util.isInteger(message.publisherTimestampUs) && !(message.publisherTimestampUs && $util.isInteger(message.publisherTimestampUs.low) && $util.isInteger(message.publisherTimestampUs.high)))
                    return "publisherTimestampUs: integer|Long expected";
            if (message.price != null && message.hasOwnProperty("price")) {
                properties._price = 1;
                if (!$util.isInteger(message.price) && !(message.price && $util.isInteger(message.price.low) && $util.isInteger(message.price.high)))
                    return "price: integer|Long expected";
            }
            if (message.rate != null && message.hasOwnProperty("rate")) {
                properties._rate = 1;
                if (!$util.isInteger(message.rate) && !(message.rate && $util.isInteger(message.rate.low) && $util.isInteger(message.rate.high)))
                    return "rate: integer|Long expected";
            }
            return null;
        };

        /**
         * Creates a FundingRateUpdateV1 message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.FundingRateUpdateV1} FundingRateUpdateV1
         */
        FundingRateUpdateV1.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.FundingRateUpdateV1)
                return object;
            let message = new $root.pyth_lazer_transaction.FundingRateUpdateV1();
            if (object.feedId != null)
                message.feedId = object.feedId >>> 0;
            if (object.sourceTimestampUs != null)
                if ($util.Long)
                    (message.sourceTimestampUs = $util.Long.fromValue(object.sourceTimestampUs)).unsigned = true;
                else if (typeof object.sourceTimestampUs === "string")
                    message.sourceTimestampUs = parseInt(object.sourceTimestampUs, 10);
                else if (typeof object.sourceTimestampUs === "number")
                    message.sourceTimestampUs = object.sourceTimestampUs;
                else if (typeof object.sourceTimestampUs === "object")
                    message.sourceTimestampUs = new $util.LongBits(object.sourceTimestampUs.low >>> 0, object.sourceTimestampUs.high >>> 0).toNumber(true);
            if (object.publisherTimestampUs != null)
                if ($util.Long)
                    (message.publisherTimestampUs = $util.Long.fromValue(object.publisherTimestampUs)).unsigned = true;
                else if (typeof object.publisherTimestampUs === "string")
                    message.publisherTimestampUs = parseInt(object.publisherTimestampUs, 10);
                else if (typeof object.publisherTimestampUs === "number")
                    message.publisherTimestampUs = object.publisherTimestampUs;
                else if (typeof object.publisherTimestampUs === "object")
                    message.publisherTimestampUs = new $util.LongBits(object.publisherTimestampUs.low >>> 0, object.publisherTimestampUs.high >>> 0).toNumber(true);
            if (object.price != null)
                if ($util.Long)
                    (message.price = $util.Long.fromValue(object.price)).unsigned = false;
                else if (typeof object.price === "string")
                    message.price = parseInt(object.price, 10);
                else if (typeof object.price === "number")
                    message.price = object.price;
                else if (typeof object.price === "object")
                    message.price = new $util.LongBits(object.price.low >>> 0, object.price.high >>> 0).toNumber();
            if (object.rate != null)
                if ($util.Long)
                    (message.rate = $util.Long.fromValue(object.rate)).unsigned = false;
                else if (typeof object.rate === "string")
                    message.rate = parseInt(object.rate, 10);
                else if (typeof object.rate === "number")
                    message.rate = object.rate;
                else if (typeof object.rate === "object")
                    message.rate = new $util.LongBits(object.rate.low >>> 0, object.rate.high >>> 0).toNumber();
            return message;
        };

        /**
         * Creates a plain object from a FundingRateUpdateV1 message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {pyth_lazer_transaction.FundingRateUpdateV1} message FundingRateUpdateV1
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FundingRateUpdateV1.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.feedId = 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.sourceTimestampUs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.sourceTimestampUs = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.publisherTimestampUs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.publisherTimestampUs = options.longs === String ? "0" : 0;
            }
            if (message.feedId != null && message.hasOwnProperty("feedId"))
                object.feedId = message.feedId;
            if (message.sourceTimestampUs != null && message.hasOwnProperty("sourceTimestampUs"))
                if (typeof message.sourceTimestampUs === "number")
                    object.sourceTimestampUs = options.longs === String ? String(message.sourceTimestampUs) : message.sourceTimestampUs;
                else
                    object.sourceTimestampUs = options.longs === String ? $util.Long.prototype.toString.call(message.sourceTimestampUs) : options.longs === Number ? new $util.LongBits(message.sourceTimestampUs.low >>> 0, message.sourceTimestampUs.high >>> 0).toNumber(true) : message.sourceTimestampUs;
            if (message.publisherTimestampUs != null && message.hasOwnProperty("publisherTimestampUs"))
                if (typeof message.publisherTimestampUs === "number")
                    object.publisherTimestampUs = options.longs === String ? String(message.publisherTimestampUs) : message.publisherTimestampUs;
                else
                    object.publisherTimestampUs = options.longs === String ? $util.Long.prototype.toString.call(message.publisherTimestampUs) : options.longs === Number ? new $util.LongBits(message.publisherTimestampUs.low >>> 0, message.publisherTimestampUs.high >>> 0).toNumber(true) : message.publisherTimestampUs;
            if (message.price != null && message.hasOwnProperty("price")) {
                if (typeof message.price === "number")
                    object.price = options.longs === String ? String(message.price) : message.price;
                else
                    object.price = options.longs === String ? $util.Long.prototype.toString.call(message.price) : options.longs === Number ? new $util.LongBits(message.price.low >>> 0, message.price.high >>> 0).toNumber() : message.price;
                if (options.oneofs)
                    object._price = "price";
            }
            if (message.rate != null && message.hasOwnProperty("rate")) {
                if (typeof message.rate === "number")
                    object.rate = options.longs === String ? String(message.rate) : message.rate;
                else
                    object.rate = options.longs === String ? $util.Long.prototype.toString.call(message.rate) : options.longs === Number ? new $util.LongBits(message.rate.low >>> 0, message.rate.high >>> 0).toNumber() : message.rate;
                if (options.oneofs)
                    object._rate = "rate";
            }
            return object;
        };

        /**
         * Converts this FundingRateUpdateV1 to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FundingRateUpdateV1.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FundingRateUpdateV1
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.FundingRateUpdateV1
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FundingRateUpdateV1.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.FundingRateUpdateV1";
        };

        return FundingRateUpdateV1;
    })();

    /**
     * TransactionSignatureType enum.
     * @name pyth_lazer_transaction.TransactionSignatureType
     * @enum {number}
     * @property {number} ed25519=0 ed25519 value
     */
    pyth_lazer_transaction.TransactionSignatureType = (function() {
        const valuesById = {}, values = Object.create(valuesById);
        values[valuesById[0] = "ed25519"] = 0;
        return values;
    })();

    pyth_lazer_transaction.SignedLazerTransaction = (function() {

        /**
         * Properties of a SignedLazerTransaction.
         * @memberof pyth_lazer_transaction
         * @interface ISignedLazerTransaction
         * @property {pyth_lazer_transaction.TransactionSignatureType|null} [signatureType] SignedLazerTransaction signatureType
         * @property {Uint8Array|null} [signature] SignedLazerTransaction signature
         * @property {Uint8Array|null} [transaction] SignedLazerTransaction transaction
         */

        /**
         * Constructs a new SignedLazerTransaction.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a SignedLazerTransaction.
         * @implements ISignedLazerTransaction
         * @constructor
         * @param {pyth_lazer_transaction.ISignedLazerTransaction=} [properties] Properties to set
         */
        function SignedLazerTransaction(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SignedLazerTransaction signatureType.
         * @member {pyth_lazer_transaction.TransactionSignatureType} signatureType
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @instance
         */
        SignedLazerTransaction.prototype.signatureType = 0;

        /**
         * SignedLazerTransaction signature.
         * @member {Uint8Array} signature
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @instance
         */
        SignedLazerTransaction.prototype.signature = $util.newBuffer([]);

        /**
         * SignedLazerTransaction transaction.
         * @member {Uint8Array} transaction
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @instance
         */
        SignedLazerTransaction.prototype.transaction = $util.newBuffer([]);

        /**
         * Creates a new SignedLazerTransaction instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ISignedLazerTransaction=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.SignedLazerTransaction} SignedLazerTransaction instance
         */
        SignedLazerTransaction.create = function create(properties) {
            return new SignedLazerTransaction(properties);
        };

        /**
         * Encodes the specified SignedLazerTransaction message. Does not implicitly {@link pyth_lazer_transaction.SignedLazerTransaction.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ISignedLazerTransaction} message SignedLazerTransaction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SignedLazerTransaction.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.signatureType != null && Object.hasOwnProperty.call(message, "signatureType"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.signatureType);
            if (message.signature != null && Object.hasOwnProperty.call(message, "signature"))
                writer.uint32(/* id 2, wireType 2 =*/18).bytes(message.signature);
            if (message.transaction != null && Object.hasOwnProperty.call(message, "transaction"))
                writer.uint32(/* id 3, wireType 2 =*/26).bytes(message.transaction);
            return writer;
        };

        /**
         * Encodes the specified SignedLazerTransaction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SignedLazerTransaction.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ISignedLazerTransaction} message SignedLazerTransaction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SignedLazerTransaction.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SignedLazerTransaction message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.SignedLazerTransaction} SignedLazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SignedLazerTransaction.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.SignedLazerTransaction();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.signatureType = reader.int32();
                        break;
                    }
                case 2: {
                        message.signature = reader.bytes();
                        break;
                    }
                case 3: {
                        message.transaction = reader.bytes();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SignedLazerTransaction message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.SignedLazerTransaction} SignedLazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SignedLazerTransaction.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SignedLazerTransaction message.
         * @function verify
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SignedLazerTransaction.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.signatureType != null && message.hasOwnProperty("signatureType"))
                switch (message.signatureType) {
                default:
                    return "signatureType: enum value expected";
                case 0:
                    break;
                }
            if (message.signature != null && message.hasOwnProperty("signature"))
                if (!(message.signature && typeof message.signature.length === "number" || $util.isString(message.signature)))
                    return "signature: buffer expected";
            if (message.transaction != null && message.hasOwnProperty("transaction"))
                if (!(message.transaction && typeof message.transaction.length === "number" || $util.isString(message.transaction)))
                    return "transaction: buffer expected";
            return null;
        };

        /**
         * Creates a SignedLazerTransaction message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.SignedLazerTransaction} SignedLazerTransaction
         */
        SignedLazerTransaction.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.SignedLazerTransaction)
                return object;
            let message = new $root.pyth_lazer_transaction.SignedLazerTransaction();
            switch (object.signatureType) {
            default:
                if (typeof object.signatureType === "number") {
                    message.signatureType = object.signatureType;
                    break;
                }
                break;
            case "ed25519":
            case 0:
                message.signatureType = 0;
                break;
            }
            if (object.signature != null)
                if (typeof object.signature === "string")
                    $util.base64.decode(object.signature, message.signature = $util.newBuffer($util.base64.length(object.signature)), 0);
                else if (object.signature.length >= 0)
                    message.signature = object.signature;
            if (object.transaction != null)
                if (typeof object.transaction === "string")
                    $util.base64.decode(object.transaction, message.transaction = $util.newBuffer($util.base64.length(object.transaction)), 0);
                else if (object.transaction.length >= 0)
                    message.transaction = object.transaction;
            return message;
        };

        /**
         * Creates a plain object from a SignedLazerTransaction message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {pyth_lazer_transaction.SignedLazerTransaction} message SignedLazerTransaction
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SignedLazerTransaction.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (options.defaults) {
                object.signatureType = options.enums === String ? "ed25519" : 0;
                if (options.bytes === String)
                    object.signature = "";
                else {
                    object.signature = [];
                    if (options.bytes !== Array)
                        object.signature = $util.newBuffer(object.signature);
                }
                if (options.bytes === String)
                    object.transaction = "";
                else {
                    object.transaction = [];
                    if (options.bytes !== Array)
                        object.transaction = $util.newBuffer(object.transaction);
                }
            }
            if (message.signatureType != null && message.hasOwnProperty("signatureType"))
                object.signatureType = options.enums === String ? $root.pyth_lazer_transaction.TransactionSignatureType[message.signatureType] === undefined ? message.signatureType : $root.pyth_lazer_transaction.TransactionSignatureType[message.signatureType] : message.signatureType;
            if (message.signature != null && message.hasOwnProperty("signature"))
                object.signature = options.bytes === String ? $util.base64.encode(message.signature, 0, message.signature.length) : options.bytes === Array ? Array.prototype.slice.call(message.signature) : message.signature;
            if (message.transaction != null && message.hasOwnProperty("transaction"))
                object.transaction = options.bytes === String ? $util.base64.encode(message.transaction, 0, message.transaction.length) : options.bytes === Array ? Array.prototype.slice.call(message.transaction) : message.transaction;
            return object;
        };

        /**
         * Converts this SignedLazerTransaction to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SignedLazerTransaction.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SignedLazerTransaction
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.SignedLazerTransaction
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SignedLazerTransaction.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.SignedLazerTransaction";
        };

        return SignedLazerTransaction;
    })();

    pyth_lazer_transaction.LazerTransaction = (function() {

        /**
         * Properties of a LazerTransaction.
         * @memberof pyth_lazer_transaction
         * @interface ILazerTransaction
         * @property {pyth_lazer_transaction.IPublisherUpdate|null} [publisherUpdates] LazerTransaction publisherUpdates
         */

        /**
         * Constructs a new LazerTransaction.
         * @memberof pyth_lazer_transaction
         * @classdesc Represents a LazerTransaction.
         * @implements ILazerTransaction
         * @constructor
         * @param {pyth_lazer_transaction.ILazerTransaction=} [properties] Properties to set
         */
        function LazerTransaction(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * LazerTransaction publisherUpdates.
         * @member {pyth_lazer_transaction.IPublisherUpdate|null|undefined} publisherUpdates
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @instance
         */
        LazerTransaction.prototype.publisherUpdates = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        /**
         * LazerTransaction payload.
         * @member {"publisherUpdates"|undefined} payload
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @instance
         */
        Object.defineProperty(LazerTransaction.prototype, "payload", {
            get: $util.oneOfGetter($oneOfFields = ["publisherUpdates"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new LazerTransaction instance using the specified properties.
         * @function create
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ILazerTransaction=} [properties] Properties to set
         * @returns {pyth_lazer_transaction.LazerTransaction} LazerTransaction instance
         */
        LazerTransaction.create = function create(properties) {
            return new LazerTransaction(properties);
        };

        /**
         * Encodes the specified LazerTransaction message. Does not implicitly {@link pyth_lazer_transaction.LazerTransaction.verify|verify} messages.
         * @function encode
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ILazerTransaction} message LazerTransaction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        LazerTransaction.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.publisherUpdates != null && Object.hasOwnProperty.call(message, "publisherUpdates"))
                $root.pyth_lazer_transaction.PublisherUpdate.encode(message.publisherUpdates, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified LazerTransaction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.LazerTransaction.verify|verify} messages.
         * @function encodeDelimited
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {pyth_lazer_transaction.ILazerTransaction} message LazerTransaction message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        LazerTransaction.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a LazerTransaction message from the specified reader or buffer.
         * @function decode
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {pyth_lazer_transaction.LazerTransaction} LazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        LazerTransaction.decode = function decode(reader, length) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.pyth_lazer_transaction.LazerTransaction();
            while (reader.pos < end) {
                let tag = reader.uint32();
                switch (tag >>> 3) {
                case 1: {
                        message.publisherUpdates = $root.pyth_lazer_transaction.PublisherUpdate.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a LazerTransaction message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {pyth_lazer_transaction.LazerTransaction} LazerTransaction
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        LazerTransaction.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a LazerTransaction message.
         * @function verify
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        LazerTransaction.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            let properties = {};
            if (message.publisherUpdates != null && message.hasOwnProperty("publisherUpdates")) {
                properties.payload = 1;
                {
                    let error = $root.pyth_lazer_transaction.PublisherUpdate.verify(message.publisherUpdates);
                    if (error)
                        return "publisherUpdates." + error;
                }
            }
            return null;
        };

        /**
         * Creates a LazerTransaction message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {pyth_lazer_transaction.LazerTransaction} LazerTransaction
         */
        LazerTransaction.fromObject = function fromObject(object) {
            if (object instanceof $root.pyth_lazer_transaction.LazerTransaction)
                return object;
            let message = new $root.pyth_lazer_transaction.LazerTransaction();
            if (object.publisherUpdates != null) {
                if (typeof object.publisherUpdates !== "object")
                    throw TypeError(".pyth_lazer_transaction.LazerTransaction.publisherUpdates: object expected");
                message.publisherUpdates = $root.pyth_lazer_transaction.PublisherUpdate.fromObject(object.publisherUpdates);
            }
            return message;
        };

        /**
         * Creates a plain object from a LazerTransaction message. Also converts values to other types if specified.
         * @function toObject
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {pyth_lazer_transaction.LazerTransaction} message LazerTransaction
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        LazerTransaction.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            let object = {};
            if (message.publisherUpdates != null && message.hasOwnProperty("publisherUpdates")) {
                object.publisherUpdates = $root.pyth_lazer_transaction.PublisherUpdate.toObject(message.publisherUpdates, options);
                if (options.oneofs)
                    object.payload = "publisherUpdates";
            }
            return object;
        };

        /**
         * Converts this LazerTransaction to JSON.
         * @function toJSON
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        LazerTransaction.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for LazerTransaction
         * @function getTypeUrl
         * @memberof pyth_lazer_transaction.LazerTransaction
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        LazerTransaction.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/pyth_lazer_transaction.LazerTransaction";
        };

        return LazerTransaction;
    })();

    return pyth_lazer_transaction;
})();

export { $root as default };
