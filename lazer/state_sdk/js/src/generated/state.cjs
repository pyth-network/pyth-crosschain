/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.lazer = (function () {
  /**
   * Namespace lazer.
   * @exports lazer
   * @namespace
   */
  var lazer = {};

  lazer.State = (function () {
    /**
     * Properties of a State.
     * @memberof lazer
     * @interface IState
     * @property {number|null} [shardId] State shardId
     * @property {number|Long|null} [lastSequenceNo] State lastSequenceNo
     * @property {google.protobuf.ITimestamp|null} [lastTimestamp] State lastTimestamp
     * @property {string|null} [shardName] State shardName
     * @property {google.protobuf.IDuration|null} [minRate] State minRate
     * @property {Array.<lazer.IFeed>|null} [feeds] State feeds
     * @property {Array.<lazer.IPublisher>|null} [publishers] State publishers
     */

    /**
     * Constructs a new State.
     * @memberof lazer
     * @classdesc Represents a State.
     * @implements IState
     * @constructor
     * @param {lazer.IState=} [properties] Properties to set
     */
    function State(properties) {
      this.feeds = [];
      this.publishers = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * State shardId.
     * @member {number|null|undefined} shardId
     * @memberof lazer.State
     * @instance
     */
    State.prototype.shardId = null;

    /**
     * State lastSequenceNo.
     * @member {number|Long|null|undefined} lastSequenceNo
     * @memberof lazer.State
     * @instance
     */
    State.prototype.lastSequenceNo = null;

    /**
     * State lastTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} lastTimestamp
     * @memberof lazer.State
     * @instance
     */
    State.prototype.lastTimestamp = null;

    /**
     * State shardName.
     * @member {string|null|undefined} shardName
     * @memberof lazer.State
     * @instance
     */
    State.prototype.shardName = null;

    /**
     * State minRate.
     * @member {google.protobuf.IDuration|null|undefined} minRate
     * @memberof lazer.State
     * @instance
     */
    State.prototype.minRate = null;

    /**
     * State feeds.
     * @member {Array.<lazer.IFeed>} feeds
     * @memberof lazer.State
     * @instance
     */
    State.prototype.feeds = $util.emptyArray;

    /**
     * State publishers.
     * @member {Array.<lazer.IPublisher>} publishers
     * @memberof lazer.State
     * @instance
     */
    State.prototype.publishers = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * State _shardId.
     * @member {"shardId"|undefined} _shardId
     * @memberof lazer.State
     * @instance
     */
    Object.defineProperty(State.prototype, "_shardId", {
      get: $util.oneOfGetter(($oneOfFields = ["shardId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * State _lastSequenceNo.
     * @member {"lastSequenceNo"|undefined} _lastSequenceNo
     * @memberof lazer.State
     * @instance
     */
    Object.defineProperty(State.prototype, "_lastSequenceNo", {
      get: $util.oneOfGetter(($oneOfFields = ["lastSequenceNo"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * State _lastTimestamp.
     * @member {"lastTimestamp"|undefined} _lastTimestamp
     * @memberof lazer.State
     * @instance
     */
    Object.defineProperty(State.prototype, "_lastTimestamp", {
      get: $util.oneOfGetter(($oneOfFields = ["lastTimestamp"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * State _shardName.
     * @member {"shardName"|undefined} _shardName
     * @memberof lazer.State
     * @instance
     */
    Object.defineProperty(State.prototype, "_shardName", {
      get: $util.oneOfGetter(($oneOfFields = ["shardName"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * State _minRate.
     * @member {"minRate"|undefined} _minRate
     * @memberof lazer.State
     * @instance
     */
    Object.defineProperty(State.prototype, "_minRate", {
      get: $util.oneOfGetter(($oneOfFields = ["minRate"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new State instance using the specified properties.
     * @function create
     * @memberof lazer.State
     * @static
     * @param {lazer.IState=} [properties] Properties to set
     * @returns {lazer.State} State instance
     */
    State.create = function create(properties) {
      return new State(properties);
    };

    /**
     * Encodes the specified State message. Does not implicitly {@link lazer.State.verify|verify} messages.
     * @function encode
     * @memberof lazer.State
     * @static
     * @param {lazer.IState} message State message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    State.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.shardId != null &&
        Object.hasOwnProperty.call(message, "shardId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.shardId);
      if (
        message.lastSequenceNo != null &&
        Object.hasOwnProperty.call(message, "lastSequenceNo")
      )
        writer
          .uint32(/* id 2, wireType 0 =*/ 16)
          .uint64(message.lastSequenceNo);
      if (
        message.lastTimestamp != null &&
        Object.hasOwnProperty.call(message, "lastTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.lastTimestamp,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (
        message.shardName != null &&
        Object.hasOwnProperty.call(message, "shardName")
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.shardName);
      if (
        message.minRate != null &&
        Object.hasOwnProperty.call(message, "minRate")
      )
        $root.google.protobuf.Duration.encode(
          message.minRate,
          writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
        ).ldelim();
      if (message.feeds != null && message.feeds.length)
        for (var i = 0; i < message.feeds.length; ++i)
          $root.lazer.Feed.encode(
            message.feeds[i],
            writer.uint32(/* id 7, wireType 2 =*/ 58).fork(),
          ).ldelim();
      if (message.publishers != null && message.publishers.length)
        for (var i = 0; i < message.publishers.length; ++i)
          $root.lazer.Publisher.encode(
            message.publishers[i],
            writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified State message, length delimited. Does not implicitly {@link lazer.State.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.State
     * @static
     * @param {lazer.IState} message State message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    State.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a State message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.State
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.State} State
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    State.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.State();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.shardId = reader.uint32();
            break;
          }
          case 2: {
            message.lastSequenceNo = reader.uint64();
            break;
          }
          case 3: {
            message.lastTimestamp = $root.google.protobuf.Timestamp.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 4: {
            message.shardName = reader.string();
            break;
          }
          case 5: {
            message.minRate = $root.google.protobuf.Duration.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 7: {
            if (!(message.feeds && message.feeds.length)) message.feeds = [];
            message.feeds.push(
              $root.lazer.Feed.decode(reader, reader.uint32()),
            );
            break;
          }
          case 8: {
            if (!(message.publishers && message.publishers.length))
              message.publishers = [];
            message.publishers.push(
              $root.lazer.Publisher.decode(reader, reader.uint32()),
            );
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
     * Decodes a State message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.State
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.State} State
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    State.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a State message.
     * @function verify
     * @memberof lazer.State
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    State.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.shardId != null && message.hasOwnProperty("shardId")) {
        properties._shardId = 1;
        if (!$util.isInteger(message.shardId))
          return "shardId: integer expected";
      }
      if (
        message.lastSequenceNo != null &&
        message.hasOwnProperty("lastSequenceNo")
      ) {
        properties._lastSequenceNo = 1;
        if (
          !$util.isInteger(message.lastSequenceNo) &&
          !(
            message.lastSequenceNo &&
            $util.isInteger(message.lastSequenceNo.low) &&
            $util.isInteger(message.lastSequenceNo.high)
          )
        )
          return "lastSequenceNo: integer|Long expected";
      }
      if (
        message.lastTimestamp != null &&
        message.hasOwnProperty("lastTimestamp")
      ) {
        properties._lastTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.lastTimestamp,
          );
          if (error) return "lastTimestamp." + error;
        }
      }
      if (message.shardName != null && message.hasOwnProperty("shardName")) {
        properties._shardName = 1;
        if (!$util.isString(message.shardName))
          return "shardName: string expected";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        properties._minRate = 1;
        {
          var error = $root.google.protobuf.Duration.verify(message.minRate);
          if (error) return "minRate." + error;
        }
      }
      if (message.feeds != null && message.hasOwnProperty("feeds")) {
        if (!Array.isArray(message.feeds)) return "feeds: array expected";
        for (var i = 0; i < message.feeds.length; ++i) {
          var error = $root.lazer.Feed.verify(message.feeds[i]);
          if (error) return "feeds." + error;
        }
      }
      if (message.publishers != null && message.hasOwnProperty("publishers")) {
        if (!Array.isArray(message.publishers))
          return "publishers: array expected";
        for (var i = 0; i < message.publishers.length; ++i) {
          var error = $root.lazer.Publisher.verify(message.publishers[i]);
          if (error) return "publishers." + error;
        }
      }
      return null;
    };

    /**
     * Creates a State message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.State
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.State} State
     */
    State.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.State) return object;
      var message = new $root.lazer.State();
      if (object.shardId != null) message.shardId = object.shardId >>> 0;
      if (object.lastSequenceNo != null)
        if ($util.Long)
          (message.lastSequenceNo = $util.Long.fromValue(
            object.lastSequenceNo,
          )).unsigned = true;
        else if (typeof object.lastSequenceNo === "string")
          message.lastSequenceNo = parseInt(object.lastSequenceNo, 10);
        else if (typeof object.lastSequenceNo === "number")
          message.lastSequenceNo = object.lastSequenceNo;
        else if (typeof object.lastSequenceNo === "object")
          message.lastSequenceNo = new $util.LongBits(
            object.lastSequenceNo.low >>> 0,
            object.lastSequenceNo.high >>> 0,
          ).toNumber(true);
      if (object.lastTimestamp != null) {
        if (typeof object.lastTimestamp !== "object")
          throw TypeError(".lazer.State.lastTimestamp: object expected");
        message.lastTimestamp = $root.google.protobuf.Timestamp.fromObject(
          object.lastTimestamp,
        );
      }
      if (object.shardName != null)
        message.shardName = String(object.shardName);
      if (object.minRate != null) {
        if (typeof object.minRate !== "object")
          throw TypeError(".lazer.State.minRate: object expected");
        message.minRate = $root.google.protobuf.Duration.fromObject(
          object.minRate,
        );
      }
      if (object.feeds) {
        if (!Array.isArray(object.feeds))
          throw TypeError(".lazer.State.feeds: array expected");
        message.feeds = [];
        for (var i = 0; i < object.feeds.length; ++i) {
          if (typeof object.feeds[i] !== "object")
            throw TypeError(".lazer.State.feeds: object expected");
          message.feeds[i] = $root.lazer.Feed.fromObject(object.feeds[i]);
        }
      }
      if (object.publishers) {
        if (!Array.isArray(object.publishers))
          throw TypeError(".lazer.State.publishers: array expected");
        message.publishers = [];
        for (var i = 0; i < object.publishers.length; ++i) {
          if (typeof object.publishers[i] !== "object")
            throw TypeError(".lazer.State.publishers: object expected");
          message.publishers[i] = $root.lazer.Publisher.fromObject(
            object.publishers[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a State message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.State
     * @static
     * @param {lazer.State} message State
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    State.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) {
        object.feeds = [];
        object.publishers = [];
      }
      if (message.shardId != null && message.hasOwnProperty("shardId")) {
        object.shardId = message.shardId;
        if (options.oneofs) object._shardId = "shardId";
      }
      if (
        message.lastSequenceNo != null &&
        message.hasOwnProperty("lastSequenceNo")
      ) {
        if (typeof message.lastSequenceNo === "number")
          object.lastSequenceNo =
            options.longs === String
              ? String(message.lastSequenceNo)
              : message.lastSequenceNo;
        else
          object.lastSequenceNo =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.lastSequenceNo)
              : options.longs === Number
                ? new $util.LongBits(
                    message.lastSequenceNo.low >>> 0,
                    message.lastSequenceNo.high >>> 0,
                  ).toNumber(true)
                : message.lastSequenceNo;
        if (options.oneofs) object._lastSequenceNo = "lastSequenceNo";
      }
      if (
        message.lastTimestamp != null &&
        message.hasOwnProperty("lastTimestamp")
      ) {
        object.lastTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.lastTimestamp,
          options,
        );
        if (options.oneofs) object._lastTimestamp = "lastTimestamp";
      }
      if (message.shardName != null && message.hasOwnProperty("shardName")) {
        object.shardName = message.shardName;
        if (options.oneofs) object._shardName = "shardName";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        object.minRate = $root.google.protobuf.Duration.toObject(
          message.minRate,
          options,
        );
        if (options.oneofs) object._minRate = "minRate";
      }
      if (message.feeds && message.feeds.length) {
        object.feeds = [];
        for (var j = 0; j < message.feeds.length; ++j)
          object.feeds[j] = $root.lazer.Feed.toObject(
            message.feeds[j],
            options,
          );
      }
      if (message.publishers && message.publishers.length) {
        object.publishers = [];
        for (var j = 0; j < message.publishers.length; ++j)
          object.publishers[j] = $root.lazer.Publisher.toObject(
            message.publishers[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this State to JSON.
     * @function toJSON
     * @memberof lazer.State
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    State.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for State
     * @function getTypeUrl
     * @memberof lazer.State
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    State.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.State";
    };

    return State;
  })();

  lazer.Publisher = (function () {
    /**
     * Properties of a Publisher.
     * @memberof lazer
     * @interface IPublisher
     * @property {number|null} [publisherId] Publisher publisherId
     * @property {string|null} [name] Publisher name
     * @property {Array.<Uint8Array>|null} [publicKeys] Publisher publicKeys
     * @property {boolean|null} [isActive] Publisher isActive
     */

    /**
     * Constructs a new Publisher.
     * @memberof lazer
     * @classdesc Represents a Publisher.
     * @implements IPublisher
     * @constructor
     * @param {lazer.IPublisher=} [properties] Properties to set
     */
    function Publisher(properties) {
      this.publicKeys = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Publisher publisherId.
     * @member {number|null|undefined} publisherId
     * @memberof lazer.Publisher
     * @instance
     */
    Publisher.prototype.publisherId = null;

    /**
     * Publisher name.
     * @member {string|null|undefined} name
     * @memberof lazer.Publisher
     * @instance
     */
    Publisher.prototype.name = null;

    /**
     * Publisher publicKeys.
     * @member {Array.<Uint8Array>} publicKeys
     * @memberof lazer.Publisher
     * @instance
     */
    Publisher.prototype.publicKeys = $util.emptyArray;

    /**
     * Publisher isActive.
     * @member {boolean|null|undefined} isActive
     * @memberof lazer.Publisher
     * @instance
     */
    Publisher.prototype.isActive = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Publisher _publisherId.
     * @member {"publisherId"|undefined} _publisherId
     * @memberof lazer.Publisher
     * @instance
     */
    Object.defineProperty(Publisher.prototype, "_publisherId", {
      get: $util.oneOfGetter(($oneOfFields = ["publisherId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Publisher _name.
     * @member {"name"|undefined} _name
     * @memberof lazer.Publisher
     * @instance
     */
    Object.defineProperty(Publisher.prototype, "_name", {
      get: $util.oneOfGetter(($oneOfFields = ["name"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Publisher _isActive.
     * @member {"isActive"|undefined} _isActive
     * @memberof lazer.Publisher
     * @instance
     */
    Object.defineProperty(Publisher.prototype, "_isActive", {
      get: $util.oneOfGetter(($oneOfFields = ["isActive"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new Publisher instance using the specified properties.
     * @function create
     * @memberof lazer.Publisher
     * @static
     * @param {lazer.IPublisher=} [properties] Properties to set
     * @returns {lazer.Publisher} Publisher instance
     */
    Publisher.create = function create(properties) {
      return new Publisher(properties);
    };

    /**
     * Encodes the specified Publisher message. Does not implicitly {@link lazer.Publisher.verify|verify} messages.
     * @function encode
     * @memberof lazer.Publisher
     * @static
     * @param {lazer.IPublisher} message Publisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Publisher.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.publisherId != null &&
        Object.hasOwnProperty.call(message, "publisherId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.publisherId);
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.name);
      if (message.publicKeys != null && message.publicKeys.length)
        for (var i = 0; i < message.publicKeys.length; ++i)
          writer
            .uint32(/* id 3, wireType 2 =*/ 26)
            .bytes(message.publicKeys[i]);
      if (
        message.isActive != null &&
        Object.hasOwnProperty.call(message, "isActive")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).bool(message.isActive);
      return writer;
    };

    /**
     * Encodes the specified Publisher message, length delimited. Does not implicitly {@link lazer.Publisher.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.Publisher
     * @static
     * @param {lazer.IPublisher} message Publisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Publisher.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Publisher message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.Publisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.Publisher} Publisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Publisher.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.Publisher();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.publisherId = reader.uint32();
            break;
          }
          case 2: {
            message.name = reader.string();
            break;
          }
          case 3: {
            if (!(message.publicKeys && message.publicKeys.length))
              message.publicKeys = [];
            message.publicKeys.push(reader.bytes());
            break;
          }
          case 4: {
            message.isActive = reader.bool();
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
     * Decodes a Publisher message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.Publisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.Publisher} Publisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Publisher.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Publisher message.
     * @function verify
     * @memberof lazer.Publisher
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Publisher.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.publisherId != null &&
        message.hasOwnProperty("publisherId")
      ) {
        properties._publisherId = 1;
        if (!$util.isInteger(message.publisherId))
          return "publisherId: integer expected";
      }
      if (message.name != null && message.hasOwnProperty("name")) {
        properties._name = 1;
        if (!$util.isString(message.name)) return "name: string expected";
      }
      if (message.publicKeys != null && message.hasOwnProperty("publicKeys")) {
        if (!Array.isArray(message.publicKeys))
          return "publicKeys: array expected";
        for (var i = 0; i < message.publicKeys.length; ++i)
          if (
            !(
              (message.publicKeys[i] &&
                typeof message.publicKeys[i].length === "number") ||
              $util.isString(message.publicKeys[i])
            )
          )
            return "publicKeys: buffer[] expected";
      }
      if (message.isActive != null && message.hasOwnProperty("isActive")) {
        properties._isActive = 1;
        if (typeof message.isActive !== "boolean")
          return "isActive: boolean expected";
      }
      return null;
    };

    /**
     * Creates a Publisher message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.Publisher
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.Publisher} Publisher
     */
    Publisher.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.Publisher) return object;
      var message = new $root.lazer.Publisher();
      if (object.publisherId != null)
        message.publisherId = object.publisherId >>> 0;
      if (object.name != null) message.name = String(object.name);
      if (object.publicKeys) {
        if (!Array.isArray(object.publicKeys))
          throw TypeError(".lazer.Publisher.publicKeys: array expected");
        message.publicKeys = [];
        for (var i = 0; i < object.publicKeys.length; ++i)
          if (typeof object.publicKeys[i] === "string")
            $util.base64.decode(
              object.publicKeys[i],
              (message.publicKeys[i] = $util.newBuffer(
                $util.base64.length(object.publicKeys[i]),
              )),
              0,
            );
          else if (object.publicKeys[i].length >= 0)
            message.publicKeys[i] = object.publicKeys[i];
      }
      if (object.isActive != null) message.isActive = Boolean(object.isActive);
      return message;
    };

    /**
     * Creates a plain object from a Publisher message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.Publisher
     * @static
     * @param {lazer.Publisher} message Publisher
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Publisher.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.publicKeys = [];
      if (
        message.publisherId != null &&
        message.hasOwnProperty("publisherId")
      ) {
        object.publisherId = message.publisherId;
        if (options.oneofs) object._publisherId = "publisherId";
      }
      if (message.name != null && message.hasOwnProperty("name")) {
        object.name = message.name;
        if (options.oneofs) object._name = "name";
      }
      if (message.publicKeys && message.publicKeys.length) {
        object.publicKeys = [];
        for (var j = 0; j < message.publicKeys.length; ++j)
          object.publicKeys[j] =
            options.bytes === String
              ? $util.base64.encode(
                  message.publicKeys[j],
                  0,
                  message.publicKeys[j].length,
                )
              : options.bytes === Array
                ? Array.prototype.slice.call(message.publicKeys[j])
                : message.publicKeys[j];
      }
      if (message.isActive != null && message.hasOwnProperty("isActive")) {
        object.isActive = message.isActive;
        if (options.oneofs) object._isActive = "isActive";
      }
      return object;
    };

    /**
     * Converts this Publisher to JSON.
     * @function toJSON
     * @memberof lazer.Publisher
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Publisher.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Publisher
     * @function getTypeUrl
     * @memberof lazer.Publisher
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Publisher.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.Publisher";
    };

    return Publisher;
  })();

  /**
   * AssetType enum.
   * @name lazer.AssetType
   * @enum {number}
   * @property {number} CRYPTO=0 CRYPTO value
   * @property {number} FUNDING_RATE=1 FUNDING_RATE value
   * @property {number} FX=2 FX value
   * @property {number} COMMODITY=3 COMMODITY value
   * @property {number} NAV=4 NAV value
   * @property {number} CRYPTO_INDEX=5 CRYPTO_INDEX value
   * @property {number} CRYPTO_REDEMPTION_RATE=6 CRYPTO_REDEMPTION_RATE value
   * @property {number} EQUITY=7 EQUITY value
   * @property {number} METAL=8 METAL value
   * @property {number} RATES=9 RATES value
   */
  lazer.AssetType = (function () {
    var valuesById = {},
      values = Object.create(valuesById);
    values[(valuesById[0] = "CRYPTO")] = 0;
    values[(valuesById[1] = "FUNDING_RATE")] = 1;
    values[(valuesById[2] = "FX")] = 2;
    values[(valuesById[3] = "COMMODITY")] = 3;
    values[(valuesById[4] = "NAV")] = 4;
    values[(valuesById[5] = "CRYPTO_INDEX")] = 5;
    values[(valuesById[6] = "CRYPTO_REDEMPTION_RATE")] = 6;
    values[(valuesById[7] = "EQUITY")] = 7;
    values[(valuesById[8] = "METAL")] = 8;
    values[(valuesById[9] = "RATES")] = 9;
    return values;
  })();

  lazer.FeedMetadata = (function () {
    /**
     * Properties of a FeedMetadata.
     * @memberof lazer
     * @interface IFeedMetadata
     * @property {number|null} [priceFeedId] FeedMetadata priceFeedId
     * @property {string|null} [name] FeedMetadata name
     * @property {string|null} [symbol] FeedMetadata symbol
     * @property {string|null} [description] FeedMetadata description
     * @property {lazer.AssetType|null} [assetType] FeedMetadata assetType
     * @property {number|null} [exponent] FeedMetadata exponent
     * @property {number|null} [cmcId] FeedMetadata cmcId
     * @property {google.protobuf.IDuration|null} [fundingRateInterval] FeedMetadata fundingRateInterval
     * @property {number|null} [minPublishers] FeedMetadata minPublishers
     * @property {google.protobuf.IDuration|null} [minRate] FeedMetadata minRate
     * @property {google.protobuf.IDuration|null} [expiryTime] FeedMetadata expiryTime
     * @property {boolean|null} [isActivated] FeedMetadata isActivated
     * @property {string|null} [hermesId] FeedMetadata hermesId
     * @property {string|null} [quoteCurrency] FeedMetadata quoteCurrency
     * @property {string|null} [marketSchedule] FeedMetadata marketSchedule
     */

    /**
     * Constructs a new FeedMetadata.
     * @memberof lazer
     * @classdesc Represents a FeedMetadata.
     * @implements IFeedMetadata
     * @constructor
     * @param {lazer.IFeedMetadata=} [properties] Properties to set
     */
    function FeedMetadata(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FeedMetadata priceFeedId.
     * @member {number|null|undefined} priceFeedId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.priceFeedId = null;

    /**
     * FeedMetadata name.
     * @member {string|null|undefined} name
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.name = null;

    /**
     * FeedMetadata symbol.
     * @member {string|null|undefined} symbol
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.symbol = null;

    /**
     * FeedMetadata description.
     * @member {string|null|undefined} description
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.description = null;

    /**
     * FeedMetadata assetType.
     * @member {lazer.AssetType|null|undefined} assetType
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.assetType = null;

    /**
     * FeedMetadata exponent.
     * @member {number|null|undefined} exponent
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.exponent = null;

    /**
     * FeedMetadata cmcId.
     * @member {number|null|undefined} cmcId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.cmcId = null;

    /**
     * FeedMetadata fundingRateInterval.
     * @member {google.protobuf.IDuration|null|undefined} fundingRateInterval
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.fundingRateInterval = null;

    /**
     * FeedMetadata minPublishers.
     * @member {number|null|undefined} minPublishers
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.minPublishers = null;

    /**
     * FeedMetadata minRate.
     * @member {google.protobuf.IDuration|null|undefined} minRate
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.minRate = null;

    /**
     * FeedMetadata expiryTime.
     * @member {google.protobuf.IDuration|null|undefined} expiryTime
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.expiryTime = null;

    /**
     * FeedMetadata isActivated.
     * @member {boolean|null|undefined} isActivated
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.isActivated = null;

    /**
     * FeedMetadata hermesId.
     * @member {string|null|undefined} hermesId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.hermesId = null;

    /**
     * FeedMetadata quoteCurrency.
     * @member {string|null|undefined} quoteCurrency
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.quoteCurrency = null;

    /**
     * FeedMetadata marketSchedule.
     * @member {string|null|undefined} marketSchedule
     * @memberof lazer.FeedMetadata
     * @instance
     */
    FeedMetadata.prototype.marketSchedule = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * FeedMetadata _priceFeedId.
     * @member {"priceFeedId"|undefined} _priceFeedId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_priceFeedId", {
      get: $util.oneOfGetter(($oneOfFields = ["priceFeedId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _name.
     * @member {"name"|undefined} _name
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_name", {
      get: $util.oneOfGetter(($oneOfFields = ["name"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _symbol.
     * @member {"symbol"|undefined} _symbol
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_symbol", {
      get: $util.oneOfGetter(($oneOfFields = ["symbol"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _description.
     * @member {"description"|undefined} _description
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_description", {
      get: $util.oneOfGetter(($oneOfFields = ["description"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _assetType.
     * @member {"assetType"|undefined} _assetType
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_assetType", {
      get: $util.oneOfGetter(($oneOfFields = ["assetType"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _exponent.
     * @member {"exponent"|undefined} _exponent
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_exponent", {
      get: $util.oneOfGetter(($oneOfFields = ["exponent"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _cmcId.
     * @member {"cmcId"|undefined} _cmcId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_cmcId", {
      get: $util.oneOfGetter(($oneOfFields = ["cmcId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _fundingRateInterval.
     * @member {"fundingRateInterval"|undefined} _fundingRateInterval
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_fundingRateInterval", {
      get: $util.oneOfGetter(($oneOfFields = ["fundingRateInterval"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _minPublishers.
     * @member {"minPublishers"|undefined} _minPublishers
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_minPublishers", {
      get: $util.oneOfGetter(($oneOfFields = ["minPublishers"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _minRate.
     * @member {"minRate"|undefined} _minRate
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_minRate", {
      get: $util.oneOfGetter(($oneOfFields = ["minRate"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _expiryTime.
     * @member {"expiryTime"|undefined} _expiryTime
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_expiryTime", {
      get: $util.oneOfGetter(($oneOfFields = ["expiryTime"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _isActivated.
     * @member {"isActivated"|undefined} _isActivated
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_isActivated", {
      get: $util.oneOfGetter(($oneOfFields = ["isActivated"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _hermesId.
     * @member {"hermesId"|undefined} _hermesId
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_hermesId", {
      get: $util.oneOfGetter(($oneOfFields = ["hermesId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _quoteCurrency.
     * @member {"quoteCurrency"|undefined} _quoteCurrency
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_quoteCurrency", {
      get: $util.oneOfGetter(($oneOfFields = ["quoteCurrency"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedMetadata _marketSchedule.
     * @member {"marketSchedule"|undefined} _marketSchedule
     * @memberof lazer.FeedMetadata
     * @instance
     */
    Object.defineProperty(FeedMetadata.prototype, "_marketSchedule", {
      get: $util.oneOfGetter(($oneOfFields = ["marketSchedule"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new FeedMetadata instance using the specified properties.
     * @function create
     * @memberof lazer.FeedMetadata
     * @static
     * @param {lazer.IFeedMetadata=} [properties] Properties to set
     * @returns {lazer.FeedMetadata} FeedMetadata instance
     */
    FeedMetadata.create = function create(properties) {
      return new FeedMetadata(properties);
    };

    /**
     * Encodes the specified FeedMetadata message. Does not implicitly {@link lazer.FeedMetadata.verify|verify} messages.
     * @function encode
     * @memberof lazer.FeedMetadata
     * @static
     * @param {lazer.IFeedMetadata} message FeedMetadata message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedMetadata.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.priceFeedId != null &&
        Object.hasOwnProperty.call(message, "priceFeedId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.priceFeedId);
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.name);
      if (
        message.symbol != null &&
        Object.hasOwnProperty.call(message, "symbol")
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.symbol);
      if (
        message.description != null &&
        Object.hasOwnProperty.call(message, "description")
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.description);
      if (
        message.assetType != null &&
        Object.hasOwnProperty.call(message, "assetType")
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.assetType);
      if (
        message.exponent != null &&
        Object.hasOwnProperty.call(message, "exponent")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).sint32(message.exponent);
      if (message.cmcId != null && Object.hasOwnProperty.call(message, "cmcId"))
        writer.uint32(/* id 7, wireType 0 =*/ 56).uint32(message.cmcId);
      if (
        message.fundingRateInterval != null &&
        Object.hasOwnProperty.call(message, "fundingRateInterval")
      )
        $root.google.protobuf.Duration.encode(
          message.fundingRateInterval,
          writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
        ).ldelim();
      if (
        message.minPublishers != null &&
        Object.hasOwnProperty.call(message, "minPublishers")
      )
        writer.uint32(/* id 9, wireType 0 =*/ 72).uint32(message.minPublishers);
      if (
        message.minRate != null &&
        Object.hasOwnProperty.call(message, "minRate")
      )
        $root.google.protobuf.Duration.encode(
          message.minRate,
          writer.uint32(/* id 10, wireType 2 =*/ 82).fork(),
        ).ldelim();
      if (
        message.expiryTime != null &&
        Object.hasOwnProperty.call(message, "expiryTime")
      )
        $root.google.protobuf.Duration.encode(
          message.expiryTime,
          writer.uint32(/* id 11, wireType 2 =*/ 90).fork(),
        ).ldelim();
      if (
        message.isActivated != null &&
        Object.hasOwnProperty.call(message, "isActivated")
      )
        writer.uint32(/* id 12, wireType 0 =*/ 96).bool(message.isActivated);
      if (
        message.hermesId != null &&
        Object.hasOwnProperty.call(message, "hermesId")
      )
        writer.uint32(/* id 13, wireType 2 =*/ 106).string(message.hermesId);
      if (
        message.quoteCurrency != null &&
        Object.hasOwnProperty.call(message, "quoteCurrency")
      )
        writer
          .uint32(/* id 14, wireType 2 =*/ 114)
          .string(message.quoteCurrency);
      if (
        message.marketSchedule != null &&
        Object.hasOwnProperty.call(message, "marketSchedule")
      )
        writer
          .uint32(/* id 15, wireType 2 =*/ 122)
          .string(message.marketSchedule);
      return writer;
    };

    /**
     * Encodes the specified FeedMetadata message, length delimited. Does not implicitly {@link lazer.FeedMetadata.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.FeedMetadata
     * @static
     * @param {lazer.IFeedMetadata} message FeedMetadata message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedMetadata.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FeedMetadata message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.FeedMetadata
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.FeedMetadata} FeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedMetadata.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.FeedMetadata();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.priceFeedId = reader.uint32();
            break;
          }
          case 2: {
            message.name = reader.string();
            break;
          }
          case 3: {
            message.symbol = reader.string();
            break;
          }
          case 4: {
            message.description = reader.string();
            break;
          }
          case 5: {
            message.assetType = reader.int32();
            break;
          }
          case 6: {
            message.exponent = reader.sint32();
            break;
          }
          case 7: {
            message.cmcId = reader.uint32();
            break;
          }
          case 8: {
            message.fundingRateInterval = $root.google.protobuf.Duration.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 9: {
            message.minPublishers = reader.uint32();
            break;
          }
          case 10: {
            message.minRate = $root.google.protobuf.Duration.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 11: {
            message.expiryTime = $root.google.protobuf.Duration.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 12: {
            message.isActivated = reader.bool();
            break;
          }
          case 13: {
            message.hermesId = reader.string();
            break;
          }
          case 14: {
            message.quoteCurrency = reader.string();
            break;
          }
          case 15: {
            message.marketSchedule = reader.string();
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
     * Decodes a FeedMetadata message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.FeedMetadata
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.FeedMetadata} FeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedMetadata.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FeedMetadata message.
     * @function verify
     * @memberof lazer.FeedMetadata
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FeedMetadata.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.priceFeedId != null &&
        message.hasOwnProperty("priceFeedId")
      ) {
        properties._priceFeedId = 1;
        if (!$util.isInteger(message.priceFeedId))
          return "priceFeedId: integer expected";
      }
      if (message.name != null && message.hasOwnProperty("name")) {
        properties._name = 1;
        if (!$util.isString(message.name)) return "name: string expected";
      }
      if (message.symbol != null && message.hasOwnProperty("symbol")) {
        properties._symbol = 1;
        if (!$util.isString(message.symbol)) return "symbol: string expected";
      }
      if (
        message.description != null &&
        message.hasOwnProperty("description")
      ) {
        properties._description = 1;
        if (!$util.isString(message.description))
          return "description: string expected";
      }
      if (message.assetType != null && message.hasOwnProperty("assetType")) {
        properties._assetType = 1;
        switch (message.assetType) {
          default:
            return "assetType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
            break;
        }
      }
      if (message.exponent != null && message.hasOwnProperty("exponent")) {
        properties._exponent = 1;
        if (!$util.isInteger(message.exponent))
          return "exponent: integer expected";
      }
      if (message.cmcId != null && message.hasOwnProperty("cmcId")) {
        properties._cmcId = 1;
        if (!$util.isInteger(message.cmcId)) return "cmcId: integer expected";
      }
      if (
        message.fundingRateInterval != null &&
        message.hasOwnProperty("fundingRateInterval")
      ) {
        properties._fundingRateInterval = 1;
        {
          var error = $root.google.protobuf.Duration.verify(
            message.fundingRateInterval,
          );
          if (error) return "fundingRateInterval." + error;
        }
      }
      if (
        message.minPublishers != null &&
        message.hasOwnProperty("minPublishers")
      ) {
        properties._minPublishers = 1;
        if (!$util.isInteger(message.minPublishers))
          return "minPublishers: integer expected";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        properties._minRate = 1;
        {
          var error = $root.google.protobuf.Duration.verify(message.minRate);
          if (error) return "minRate." + error;
        }
      }
      if (message.expiryTime != null && message.hasOwnProperty("expiryTime")) {
        properties._expiryTime = 1;
        {
          var error = $root.google.protobuf.Duration.verify(message.expiryTime);
          if (error) return "expiryTime." + error;
        }
      }
      if (
        message.isActivated != null &&
        message.hasOwnProperty("isActivated")
      ) {
        properties._isActivated = 1;
        if (typeof message.isActivated !== "boolean")
          return "isActivated: boolean expected";
      }
      if (message.hermesId != null && message.hasOwnProperty("hermesId")) {
        properties._hermesId = 1;
        if (!$util.isString(message.hermesId))
          return "hermesId: string expected";
      }
      if (
        message.quoteCurrency != null &&
        message.hasOwnProperty("quoteCurrency")
      ) {
        properties._quoteCurrency = 1;
        if (!$util.isString(message.quoteCurrency))
          return "quoteCurrency: string expected";
      }
      if (
        message.marketSchedule != null &&
        message.hasOwnProperty("marketSchedule")
      ) {
        properties._marketSchedule = 1;
        if (!$util.isString(message.marketSchedule))
          return "marketSchedule: string expected";
      }
      return null;
    };

    /**
     * Creates a FeedMetadata message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.FeedMetadata
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.FeedMetadata} FeedMetadata
     */
    FeedMetadata.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.FeedMetadata) return object;
      var message = new $root.lazer.FeedMetadata();
      if (object.priceFeedId != null)
        message.priceFeedId = object.priceFeedId >>> 0;
      if (object.name != null) message.name = String(object.name);
      if (object.symbol != null) message.symbol = String(object.symbol);
      if (object.description != null)
        message.description = String(object.description);
      switch (object.assetType) {
        default:
          if (typeof object.assetType === "number") {
            message.assetType = object.assetType;
            break;
          }
          break;
        case "CRYPTO":
        case 0:
          message.assetType = 0;
          break;
        case "FUNDING_RATE":
        case 1:
          message.assetType = 1;
          break;
        case "FX":
        case 2:
          message.assetType = 2;
          break;
        case "COMMODITY":
        case 3:
          message.assetType = 3;
          break;
        case "NAV":
        case 4:
          message.assetType = 4;
          break;
        case "CRYPTO_INDEX":
        case 5:
          message.assetType = 5;
          break;
        case "CRYPTO_REDEMPTION_RATE":
        case 6:
          message.assetType = 6;
          break;
        case "EQUITY":
        case 7:
          message.assetType = 7;
          break;
        case "METAL":
        case 8:
          message.assetType = 8;
          break;
        case "RATES":
        case 9:
          message.assetType = 9;
          break;
      }
      if (object.exponent != null) message.exponent = object.exponent | 0;
      if (object.cmcId != null) message.cmcId = object.cmcId >>> 0;
      if (object.fundingRateInterval != null) {
        if (typeof object.fundingRateInterval !== "object")
          throw TypeError(
            ".lazer.FeedMetadata.fundingRateInterval: object expected",
          );
        message.fundingRateInterval = $root.google.protobuf.Duration.fromObject(
          object.fundingRateInterval,
        );
      }
      if (object.minPublishers != null)
        message.minPublishers = object.minPublishers >>> 0;
      if (object.minRate != null) {
        if (typeof object.minRate !== "object")
          throw TypeError(".lazer.FeedMetadata.minRate: object expected");
        message.minRate = $root.google.protobuf.Duration.fromObject(
          object.minRate,
        );
      }
      if (object.expiryTime != null) {
        if (typeof object.expiryTime !== "object")
          throw TypeError(".lazer.FeedMetadata.expiryTime: object expected");
        message.expiryTime = $root.google.protobuf.Duration.fromObject(
          object.expiryTime,
        );
      }
      if (object.isActivated != null)
        message.isActivated = Boolean(object.isActivated);
      if (object.hermesId != null) message.hermesId = String(object.hermesId);
      if (object.quoteCurrency != null)
        message.quoteCurrency = String(object.quoteCurrency);
      if (object.marketSchedule != null)
        message.marketSchedule = String(object.marketSchedule);
      return message;
    };

    /**
     * Creates a plain object from a FeedMetadata message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.FeedMetadata
     * @static
     * @param {lazer.FeedMetadata} message FeedMetadata
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FeedMetadata.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.priceFeedId != null &&
        message.hasOwnProperty("priceFeedId")
      ) {
        object.priceFeedId = message.priceFeedId;
        if (options.oneofs) object._priceFeedId = "priceFeedId";
      }
      if (message.name != null && message.hasOwnProperty("name")) {
        object.name = message.name;
        if (options.oneofs) object._name = "name";
      }
      if (message.symbol != null && message.hasOwnProperty("symbol")) {
        object.symbol = message.symbol;
        if (options.oneofs) object._symbol = "symbol";
      }
      if (
        message.description != null &&
        message.hasOwnProperty("description")
      ) {
        object.description = message.description;
        if (options.oneofs) object._description = "description";
      }
      if (message.assetType != null && message.hasOwnProperty("assetType")) {
        object.assetType =
          options.enums === String
            ? $root.lazer.AssetType[message.assetType] === undefined
              ? message.assetType
              : $root.lazer.AssetType[message.assetType]
            : message.assetType;
        if (options.oneofs) object._assetType = "assetType";
      }
      if (message.exponent != null && message.hasOwnProperty("exponent")) {
        object.exponent = message.exponent;
        if (options.oneofs) object._exponent = "exponent";
      }
      if (message.cmcId != null && message.hasOwnProperty("cmcId")) {
        object.cmcId = message.cmcId;
        if (options.oneofs) object._cmcId = "cmcId";
      }
      if (
        message.fundingRateInterval != null &&
        message.hasOwnProperty("fundingRateInterval")
      ) {
        object.fundingRateInterval = $root.google.protobuf.Duration.toObject(
          message.fundingRateInterval,
          options,
        );
        if (options.oneofs) object._fundingRateInterval = "fundingRateInterval";
      }
      if (
        message.minPublishers != null &&
        message.hasOwnProperty("minPublishers")
      ) {
        object.minPublishers = message.minPublishers;
        if (options.oneofs) object._minPublishers = "minPublishers";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        object.minRate = $root.google.protobuf.Duration.toObject(
          message.minRate,
          options,
        );
        if (options.oneofs) object._minRate = "minRate";
      }
      if (message.expiryTime != null && message.hasOwnProperty("expiryTime")) {
        object.expiryTime = $root.google.protobuf.Duration.toObject(
          message.expiryTime,
          options,
        );
        if (options.oneofs) object._expiryTime = "expiryTime";
      }
      if (
        message.isActivated != null &&
        message.hasOwnProperty("isActivated")
      ) {
        object.isActivated = message.isActivated;
        if (options.oneofs) object._isActivated = "isActivated";
      }
      if (message.hermesId != null && message.hasOwnProperty("hermesId")) {
        object.hermesId = message.hermesId;
        if (options.oneofs) object._hermesId = "hermesId";
      }
      if (
        message.quoteCurrency != null &&
        message.hasOwnProperty("quoteCurrency")
      ) {
        object.quoteCurrency = message.quoteCurrency;
        if (options.oneofs) object._quoteCurrency = "quoteCurrency";
      }
      if (
        message.marketSchedule != null &&
        message.hasOwnProperty("marketSchedule")
      ) {
        object.marketSchedule = message.marketSchedule;
        if (options.oneofs) object._marketSchedule = "marketSchedule";
      }
      return object;
    };

    /**
     * Converts this FeedMetadata to JSON.
     * @function toJSON
     * @memberof lazer.FeedMetadata
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FeedMetadata.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FeedMetadata
     * @function getTypeUrl
     * @memberof lazer.FeedMetadata
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FeedMetadata.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.FeedMetadata";
    };

    return FeedMetadata;
  })();

  lazer.Feed = (function () {
    /**
     * Properties of a Feed.
     * @memberof lazer
     * @interface IFeed
     * @property {lazer.IFeedMetadata|null} [metadata] Feed metadata
     * @property {google.protobuf.ITimestamp|null} [pendingActivation] Feed pendingActivation
     * @property {google.protobuf.ITimestamp|null} [pendingDeactivation] Feed pendingDeactivation
     * @property {Array.<lazer.IFeedPublisherState>|null} [perPublisher] Feed perPublisher
     */

    /**
     * Constructs a new Feed.
     * @memberof lazer
     * @classdesc Represents a Feed.
     * @implements IFeed
     * @constructor
     * @param {lazer.IFeed=} [properties] Properties to set
     */
    function Feed(properties) {
      this.perPublisher = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Feed metadata.
     * @member {lazer.IFeedMetadata|null|undefined} metadata
     * @memberof lazer.Feed
     * @instance
     */
    Feed.prototype.metadata = null;

    /**
     * Feed pendingActivation.
     * @member {google.protobuf.ITimestamp|null|undefined} pendingActivation
     * @memberof lazer.Feed
     * @instance
     */
    Feed.prototype.pendingActivation = null;

    /**
     * Feed pendingDeactivation.
     * @member {google.protobuf.ITimestamp|null|undefined} pendingDeactivation
     * @memberof lazer.Feed
     * @instance
     */
    Feed.prototype.pendingDeactivation = null;

    /**
     * Feed perPublisher.
     * @member {Array.<lazer.IFeedPublisherState>} perPublisher
     * @memberof lazer.Feed
     * @instance
     */
    Feed.prototype.perPublisher = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Feed _metadata.
     * @member {"metadata"|undefined} _metadata
     * @memberof lazer.Feed
     * @instance
     */
    Object.defineProperty(Feed.prototype, "_metadata", {
      get: $util.oneOfGetter(($oneOfFields = ["metadata"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Feed _pendingActivation.
     * @member {"pendingActivation"|undefined} _pendingActivation
     * @memberof lazer.Feed
     * @instance
     */
    Object.defineProperty(Feed.prototype, "_pendingActivation", {
      get: $util.oneOfGetter(($oneOfFields = ["pendingActivation"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Feed _pendingDeactivation.
     * @member {"pendingDeactivation"|undefined} _pendingDeactivation
     * @memberof lazer.Feed
     * @instance
     */
    Object.defineProperty(Feed.prototype, "_pendingDeactivation", {
      get: $util.oneOfGetter(($oneOfFields = ["pendingDeactivation"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new Feed instance using the specified properties.
     * @function create
     * @memberof lazer.Feed
     * @static
     * @param {lazer.IFeed=} [properties] Properties to set
     * @returns {lazer.Feed} Feed instance
     */
    Feed.create = function create(properties) {
      return new Feed(properties);
    };

    /**
     * Encodes the specified Feed message. Does not implicitly {@link lazer.Feed.verify|verify} messages.
     * @function encode
     * @memberof lazer.Feed
     * @static
     * @param {lazer.IFeed} message Feed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Feed.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.metadata != null &&
        Object.hasOwnProperty.call(message, "metadata")
      )
        $root.lazer.FeedMetadata.encode(
          message.metadata,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.pendingActivation != null &&
        Object.hasOwnProperty.call(message, "pendingActivation")
      )
        $root.google.protobuf.Timestamp.encode(
          message.pendingActivation,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (
        message.pendingDeactivation != null &&
        Object.hasOwnProperty.call(message, "pendingDeactivation")
      )
        $root.google.protobuf.Timestamp.encode(
          message.pendingDeactivation,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (message.perPublisher != null && message.perPublisher.length)
        for (var i = 0; i < message.perPublisher.length; ++i)
          $root.lazer.FeedPublisherState.encode(
            message.perPublisher[i],
            writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified Feed message, length delimited. Does not implicitly {@link lazer.Feed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.Feed
     * @static
     * @param {lazer.IFeed} message Feed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Feed.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Feed message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.Feed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.Feed} Feed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Feed.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.Feed();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.metadata = $root.lazer.FeedMetadata.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 2: {
            message.pendingActivation = $root.google.protobuf.Timestamp.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 3: {
            message.pendingDeactivation =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
            break;
          }
          case 4: {
            if (!(message.perPublisher && message.perPublisher.length))
              message.perPublisher = [];
            message.perPublisher.push(
              $root.lazer.FeedPublisherState.decode(reader, reader.uint32()),
            );
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
     * Decodes a Feed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.Feed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.Feed} Feed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Feed.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Feed message.
     * @function verify
     * @memberof lazer.Feed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Feed.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.metadata != null && message.hasOwnProperty("metadata")) {
        properties._metadata = 1;
        {
          var error = $root.lazer.FeedMetadata.verify(message.metadata);
          if (error) return "metadata." + error;
        }
      }
      if (
        message.pendingActivation != null &&
        message.hasOwnProperty("pendingActivation")
      ) {
        properties._pendingActivation = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.pendingActivation,
          );
          if (error) return "pendingActivation." + error;
        }
      }
      if (
        message.pendingDeactivation != null &&
        message.hasOwnProperty("pendingDeactivation")
      ) {
        properties._pendingDeactivation = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.pendingDeactivation,
          );
          if (error) return "pendingDeactivation." + error;
        }
      }
      if (
        message.perPublisher != null &&
        message.hasOwnProperty("perPublisher")
      ) {
        if (!Array.isArray(message.perPublisher))
          return "perPublisher: array expected";
        for (var i = 0; i < message.perPublisher.length; ++i) {
          var error = $root.lazer.FeedPublisherState.verify(
            message.perPublisher[i],
          );
          if (error) return "perPublisher." + error;
        }
      }
      return null;
    };

    /**
     * Creates a Feed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.Feed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.Feed} Feed
     */
    Feed.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.Feed) return object;
      var message = new $root.lazer.Feed();
      if (object.metadata != null) {
        if (typeof object.metadata !== "object")
          throw TypeError(".lazer.Feed.metadata: object expected");
        message.metadata = $root.lazer.FeedMetadata.fromObject(object.metadata);
      }
      if (object.pendingActivation != null) {
        if (typeof object.pendingActivation !== "object")
          throw TypeError(".lazer.Feed.pendingActivation: object expected");
        message.pendingActivation = $root.google.protobuf.Timestamp.fromObject(
          object.pendingActivation,
        );
      }
      if (object.pendingDeactivation != null) {
        if (typeof object.pendingDeactivation !== "object")
          throw TypeError(".lazer.Feed.pendingDeactivation: object expected");
        message.pendingDeactivation =
          $root.google.protobuf.Timestamp.fromObject(
            object.pendingDeactivation,
          );
      }
      if (object.perPublisher) {
        if (!Array.isArray(object.perPublisher))
          throw TypeError(".lazer.Feed.perPublisher: array expected");
        message.perPublisher = [];
        for (var i = 0; i < object.perPublisher.length; ++i) {
          if (typeof object.perPublisher[i] !== "object")
            throw TypeError(".lazer.Feed.perPublisher: object expected");
          message.perPublisher[i] = $root.lazer.FeedPublisherState.fromObject(
            object.perPublisher[i],
          );
        }
      }
      return message;
    };

    /**
     * Creates a plain object from a Feed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.Feed
     * @static
     * @param {lazer.Feed} message Feed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Feed.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.perPublisher = [];
      if (message.metadata != null && message.hasOwnProperty("metadata")) {
        object.metadata = $root.lazer.FeedMetadata.toObject(
          message.metadata,
          options,
        );
        if (options.oneofs) object._metadata = "metadata";
      }
      if (
        message.pendingActivation != null &&
        message.hasOwnProperty("pendingActivation")
      ) {
        object.pendingActivation = $root.google.protobuf.Timestamp.toObject(
          message.pendingActivation,
          options,
        );
        if (options.oneofs) object._pendingActivation = "pendingActivation";
      }
      if (
        message.pendingDeactivation != null &&
        message.hasOwnProperty("pendingDeactivation")
      ) {
        object.pendingDeactivation = $root.google.protobuf.Timestamp.toObject(
          message.pendingDeactivation,
          options,
        );
        if (options.oneofs) object._pendingDeactivation = "pendingDeactivation";
      }
      if (message.perPublisher && message.perPublisher.length) {
        object.perPublisher = [];
        for (var j = 0; j < message.perPublisher.length; ++j)
          object.perPublisher[j] = $root.lazer.FeedPublisherState.toObject(
            message.perPublisher[j],
            options,
          );
      }
      return object;
    };

    /**
     * Converts this Feed to JSON.
     * @function toJSON
     * @memberof lazer.Feed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Feed.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Feed
     * @function getTypeUrl
     * @memberof lazer.Feed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Feed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.Feed";
    };

    return Feed;
  })();

  lazer.FeedPublisherState = (function () {
    /**
     * Properties of a FeedPublisherState.
     * @memberof lazer
     * @interface IFeedPublisherState
     * @property {number|null} [publisherId] FeedPublisherState publisherId
     * @property {google.protobuf.ITimestamp|null} [lastUpdateTimestamp] FeedPublisherState lastUpdateTimestamp
     * @property {google.protobuf.ITimestamp|null} [lastPublisherTimestamp] FeedPublisherState lastPublisherTimestamp
     * @property {lazer.IFeedData|null} [lastFeedData] FeedPublisherState lastFeedData
     */

    /**
     * Constructs a new FeedPublisherState.
     * @memberof lazer
     * @classdesc Represents a FeedPublisherState.
     * @implements IFeedPublisherState
     * @constructor
     * @param {lazer.IFeedPublisherState=} [properties] Properties to set
     */
    function FeedPublisherState(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FeedPublisherState publisherId.
     * @member {number|null|undefined} publisherId
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    FeedPublisherState.prototype.publisherId = null;

    /**
     * FeedPublisherState lastUpdateTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} lastUpdateTimestamp
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    FeedPublisherState.prototype.lastUpdateTimestamp = null;

    /**
     * FeedPublisherState lastPublisherTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} lastPublisherTimestamp
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    FeedPublisherState.prototype.lastPublisherTimestamp = null;

    /**
     * FeedPublisherState lastFeedData.
     * @member {lazer.IFeedData|null|undefined} lastFeedData
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    FeedPublisherState.prototype.lastFeedData = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * FeedPublisherState _publisherId.
     * @member {"publisherId"|undefined} _publisherId
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    Object.defineProperty(FeedPublisherState.prototype, "_publisherId", {
      get: $util.oneOfGetter(($oneOfFields = ["publisherId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedPublisherState _lastUpdateTimestamp.
     * @member {"lastUpdateTimestamp"|undefined} _lastUpdateTimestamp
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    Object.defineProperty(
      FeedPublisherState.prototype,
      "_lastUpdateTimestamp",
      {
        get: $util.oneOfGetter(($oneOfFields = ["lastUpdateTimestamp"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * FeedPublisherState _lastPublisherTimestamp.
     * @member {"lastPublisherTimestamp"|undefined} _lastPublisherTimestamp
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    Object.defineProperty(
      FeedPublisherState.prototype,
      "_lastPublisherTimestamp",
      {
        get: $util.oneOfGetter(($oneOfFields = ["lastPublisherTimestamp"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * FeedPublisherState _lastFeedData.
     * @member {"lastFeedData"|undefined} _lastFeedData
     * @memberof lazer.FeedPublisherState
     * @instance
     */
    Object.defineProperty(FeedPublisherState.prototype, "_lastFeedData", {
      get: $util.oneOfGetter(($oneOfFields = ["lastFeedData"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new FeedPublisherState instance using the specified properties.
     * @function create
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {lazer.IFeedPublisherState=} [properties] Properties to set
     * @returns {lazer.FeedPublisherState} FeedPublisherState instance
     */
    FeedPublisherState.create = function create(properties) {
      return new FeedPublisherState(properties);
    };

    /**
     * Encodes the specified FeedPublisherState message. Does not implicitly {@link lazer.FeedPublisherState.verify|verify} messages.
     * @function encode
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {lazer.IFeedPublisherState} message FeedPublisherState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedPublisherState.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.publisherId != null &&
        Object.hasOwnProperty.call(message, "publisherId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.publisherId);
      if (
        message.lastUpdateTimestamp != null &&
        Object.hasOwnProperty.call(message, "lastUpdateTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.lastUpdateTimestamp,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (
        message.lastPublisherTimestamp != null &&
        Object.hasOwnProperty.call(message, "lastPublisherTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.lastPublisherTimestamp,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (
        message.lastFeedData != null &&
        Object.hasOwnProperty.call(message, "lastFeedData")
      )
        $root.lazer.FeedData.encode(
          message.lastFeedData,
          writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified FeedPublisherState message, length delimited. Does not implicitly {@link lazer.FeedPublisherState.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {lazer.IFeedPublisherState} message FeedPublisherState message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedPublisherState.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FeedPublisherState message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.FeedPublisherState} FeedPublisherState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedPublisherState.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.FeedPublisherState();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.publisherId = reader.uint32();
            break;
          }
          case 2: {
            message.lastUpdateTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
            break;
          }
          case 3: {
            message.lastPublisherTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
            break;
          }
          case 4: {
            message.lastFeedData = $root.lazer.FeedData.decode(
              reader,
              reader.uint32(),
            );
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
     * Decodes a FeedPublisherState message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.FeedPublisherState} FeedPublisherState
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedPublisherState.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FeedPublisherState message.
     * @function verify
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FeedPublisherState.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.publisherId != null &&
        message.hasOwnProperty("publisherId")
      ) {
        properties._publisherId = 1;
        if (!$util.isInteger(message.publisherId))
          return "publisherId: integer expected";
      }
      if (
        message.lastUpdateTimestamp != null &&
        message.hasOwnProperty("lastUpdateTimestamp")
      ) {
        properties._lastUpdateTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.lastUpdateTimestamp,
          );
          if (error) return "lastUpdateTimestamp." + error;
        }
      }
      if (
        message.lastPublisherTimestamp != null &&
        message.hasOwnProperty("lastPublisherTimestamp")
      ) {
        properties._lastPublisherTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.lastPublisherTimestamp,
          );
          if (error) return "lastPublisherTimestamp." + error;
        }
      }
      if (
        message.lastFeedData != null &&
        message.hasOwnProperty("lastFeedData")
      ) {
        properties._lastFeedData = 1;
        {
          var error = $root.lazer.FeedData.verify(message.lastFeedData);
          if (error) return "lastFeedData." + error;
        }
      }
      return null;
    };

    /**
     * Creates a FeedPublisherState message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.FeedPublisherState} FeedPublisherState
     */
    FeedPublisherState.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.FeedPublisherState) return object;
      var message = new $root.lazer.FeedPublisherState();
      if (object.publisherId != null)
        message.publisherId = object.publisherId >>> 0;
      if (object.lastUpdateTimestamp != null) {
        if (typeof object.lastUpdateTimestamp !== "object")
          throw TypeError(
            ".lazer.FeedPublisherState.lastUpdateTimestamp: object expected",
          );
        message.lastUpdateTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.lastUpdateTimestamp,
          );
      }
      if (object.lastPublisherTimestamp != null) {
        if (typeof object.lastPublisherTimestamp !== "object")
          throw TypeError(
            ".lazer.FeedPublisherState.lastPublisherTimestamp: object expected",
          );
        message.lastPublisherTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.lastPublisherTimestamp,
          );
      }
      if (object.lastFeedData != null) {
        if (typeof object.lastFeedData !== "object")
          throw TypeError(
            ".lazer.FeedPublisherState.lastFeedData: object expected",
          );
        message.lastFeedData = $root.lazer.FeedData.fromObject(
          object.lastFeedData,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a FeedPublisherState message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {lazer.FeedPublisherState} message FeedPublisherState
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FeedPublisherState.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.publisherId != null &&
        message.hasOwnProperty("publisherId")
      ) {
        object.publisherId = message.publisherId;
        if (options.oneofs) object._publisherId = "publisherId";
      }
      if (
        message.lastUpdateTimestamp != null &&
        message.hasOwnProperty("lastUpdateTimestamp")
      ) {
        object.lastUpdateTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.lastUpdateTimestamp,
          options,
        );
        if (options.oneofs) object._lastUpdateTimestamp = "lastUpdateTimestamp";
      }
      if (
        message.lastPublisherTimestamp != null &&
        message.hasOwnProperty("lastPublisherTimestamp")
      ) {
        object.lastPublisherTimestamp =
          $root.google.protobuf.Timestamp.toObject(
            message.lastPublisherTimestamp,
            options,
          );
        if (options.oneofs)
          object._lastPublisherTimestamp = "lastPublisherTimestamp";
      }
      if (
        message.lastFeedData != null &&
        message.hasOwnProperty("lastFeedData")
      ) {
        object.lastFeedData = $root.lazer.FeedData.toObject(
          message.lastFeedData,
          options,
        );
        if (options.oneofs) object._lastFeedData = "lastFeedData";
      }
      return object;
    };

    /**
     * Converts this FeedPublisherState to JSON.
     * @function toJSON
     * @memberof lazer.FeedPublisherState
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FeedPublisherState.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FeedPublisherState
     * @function getTypeUrl
     * @memberof lazer.FeedPublisherState
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FeedPublisherState.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.FeedPublisherState";
    };

    return FeedPublisherState;
  })();

  lazer.FeedData = (function () {
    /**
     * Properties of a FeedData.
     * @memberof lazer
     * @interface IFeedData
     * @property {google.protobuf.ITimestamp|null} [sourceTimestamp] FeedData sourceTimestamp
     * @property {google.protobuf.ITimestamp|null} [publisherTimestamp] FeedData publisherTimestamp
     * @property {number|Long|null} [price] FeedData price
     * @property {number|Long|null} [bestBidPrice] FeedData bestBidPrice
     * @property {number|Long|null} [bestAskPrice] FeedData bestAskPrice
     * @property {number|Long|null} [fundingRate] FeedData fundingRate
     */

    /**
     * Constructs a new FeedData.
     * @memberof lazer
     * @classdesc Represents a FeedData.
     * @implements IFeedData
     * @constructor
     * @param {lazer.IFeedData=} [properties] Properties to set
     */
    function FeedData(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * FeedData sourceTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} sourceTimestamp
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.sourceTimestamp = null;

    /**
     * FeedData publisherTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} publisherTimestamp
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.publisherTimestamp = null;

    /**
     * FeedData price.
     * @member {number|Long|null|undefined} price
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.price = null;

    /**
     * FeedData bestBidPrice.
     * @member {number|Long|null|undefined} bestBidPrice
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.bestBidPrice = null;

    /**
     * FeedData bestAskPrice.
     * @member {number|Long|null|undefined} bestAskPrice
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.bestAskPrice = null;

    /**
     * FeedData fundingRate.
     * @member {number|Long|null|undefined} fundingRate
     * @memberof lazer.FeedData
     * @instance
     */
    FeedData.prototype.fundingRate = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * FeedData _sourceTimestamp.
     * @member {"sourceTimestamp"|undefined} _sourceTimestamp
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_sourceTimestamp", {
      get: $util.oneOfGetter(($oneOfFields = ["sourceTimestamp"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedData _publisherTimestamp.
     * @member {"publisherTimestamp"|undefined} _publisherTimestamp
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_publisherTimestamp", {
      get: $util.oneOfGetter(($oneOfFields = ["publisherTimestamp"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedData _price.
     * @member {"price"|undefined} _price
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_price", {
      get: $util.oneOfGetter(($oneOfFields = ["price"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedData _bestBidPrice.
     * @member {"bestBidPrice"|undefined} _bestBidPrice
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_bestBidPrice", {
      get: $util.oneOfGetter(($oneOfFields = ["bestBidPrice"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedData _bestAskPrice.
     * @member {"bestAskPrice"|undefined} _bestAskPrice
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_bestAskPrice", {
      get: $util.oneOfGetter(($oneOfFields = ["bestAskPrice"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * FeedData _fundingRate.
     * @member {"fundingRate"|undefined} _fundingRate
     * @memberof lazer.FeedData
     * @instance
     */
    Object.defineProperty(FeedData.prototype, "_fundingRate", {
      get: $util.oneOfGetter(($oneOfFields = ["fundingRate"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new FeedData instance using the specified properties.
     * @function create
     * @memberof lazer.FeedData
     * @static
     * @param {lazer.IFeedData=} [properties] Properties to set
     * @returns {lazer.FeedData} FeedData instance
     */
    FeedData.create = function create(properties) {
      return new FeedData(properties);
    };

    /**
     * Encodes the specified FeedData message. Does not implicitly {@link lazer.FeedData.verify|verify} messages.
     * @function encode
     * @memberof lazer.FeedData
     * @static
     * @param {lazer.IFeedData} message FeedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedData.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.sourceTimestamp != null &&
        Object.hasOwnProperty.call(message, "sourceTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.sourceTimestamp,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.publisherTimestamp != null &&
        Object.hasOwnProperty.call(message, "publisherTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.publisherTimestamp,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (message.price != null && Object.hasOwnProperty.call(message, "price"))
        writer.uint32(/* id 3, wireType 0 =*/ 24).int64(message.price);
      if (
        message.bestBidPrice != null &&
        Object.hasOwnProperty.call(message, "bestBidPrice")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).int64(message.bestBidPrice);
      if (
        message.bestAskPrice != null &&
        Object.hasOwnProperty.call(message, "bestAskPrice")
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).int64(message.bestAskPrice);
      if (
        message.fundingRate != null &&
        Object.hasOwnProperty.call(message, "fundingRate")
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).int64(message.fundingRate);
      return writer;
    };

    /**
     * Encodes the specified FeedData message, length delimited. Does not implicitly {@link lazer.FeedData.verify|verify} messages.
     * @function encodeDelimited
     * @memberof lazer.FeedData
     * @static
     * @param {lazer.IFeedData} message FeedData message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    FeedData.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a FeedData message from the specified reader or buffer.
     * @function decode
     * @memberof lazer.FeedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {lazer.FeedData} FeedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedData.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.lazer.FeedData();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.sourceTimestamp = $root.google.protobuf.Timestamp.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 2: {
            message.publisherTimestamp = $root.google.protobuf.Timestamp.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 3: {
            message.price = reader.int64();
            break;
          }
          case 4: {
            message.bestBidPrice = reader.int64();
            break;
          }
          case 5: {
            message.bestAskPrice = reader.int64();
            break;
          }
          case 6: {
            message.fundingRate = reader.int64();
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
     * Decodes a FeedData message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof lazer.FeedData
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {lazer.FeedData} FeedData
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    FeedData.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a FeedData message.
     * @function verify
     * @memberof lazer.FeedData
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    FeedData.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.sourceTimestamp != null &&
        message.hasOwnProperty("sourceTimestamp")
      ) {
        properties._sourceTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.sourceTimestamp,
          );
          if (error) return "sourceTimestamp." + error;
        }
      }
      if (
        message.publisherTimestamp != null &&
        message.hasOwnProperty("publisherTimestamp")
      ) {
        properties._publisherTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.publisherTimestamp,
          );
          if (error) return "publisherTimestamp." + error;
        }
      }
      if (message.price != null && message.hasOwnProperty("price")) {
        properties._price = 1;
        if (
          !$util.isInteger(message.price) &&
          !(
            message.price &&
            $util.isInteger(message.price.low) &&
            $util.isInteger(message.price.high)
          )
        )
          return "price: integer|Long expected";
      }
      if (
        message.bestBidPrice != null &&
        message.hasOwnProperty("bestBidPrice")
      ) {
        properties._bestBidPrice = 1;
        if (
          !$util.isInteger(message.bestBidPrice) &&
          !(
            message.bestBidPrice &&
            $util.isInteger(message.bestBidPrice.low) &&
            $util.isInteger(message.bestBidPrice.high)
          )
        )
          return "bestBidPrice: integer|Long expected";
      }
      if (
        message.bestAskPrice != null &&
        message.hasOwnProperty("bestAskPrice")
      ) {
        properties._bestAskPrice = 1;
        if (
          !$util.isInteger(message.bestAskPrice) &&
          !(
            message.bestAskPrice &&
            $util.isInteger(message.bestAskPrice.low) &&
            $util.isInteger(message.bestAskPrice.high)
          )
        )
          return "bestAskPrice: integer|Long expected";
      }
      if (
        message.fundingRate != null &&
        message.hasOwnProperty("fundingRate")
      ) {
        properties._fundingRate = 1;
        if (
          !$util.isInteger(message.fundingRate) &&
          !(
            message.fundingRate &&
            $util.isInteger(message.fundingRate.low) &&
            $util.isInteger(message.fundingRate.high)
          )
        )
          return "fundingRate: integer|Long expected";
      }
      return null;
    };

    /**
     * Creates a FeedData message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof lazer.FeedData
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {lazer.FeedData} FeedData
     */
    FeedData.fromObject = function fromObject(object) {
      if (object instanceof $root.lazer.FeedData) return object;
      var message = new $root.lazer.FeedData();
      if (object.sourceTimestamp != null) {
        if (typeof object.sourceTimestamp !== "object")
          throw TypeError(".lazer.FeedData.sourceTimestamp: object expected");
        message.sourceTimestamp = $root.google.protobuf.Timestamp.fromObject(
          object.sourceTimestamp,
        );
      }
      if (object.publisherTimestamp != null) {
        if (typeof object.publisherTimestamp !== "object")
          throw TypeError(
            ".lazer.FeedData.publisherTimestamp: object expected",
          );
        message.publisherTimestamp = $root.google.protobuf.Timestamp.fromObject(
          object.publisherTimestamp,
        );
      }
      if (object.price != null)
        if ($util.Long)
          (message.price = $util.Long.fromValue(object.price)).unsigned = false;
        else if (typeof object.price === "string")
          message.price = parseInt(object.price, 10);
        else if (typeof object.price === "number") message.price = object.price;
        else if (typeof object.price === "object")
          message.price = new $util.LongBits(
            object.price.low >>> 0,
            object.price.high >>> 0,
          ).toNumber();
      if (object.bestBidPrice != null)
        if ($util.Long)
          (message.bestBidPrice = $util.Long.fromValue(
            object.bestBidPrice,
          )).unsigned = false;
        else if (typeof object.bestBidPrice === "string")
          message.bestBidPrice = parseInt(object.bestBidPrice, 10);
        else if (typeof object.bestBidPrice === "number")
          message.bestBidPrice = object.bestBidPrice;
        else if (typeof object.bestBidPrice === "object")
          message.bestBidPrice = new $util.LongBits(
            object.bestBidPrice.low >>> 0,
            object.bestBidPrice.high >>> 0,
          ).toNumber();
      if (object.bestAskPrice != null)
        if ($util.Long)
          (message.bestAskPrice = $util.Long.fromValue(
            object.bestAskPrice,
          )).unsigned = false;
        else if (typeof object.bestAskPrice === "string")
          message.bestAskPrice = parseInt(object.bestAskPrice, 10);
        else if (typeof object.bestAskPrice === "number")
          message.bestAskPrice = object.bestAskPrice;
        else if (typeof object.bestAskPrice === "object")
          message.bestAskPrice = new $util.LongBits(
            object.bestAskPrice.low >>> 0,
            object.bestAskPrice.high >>> 0,
          ).toNumber();
      if (object.fundingRate != null)
        if ($util.Long)
          (message.fundingRate = $util.Long.fromValue(
            object.fundingRate,
          )).unsigned = false;
        else if (typeof object.fundingRate === "string")
          message.fundingRate = parseInt(object.fundingRate, 10);
        else if (typeof object.fundingRate === "number")
          message.fundingRate = object.fundingRate;
        else if (typeof object.fundingRate === "object")
          message.fundingRate = new $util.LongBits(
            object.fundingRate.low >>> 0,
            object.fundingRate.high >>> 0,
          ).toNumber();
      return message;
    };

    /**
     * Creates a plain object from a FeedData message. Also converts values to other types if specified.
     * @function toObject
     * @memberof lazer.FeedData
     * @static
     * @param {lazer.FeedData} message FeedData
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    FeedData.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.sourceTimestamp != null &&
        message.hasOwnProperty("sourceTimestamp")
      ) {
        object.sourceTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.sourceTimestamp,
          options,
        );
        if (options.oneofs) object._sourceTimestamp = "sourceTimestamp";
      }
      if (
        message.publisherTimestamp != null &&
        message.hasOwnProperty("publisherTimestamp")
      ) {
        object.publisherTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.publisherTimestamp,
          options,
        );
        if (options.oneofs) object._publisherTimestamp = "publisherTimestamp";
      }
      if (message.price != null && message.hasOwnProperty("price")) {
        if (typeof message.price === "number")
          object.price =
            options.longs === String ? String(message.price) : message.price;
        else
          object.price =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.price)
              : options.longs === Number
                ? new $util.LongBits(
                    message.price.low >>> 0,
                    message.price.high >>> 0,
                  ).toNumber()
                : message.price;
        if (options.oneofs) object._price = "price";
      }
      if (
        message.bestBidPrice != null &&
        message.hasOwnProperty("bestBidPrice")
      ) {
        if (typeof message.bestBidPrice === "number")
          object.bestBidPrice =
            options.longs === String
              ? String(message.bestBidPrice)
              : message.bestBidPrice;
        else
          object.bestBidPrice =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.bestBidPrice)
              : options.longs === Number
                ? new $util.LongBits(
                    message.bestBidPrice.low >>> 0,
                    message.bestBidPrice.high >>> 0,
                  ).toNumber()
                : message.bestBidPrice;
        if (options.oneofs) object._bestBidPrice = "bestBidPrice";
      }
      if (
        message.bestAskPrice != null &&
        message.hasOwnProperty("bestAskPrice")
      ) {
        if (typeof message.bestAskPrice === "number")
          object.bestAskPrice =
            options.longs === String
              ? String(message.bestAskPrice)
              : message.bestAskPrice;
        else
          object.bestAskPrice =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.bestAskPrice)
              : options.longs === Number
                ? new $util.LongBits(
                    message.bestAskPrice.low >>> 0,
                    message.bestAskPrice.high >>> 0,
                  ).toNumber()
                : message.bestAskPrice;
        if (options.oneofs) object._bestAskPrice = "bestAskPrice";
      }
      if (
        message.fundingRate != null &&
        message.hasOwnProperty("fundingRate")
      ) {
        if (typeof message.fundingRate === "number")
          object.fundingRate =
            options.longs === String
              ? String(message.fundingRate)
              : message.fundingRate;
        else
          object.fundingRate =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.fundingRate)
              : options.longs === Number
                ? new $util.LongBits(
                    message.fundingRate.low >>> 0,
                    message.fundingRate.high >>> 0,
                  ).toNumber()
                : message.fundingRate;
        if (options.oneofs) object._fundingRate = "fundingRate";
      }
      return object;
    };

    /**
     * Converts this FeedData to JSON.
     * @function toJSON
     * @memberof lazer.FeedData
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    FeedData.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for FeedData
     * @function getTypeUrl
     * @memberof lazer.FeedData
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    FeedData.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/lazer.FeedData";
    };

    return FeedData;
  })();

  return lazer;
})();

$root.google = (function () {
  /**
   * Namespace google.
   * @exports google
   * @namespace
   */
  var google = {};

  google.protobuf = (function () {
    /**
     * Namespace protobuf.
     * @memberof google
     * @namespace
     */
    var protobuf = {};

    protobuf.Duration = (function () {
      /**
       * Properties of a Duration.
       * @memberof google.protobuf
       * @interface IDuration
       * @property {number|Long|null} [seconds] Duration seconds
       * @property {number|null} [nanos] Duration nanos
       */

      /**
       * Constructs a new Duration.
       * @memberof google.protobuf
       * @classdesc Represents a Duration.
       * @implements IDuration
       * @constructor
       * @param {google.protobuf.IDuration=} [properties] Properties to set
       */
      function Duration(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * Duration seconds.
       * @member {number|Long} seconds
       * @memberof google.protobuf.Duration
       * @instance
       */
      Duration.prototype.seconds = $util.Long
        ? $util.Long.fromBits(0, 0, false)
        : 0;

      /**
       * Duration nanos.
       * @member {number} nanos
       * @memberof google.protobuf.Duration
       * @instance
       */
      Duration.prototype.nanos = 0;

      /**
       * Creates a new Duration instance using the specified properties.
       * @function create
       * @memberof google.protobuf.Duration
       * @static
       * @param {google.protobuf.IDuration=} [properties] Properties to set
       * @returns {google.protobuf.Duration} Duration instance
       */
      Duration.create = function create(properties) {
        return new Duration(properties);
      };

      /**
       * Encodes the specified Duration message. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
       * @function encode
       * @memberof google.protobuf.Duration
       * @static
       * @param {google.protobuf.IDuration} message Duration message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Duration.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (
          message.seconds != null &&
          Object.hasOwnProperty.call(message, "seconds")
        )
          writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.seconds);
        if (
          message.nanos != null &&
          Object.hasOwnProperty.call(message, "nanos")
        )
          writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.nanos);
        return writer;
      };

      /**
       * Encodes the specified Duration message, length delimited. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
       * @function encodeDelimited
       * @memberof google.protobuf.Duration
       * @static
       * @param {google.protobuf.IDuration} message Duration message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Duration.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a Duration message from the specified reader or buffer.
       * @function decode
       * @memberof google.protobuf.Duration
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {google.protobuf.Duration} Duration
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Duration.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.google.protobuf.Duration();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              message.seconds = reader.int64();
              break;
            }
            case 2: {
              message.nanos = reader.int32();
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
       * Decodes a Duration message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof google.protobuf.Duration
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {google.protobuf.Duration} Duration
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Duration.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a Duration message.
       * @function verify
       * @memberof google.protobuf.Duration
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      Duration.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (message.seconds != null && message.hasOwnProperty("seconds"))
          if (
            !$util.isInteger(message.seconds) &&
            !(
              message.seconds &&
              $util.isInteger(message.seconds.low) &&
              $util.isInteger(message.seconds.high)
            )
          )
            return "seconds: integer|Long expected";
        if (message.nanos != null && message.hasOwnProperty("nanos"))
          if (!$util.isInteger(message.nanos)) return "nanos: integer expected";
        return null;
      };

      /**
       * Creates a Duration message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof google.protobuf.Duration
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {google.protobuf.Duration} Duration
       */
      Duration.fromObject = function fromObject(object) {
        if (object instanceof $root.google.protobuf.Duration) return object;
        var message = new $root.google.protobuf.Duration();
        if (object.seconds != null)
          if ($util.Long)
            (message.seconds = $util.Long.fromValue(object.seconds)).unsigned =
              false;
          else if (typeof object.seconds === "string")
            message.seconds = parseInt(object.seconds, 10);
          else if (typeof object.seconds === "number")
            message.seconds = object.seconds;
          else if (typeof object.seconds === "object")
            message.seconds = new $util.LongBits(
              object.seconds.low >>> 0,
              object.seconds.high >>> 0,
            ).toNumber();
        if (object.nanos != null) message.nanos = object.nanos | 0;
        return message;
      };

      /**
       * Creates a plain object from a Duration message. Also converts values to other types if specified.
       * @function toObject
       * @memberof google.protobuf.Duration
       * @static
       * @param {google.protobuf.Duration} message Duration
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      Duration.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.defaults) {
          if ($util.Long) {
            var long = new $util.Long(0, 0, false);
            object.seconds =
              options.longs === String
                ? long.toString()
                : options.longs === Number
                  ? long.toNumber()
                  : long;
          } else object.seconds = options.longs === String ? "0" : 0;
          object.nanos = 0;
        }
        if (message.seconds != null && message.hasOwnProperty("seconds"))
          if (typeof message.seconds === "number")
            object.seconds =
              options.longs === String
                ? String(message.seconds)
                : message.seconds;
          else
            object.seconds =
              options.longs === String
                ? $util.Long.prototype.toString.call(message.seconds)
                : options.longs === Number
                  ? new $util.LongBits(
                      message.seconds.low >>> 0,
                      message.seconds.high >>> 0,
                    ).toNumber()
                  : message.seconds;
        if (message.nanos != null && message.hasOwnProperty("nanos"))
          object.nanos = message.nanos;
        return object;
      };

      /**
       * Converts this Duration to JSON.
       * @function toJSON
       * @memberof google.protobuf.Duration
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      Duration.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for Duration
       * @function getTypeUrl
       * @memberof google.protobuf.Duration
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      Duration.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/google.protobuf.Duration";
      };

      return Duration;
    })();

    protobuf.Timestamp = (function () {
      /**
       * Properties of a Timestamp.
       * @memberof google.protobuf
       * @interface ITimestamp
       * @property {number|Long|null} [seconds] Timestamp seconds
       * @property {number|null} [nanos] Timestamp nanos
       */

      /**
       * Constructs a new Timestamp.
       * @memberof google.protobuf
       * @classdesc Represents a Timestamp.
       * @implements ITimestamp
       * @constructor
       * @param {google.protobuf.ITimestamp=} [properties] Properties to set
       */
      function Timestamp(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * Timestamp seconds.
       * @member {number|Long} seconds
       * @memberof google.protobuf.Timestamp
       * @instance
       */
      Timestamp.prototype.seconds = $util.Long
        ? $util.Long.fromBits(0, 0, false)
        : 0;

      /**
       * Timestamp nanos.
       * @member {number} nanos
       * @memberof google.protobuf.Timestamp
       * @instance
       */
      Timestamp.prototype.nanos = 0;

      /**
       * Creates a new Timestamp instance using the specified properties.
       * @function create
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {google.protobuf.ITimestamp=} [properties] Properties to set
       * @returns {google.protobuf.Timestamp} Timestamp instance
       */
      Timestamp.create = function create(properties) {
        return new Timestamp(properties);
      };

      /**
       * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
       * @function encode
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {google.protobuf.ITimestamp} message Timestamp message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Timestamp.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (
          message.seconds != null &&
          Object.hasOwnProperty.call(message, "seconds")
        )
          writer.uint32(/* id 1, wireType 0 =*/ 8).int64(message.seconds);
        if (
          message.nanos != null &&
          Object.hasOwnProperty.call(message, "nanos")
        )
          writer.uint32(/* id 2, wireType 0 =*/ 16).int32(message.nanos);
        return writer;
      };

      /**
       * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
       * @function encodeDelimited
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {google.protobuf.ITimestamp} message Timestamp message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Timestamp.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a Timestamp message from the specified reader or buffer.
       * @function decode
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {google.protobuf.Timestamp} Timestamp
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Timestamp.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.google.protobuf.Timestamp();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              message.seconds = reader.int64();
              break;
            }
            case 2: {
              message.nanos = reader.int32();
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
       * Decodes a Timestamp message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {google.protobuf.Timestamp} Timestamp
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Timestamp.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a Timestamp message.
       * @function verify
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      Timestamp.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (message.seconds != null && message.hasOwnProperty("seconds"))
          if (
            !$util.isInteger(message.seconds) &&
            !(
              message.seconds &&
              $util.isInteger(message.seconds.low) &&
              $util.isInteger(message.seconds.high)
            )
          )
            return "seconds: integer|Long expected";
        if (message.nanos != null && message.hasOwnProperty("nanos"))
          if (!$util.isInteger(message.nanos)) return "nanos: integer expected";
        return null;
      };

      /**
       * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {google.protobuf.Timestamp} Timestamp
       */
      Timestamp.fromObject = function fromObject(object) {
        if (object instanceof $root.google.protobuf.Timestamp) return object;
        var message = new $root.google.protobuf.Timestamp();
        if (object.seconds != null)
          if ($util.Long)
            (message.seconds = $util.Long.fromValue(object.seconds)).unsigned =
              false;
          else if (typeof object.seconds === "string")
            message.seconds = parseInt(object.seconds, 10);
          else if (typeof object.seconds === "number")
            message.seconds = object.seconds;
          else if (typeof object.seconds === "object")
            message.seconds = new $util.LongBits(
              object.seconds.low >>> 0,
              object.seconds.high >>> 0,
            ).toNumber();
        if (object.nanos != null) message.nanos = object.nanos | 0;
        return message;
      };

      /**
       * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
       * @function toObject
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {google.protobuf.Timestamp} message Timestamp
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      Timestamp.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.defaults) {
          if ($util.Long) {
            var long = new $util.Long(0, 0, false);
            object.seconds =
              options.longs === String
                ? long.toString()
                : options.longs === Number
                  ? long.toNumber()
                  : long;
          } else object.seconds = options.longs === String ? "0" : 0;
          object.nanos = 0;
        }
        if (message.seconds != null && message.hasOwnProperty("seconds"))
          if (typeof message.seconds === "number")
            object.seconds =
              options.longs === String
                ? String(message.seconds)
                : message.seconds;
          else
            object.seconds =
              options.longs === String
                ? $util.Long.prototype.toString.call(message.seconds)
                : options.longs === Number
                  ? new $util.LongBits(
                      message.seconds.low >>> 0,
                      message.seconds.high >>> 0,
                    ).toNumber()
                  : message.seconds;
        if (message.nanos != null && message.hasOwnProperty("nanos"))
          object.nanos = message.nanos;
        return object;
      };

      /**
       * Converts this Timestamp to JSON.
       * @function toJSON
       * @memberof google.protobuf.Timestamp
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      Timestamp.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for Timestamp
       * @function getTypeUrl
       * @memberof google.protobuf.Timestamp
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      Timestamp.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/google.protobuf.Timestamp";
      };

      return Timestamp;
    })();

    return protobuf;
  })();

  return google;
})();

module.exports = $root;
