/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.pyth_lazer_transaction = (function () {
  /**
   * Namespace pyth_lazer_transaction.
   * @exports pyth_lazer_transaction
   * @namespace
   */
  var pyth_lazer_transaction = {};

  pyth_lazer_transaction.GovernanceInstruction = (function () {
    /**
     * Properties of a GovernanceInstruction.
     * @memberof pyth_lazer_transaction
     * @interface IGovernanceInstruction
     * @property {Array.<pyth_lazer_transaction.IGovernanceDirective>|null} [directives] GovernanceInstruction directives
     * @property {google.protobuf.ITimestamp|null} [minExecutionTimestamp] GovernanceInstruction minExecutionTimestamp
     * @property {google.protobuf.ITimestamp|null} [maxExecutionTimestamp] GovernanceInstruction maxExecutionTimestamp
     * @property {number|null} [governanceSequenceNo] GovernanceInstruction governanceSequenceNo
     */

    /**
     * Constructs a new GovernanceInstruction.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a GovernanceInstruction.
     * @implements IGovernanceInstruction
     * @constructor
     * @param {pyth_lazer_transaction.IGovernanceInstruction=} [properties] Properties to set
     */
    function GovernanceInstruction(properties) {
      this.directives = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GovernanceInstruction directives.
     * @member {Array.<pyth_lazer_transaction.IGovernanceDirective>} directives
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    GovernanceInstruction.prototype.directives = $util.emptyArray;

    /**
     * GovernanceInstruction minExecutionTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} minExecutionTimestamp
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    GovernanceInstruction.prototype.minExecutionTimestamp = null;

    /**
     * GovernanceInstruction maxExecutionTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} maxExecutionTimestamp
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    GovernanceInstruction.prototype.maxExecutionTimestamp = null;

    /**
     * GovernanceInstruction governanceSequenceNo.
     * @member {number|null|undefined} governanceSequenceNo
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    GovernanceInstruction.prototype.governanceSequenceNo = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * GovernanceInstruction _minExecutionTimestamp.
     * @member {"minExecutionTimestamp"|undefined} _minExecutionTimestamp
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    Object.defineProperty(
      GovernanceInstruction.prototype,
      "_minExecutionTimestamp",
      {
        get: $util.oneOfGetter(($oneOfFields = ["minExecutionTimestamp"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * GovernanceInstruction _maxExecutionTimestamp.
     * @member {"maxExecutionTimestamp"|undefined} _maxExecutionTimestamp
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    Object.defineProperty(
      GovernanceInstruction.prototype,
      "_maxExecutionTimestamp",
      {
        get: $util.oneOfGetter(($oneOfFields = ["maxExecutionTimestamp"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * GovernanceInstruction _governanceSequenceNo.
     * @member {"governanceSequenceNo"|undefined} _governanceSequenceNo
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     */
    Object.defineProperty(
      GovernanceInstruction.prototype,
      "_governanceSequenceNo",
      {
        get: $util.oneOfGetter(($oneOfFields = ["governanceSequenceNo"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * Creates a new GovernanceInstruction instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {pyth_lazer_transaction.IGovernanceInstruction=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.GovernanceInstruction} GovernanceInstruction instance
     */
    GovernanceInstruction.create = function create(properties) {
      return new GovernanceInstruction(properties);
    };

    /**
     * Encodes the specified GovernanceInstruction message. Does not implicitly {@link pyth_lazer_transaction.GovernanceInstruction.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {pyth_lazer_transaction.IGovernanceInstruction} message GovernanceInstruction message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceInstruction.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.directives != null && message.directives.length)
        for (var i = 0; i < message.directives.length; ++i)
          $root.pyth_lazer_transaction.GovernanceDirective.encode(
            message.directives[i],
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
      if (
        message.minExecutionTimestamp != null &&
        Object.hasOwnProperty.call(message, "minExecutionTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.minExecutionTimestamp,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      if (
        message.maxExecutionTimestamp != null &&
        Object.hasOwnProperty.call(message, "maxExecutionTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.maxExecutionTimestamp,
          writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
        ).ldelim();
      if (
        message.governanceSequenceNo != null &&
        Object.hasOwnProperty.call(message, "governanceSequenceNo")
      )
        writer
          .uint32(/* id 5, wireType 0 =*/ 40)
          .uint32(message.governanceSequenceNo);
      return writer;
    };

    /**
     * Encodes the specified GovernanceInstruction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceInstruction.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {pyth_lazer_transaction.IGovernanceInstruction} message GovernanceInstruction message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceInstruction.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GovernanceInstruction message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.GovernanceInstruction} GovernanceInstruction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceInstruction.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.GovernanceInstruction();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 2: {
            if (!(message.directives && message.directives.length))
              message.directives = [];
            message.directives.push(
              $root.pyth_lazer_transaction.GovernanceDirective.decode(
                reader,
                reader.uint32(),
              ),
            );
            break;
          }
          case 3: {
            message.minExecutionTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
            break;
          }
          case 4: {
            message.maxExecutionTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
            break;
          }
          case 5: {
            message.governanceSequenceNo = reader.uint32();
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
     * Decodes a GovernanceInstruction message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.GovernanceInstruction} GovernanceInstruction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceInstruction.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GovernanceInstruction message.
     * @function verify
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GovernanceInstruction.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.directives != null && message.hasOwnProperty("directives")) {
        if (!Array.isArray(message.directives))
          return "directives: array expected";
        for (var i = 0; i < message.directives.length; ++i) {
          var error = $root.pyth_lazer_transaction.GovernanceDirective.verify(
            message.directives[i],
          );
          if (error) return "directives." + error;
        }
      }
      if (
        message.minExecutionTimestamp != null &&
        message.hasOwnProperty("minExecutionTimestamp")
      ) {
        properties._minExecutionTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.minExecutionTimestamp,
          );
          if (error) return "minExecutionTimestamp." + error;
        }
      }
      if (
        message.maxExecutionTimestamp != null &&
        message.hasOwnProperty("maxExecutionTimestamp")
      ) {
        properties._maxExecutionTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.maxExecutionTimestamp,
          );
          if (error) return "maxExecutionTimestamp." + error;
        }
      }
      if (
        message.governanceSequenceNo != null &&
        message.hasOwnProperty("governanceSequenceNo")
      ) {
        properties._governanceSequenceNo = 1;
        if (!$util.isInteger(message.governanceSequenceNo))
          return "governanceSequenceNo: integer expected";
      }
      return null;
    };

    /**
     * Creates a GovernanceInstruction message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.GovernanceInstruction} GovernanceInstruction
     */
    GovernanceInstruction.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.GovernanceInstruction)
        return object;
      var message = new $root.pyth_lazer_transaction.GovernanceInstruction();
      if (object.directives) {
        if (!Array.isArray(object.directives))
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceInstruction.directives: array expected",
          );
        message.directives = [];
        for (var i = 0; i < object.directives.length; ++i) {
          if (typeof object.directives[i] !== "object")
            throw TypeError(
              ".pyth_lazer_transaction.GovernanceInstruction.directives: object expected",
            );
          message.directives[i] =
            $root.pyth_lazer_transaction.GovernanceDirective.fromObject(
              object.directives[i],
            );
        }
      }
      if (object.minExecutionTimestamp != null) {
        if (typeof object.minExecutionTimestamp !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceInstruction.minExecutionTimestamp: object expected",
          );
        message.minExecutionTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.minExecutionTimestamp,
          );
      }
      if (object.maxExecutionTimestamp != null) {
        if (typeof object.maxExecutionTimestamp !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceInstruction.maxExecutionTimestamp: object expected",
          );
        message.maxExecutionTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.maxExecutionTimestamp,
          );
      }
      if (object.governanceSequenceNo != null)
        message.governanceSequenceNo = object.governanceSequenceNo >>> 0;
      return message;
    };

    /**
     * Creates a plain object from a GovernanceInstruction message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {pyth_lazer_transaction.GovernanceInstruction} message GovernanceInstruction
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GovernanceInstruction.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.directives = [];
      if (message.directives && message.directives.length) {
        object.directives = [];
        for (var j = 0; j < message.directives.length; ++j)
          object.directives[j] =
            $root.pyth_lazer_transaction.GovernanceDirective.toObject(
              message.directives[j],
              options,
            );
      }
      if (
        message.minExecutionTimestamp != null &&
        message.hasOwnProperty("minExecutionTimestamp")
      ) {
        object.minExecutionTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.minExecutionTimestamp,
          options,
        );
        if (options.oneofs)
          object._minExecutionTimestamp = "minExecutionTimestamp";
      }
      if (
        message.maxExecutionTimestamp != null &&
        message.hasOwnProperty("maxExecutionTimestamp")
      ) {
        object.maxExecutionTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.maxExecutionTimestamp,
          options,
        );
        if (options.oneofs)
          object._maxExecutionTimestamp = "maxExecutionTimestamp";
      }
      if (
        message.governanceSequenceNo != null &&
        message.hasOwnProperty("governanceSequenceNo")
      ) {
        object.governanceSequenceNo = message.governanceSequenceNo;
        if (options.oneofs)
          object._governanceSequenceNo = "governanceSequenceNo";
      }
      return object;
    };

    /**
     * Converts this GovernanceInstruction to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GovernanceInstruction.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GovernanceInstruction
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.GovernanceInstruction
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GovernanceInstruction.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.GovernanceInstruction";
    };

    return GovernanceInstruction;
  })();

  pyth_lazer_transaction.ShardFilter = (function () {
    /**
     * Properties of a ShardFilter.
     * @memberof pyth_lazer_transaction
     * @interface IShardFilter
     * @property {google.protobuf.IEmpty|null} [allShards] ShardFilter allShards
     * @property {pyth_lazer_transaction.ShardFilter.IShardNames|null} [shardNames] ShardFilter shardNames
     * @property {pyth_lazer_transaction.ShardFilter.IShardGroups|null} [shardGroups] ShardFilter shardGroups
     */

    /**
     * Constructs a new ShardFilter.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a ShardFilter.
     * @implements IShardFilter
     * @constructor
     * @param {pyth_lazer_transaction.IShardFilter=} [properties] Properties to set
     */
    function ShardFilter(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ShardFilter allShards.
     * @member {google.protobuf.IEmpty|null|undefined} allShards
     * @memberof pyth_lazer_transaction.ShardFilter
     * @instance
     */
    ShardFilter.prototype.allShards = null;

    /**
     * ShardFilter shardNames.
     * @member {pyth_lazer_transaction.ShardFilter.IShardNames|null|undefined} shardNames
     * @memberof pyth_lazer_transaction.ShardFilter
     * @instance
     */
    ShardFilter.prototype.shardNames = null;

    /**
     * ShardFilter shardGroups.
     * @member {pyth_lazer_transaction.ShardFilter.IShardGroups|null|undefined} shardGroups
     * @memberof pyth_lazer_transaction.ShardFilter
     * @instance
     */
    ShardFilter.prototype.shardGroups = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * ShardFilter filter.
     * @member {"allShards"|"shardNames"|"shardGroups"|undefined} filter
     * @memberof pyth_lazer_transaction.ShardFilter
     * @instance
     */
    Object.defineProperty(ShardFilter.prototype, "filter", {
      get: $util.oneOfGetter(
        ($oneOfFields = ["allShards", "shardNames", "shardGroups"]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new ShardFilter instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {pyth_lazer_transaction.IShardFilter=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.ShardFilter} ShardFilter instance
     */
    ShardFilter.create = function create(properties) {
      return new ShardFilter(properties);
    };

    /**
     * Encodes the specified ShardFilter message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {pyth_lazer_transaction.IShardFilter} message ShardFilter message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShardFilter.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.allShards != null &&
        Object.hasOwnProperty.call(message, "allShards")
      )
        $root.google.protobuf.Empty.encode(
          message.allShards,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.shardNames != null &&
        Object.hasOwnProperty.call(message, "shardNames")
      )
        $root.pyth_lazer_transaction.ShardFilter.ShardNames.encode(
          message.shardNames,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (
        message.shardGroups != null &&
        Object.hasOwnProperty.call(message, "shardGroups")
      )
        $root.pyth_lazer_transaction.ShardFilter.ShardGroups.encode(
          message.shardGroups,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified ShardFilter message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {pyth_lazer_transaction.IShardFilter} message ShardFilter message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ShardFilter.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ShardFilter message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.ShardFilter} ShardFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShardFilter.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.ShardFilter();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.allShards = $root.google.protobuf.Empty.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 2: {
            message.shardNames =
              $root.pyth_lazer_transaction.ShardFilter.ShardNames.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 3: {
            message.shardGroups =
              $root.pyth_lazer_transaction.ShardFilter.ShardGroups.decode(
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
     * Decodes a ShardFilter message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.ShardFilter} ShardFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ShardFilter.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ShardFilter message.
     * @function verify
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ShardFilter.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.allShards != null && message.hasOwnProperty("allShards")) {
        properties.filter = 1;
        {
          var error = $root.google.protobuf.Empty.verify(message.allShards);
          if (error) return "allShards." + error;
        }
      }
      if (message.shardNames != null && message.hasOwnProperty("shardNames")) {
        if (properties.filter === 1) return "filter: multiple values";
        properties.filter = 1;
        {
          var error =
            $root.pyth_lazer_transaction.ShardFilter.ShardNames.verify(
              message.shardNames,
            );
          if (error) return "shardNames." + error;
        }
      }
      if (
        message.shardGroups != null &&
        message.hasOwnProperty("shardGroups")
      ) {
        if (properties.filter === 1) return "filter: multiple values";
        properties.filter = 1;
        {
          var error =
            $root.pyth_lazer_transaction.ShardFilter.ShardGroups.verify(
              message.shardGroups,
            );
          if (error) return "shardGroups." + error;
        }
      }
      return null;
    };

    /**
     * Creates a ShardFilter message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.ShardFilter} ShardFilter
     */
    ShardFilter.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.ShardFilter)
        return object;
      var message = new $root.pyth_lazer_transaction.ShardFilter();
      if (object.allShards != null) {
        if (typeof object.allShards !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.ShardFilter.allShards: object expected",
          );
        message.allShards = $root.google.protobuf.Empty.fromObject(
          object.allShards,
        );
      }
      if (object.shardNames != null) {
        if (typeof object.shardNames !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.ShardFilter.shardNames: object expected",
          );
        message.shardNames =
          $root.pyth_lazer_transaction.ShardFilter.ShardNames.fromObject(
            object.shardNames,
          );
      }
      if (object.shardGroups != null) {
        if (typeof object.shardGroups !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.ShardFilter.shardGroups: object expected",
          );
        message.shardGroups =
          $root.pyth_lazer_transaction.ShardFilter.ShardGroups.fromObject(
            object.shardGroups,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from a ShardFilter message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {pyth_lazer_transaction.ShardFilter} message ShardFilter
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ShardFilter.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.allShards != null && message.hasOwnProperty("allShards")) {
        object.allShards = $root.google.protobuf.Empty.toObject(
          message.allShards,
          options,
        );
        if (options.oneofs) object.filter = "allShards";
      }
      if (message.shardNames != null && message.hasOwnProperty("shardNames")) {
        object.shardNames =
          $root.pyth_lazer_transaction.ShardFilter.ShardNames.toObject(
            message.shardNames,
            options,
          );
        if (options.oneofs) object.filter = "shardNames";
      }
      if (
        message.shardGroups != null &&
        message.hasOwnProperty("shardGroups")
      ) {
        object.shardGroups =
          $root.pyth_lazer_transaction.ShardFilter.ShardGroups.toObject(
            message.shardGroups,
            options,
          );
        if (options.oneofs) object.filter = "shardGroups";
      }
      return object;
    };

    /**
     * Converts this ShardFilter to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.ShardFilter
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ShardFilter.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ShardFilter
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.ShardFilter
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ShardFilter.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.ShardFilter";
    };

    ShardFilter.ShardNames = (function () {
      /**
       * Properties of a ShardNames.
       * @memberof pyth_lazer_transaction.ShardFilter
       * @interface IShardNames
       * @property {Array.<string>|null} [shardNames] ShardNames shardNames
       */

      /**
       * Constructs a new ShardNames.
       * @memberof pyth_lazer_transaction.ShardFilter
       * @classdesc Represents a ShardNames.
       * @implements IShardNames
       * @constructor
       * @param {pyth_lazer_transaction.ShardFilter.IShardNames=} [properties] Properties to set
       */
      function ShardNames(properties) {
        this.shardNames = [];
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * ShardNames shardNames.
       * @member {Array.<string>} shardNames
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @instance
       */
      ShardNames.prototype.shardNames = $util.emptyArray;

      /**
       * Creates a new ShardNames instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardNames=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.ShardFilter.ShardNames} ShardNames instance
       */
      ShardNames.create = function create(properties) {
        return new ShardNames(properties);
      };

      /**
       * Encodes the specified ShardNames message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardNames.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardNames} message ShardNames message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      ShardNames.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (message.shardNames != null && message.shardNames.length)
          for (var i = 0; i < message.shardNames.length; ++i)
            writer
              .uint32(/* id 1, wireType 2 =*/ 10)
              .string(message.shardNames[i]);
        return writer;
      };

      /**
       * Encodes the specified ShardNames message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardNames.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardNames} message ShardNames message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      ShardNames.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a ShardNames message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.ShardFilter.ShardNames} ShardNames
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      ShardNames.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.pyth_lazer_transaction.ShardFilter.ShardNames();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              if (!(message.shardNames && message.shardNames.length))
                message.shardNames = [];
              message.shardNames.push(reader.string());
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
       * Decodes a ShardNames message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.ShardFilter.ShardNames} ShardNames
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      ShardNames.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a ShardNames message.
       * @function verify
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      ShardNames.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (
          message.shardNames != null &&
          message.hasOwnProperty("shardNames")
        ) {
          if (!Array.isArray(message.shardNames))
            return "shardNames: array expected";
          for (var i = 0; i < message.shardNames.length; ++i)
            if (!$util.isString(message.shardNames[i]))
              return "shardNames: string[] expected";
        }
        return null;
      };

      /**
       * Creates a ShardNames message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.ShardFilter.ShardNames} ShardNames
       */
      ShardNames.fromObject = function fromObject(object) {
        if (
          object instanceof $root.pyth_lazer_transaction.ShardFilter.ShardNames
        )
          return object;
        var message = new $root.pyth_lazer_transaction.ShardFilter.ShardNames();
        if (object.shardNames) {
          if (!Array.isArray(object.shardNames))
            throw TypeError(
              ".pyth_lazer_transaction.ShardFilter.ShardNames.shardNames: array expected",
            );
          message.shardNames = [];
          for (var i = 0; i < object.shardNames.length; ++i)
            message.shardNames[i] = String(object.shardNames[i]);
        }
        return message;
      };

      /**
       * Creates a plain object from a ShardNames message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.ShardNames} message ShardNames
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      ShardNames.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.arrays || options.defaults) object.shardNames = [];
        if (message.shardNames && message.shardNames.length) {
          object.shardNames = [];
          for (var j = 0; j < message.shardNames.length; ++j)
            object.shardNames[j] = message.shardNames[j];
        }
        return object;
      };

      /**
       * Converts this ShardNames to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      ShardNames.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for ShardNames
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.ShardFilter.ShardNames
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      ShardNames.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/pyth_lazer_transaction.ShardFilter.ShardNames";
      };

      return ShardNames;
    })();

    ShardFilter.ShardGroups = (function () {
      /**
       * Properties of a ShardGroups.
       * @memberof pyth_lazer_transaction.ShardFilter
       * @interface IShardGroups
       * @property {Array.<string>|null} [shardGroups] ShardGroups shardGroups
       */

      /**
       * Constructs a new ShardGroups.
       * @memberof pyth_lazer_transaction.ShardFilter
       * @classdesc Represents a ShardGroups.
       * @implements IShardGroups
       * @constructor
       * @param {pyth_lazer_transaction.ShardFilter.IShardGroups=} [properties] Properties to set
       */
      function ShardGroups(properties) {
        this.shardGroups = [];
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * ShardGroups shardGroups.
       * @member {Array.<string>} shardGroups
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @instance
       */
      ShardGroups.prototype.shardGroups = $util.emptyArray;

      /**
       * Creates a new ShardGroups instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardGroups=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.ShardFilter.ShardGroups} ShardGroups instance
       */
      ShardGroups.create = function create(properties) {
        return new ShardGroups(properties);
      };

      /**
       * Encodes the specified ShardGroups message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardGroups.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardGroups} message ShardGroups message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      ShardGroups.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (message.shardGroups != null && message.shardGroups.length)
          for (var i = 0; i < message.shardGroups.length; ++i)
            writer
              .uint32(/* id 1, wireType 2 =*/ 10)
              .string(message.shardGroups[i]);
        return writer;
      };

      /**
       * Encodes the specified ShardGroups message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardGroups.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.IShardGroups} message ShardGroups message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      ShardGroups.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a ShardGroups message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.ShardFilter.ShardGroups} ShardGroups
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      ShardGroups.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.pyth_lazer_transaction.ShardFilter.ShardGroups();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              if (!(message.shardGroups && message.shardGroups.length))
                message.shardGroups = [];
              message.shardGroups.push(reader.string());
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
       * Decodes a ShardGroups message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.ShardFilter.ShardGroups} ShardGroups
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      ShardGroups.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a ShardGroups message.
       * @function verify
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      ShardGroups.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (
          message.shardGroups != null &&
          message.hasOwnProperty("shardGroups")
        ) {
          if (!Array.isArray(message.shardGroups))
            return "shardGroups: array expected";
          for (var i = 0; i < message.shardGroups.length; ++i)
            if (!$util.isString(message.shardGroups[i]))
              return "shardGroups: string[] expected";
        }
        return null;
      };

      /**
       * Creates a ShardGroups message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.ShardFilter.ShardGroups} ShardGroups
       */
      ShardGroups.fromObject = function fromObject(object) {
        if (
          object instanceof $root.pyth_lazer_transaction.ShardFilter.ShardGroups
        )
          return object;
        var message =
          new $root.pyth_lazer_transaction.ShardFilter.ShardGroups();
        if (object.shardGroups) {
          if (!Array.isArray(object.shardGroups))
            throw TypeError(
              ".pyth_lazer_transaction.ShardFilter.ShardGroups.shardGroups: array expected",
            );
          message.shardGroups = [];
          for (var i = 0; i < object.shardGroups.length; ++i)
            message.shardGroups[i] = String(object.shardGroups[i]);
        }
        return message;
      };

      /**
       * Creates a plain object from a ShardGroups message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {pyth_lazer_transaction.ShardFilter.ShardGroups} message ShardGroups
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      ShardGroups.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.arrays || options.defaults) object.shardGroups = [];
        if (message.shardGroups && message.shardGroups.length) {
          object.shardGroups = [];
          for (var j = 0; j < message.shardGroups.length; ++j)
            object.shardGroups[j] = message.shardGroups[j];
        }
        return object;
      };

      /**
       * Converts this ShardGroups to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      ShardGroups.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for ShardGroups
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.ShardFilter.ShardGroups
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      ShardGroups.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return (
          typeUrlPrefix + "/pyth_lazer_transaction.ShardFilter.ShardGroups"
        );
      };

      return ShardGroups;
    })();

    return ShardFilter;
  })();

  pyth_lazer_transaction.GovernanceDirective = (function () {
    /**
     * Properties of a GovernanceDirective.
     * @memberof pyth_lazer_transaction
     * @interface IGovernanceDirective
     * @property {pyth_lazer_transaction.IShardFilter|null} [shardFilter] GovernanceDirective shardFilter
     * @property {pyth_lazer_transaction.ICreateShard|null} [createShard] GovernanceDirective createShard
     * @property {pyth_lazer_transaction.IAddGovernanceSource|null} [addGovernanceSource] GovernanceDirective addGovernanceSource
     * @property {pyth_lazer_transaction.IUpdateGovernanceSource|null} [updateGovernanceSource] GovernanceDirective updateGovernanceSource
     * @property {pyth_lazer_transaction.ISetShardName|null} [setShardName] GovernanceDirective setShardName
     * @property {pyth_lazer_transaction.ISetShardGroup|null} [setShardGroup] GovernanceDirective setShardGroup
     * @property {pyth_lazer_transaction.IResetLastSequenceNo|null} [resetLastSequenceNo] GovernanceDirective resetLastSequenceNo
     * @property {pyth_lazer_transaction.IAddPublisher|null} [addPublisher] GovernanceDirective addPublisher
     * @property {pyth_lazer_transaction.IUpdatePublisher|null} [updatePublisher] GovernanceDirective updatePublisher
     * @property {pyth_lazer_transaction.IAddFeed|null} [addFeed] GovernanceDirective addFeed
     * @property {pyth_lazer_transaction.IUpdateFeed|null} [updateFeed] GovernanceDirective updateFeed
     */

    /**
     * Constructs a new GovernanceDirective.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a GovernanceDirective.
     * @implements IGovernanceDirective
     * @constructor
     * @param {pyth_lazer_transaction.IGovernanceDirective=} [properties] Properties to set
     */
    function GovernanceDirective(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GovernanceDirective shardFilter.
     * @member {pyth_lazer_transaction.IShardFilter|null|undefined} shardFilter
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.shardFilter = null;

    /**
     * GovernanceDirective createShard.
     * @member {pyth_lazer_transaction.ICreateShard|null|undefined} createShard
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.createShard = null;

    /**
     * GovernanceDirective addGovernanceSource.
     * @member {pyth_lazer_transaction.IAddGovernanceSource|null|undefined} addGovernanceSource
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.addGovernanceSource = null;

    /**
     * GovernanceDirective updateGovernanceSource.
     * @member {pyth_lazer_transaction.IUpdateGovernanceSource|null|undefined} updateGovernanceSource
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.updateGovernanceSource = null;

    /**
     * GovernanceDirective setShardName.
     * @member {pyth_lazer_transaction.ISetShardName|null|undefined} setShardName
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.setShardName = null;

    /**
     * GovernanceDirective setShardGroup.
     * @member {pyth_lazer_transaction.ISetShardGroup|null|undefined} setShardGroup
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.setShardGroup = null;

    /**
     * GovernanceDirective resetLastSequenceNo.
     * @member {pyth_lazer_transaction.IResetLastSequenceNo|null|undefined} resetLastSequenceNo
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.resetLastSequenceNo = null;

    /**
     * GovernanceDirective addPublisher.
     * @member {pyth_lazer_transaction.IAddPublisher|null|undefined} addPublisher
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.addPublisher = null;

    /**
     * GovernanceDirective updatePublisher.
     * @member {pyth_lazer_transaction.IUpdatePublisher|null|undefined} updatePublisher
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.updatePublisher = null;

    /**
     * GovernanceDirective addFeed.
     * @member {pyth_lazer_transaction.IAddFeed|null|undefined} addFeed
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.addFeed = null;

    /**
     * GovernanceDirective updateFeed.
     * @member {pyth_lazer_transaction.IUpdateFeed|null|undefined} updateFeed
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    GovernanceDirective.prototype.updateFeed = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * GovernanceDirective _shardFilter.
     * @member {"shardFilter"|undefined} _shardFilter
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    Object.defineProperty(GovernanceDirective.prototype, "_shardFilter", {
      get: $util.oneOfGetter(($oneOfFields = ["shardFilter"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * GovernanceDirective action.
     * @member {"createShard"|"addGovernanceSource"|"updateGovernanceSource"|"setShardName"|"setShardGroup"|"resetLastSequenceNo"|"addPublisher"|"updatePublisher"|"addFeed"|"updateFeed"|undefined} action
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     */
    Object.defineProperty(GovernanceDirective.prototype, "action", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "createShard",
          "addGovernanceSource",
          "updateGovernanceSource",
          "setShardName",
          "setShardGroup",
          "resetLastSequenceNo",
          "addPublisher",
          "updatePublisher",
          "addFeed",
          "updateFeed",
        ]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new GovernanceDirective instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {pyth_lazer_transaction.IGovernanceDirective=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.GovernanceDirective} GovernanceDirective instance
     */
    GovernanceDirective.create = function create(properties) {
      return new GovernanceDirective(properties);
    };

    /**
     * Encodes the specified GovernanceDirective message. Does not implicitly {@link pyth_lazer_transaction.GovernanceDirective.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {pyth_lazer_transaction.IGovernanceDirective} message GovernanceDirective message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceDirective.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.shardFilter != null &&
        Object.hasOwnProperty.call(message, "shardFilter")
      )
        $root.pyth_lazer_transaction.ShardFilter.encode(
          message.shardFilter,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.createShard != null &&
        Object.hasOwnProperty.call(message, "createShard")
      )
        $root.pyth_lazer_transaction.CreateShard.encode(
          message.createShard,
          writer.uint32(/* id 101, wireType 2 =*/ 810).fork(),
        ).ldelim();
      if (
        message.addGovernanceSource != null &&
        Object.hasOwnProperty.call(message, "addGovernanceSource")
      )
        $root.pyth_lazer_transaction.AddGovernanceSource.encode(
          message.addGovernanceSource,
          writer.uint32(/* id 102, wireType 2 =*/ 818).fork(),
        ).ldelim();
      if (
        message.updateGovernanceSource != null &&
        Object.hasOwnProperty.call(message, "updateGovernanceSource")
      )
        $root.pyth_lazer_transaction.UpdateGovernanceSource.encode(
          message.updateGovernanceSource,
          writer.uint32(/* id 103, wireType 2 =*/ 826).fork(),
        ).ldelim();
      if (
        message.setShardName != null &&
        Object.hasOwnProperty.call(message, "setShardName")
      )
        $root.pyth_lazer_transaction.SetShardName.encode(
          message.setShardName,
          writer.uint32(/* id 104, wireType 2 =*/ 834).fork(),
        ).ldelim();
      if (
        message.setShardGroup != null &&
        Object.hasOwnProperty.call(message, "setShardGroup")
      )
        $root.pyth_lazer_transaction.SetShardGroup.encode(
          message.setShardGroup,
          writer.uint32(/* id 105, wireType 2 =*/ 842).fork(),
        ).ldelim();
      if (
        message.resetLastSequenceNo != null &&
        Object.hasOwnProperty.call(message, "resetLastSequenceNo")
      )
        $root.pyth_lazer_transaction.ResetLastSequenceNo.encode(
          message.resetLastSequenceNo,
          writer.uint32(/* id 106, wireType 2 =*/ 850).fork(),
        ).ldelim();
      if (
        message.addPublisher != null &&
        Object.hasOwnProperty.call(message, "addPublisher")
      )
        $root.pyth_lazer_transaction.AddPublisher.encode(
          message.addPublisher,
          writer.uint32(/* id 107, wireType 2 =*/ 858).fork(),
        ).ldelim();
      if (
        message.updatePublisher != null &&
        Object.hasOwnProperty.call(message, "updatePublisher")
      )
        $root.pyth_lazer_transaction.UpdatePublisher.encode(
          message.updatePublisher,
          writer.uint32(/* id 108, wireType 2 =*/ 866).fork(),
        ).ldelim();
      if (
        message.addFeed != null &&
        Object.hasOwnProperty.call(message, "addFeed")
      )
        $root.pyth_lazer_transaction.AddFeed.encode(
          message.addFeed,
          writer.uint32(/* id 109, wireType 2 =*/ 874).fork(),
        ).ldelim();
      if (
        message.updateFeed != null &&
        Object.hasOwnProperty.call(message, "updateFeed")
      )
        $root.pyth_lazer_transaction.UpdateFeed.encode(
          message.updateFeed,
          writer.uint32(/* id 110, wireType 2 =*/ 882).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GovernanceDirective message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceDirective.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {pyth_lazer_transaction.IGovernanceDirective} message GovernanceDirective message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceDirective.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GovernanceDirective message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.GovernanceDirective} GovernanceDirective
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceDirective.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.GovernanceDirective();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.shardFilter =
              $root.pyth_lazer_transaction.ShardFilter.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 101: {
            message.createShard =
              $root.pyth_lazer_transaction.CreateShard.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 102: {
            message.addGovernanceSource =
              $root.pyth_lazer_transaction.AddGovernanceSource.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 103: {
            message.updateGovernanceSource =
              $root.pyth_lazer_transaction.UpdateGovernanceSource.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 104: {
            message.setShardName =
              $root.pyth_lazer_transaction.SetShardName.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 105: {
            message.setShardGroup =
              $root.pyth_lazer_transaction.SetShardGroup.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 106: {
            message.resetLastSequenceNo =
              $root.pyth_lazer_transaction.ResetLastSequenceNo.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 107: {
            message.addPublisher =
              $root.pyth_lazer_transaction.AddPublisher.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 108: {
            message.updatePublisher =
              $root.pyth_lazer_transaction.UpdatePublisher.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 109: {
            message.addFeed = $root.pyth_lazer_transaction.AddFeed.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 110: {
            message.updateFeed = $root.pyth_lazer_transaction.UpdateFeed.decode(
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
     * Decodes a GovernanceDirective message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.GovernanceDirective} GovernanceDirective
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceDirective.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GovernanceDirective message.
     * @function verify
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GovernanceDirective.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.shardFilter != null &&
        message.hasOwnProperty("shardFilter")
      ) {
        properties._shardFilter = 1;
        {
          var error = $root.pyth_lazer_transaction.ShardFilter.verify(
            message.shardFilter,
          );
          if (error) return "shardFilter." + error;
        }
      }
      if (
        message.createShard != null &&
        message.hasOwnProperty("createShard")
      ) {
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.CreateShard.verify(
            message.createShard,
          );
          if (error) return "createShard." + error;
        }
      }
      if (
        message.addGovernanceSource != null &&
        message.hasOwnProperty("addGovernanceSource")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.AddGovernanceSource.verify(
            message.addGovernanceSource,
          );
          if (error) return "addGovernanceSource." + error;
        }
      }
      if (
        message.updateGovernanceSource != null &&
        message.hasOwnProperty("updateGovernanceSource")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error =
            $root.pyth_lazer_transaction.UpdateGovernanceSource.verify(
              message.updateGovernanceSource,
            );
          if (error) return "updateGovernanceSource." + error;
        }
      }
      if (
        message.setShardName != null &&
        message.hasOwnProperty("setShardName")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.SetShardName.verify(
            message.setShardName,
          );
          if (error) return "setShardName." + error;
        }
      }
      if (
        message.setShardGroup != null &&
        message.hasOwnProperty("setShardGroup")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.SetShardGroup.verify(
            message.setShardGroup,
          );
          if (error) return "setShardGroup." + error;
        }
      }
      if (
        message.resetLastSequenceNo != null &&
        message.hasOwnProperty("resetLastSequenceNo")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.ResetLastSequenceNo.verify(
            message.resetLastSequenceNo,
          );
          if (error) return "resetLastSequenceNo." + error;
        }
      }
      if (
        message.addPublisher != null &&
        message.hasOwnProperty("addPublisher")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.AddPublisher.verify(
            message.addPublisher,
          );
          if (error) return "addPublisher." + error;
        }
      }
      if (
        message.updatePublisher != null &&
        message.hasOwnProperty("updatePublisher")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.UpdatePublisher.verify(
            message.updatePublisher,
          );
          if (error) return "updatePublisher." + error;
        }
      }
      if (message.addFeed != null && message.hasOwnProperty("addFeed")) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.AddFeed.verify(
            message.addFeed,
          );
          if (error) return "addFeed." + error;
        }
      }
      if (message.updateFeed != null && message.hasOwnProperty("updateFeed")) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.UpdateFeed.verify(
            message.updateFeed,
          );
          if (error) return "updateFeed." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GovernanceDirective message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.GovernanceDirective} GovernanceDirective
     */
    GovernanceDirective.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.GovernanceDirective)
        return object;
      var message = new $root.pyth_lazer_transaction.GovernanceDirective();
      if (object.shardFilter != null) {
        if (typeof object.shardFilter !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.shardFilter: object expected",
          );
        message.shardFilter =
          $root.pyth_lazer_transaction.ShardFilter.fromObject(
            object.shardFilter,
          );
      }
      if (object.createShard != null) {
        if (typeof object.createShard !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.createShard: object expected",
          );
        message.createShard =
          $root.pyth_lazer_transaction.CreateShard.fromObject(
            object.createShard,
          );
      }
      if (object.addGovernanceSource != null) {
        if (typeof object.addGovernanceSource !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.addGovernanceSource: object expected",
          );
        message.addGovernanceSource =
          $root.pyth_lazer_transaction.AddGovernanceSource.fromObject(
            object.addGovernanceSource,
          );
      }
      if (object.updateGovernanceSource != null) {
        if (typeof object.updateGovernanceSource !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.updateGovernanceSource: object expected",
          );
        message.updateGovernanceSource =
          $root.pyth_lazer_transaction.UpdateGovernanceSource.fromObject(
            object.updateGovernanceSource,
          );
      }
      if (object.setShardName != null) {
        if (typeof object.setShardName !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.setShardName: object expected",
          );
        message.setShardName =
          $root.pyth_lazer_transaction.SetShardName.fromObject(
            object.setShardName,
          );
      }
      if (object.setShardGroup != null) {
        if (typeof object.setShardGroup !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.setShardGroup: object expected",
          );
        message.setShardGroup =
          $root.pyth_lazer_transaction.SetShardGroup.fromObject(
            object.setShardGroup,
          );
      }
      if (object.resetLastSequenceNo != null) {
        if (typeof object.resetLastSequenceNo !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.resetLastSequenceNo: object expected",
          );
        message.resetLastSequenceNo =
          $root.pyth_lazer_transaction.ResetLastSequenceNo.fromObject(
            object.resetLastSequenceNo,
          );
      }
      if (object.addPublisher != null) {
        if (typeof object.addPublisher !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.addPublisher: object expected",
          );
        message.addPublisher =
          $root.pyth_lazer_transaction.AddPublisher.fromObject(
            object.addPublisher,
          );
      }
      if (object.updatePublisher != null) {
        if (typeof object.updatePublisher !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.updatePublisher: object expected",
          );
        message.updatePublisher =
          $root.pyth_lazer_transaction.UpdatePublisher.fromObject(
            object.updatePublisher,
          );
      }
      if (object.addFeed != null) {
        if (typeof object.addFeed !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.addFeed: object expected",
          );
        message.addFeed = $root.pyth_lazer_transaction.AddFeed.fromObject(
          object.addFeed,
        );
      }
      if (object.updateFeed != null) {
        if (typeof object.updateFeed !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceDirective.updateFeed: object expected",
          );
        message.updateFeed = $root.pyth_lazer_transaction.UpdateFeed.fromObject(
          object.updateFeed,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a GovernanceDirective message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {pyth_lazer_transaction.GovernanceDirective} message GovernanceDirective
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GovernanceDirective.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.shardFilter != null &&
        message.hasOwnProperty("shardFilter")
      ) {
        object.shardFilter = $root.pyth_lazer_transaction.ShardFilter.toObject(
          message.shardFilter,
          options,
        );
        if (options.oneofs) object._shardFilter = "shardFilter";
      }
      if (
        message.createShard != null &&
        message.hasOwnProperty("createShard")
      ) {
        object.createShard = $root.pyth_lazer_transaction.CreateShard.toObject(
          message.createShard,
          options,
        );
        if (options.oneofs) object.action = "createShard";
      }
      if (
        message.addGovernanceSource != null &&
        message.hasOwnProperty("addGovernanceSource")
      ) {
        object.addGovernanceSource =
          $root.pyth_lazer_transaction.AddGovernanceSource.toObject(
            message.addGovernanceSource,
            options,
          );
        if (options.oneofs) object.action = "addGovernanceSource";
      }
      if (
        message.updateGovernanceSource != null &&
        message.hasOwnProperty("updateGovernanceSource")
      ) {
        object.updateGovernanceSource =
          $root.pyth_lazer_transaction.UpdateGovernanceSource.toObject(
            message.updateGovernanceSource,
            options,
          );
        if (options.oneofs) object.action = "updateGovernanceSource";
      }
      if (
        message.setShardName != null &&
        message.hasOwnProperty("setShardName")
      ) {
        object.setShardName =
          $root.pyth_lazer_transaction.SetShardName.toObject(
            message.setShardName,
            options,
          );
        if (options.oneofs) object.action = "setShardName";
      }
      if (
        message.setShardGroup != null &&
        message.hasOwnProperty("setShardGroup")
      ) {
        object.setShardGroup =
          $root.pyth_lazer_transaction.SetShardGroup.toObject(
            message.setShardGroup,
            options,
          );
        if (options.oneofs) object.action = "setShardGroup";
      }
      if (
        message.resetLastSequenceNo != null &&
        message.hasOwnProperty("resetLastSequenceNo")
      ) {
        object.resetLastSequenceNo =
          $root.pyth_lazer_transaction.ResetLastSequenceNo.toObject(
            message.resetLastSequenceNo,
            options,
          );
        if (options.oneofs) object.action = "resetLastSequenceNo";
      }
      if (
        message.addPublisher != null &&
        message.hasOwnProperty("addPublisher")
      ) {
        object.addPublisher =
          $root.pyth_lazer_transaction.AddPublisher.toObject(
            message.addPublisher,
            options,
          );
        if (options.oneofs) object.action = "addPublisher";
      }
      if (
        message.updatePublisher != null &&
        message.hasOwnProperty("updatePublisher")
      ) {
        object.updatePublisher =
          $root.pyth_lazer_transaction.UpdatePublisher.toObject(
            message.updatePublisher,
            options,
          );
        if (options.oneofs) object.action = "updatePublisher";
      }
      if (message.addFeed != null && message.hasOwnProperty("addFeed")) {
        object.addFeed = $root.pyth_lazer_transaction.AddFeed.toObject(
          message.addFeed,
          options,
        );
        if (options.oneofs) object.action = "addFeed";
      }
      if (message.updateFeed != null && message.hasOwnProperty("updateFeed")) {
        object.updateFeed = $root.pyth_lazer_transaction.UpdateFeed.toObject(
          message.updateFeed,
          options,
        );
        if (options.oneofs) object.action = "updateFeed";
      }
      return object;
    };

    /**
     * Converts this GovernanceDirective to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GovernanceDirective.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GovernanceDirective
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.GovernanceDirective
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GovernanceDirective.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.GovernanceDirective";
    };

    return GovernanceDirective;
  })();

  pyth_lazer_transaction.Permissions = (function () {
    /**
     * Properties of a Permissions.
     * @memberof pyth_lazer_transaction
     * @interface IPermissions
     * @property {boolean|null} [allActions] Permissions allActions
     * @property {Array.<pyth_lazer_transaction.Permissions.ShardAction>|null} [shardActions] Permissions shardActions
     * @property {boolean|null} [allUpdateGovernanceSourceActions] Permissions allUpdateGovernanceSourceActions
     * @property {Array.<pyth_lazer_transaction.Permissions.UpdateGovernanceSourceAction>|null} [updateGovernanceSourceActions] Permissions updateGovernanceSourceActions
     * @property {boolean|null} [allUpdatePublisherAction] Permissions allUpdatePublisherAction
     * @property {Array.<pyth_lazer_transaction.Permissions.UpdatePublisherAction>|null} [updatePublisherActions] Permissions updatePublisherActions
     * @property {boolean|null} [allUpdateFeedActions] Permissions allUpdateFeedActions
     * @property {Array.<pyth_lazer_transaction.Permissions.UpdateFeedAction>|null} [updateFeedActions] Permissions updateFeedActions
     */

    /**
     * Constructs a new Permissions.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a Permissions.
     * @implements IPermissions
     * @constructor
     * @param {pyth_lazer_transaction.IPermissions=} [properties] Properties to set
     */
    function Permissions(properties) {
      this.shardActions = [];
      this.updateGovernanceSourceActions = [];
      this.updatePublisherActions = [];
      this.updateFeedActions = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Permissions allActions.
     * @member {boolean|null|undefined} allActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.allActions = null;

    /**
     * Permissions shardActions.
     * @member {Array.<pyth_lazer_transaction.Permissions.ShardAction>} shardActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.shardActions = $util.emptyArray;

    /**
     * Permissions allUpdateGovernanceSourceActions.
     * @member {boolean|null|undefined} allUpdateGovernanceSourceActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.allUpdateGovernanceSourceActions = null;

    /**
     * Permissions updateGovernanceSourceActions.
     * @member {Array.<pyth_lazer_transaction.Permissions.UpdateGovernanceSourceAction>} updateGovernanceSourceActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.updateGovernanceSourceActions = $util.emptyArray;

    /**
     * Permissions allUpdatePublisherAction.
     * @member {boolean|null|undefined} allUpdatePublisherAction
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.allUpdatePublisherAction = null;

    /**
     * Permissions updatePublisherActions.
     * @member {Array.<pyth_lazer_transaction.Permissions.UpdatePublisherAction>} updatePublisherActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.updatePublisherActions = $util.emptyArray;

    /**
     * Permissions allUpdateFeedActions.
     * @member {boolean|null|undefined} allUpdateFeedActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.allUpdateFeedActions = null;

    /**
     * Permissions updateFeedActions.
     * @member {Array.<pyth_lazer_transaction.Permissions.UpdateFeedAction>} updateFeedActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Permissions.prototype.updateFeedActions = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * Permissions _allActions.
     * @member {"allActions"|undefined} _allActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Object.defineProperty(Permissions.prototype, "_allActions", {
      get: $util.oneOfGetter(($oneOfFields = ["allActions"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Permissions _allUpdateGovernanceSourceActions.
     * @member {"allUpdateGovernanceSourceActions"|undefined} _allUpdateGovernanceSourceActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Object.defineProperty(
      Permissions.prototype,
      "_allUpdateGovernanceSourceActions",
      {
        get: $util.oneOfGetter(
          ($oneOfFields = ["allUpdateGovernanceSourceActions"]),
        ),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * Permissions _allUpdatePublisherAction.
     * @member {"allUpdatePublisherAction"|undefined} _allUpdatePublisherAction
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Object.defineProperty(Permissions.prototype, "_allUpdatePublisherAction", {
      get: $util.oneOfGetter(($oneOfFields = ["allUpdatePublisherAction"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Permissions _allUpdateFeedActions.
     * @member {"allUpdateFeedActions"|undefined} _allUpdateFeedActions
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     */
    Object.defineProperty(Permissions.prototype, "_allUpdateFeedActions", {
      get: $util.oneOfGetter(($oneOfFields = ["allUpdateFeedActions"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new Permissions instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {pyth_lazer_transaction.IPermissions=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.Permissions} Permissions instance
     */
    Permissions.create = function create(properties) {
      return new Permissions(properties);
    };

    /**
     * Encodes the specified Permissions message. Does not implicitly {@link pyth_lazer_transaction.Permissions.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {pyth_lazer_transaction.IPermissions} message Permissions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Permissions.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.allActions != null &&
        Object.hasOwnProperty.call(message, "allActions")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).bool(message.allActions);
      if (message.shardActions != null && message.shardActions.length) {
        writer.uint32(/* id 2, wireType 2 =*/ 18).fork();
        for (var i = 0; i < message.shardActions.length; ++i)
          writer.int32(message.shardActions[i]);
        writer.ldelim();
      }
      if (
        message.allUpdateGovernanceSourceActions != null &&
        Object.hasOwnProperty.call(message, "allUpdateGovernanceSourceActions")
      )
        writer
          .uint32(/* id 3, wireType 0 =*/ 24)
          .bool(message.allUpdateGovernanceSourceActions);
      if (
        message.updateGovernanceSourceActions != null &&
        message.updateGovernanceSourceActions.length
      ) {
        writer.uint32(/* id 4, wireType 2 =*/ 34).fork();
        for (var i = 0; i < message.updateGovernanceSourceActions.length; ++i)
          writer.int32(message.updateGovernanceSourceActions[i]);
        writer.ldelim();
      }
      if (
        message.allUpdatePublisherAction != null &&
        Object.hasOwnProperty.call(message, "allUpdatePublisherAction")
      )
        writer
          .uint32(/* id 5, wireType 0 =*/ 40)
          .bool(message.allUpdatePublisherAction);
      if (
        message.updatePublisherActions != null &&
        message.updatePublisherActions.length
      ) {
        writer.uint32(/* id 6, wireType 2 =*/ 50).fork();
        for (var i = 0; i < message.updatePublisherActions.length; ++i)
          writer.int32(message.updatePublisherActions[i]);
        writer.ldelim();
      }
      if (
        message.allUpdateFeedActions != null &&
        Object.hasOwnProperty.call(message, "allUpdateFeedActions")
      )
        writer
          .uint32(/* id 7, wireType 0 =*/ 56)
          .bool(message.allUpdateFeedActions);
      if (
        message.updateFeedActions != null &&
        message.updateFeedActions.length
      ) {
        writer.uint32(/* id 8, wireType 2 =*/ 66).fork();
        for (var i = 0; i < message.updateFeedActions.length; ++i)
          writer.int32(message.updateFeedActions[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified Permissions message, length delimited. Does not implicitly {@link pyth_lazer_transaction.Permissions.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {pyth_lazer_transaction.IPermissions} message Permissions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Permissions.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Permissions message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.Permissions} Permissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Permissions.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.Permissions();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.allActions = reader.bool();
            break;
          }
          case 2: {
            if (!(message.shardActions && message.shardActions.length))
              message.shardActions = [];
            if ((tag & 7) === 2) {
              var end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2)
                message.shardActions.push(reader.int32());
            } else message.shardActions.push(reader.int32());
            break;
          }
          case 3: {
            message.allUpdateGovernanceSourceActions = reader.bool();
            break;
          }
          case 4: {
            if (
              !(
                message.updateGovernanceSourceActions &&
                message.updateGovernanceSourceActions.length
              )
            )
              message.updateGovernanceSourceActions = [];
            if ((tag & 7) === 2) {
              var end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2)
                message.updateGovernanceSourceActions.push(reader.int32());
            } else message.updateGovernanceSourceActions.push(reader.int32());
            break;
          }
          case 5: {
            message.allUpdatePublisherAction = reader.bool();
            break;
          }
          case 6: {
            if (
              !(
                message.updatePublisherActions &&
                message.updatePublisherActions.length
              )
            )
              message.updatePublisherActions = [];
            if ((tag & 7) === 2) {
              var end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2)
                message.updatePublisherActions.push(reader.int32());
            } else message.updatePublisherActions.push(reader.int32());
            break;
          }
          case 7: {
            message.allUpdateFeedActions = reader.bool();
            break;
          }
          case 8: {
            if (
              !(message.updateFeedActions && message.updateFeedActions.length)
            )
              message.updateFeedActions = [];
            if ((tag & 7) === 2) {
              var end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2)
                message.updateFeedActions.push(reader.int32());
            } else message.updateFeedActions.push(reader.int32());
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
     * Decodes a Permissions message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.Permissions} Permissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Permissions.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Permissions message.
     * @function verify
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Permissions.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.allActions != null && message.hasOwnProperty("allActions")) {
        properties._allActions = 1;
        if (typeof message.allActions !== "boolean")
          return "allActions: boolean expected";
      }
      if (
        message.shardActions != null &&
        message.hasOwnProperty("shardActions")
      ) {
        if (!Array.isArray(message.shardActions))
          return "shardActions: array expected";
        for (var i = 0; i < message.shardActions.length; ++i)
          switch (message.shardActions[i]) {
            default:
              return "shardActions: enum value[] expected";
            case 0:
            case 101:
            case 102:
            case 103:
            case 104:
            case 105:
            case 106:
            case 107:
            case 109:
              break;
          }
      }
      if (
        message.allUpdateGovernanceSourceActions != null &&
        message.hasOwnProperty("allUpdateGovernanceSourceActions")
      ) {
        properties._allUpdateGovernanceSourceActions = 1;
        if (typeof message.allUpdateGovernanceSourceActions !== "boolean")
          return "allUpdateGovernanceSourceActions: boolean expected";
      }
      if (
        message.updateGovernanceSourceActions != null &&
        message.hasOwnProperty("updateGovernanceSourceActions")
      ) {
        if (!Array.isArray(message.updateGovernanceSourceActions))
          return "updateGovernanceSourceActions: array expected";
        for (var i = 0; i < message.updateGovernanceSourceActions.length; ++i)
          switch (message.updateGovernanceSourceActions[i]) {
            default:
              return "updateGovernanceSourceActions: enum value[] expected";
            case 0:
            case 101:
            case 199:
              break;
          }
      }
      if (
        message.allUpdatePublisherAction != null &&
        message.hasOwnProperty("allUpdatePublisherAction")
      ) {
        properties._allUpdatePublisherAction = 1;
        if (typeof message.allUpdatePublisherAction !== "boolean")
          return "allUpdatePublisherAction: boolean expected";
      }
      if (
        message.updatePublisherActions != null &&
        message.hasOwnProperty("updatePublisherActions")
      ) {
        if (!Array.isArray(message.updatePublisherActions))
          return "updatePublisherActions: array expected";
        for (var i = 0; i < message.updatePublisherActions.length; ++i)
          switch (message.updatePublisherActions[i]) {
            default:
              return "updatePublisherActions: enum value[] expected";
            case 0:
            case 101:
            case 102:
            case 103:
            case 104:
            case 105:
            case 199:
              break;
          }
      }
      if (
        message.allUpdateFeedActions != null &&
        message.hasOwnProperty("allUpdateFeedActions")
      ) {
        properties._allUpdateFeedActions = 1;
        if (typeof message.allUpdateFeedActions !== "boolean")
          return "allUpdateFeedActions: boolean expected";
      }
      if (
        message.updateFeedActions != null &&
        message.hasOwnProperty("updateFeedActions")
      ) {
        if (!Array.isArray(message.updateFeedActions))
          return "updateFeedActions: array expected";
        for (var i = 0; i < message.updateFeedActions.length; ++i)
          switch (message.updateFeedActions[i]) {
            default:
              return "updateFeedActions: enum value[] expected";
            case 0:
            case 101:
            case 102:
            case 103:
            case 199:
              break;
          }
      }
      return null;
    };

    /**
     * Creates a Permissions message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.Permissions} Permissions
     */
    Permissions.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.Permissions)
        return object;
      var message = new $root.pyth_lazer_transaction.Permissions();
      if (object.allActions != null)
        message.allActions = Boolean(object.allActions);
      if (object.shardActions) {
        if (!Array.isArray(object.shardActions))
          throw TypeError(
            ".pyth_lazer_transaction.Permissions.shardActions: array expected",
          );
        message.shardActions = [];
        for (var i = 0; i < object.shardActions.length; ++i)
          switch (object.shardActions[i]) {
            default:
              if (typeof object.shardActions[i] === "number") {
                message.shardActions[i] = object.shardActions[i];
                break;
              }
            case "SHARD_ACTION_UNSPECIFIED":
            case 0:
              message.shardActions[i] = 0;
              break;
            case "CREATE_SHARD":
            case 101:
              message.shardActions[i] = 101;
              break;
            case "ADD_GOVERNANCE_SOURCE":
            case 102:
              message.shardActions[i] = 102;
              break;
            case "UPDATE_GOVERNANCE_SOURCE":
            case 103:
              message.shardActions[i] = 103;
              break;
            case "SET_SHARD_NAME":
            case 104:
              message.shardActions[i] = 104;
              break;
            case "SET_SHARD_GROUP":
            case 105:
              message.shardActions[i] = 105;
              break;
            case "RESET_LAST_SEQUENCE_NO":
            case 106:
              message.shardActions[i] = 106;
              break;
            case "ADD_PUBLISHER":
            case 107:
              message.shardActions[i] = 107;
              break;
            case "ADD_FEED":
            case 109:
              message.shardActions[i] = 109;
              break;
          }
      }
      if (object.allUpdateGovernanceSourceActions != null)
        message.allUpdateGovernanceSourceActions = Boolean(
          object.allUpdateGovernanceSourceActions,
        );
      if (object.updateGovernanceSourceActions) {
        if (!Array.isArray(object.updateGovernanceSourceActions))
          throw TypeError(
            ".pyth_lazer_transaction.Permissions.updateGovernanceSourceActions: array expected",
          );
        message.updateGovernanceSourceActions = [];
        for (var i = 0; i < object.updateGovernanceSourceActions.length; ++i)
          switch (object.updateGovernanceSourceActions[i]) {
            default:
              if (typeof object.updateGovernanceSourceActions[i] === "number") {
                message.updateGovernanceSourceActions[i] =
                  object.updateGovernanceSourceActions[i];
                break;
              }
            case "UPDATE_GOVERNANCE_SOURCE_ACTION_UNSPECIFIED":
            case 0:
              message.updateGovernanceSourceActions[i] = 0;
              break;
            case "SET_GOVERNANCE_SOURCE_PERMISSIONS":
            case 101:
              message.updateGovernanceSourceActions[i] = 101;
              break;
            case "REMOVE_GOVERNANCE_SOURCE":
            case 199:
              message.updateGovernanceSourceActions[i] = 199;
              break;
          }
      }
      if (object.allUpdatePublisherAction != null)
        message.allUpdatePublisherAction = Boolean(
          object.allUpdatePublisherAction,
        );
      if (object.updatePublisherActions) {
        if (!Array.isArray(object.updatePublisherActions))
          throw TypeError(
            ".pyth_lazer_transaction.Permissions.updatePublisherActions: array expected",
          );
        message.updatePublisherActions = [];
        for (var i = 0; i < object.updatePublisherActions.length; ++i)
          switch (object.updatePublisherActions[i]) {
            default:
              if (typeof object.updatePublisherActions[i] === "number") {
                message.updatePublisherActions[i] =
                  object.updatePublisherActions[i];
                break;
              }
            case "UPDATE_PUBLISHER_ACTION_UNSPECIFIED":
            case 0:
              message.updatePublisherActions[i] = 0;
              break;
            case "SET_PUBLISHER_NAME":
            case 101:
              message.updatePublisherActions[i] = 101;
              break;
            case "ADD_PUBLISHER_PUBLIC_KEYS":
            case 102:
              message.updatePublisherActions[i] = 102;
              break;
            case "REMOVE_PUBLISHER_PUBLIC_KEYS":
            case 103:
              message.updatePublisherActions[i] = 103;
              break;
            case "SET_PUBLISHER_PUBLIC_KEYS":
            case 104:
              message.updatePublisherActions[i] = 104;
              break;
            case "SET_PUBLISHER_ACTIVE":
            case 105:
              message.updatePublisherActions[i] = 105;
              break;
            case "REMOVE_PUBLISHER":
            case 199:
              message.updatePublisherActions[i] = 199;
              break;
          }
      }
      if (object.allUpdateFeedActions != null)
        message.allUpdateFeedActions = Boolean(object.allUpdateFeedActions);
      if (object.updateFeedActions) {
        if (!Array.isArray(object.updateFeedActions))
          throw TypeError(
            ".pyth_lazer_transaction.Permissions.updateFeedActions: array expected",
          );
        message.updateFeedActions = [];
        for (var i = 0; i < object.updateFeedActions.length; ++i)
          switch (object.updateFeedActions[i]) {
            default:
              if (typeof object.updateFeedActions[i] === "number") {
                message.updateFeedActions[i] = object.updateFeedActions[i];
                break;
              }
            case "UPDATE_FEED_ACTION_UNSPECIFIED":
            case 0:
              message.updateFeedActions[i] = 0;
              break;
            case "UPDATE_FEED_METADATA":
            case 101:
              message.updateFeedActions[i] = 101;
              break;
            case "ACTIVATE_FEED":
            case 102:
              message.updateFeedActions[i] = 102;
              break;
            case "DEACTIVATE_FEED":
            case 103:
              message.updateFeedActions[i] = 103;
              break;
            case "REMOVE_FEED":
            case 199:
              message.updateFeedActions[i] = 199;
              break;
          }
      }
      return message;
    };

    /**
     * Creates a plain object from a Permissions message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {pyth_lazer_transaction.Permissions} message Permissions
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Permissions.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) {
        object.shardActions = [];
        object.updateGovernanceSourceActions = [];
        object.updatePublisherActions = [];
        object.updateFeedActions = [];
      }
      if (message.allActions != null && message.hasOwnProperty("allActions")) {
        object.allActions = message.allActions;
        if (options.oneofs) object._allActions = "allActions";
      }
      if (message.shardActions && message.shardActions.length) {
        object.shardActions = [];
        for (var j = 0; j < message.shardActions.length; ++j)
          object.shardActions[j] =
            options.enums === String
              ? $root.pyth_lazer_transaction.Permissions.ShardAction[
                  message.shardActions[j]
                ] === undefined
                ? message.shardActions[j]
                : $root.pyth_lazer_transaction.Permissions.ShardAction[
                    message.shardActions[j]
                  ]
              : message.shardActions[j];
      }
      if (
        message.allUpdateGovernanceSourceActions != null &&
        message.hasOwnProperty("allUpdateGovernanceSourceActions")
      ) {
        object.allUpdateGovernanceSourceActions =
          message.allUpdateGovernanceSourceActions;
        if (options.oneofs)
          object._allUpdateGovernanceSourceActions =
            "allUpdateGovernanceSourceActions";
      }
      if (
        message.updateGovernanceSourceActions &&
        message.updateGovernanceSourceActions.length
      ) {
        object.updateGovernanceSourceActions = [];
        for (var j = 0; j < message.updateGovernanceSourceActions.length; ++j)
          object.updateGovernanceSourceActions[j] =
            options.enums === String
              ? $root.pyth_lazer_transaction.Permissions
                  .UpdateGovernanceSourceAction[
                  message.updateGovernanceSourceActions[j]
                ] === undefined
                ? message.updateGovernanceSourceActions[j]
                : $root.pyth_lazer_transaction.Permissions
                    .UpdateGovernanceSourceAction[
                    message.updateGovernanceSourceActions[j]
                  ]
              : message.updateGovernanceSourceActions[j];
      }
      if (
        message.allUpdatePublisherAction != null &&
        message.hasOwnProperty("allUpdatePublisherAction")
      ) {
        object.allUpdatePublisherAction = message.allUpdatePublisherAction;
        if (options.oneofs)
          object._allUpdatePublisherAction = "allUpdatePublisherAction";
      }
      if (
        message.updatePublisherActions &&
        message.updatePublisherActions.length
      ) {
        object.updatePublisherActions = [];
        for (var j = 0; j < message.updatePublisherActions.length; ++j)
          object.updatePublisherActions[j] =
            options.enums === String
              ? $root.pyth_lazer_transaction.Permissions.UpdatePublisherAction[
                  message.updatePublisherActions[j]
                ] === undefined
                ? message.updatePublisherActions[j]
                : $root.pyth_lazer_transaction.Permissions
                    .UpdatePublisherAction[message.updatePublisherActions[j]]
              : message.updatePublisherActions[j];
      }
      if (
        message.allUpdateFeedActions != null &&
        message.hasOwnProperty("allUpdateFeedActions")
      ) {
        object.allUpdateFeedActions = message.allUpdateFeedActions;
        if (options.oneofs)
          object._allUpdateFeedActions = "allUpdateFeedActions";
      }
      if (message.updateFeedActions && message.updateFeedActions.length) {
        object.updateFeedActions = [];
        for (var j = 0; j < message.updateFeedActions.length; ++j)
          object.updateFeedActions[j] =
            options.enums === String
              ? $root.pyth_lazer_transaction.Permissions.UpdateFeedAction[
                  message.updateFeedActions[j]
                ] === undefined
                ? message.updateFeedActions[j]
                : $root.pyth_lazer_transaction.Permissions.UpdateFeedAction[
                    message.updateFeedActions[j]
                  ]
              : message.updateFeedActions[j];
      }
      return object;
    };

    /**
     * Converts this Permissions to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.Permissions
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Permissions.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Permissions
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.Permissions
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Permissions.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.Permissions";
    };

    /**
     * ShardAction enum.
     * @name pyth_lazer_transaction.Permissions.ShardAction
     * @enum {number}
     * @property {number} SHARD_ACTION_UNSPECIFIED=0 SHARD_ACTION_UNSPECIFIED value
     * @property {number} CREATE_SHARD=101 CREATE_SHARD value
     * @property {number} ADD_GOVERNANCE_SOURCE=102 ADD_GOVERNANCE_SOURCE value
     * @property {number} UPDATE_GOVERNANCE_SOURCE=103 UPDATE_GOVERNANCE_SOURCE value
     * @property {number} SET_SHARD_NAME=104 SET_SHARD_NAME value
     * @property {number} SET_SHARD_GROUP=105 SET_SHARD_GROUP value
     * @property {number} RESET_LAST_SEQUENCE_NO=106 RESET_LAST_SEQUENCE_NO value
     * @property {number} ADD_PUBLISHER=107 ADD_PUBLISHER value
     * @property {number} ADD_FEED=109 ADD_FEED value
     */
    Permissions.ShardAction = (function () {
      var valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "SHARD_ACTION_UNSPECIFIED")] = 0;
      values[(valuesById[101] = "CREATE_SHARD")] = 101;
      values[(valuesById[102] = "ADD_GOVERNANCE_SOURCE")] = 102;
      values[(valuesById[103] = "UPDATE_GOVERNANCE_SOURCE")] = 103;
      values[(valuesById[104] = "SET_SHARD_NAME")] = 104;
      values[(valuesById[105] = "SET_SHARD_GROUP")] = 105;
      values[(valuesById[106] = "RESET_LAST_SEQUENCE_NO")] = 106;
      values[(valuesById[107] = "ADD_PUBLISHER")] = 107;
      values[(valuesById[109] = "ADD_FEED")] = 109;
      return values;
    })();

    /**
     * UpdateGovernanceSourceAction enum.
     * @name pyth_lazer_transaction.Permissions.UpdateGovernanceSourceAction
     * @enum {number}
     * @property {number} UPDATE_GOVERNANCE_SOURCE_ACTION_UNSPECIFIED=0 UPDATE_GOVERNANCE_SOURCE_ACTION_UNSPECIFIED value
     * @property {number} SET_GOVERNANCE_SOURCE_PERMISSIONS=101 SET_GOVERNANCE_SOURCE_PERMISSIONS value
     * @property {number} REMOVE_GOVERNANCE_SOURCE=199 REMOVE_GOVERNANCE_SOURCE value
     */
    Permissions.UpdateGovernanceSourceAction = (function () {
      var valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "UPDATE_GOVERNANCE_SOURCE_ACTION_UNSPECIFIED")] =
        0;
      values[(valuesById[101] = "SET_GOVERNANCE_SOURCE_PERMISSIONS")] = 101;
      values[(valuesById[199] = "REMOVE_GOVERNANCE_SOURCE")] = 199;
      return values;
    })();

    /**
     * UpdatePublisherAction enum.
     * @name pyth_lazer_transaction.Permissions.UpdatePublisherAction
     * @enum {number}
     * @property {number} UPDATE_PUBLISHER_ACTION_UNSPECIFIED=0 UPDATE_PUBLISHER_ACTION_UNSPECIFIED value
     * @property {number} SET_PUBLISHER_NAME=101 SET_PUBLISHER_NAME value
     * @property {number} ADD_PUBLISHER_PUBLIC_KEYS=102 ADD_PUBLISHER_PUBLIC_KEYS value
     * @property {number} REMOVE_PUBLISHER_PUBLIC_KEYS=103 REMOVE_PUBLISHER_PUBLIC_KEYS value
     * @property {number} SET_PUBLISHER_PUBLIC_KEYS=104 SET_PUBLISHER_PUBLIC_KEYS value
     * @property {number} SET_PUBLISHER_ACTIVE=105 SET_PUBLISHER_ACTIVE value
     * @property {number} REMOVE_PUBLISHER=199 REMOVE_PUBLISHER value
     */
    Permissions.UpdatePublisherAction = (function () {
      var valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "UPDATE_PUBLISHER_ACTION_UNSPECIFIED")] = 0;
      values[(valuesById[101] = "SET_PUBLISHER_NAME")] = 101;
      values[(valuesById[102] = "ADD_PUBLISHER_PUBLIC_KEYS")] = 102;
      values[(valuesById[103] = "REMOVE_PUBLISHER_PUBLIC_KEYS")] = 103;
      values[(valuesById[104] = "SET_PUBLISHER_PUBLIC_KEYS")] = 104;
      values[(valuesById[105] = "SET_PUBLISHER_ACTIVE")] = 105;
      values[(valuesById[199] = "REMOVE_PUBLISHER")] = 199;
      return values;
    })();

    /**
     * UpdateFeedAction enum.
     * @name pyth_lazer_transaction.Permissions.UpdateFeedAction
     * @enum {number}
     * @property {number} UPDATE_FEED_ACTION_UNSPECIFIED=0 UPDATE_FEED_ACTION_UNSPECIFIED value
     * @property {number} UPDATE_FEED_METADATA=101 UPDATE_FEED_METADATA value
     * @property {number} ACTIVATE_FEED=102 ACTIVATE_FEED value
     * @property {number} DEACTIVATE_FEED=103 DEACTIVATE_FEED value
     * @property {number} REMOVE_FEED=199 REMOVE_FEED value
     */
    Permissions.UpdateFeedAction = (function () {
      var valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "UPDATE_FEED_ACTION_UNSPECIFIED")] = 0;
      values[(valuesById[101] = "UPDATE_FEED_METADATA")] = 101;
      values[(valuesById[102] = "ACTIVATE_FEED")] = 102;
      values[(valuesById[103] = "DEACTIVATE_FEED")] = 103;
      values[(valuesById[199] = "REMOVE_FEED")] = 199;
      return values;
    })();

    return Permissions;
  })();

  pyth_lazer_transaction.GovernanceSource = (function () {
    /**
     * Properties of a GovernanceSource.
     * @memberof pyth_lazer_transaction
     * @interface IGovernanceSource
     * @property {pyth_lazer_transaction.GovernanceSource.ISingleEd25519|null} [singleEd25519] GovernanceSource singleEd25519
     * @property {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter|null} [wormholeEmitter] GovernanceSource wormholeEmitter
     */

    /**
     * Constructs a new GovernanceSource.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a GovernanceSource.
     * @implements IGovernanceSource
     * @constructor
     * @param {pyth_lazer_transaction.IGovernanceSource=} [properties] Properties to set
     */
    function GovernanceSource(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * GovernanceSource singleEd25519.
     * @member {pyth_lazer_transaction.GovernanceSource.ISingleEd25519|null|undefined} singleEd25519
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @instance
     */
    GovernanceSource.prototype.singleEd25519 = null;

    /**
     * GovernanceSource wormholeEmitter.
     * @member {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter|null|undefined} wormholeEmitter
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @instance
     */
    GovernanceSource.prototype.wormholeEmitter = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * GovernanceSource source.
     * @member {"singleEd25519"|"wormholeEmitter"|undefined} source
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @instance
     */
    Object.defineProperty(GovernanceSource.prototype, "source", {
      get: $util.oneOfGetter(
        ($oneOfFields = ["singleEd25519", "wormholeEmitter"]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new GovernanceSource instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IGovernanceSource=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.GovernanceSource} GovernanceSource instance
     */
    GovernanceSource.create = function create(properties) {
      return new GovernanceSource(properties);
    };

    /**
     * Encodes the specified GovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IGovernanceSource} message GovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceSource.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.singleEd25519 != null &&
        Object.hasOwnProperty.call(message, "singleEd25519")
      )
        $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519.encode(
          message.singleEd25519,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.wormholeEmitter != null &&
        Object.hasOwnProperty.call(message, "wormholeEmitter")
      )
        $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter.encode(
          message.wormholeEmitter,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified GovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IGovernanceSource} message GovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GovernanceSource.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a GovernanceSource message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.GovernanceSource} GovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceSource.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.GovernanceSource();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.singleEd25519 =
              $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 2: {
            message.wormholeEmitter =
              $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter.decode(
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
     * Decodes a GovernanceSource message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.GovernanceSource} GovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GovernanceSource.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GovernanceSource message.
     * @function verify
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GovernanceSource.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.singleEd25519 != null &&
        message.hasOwnProperty("singleEd25519")
      ) {
        properties.source = 1;
        {
          var error =
            $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519.verify(
              message.singleEd25519,
            );
          if (error) return "singleEd25519." + error;
        }
      }
      if (
        message.wormholeEmitter != null &&
        message.hasOwnProperty("wormholeEmitter")
      ) {
        if (properties.source === 1) return "source: multiple values";
        properties.source = 1;
        {
          var error =
            $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter.verify(
              message.wormholeEmitter,
            );
          if (error) return "wormholeEmitter." + error;
        }
      }
      return null;
    };

    /**
     * Creates a GovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.GovernanceSource} GovernanceSource
     */
    GovernanceSource.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.GovernanceSource)
        return object;
      var message = new $root.pyth_lazer_transaction.GovernanceSource();
      if (object.singleEd25519 != null) {
        if (typeof object.singleEd25519 !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceSource.singleEd25519: object expected",
          );
        message.singleEd25519 =
          $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519.fromObject(
            object.singleEd25519,
          );
      }
      if (object.wormholeEmitter != null) {
        if (typeof object.wormholeEmitter !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.GovernanceSource.wormholeEmitter: object expected",
          );
        message.wormholeEmitter =
          $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter.fromObject(
            object.wormholeEmitter,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from a GovernanceSource message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {pyth_lazer_transaction.GovernanceSource} message GovernanceSource
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GovernanceSource.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.singleEd25519 != null &&
        message.hasOwnProperty("singleEd25519")
      ) {
        object.singleEd25519 =
          $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519.toObject(
            message.singleEd25519,
            options,
          );
        if (options.oneofs) object.source = "singleEd25519";
      }
      if (
        message.wormholeEmitter != null &&
        message.hasOwnProperty("wormholeEmitter")
      ) {
        object.wormholeEmitter =
          $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter.toObject(
            message.wormholeEmitter,
            options,
          );
        if (options.oneofs) object.source = "wormholeEmitter";
      }
      return object;
    };

    /**
     * Converts this GovernanceSource to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GovernanceSource.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for GovernanceSource
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.GovernanceSource
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    GovernanceSource.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.GovernanceSource";
    };

    GovernanceSource.SingleEd25519 = (function () {
      /**
       * Properties of a SingleEd25519.
       * @memberof pyth_lazer_transaction.GovernanceSource
       * @interface ISingleEd25519
       * @property {Uint8Array|null} [publicKey] SingleEd25519 publicKey
       */

      /**
       * Constructs a new SingleEd25519.
       * @memberof pyth_lazer_transaction.GovernanceSource
       * @classdesc Represents a SingleEd25519.
       * @implements ISingleEd25519
       * @constructor
       * @param {pyth_lazer_transaction.GovernanceSource.ISingleEd25519=} [properties] Properties to set
       */
      function SingleEd25519(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * SingleEd25519 publicKey.
       * @member {Uint8Array|null|undefined} publicKey
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @instance
       */
      SingleEd25519.prototype.publicKey = null;

      // OneOf field names bound to virtual getters and setters
      var $oneOfFields;

      /**
       * SingleEd25519 _publicKey.
       * @member {"publicKey"|undefined} _publicKey
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @instance
       */
      Object.defineProperty(SingleEd25519.prototype, "_publicKey", {
        get: $util.oneOfGetter(($oneOfFields = ["publicKey"])),
        set: $util.oneOfSetter($oneOfFields),
      });

      /**
       * Creates a new SingleEd25519 instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.ISingleEd25519=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.GovernanceSource.SingleEd25519} SingleEd25519 instance
       */
      SingleEd25519.create = function create(properties) {
        return new SingleEd25519(properties);
      };

      /**
       * Encodes the specified SingleEd25519 message. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.SingleEd25519.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.ISingleEd25519} message SingleEd25519 message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      SingleEd25519.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (
          message.publicKey != null &&
          Object.hasOwnProperty.call(message, "publicKey")
        )
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.publicKey);
        return writer;
      };

      /**
       * Encodes the specified SingleEd25519 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.SingleEd25519.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.ISingleEd25519} message SingleEd25519 message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      SingleEd25519.encodeDelimited = function encodeDelimited(
        message,
        writer,
      ) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a SingleEd25519 message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.GovernanceSource.SingleEd25519} SingleEd25519
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      SingleEd25519.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message =
            new $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              message.publicKey = reader.bytes();
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
       * Decodes a SingleEd25519 message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.GovernanceSource.SingleEd25519} SingleEd25519
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      SingleEd25519.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a SingleEd25519 message.
       * @function verify
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      SingleEd25519.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        var properties = {};
        if (message.publicKey != null && message.hasOwnProperty("publicKey")) {
          properties._publicKey = 1;
          if (
            !(
              (message.publicKey &&
                typeof message.publicKey.length === "number") ||
              $util.isString(message.publicKey)
            )
          )
            return "publicKey: buffer expected";
        }
        return null;
      };

      /**
       * Creates a SingleEd25519 message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.GovernanceSource.SingleEd25519} SingleEd25519
       */
      SingleEd25519.fromObject = function fromObject(object) {
        if (
          object instanceof
          $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519
        )
          return object;
        var message =
          new $root.pyth_lazer_transaction.GovernanceSource.SingleEd25519();
        if (object.publicKey != null)
          if (typeof object.publicKey === "string")
            $util.base64.decode(
              object.publicKey,
              (message.publicKey = $util.newBuffer(
                $util.base64.length(object.publicKey),
              )),
              0,
            );
          else if (object.publicKey.length >= 0)
            message.publicKey = object.publicKey;
        return message;
      };

      /**
       * Creates a plain object from a SingleEd25519 message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.SingleEd25519} message SingleEd25519
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      SingleEd25519.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (message.publicKey != null && message.hasOwnProperty("publicKey")) {
          object.publicKey =
            options.bytes === String
              ? $util.base64.encode(
                  message.publicKey,
                  0,
                  message.publicKey.length,
                )
              : options.bytes === Array
                ? Array.prototype.slice.call(message.publicKey)
                : message.publicKey;
          if (options.oneofs) object._publicKey = "publicKey";
        }
        return object;
      };

      /**
       * Converts this SingleEd25519 to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      SingleEd25519.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for SingleEd25519
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.GovernanceSource.SingleEd25519
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      SingleEd25519.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return (
          typeUrlPrefix +
          "/pyth_lazer_transaction.GovernanceSource.SingleEd25519"
        );
      };

      return SingleEd25519;
    })();

    GovernanceSource.WormholeEmitter = (function () {
      /**
       * Properties of a WormholeEmitter.
       * @memberof pyth_lazer_transaction.GovernanceSource
       * @interface IWormholeEmitter
       * @property {Uint8Array|null} [address] WormholeEmitter address
       * @property {number|null} [chainId] WormholeEmitter chainId
       */

      /**
       * Constructs a new WormholeEmitter.
       * @memberof pyth_lazer_transaction.GovernanceSource
       * @classdesc Represents a WormholeEmitter.
       * @implements IWormholeEmitter
       * @constructor
       * @param {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter=} [properties] Properties to set
       */
      function WormholeEmitter(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * WormholeEmitter address.
       * @member {Uint8Array|null|undefined} address
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @instance
       */
      WormholeEmitter.prototype.address = null;

      /**
       * WormholeEmitter chainId.
       * @member {number|null|undefined} chainId
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @instance
       */
      WormholeEmitter.prototype.chainId = null;

      // OneOf field names bound to virtual getters and setters
      var $oneOfFields;

      /**
       * WormholeEmitter _address.
       * @member {"address"|undefined} _address
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @instance
       */
      Object.defineProperty(WormholeEmitter.prototype, "_address", {
        get: $util.oneOfGetter(($oneOfFields = ["address"])),
        set: $util.oneOfSetter($oneOfFields),
      });

      /**
       * WormholeEmitter _chainId.
       * @member {"chainId"|undefined} _chainId
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @instance
       */
      Object.defineProperty(WormholeEmitter.prototype, "_chainId", {
        get: $util.oneOfGetter(($oneOfFields = ["chainId"])),
        set: $util.oneOfSetter($oneOfFields),
      });

      /**
       * Creates a new WormholeEmitter instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.GovernanceSource.WormholeEmitter} WormholeEmitter instance
       */
      WormholeEmitter.create = function create(properties) {
        return new WormholeEmitter(properties);
      };

      /**
       * Encodes the specified WormholeEmitter message. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.WormholeEmitter.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter} message WormholeEmitter message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      WormholeEmitter.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (
          message.address != null &&
          Object.hasOwnProperty.call(message, "address")
        )
          writer.uint32(/* id 1, wireType 2 =*/ 10).bytes(message.address);
        if (
          message.chainId != null &&
          Object.hasOwnProperty.call(message, "chainId")
        )
          writer.uint32(/* id 2, wireType 0 =*/ 16).uint32(message.chainId);
        return writer;
      };

      /**
       * Encodes the specified WormholeEmitter message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.WormholeEmitter.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.IWormholeEmitter} message WormholeEmitter message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      WormholeEmitter.encodeDelimited = function encodeDelimited(
        message,
        writer,
      ) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a WormholeEmitter message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.GovernanceSource.WormholeEmitter} WormholeEmitter
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      WormholeEmitter.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message =
            new $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              message.address = reader.bytes();
              break;
            }
            case 2: {
              message.chainId = reader.uint32();
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
       * Decodes a WormholeEmitter message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.GovernanceSource.WormholeEmitter} WormholeEmitter
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      WormholeEmitter.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a WormholeEmitter message.
       * @function verify
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      WormholeEmitter.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        var properties = {};
        if (message.address != null && message.hasOwnProperty("address")) {
          properties._address = 1;
          if (
            !(
              (message.address && typeof message.address.length === "number") ||
              $util.isString(message.address)
            )
          )
            return "address: buffer expected";
        }
        if (message.chainId != null && message.hasOwnProperty("chainId")) {
          properties._chainId = 1;
          if (!$util.isInteger(message.chainId))
            return "chainId: integer expected";
        }
        return null;
      };

      /**
       * Creates a WormholeEmitter message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.GovernanceSource.WormholeEmitter} WormholeEmitter
       */
      WormholeEmitter.fromObject = function fromObject(object) {
        if (
          object instanceof
          $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter
        )
          return object;
        var message =
          new $root.pyth_lazer_transaction.GovernanceSource.WormholeEmitter();
        if (object.address != null)
          if (typeof object.address === "string")
            $util.base64.decode(
              object.address,
              (message.address = $util.newBuffer(
                $util.base64.length(object.address),
              )),
              0,
            );
          else if (object.address.length >= 0) message.address = object.address;
        if (object.chainId != null) message.chainId = object.chainId >>> 0;
        return message;
      };

      /**
       * Creates a plain object from a WormholeEmitter message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {pyth_lazer_transaction.GovernanceSource.WormholeEmitter} message WormholeEmitter
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      WormholeEmitter.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (message.address != null && message.hasOwnProperty("address")) {
          object.address =
            options.bytes === String
              ? $util.base64.encode(message.address, 0, message.address.length)
              : options.bytes === Array
                ? Array.prototype.slice.call(message.address)
                : message.address;
          if (options.oneofs) object._address = "address";
        }
        if (message.chainId != null && message.hasOwnProperty("chainId")) {
          object.chainId = message.chainId;
          if (options.oneofs) object._chainId = "chainId";
        }
        return object;
      };

      /**
       * Converts this WormholeEmitter to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      WormholeEmitter.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for WormholeEmitter
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.GovernanceSource.WormholeEmitter
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      WormholeEmitter.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return (
          typeUrlPrefix +
          "/pyth_lazer_transaction.GovernanceSource.WormholeEmitter"
        );
      };

      return WormholeEmitter;
    })();

    return GovernanceSource;
  })();

  pyth_lazer_transaction.CreateShard = (function () {
    /**
     * Properties of a CreateShard.
     * @memberof pyth_lazer_transaction
     * @interface ICreateShard
     * @property {number|null} [shardId] CreateShard shardId
     * @property {string|null} [shardGroup] CreateShard shardGroup
     * @property {google.protobuf.IDuration|null} [minRate] CreateShard minRate
     */

    /**
     * Constructs a new CreateShard.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a CreateShard.
     * @implements ICreateShard
     * @constructor
     * @param {pyth_lazer_transaction.ICreateShard=} [properties] Properties to set
     */
    function CreateShard(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * CreateShard shardId.
     * @member {number|null|undefined} shardId
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    CreateShard.prototype.shardId = null;

    /**
     * CreateShard shardGroup.
     * @member {string|null|undefined} shardGroup
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    CreateShard.prototype.shardGroup = null;

    /**
     * CreateShard minRate.
     * @member {google.protobuf.IDuration|null|undefined} minRate
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    CreateShard.prototype.minRate = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * CreateShard _shardId.
     * @member {"shardId"|undefined} _shardId
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    Object.defineProperty(CreateShard.prototype, "_shardId", {
      get: $util.oneOfGetter(($oneOfFields = ["shardId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * CreateShard _shardGroup.
     * @member {"shardGroup"|undefined} _shardGroup
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    Object.defineProperty(CreateShard.prototype, "_shardGroup", {
      get: $util.oneOfGetter(($oneOfFields = ["shardGroup"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * CreateShard _minRate.
     * @member {"minRate"|undefined} _minRate
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     */
    Object.defineProperty(CreateShard.prototype, "_minRate", {
      get: $util.oneOfGetter(($oneOfFields = ["minRate"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new CreateShard instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {pyth_lazer_transaction.ICreateShard=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.CreateShard} CreateShard instance
     */
    CreateShard.create = function create(properties) {
      return new CreateShard(properties);
    };

    /**
     * Encodes the specified CreateShard message. Does not implicitly {@link pyth_lazer_transaction.CreateShard.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {pyth_lazer_transaction.ICreateShard} message CreateShard message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CreateShard.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.shardId != null &&
        Object.hasOwnProperty.call(message, "shardId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.shardId);
      if (
        message.shardGroup != null &&
        Object.hasOwnProperty.call(message, "shardGroup")
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.shardGroup);
      if (
        message.minRate != null &&
        Object.hasOwnProperty.call(message, "minRate")
      )
        $root.google.protobuf.Duration.encode(
          message.minRate,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified CreateShard message, length delimited. Does not implicitly {@link pyth_lazer_transaction.CreateShard.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {pyth_lazer_transaction.ICreateShard} message CreateShard message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    CreateShard.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a CreateShard message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.CreateShard} CreateShard
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CreateShard.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.CreateShard();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.shardId = reader.uint32();
            break;
          }
          case 2: {
            message.shardGroup = reader.string();
            break;
          }
          case 3: {
            message.minRate = $root.google.protobuf.Duration.decode(
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
     * Decodes a CreateShard message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.CreateShard} CreateShard
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    CreateShard.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a CreateShard message.
     * @function verify
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    CreateShard.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.shardId != null && message.hasOwnProperty("shardId")) {
        properties._shardId = 1;
        if (!$util.isInteger(message.shardId))
          return "shardId: integer expected";
      }
      if (message.shardGroup != null && message.hasOwnProperty("shardGroup")) {
        properties._shardGroup = 1;
        if (!$util.isString(message.shardGroup))
          return "shardGroup: string expected";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        properties._minRate = 1;
        {
          var error = $root.google.protobuf.Duration.verify(message.minRate);
          if (error) return "minRate." + error;
        }
      }
      return null;
    };

    /**
     * Creates a CreateShard message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.CreateShard} CreateShard
     */
    CreateShard.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.CreateShard)
        return object;
      var message = new $root.pyth_lazer_transaction.CreateShard();
      if (object.shardId != null) message.shardId = object.shardId >>> 0;
      if (object.shardGroup != null)
        message.shardGroup = String(object.shardGroup);
      if (object.minRate != null) {
        if (typeof object.minRate !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.CreateShard.minRate: object expected",
          );
        message.minRate = $root.google.protobuf.Duration.fromObject(
          object.minRate,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a CreateShard message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {pyth_lazer_transaction.CreateShard} message CreateShard
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    CreateShard.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.shardId != null && message.hasOwnProperty("shardId")) {
        object.shardId = message.shardId;
        if (options.oneofs) object._shardId = "shardId";
      }
      if (message.shardGroup != null && message.hasOwnProperty("shardGroup")) {
        object.shardGroup = message.shardGroup;
        if (options.oneofs) object._shardGroup = "shardGroup";
      }
      if (message.minRate != null && message.hasOwnProperty("minRate")) {
        object.minRate = $root.google.protobuf.Duration.toObject(
          message.minRate,
          options,
        );
        if (options.oneofs) object._minRate = "minRate";
      }
      return object;
    };

    /**
     * Converts this CreateShard to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.CreateShard
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    CreateShard.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for CreateShard
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.CreateShard
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    CreateShard.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.CreateShard";
    };

    return CreateShard;
  })();

  pyth_lazer_transaction.AddGovernanceSource = (function () {
    /**
     * Properties of an AddGovernanceSource.
     * @memberof pyth_lazer_transaction
     * @interface IAddGovernanceSource
     * @property {pyth_lazer_transaction.IGovernanceSource|null} [newSource] AddGovernanceSource newSource
     * @property {pyth_lazer_transaction.IPermissions|null} [permissions] AddGovernanceSource permissions
     */

    /**
     * Constructs a new AddGovernanceSource.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an AddGovernanceSource.
     * @implements IAddGovernanceSource
     * @constructor
     * @param {pyth_lazer_transaction.IAddGovernanceSource=} [properties] Properties to set
     */
    function AddGovernanceSource(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AddGovernanceSource newSource.
     * @member {pyth_lazer_transaction.IGovernanceSource|null|undefined} newSource
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @instance
     */
    AddGovernanceSource.prototype.newSource = null;

    /**
     * AddGovernanceSource permissions.
     * @member {pyth_lazer_transaction.IPermissions|null|undefined} permissions
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @instance
     */
    AddGovernanceSource.prototype.permissions = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * AddGovernanceSource _newSource.
     * @member {"newSource"|undefined} _newSource
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @instance
     */
    Object.defineProperty(AddGovernanceSource.prototype, "_newSource", {
      get: $util.oneOfGetter(($oneOfFields = ["newSource"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * AddGovernanceSource _permissions.
     * @member {"permissions"|undefined} _permissions
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @instance
     */
    Object.defineProperty(AddGovernanceSource.prototype, "_permissions", {
      get: $util.oneOfGetter(($oneOfFields = ["permissions"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new AddGovernanceSource instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IAddGovernanceSource=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.AddGovernanceSource} AddGovernanceSource instance
     */
    AddGovernanceSource.create = function create(properties) {
      return new AddGovernanceSource(properties);
    };

    /**
     * Encodes the specified AddGovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.AddGovernanceSource.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IAddGovernanceSource} message AddGovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddGovernanceSource.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.newSource != null &&
        Object.hasOwnProperty.call(message, "newSource")
      )
        $root.pyth_lazer_transaction.GovernanceSource.encode(
          message.newSource,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.permissions != null &&
        Object.hasOwnProperty.call(message, "permissions")
      )
        $root.pyth_lazer_transaction.Permissions.encode(
          message.permissions,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified AddGovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddGovernanceSource.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IAddGovernanceSource} message AddGovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddGovernanceSource.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AddGovernanceSource message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.AddGovernanceSource} AddGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddGovernanceSource.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.AddGovernanceSource();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.newSource =
              $root.pyth_lazer_transaction.GovernanceSource.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 2: {
            message.permissions =
              $root.pyth_lazer_transaction.Permissions.decode(
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
     * Decodes an AddGovernanceSource message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.AddGovernanceSource} AddGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddGovernanceSource.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AddGovernanceSource message.
     * @function verify
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AddGovernanceSource.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.newSource != null && message.hasOwnProperty("newSource")) {
        properties._newSource = 1;
        {
          var error = $root.pyth_lazer_transaction.GovernanceSource.verify(
            message.newSource,
          );
          if (error) return "newSource." + error;
        }
      }
      if (
        message.permissions != null &&
        message.hasOwnProperty("permissions")
      ) {
        properties._permissions = 1;
        {
          var error = $root.pyth_lazer_transaction.Permissions.verify(
            message.permissions,
          );
          if (error) return "permissions." + error;
        }
      }
      return null;
    };

    /**
     * Creates an AddGovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.AddGovernanceSource} AddGovernanceSource
     */
    AddGovernanceSource.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.AddGovernanceSource)
        return object;
      var message = new $root.pyth_lazer_transaction.AddGovernanceSource();
      if (object.newSource != null) {
        if (typeof object.newSource !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.AddGovernanceSource.newSource: object expected",
          );
        message.newSource =
          $root.pyth_lazer_transaction.GovernanceSource.fromObject(
            object.newSource,
          );
      }
      if (object.permissions != null) {
        if (typeof object.permissions !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.AddGovernanceSource.permissions: object expected",
          );
        message.permissions =
          $root.pyth_lazer_transaction.Permissions.fromObject(
            object.permissions,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from an AddGovernanceSource message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.AddGovernanceSource} message AddGovernanceSource
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AddGovernanceSource.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.newSource != null && message.hasOwnProperty("newSource")) {
        object.newSource =
          $root.pyth_lazer_transaction.GovernanceSource.toObject(
            message.newSource,
            options,
          );
        if (options.oneofs) object._newSource = "newSource";
      }
      if (
        message.permissions != null &&
        message.hasOwnProperty("permissions")
      ) {
        object.permissions = $root.pyth_lazer_transaction.Permissions.toObject(
          message.permissions,
          options,
        );
        if (options.oneofs) object._permissions = "permissions";
      }
      return object;
    };

    /**
     * Converts this AddGovernanceSource to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AddGovernanceSource.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AddGovernanceSource
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.AddGovernanceSource
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AddGovernanceSource.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.AddGovernanceSource";
    };

    return AddGovernanceSource;
  })();

  pyth_lazer_transaction.UpdateGovernanceSource = (function () {
    /**
     * Properties of an UpdateGovernanceSource.
     * @memberof pyth_lazer_transaction
     * @interface IUpdateGovernanceSource
     * @property {pyth_lazer_transaction.IGovernanceSource|null} [source] UpdateGovernanceSource source
     * @property {pyth_lazer_transaction.ISetGovernanceSourcePermissions|null} [setGovernanceSourcePermissions] UpdateGovernanceSource setGovernanceSourcePermissions
     * @property {google.protobuf.IEmpty|null} [removeGovernanceSource] UpdateGovernanceSource removeGovernanceSource
     */

    /**
     * Constructs a new UpdateGovernanceSource.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an UpdateGovernanceSource.
     * @implements IUpdateGovernanceSource
     * @constructor
     * @param {pyth_lazer_transaction.IUpdateGovernanceSource=} [properties] Properties to set
     */
    function UpdateGovernanceSource(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UpdateGovernanceSource source.
     * @member {pyth_lazer_transaction.IGovernanceSource|null|undefined} source
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     */
    UpdateGovernanceSource.prototype.source = null;

    /**
     * UpdateGovernanceSource setGovernanceSourcePermissions.
     * @member {pyth_lazer_transaction.ISetGovernanceSourcePermissions|null|undefined} setGovernanceSourcePermissions
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     */
    UpdateGovernanceSource.prototype.setGovernanceSourcePermissions = null;

    /**
     * UpdateGovernanceSource removeGovernanceSource.
     * @member {google.protobuf.IEmpty|null|undefined} removeGovernanceSource
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     */
    UpdateGovernanceSource.prototype.removeGovernanceSource = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * UpdateGovernanceSource _source.
     * @member {"source"|undefined} _source
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     */
    Object.defineProperty(UpdateGovernanceSource.prototype, "_source", {
      get: $util.oneOfGetter(($oneOfFields = ["source"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * UpdateGovernanceSource action.
     * @member {"setGovernanceSourcePermissions"|"removeGovernanceSource"|undefined} action
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     */
    Object.defineProperty(UpdateGovernanceSource.prototype, "action", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "setGovernanceSourcePermissions",
          "removeGovernanceSource",
        ]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new UpdateGovernanceSource instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IUpdateGovernanceSource=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.UpdateGovernanceSource} UpdateGovernanceSource instance
     */
    UpdateGovernanceSource.create = function create(properties) {
      return new UpdateGovernanceSource(properties);
    };

    /**
     * Encodes the specified UpdateGovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.UpdateGovernanceSource.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IUpdateGovernanceSource} message UpdateGovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateGovernanceSource.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.source != null &&
        Object.hasOwnProperty.call(message, "source")
      )
        $root.pyth_lazer_transaction.GovernanceSource.encode(
          message.source,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      if (
        message.setGovernanceSourcePermissions != null &&
        Object.hasOwnProperty.call(message, "setGovernanceSourcePermissions")
      )
        $root.pyth_lazer_transaction.SetGovernanceSourcePermissions.encode(
          message.setGovernanceSourcePermissions,
          writer.uint32(/* id 101, wireType 2 =*/ 810).fork(),
        ).ldelim();
      if (
        message.removeGovernanceSource != null &&
        Object.hasOwnProperty.call(message, "removeGovernanceSource")
      )
        $root.google.protobuf.Empty.encode(
          message.removeGovernanceSource,
          writer.uint32(/* id 199, wireType 2 =*/ 1594).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified UpdateGovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateGovernanceSource.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.IUpdateGovernanceSource} message UpdateGovernanceSource message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateGovernanceSource.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an UpdateGovernanceSource message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.UpdateGovernanceSource} UpdateGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateGovernanceSource.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.UpdateGovernanceSource();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.source =
              $root.pyth_lazer_transaction.GovernanceSource.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 101: {
            message.setGovernanceSourcePermissions =
              $root.pyth_lazer_transaction.SetGovernanceSourcePermissions.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 199: {
            message.removeGovernanceSource = $root.google.protobuf.Empty.decode(
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
     * Decodes an UpdateGovernanceSource message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.UpdateGovernanceSource} UpdateGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateGovernanceSource.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an UpdateGovernanceSource message.
     * @function verify
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UpdateGovernanceSource.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.source != null && message.hasOwnProperty("source")) {
        properties._source = 1;
        {
          var error = $root.pyth_lazer_transaction.GovernanceSource.verify(
            message.source,
          );
          if (error) return "source." + error;
        }
      }
      if (
        message.setGovernanceSourcePermissions != null &&
        message.hasOwnProperty("setGovernanceSourcePermissions")
      ) {
        properties.action = 1;
        {
          var error =
            $root.pyth_lazer_transaction.SetGovernanceSourcePermissions.verify(
              message.setGovernanceSourcePermissions,
            );
          if (error) return "setGovernanceSourcePermissions." + error;
        }
      }
      if (
        message.removeGovernanceSource != null &&
        message.hasOwnProperty("removeGovernanceSource")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.google.protobuf.Empty.verify(
            message.removeGovernanceSource,
          );
          if (error) return "removeGovernanceSource." + error;
        }
      }
      return null;
    };

    /**
     * Creates an UpdateGovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.UpdateGovernanceSource} UpdateGovernanceSource
     */
    UpdateGovernanceSource.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.UpdateGovernanceSource)
        return object;
      var message = new $root.pyth_lazer_transaction.UpdateGovernanceSource();
      if (object.source != null) {
        if (typeof object.source !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateGovernanceSource.source: object expected",
          );
        message.source =
          $root.pyth_lazer_transaction.GovernanceSource.fromObject(
            object.source,
          );
      }
      if (object.setGovernanceSourcePermissions != null) {
        if (typeof object.setGovernanceSourcePermissions !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateGovernanceSource.setGovernanceSourcePermissions: object expected",
          );
        message.setGovernanceSourcePermissions =
          $root.pyth_lazer_transaction.SetGovernanceSourcePermissions.fromObject(
            object.setGovernanceSourcePermissions,
          );
      }
      if (object.removeGovernanceSource != null) {
        if (typeof object.removeGovernanceSource !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateGovernanceSource.removeGovernanceSource: object expected",
          );
        message.removeGovernanceSource = $root.google.protobuf.Empty.fromObject(
          object.removeGovernanceSource,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from an UpdateGovernanceSource message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {pyth_lazer_transaction.UpdateGovernanceSource} message UpdateGovernanceSource
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UpdateGovernanceSource.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.source != null && message.hasOwnProperty("source")) {
        object.source = $root.pyth_lazer_transaction.GovernanceSource.toObject(
          message.source,
          options,
        );
        if (options.oneofs) object._source = "source";
      }
      if (
        message.setGovernanceSourcePermissions != null &&
        message.hasOwnProperty("setGovernanceSourcePermissions")
      ) {
        object.setGovernanceSourcePermissions =
          $root.pyth_lazer_transaction.SetGovernanceSourcePermissions.toObject(
            message.setGovernanceSourcePermissions,
            options,
          );
        if (options.oneofs) object.action = "setGovernanceSourcePermissions";
      }
      if (
        message.removeGovernanceSource != null &&
        message.hasOwnProperty("removeGovernanceSource")
      ) {
        object.removeGovernanceSource = $root.google.protobuf.Empty.toObject(
          message.removeGovernanceSource,
          options,
        );
        if (options.oneofs) object.action = "removeGovernanceSource";
      }
      return object;
    };

    /**
     * Converts this UpdateGovernanceSource to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UpdateGovernanceSource.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UpdateGovernanceSource
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.UpdateGovernanceSource
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UpdateGovernanceSource.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.UpdateGovernanceSource";
    };

    return UpdateGovernanceSource;
  })();

  pyth_lazer_transaction.SetGovernanceSourcePermissions = (function () {
    /**
     * Properties of a SetGovernanceSourcePermissions.
     * @memberof pyth_lazer_transaction
     * @interface ISetGovernanceSourcePermissions
     * @property {pyth_lazer_transaction.IPermissions|null} [permissions] SetGovernanceSourcePermissions permissions
     */

    /**
     * Constructs a new SetGovernanceSourcePermissions.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetGovernanceSourcePermissions.
     * @implements ISetGovernanceSourcePermissions
     * @constructor
     * @param {pyth_lazer_transaction.ISetGovernanceSourcePermissions=} [properties] Properties to set
     */
    function SetGovernanceSourcePermissions(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetGovernanceSourcePermissions permissions.
     * @member {pyth_lazer_transaction.IPermissions|null|undefined} permissions
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @instance
     */
    SetGovernanceSourcePermissions.prototype.permissions = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * SetGovernanceSourcePermissions _permissions.
     * @member {"permissions"|undefined} _permissions
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @instance
     */
    Object.defineProperty(
      SetGovernanceSourcePermissions.prototype,
      "_permissions",
      {
        get: $util.oneOfGetter(($oneOfFields = ["permissions"])),
        set: $util.oneOfSetter($oneOfFields),
      },
    );

    /**
     * Creates a new SetGovernanceSourcePermissions instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {pyth_lazer_transaction.ISetGovernanceSourcePermissions=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetGovernanceSourcePermissions} SetGovernanceSourcePermissions instance
     */
    SetGovernanceSourcePermissions.create = function create(properties) {
      return new SetGovernanceSourcePermissions(properties);
    };

    /**
     * Encodes the specified SetGovernanceSourcePermissions message. Does not implicitly {@link pyth_lazer_transaction.SetGovernanceSourcePermissions.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {pyth_lazer_transaction.ISetGovernanceSourcePermissions} message SetGovernanceSourcePermissions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetGovernanceSourcePermissions.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.permissions != null &&
        Object.hasOwnProperty.call(message, "permissions")
      )
        $root.pyth_lazer_transaction.Permissions.encode(
          message.permissions,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified SetGovernanceSourcePermissions message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetGovernanceSourcePermissions.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {pyth_lazer_transaction.ISetGovernanceSourcePermissions} message SetGovernanceSourcePermissions message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetGovernanceSourcePermissions.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetGovernanceSourcePermissions message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetGovernanceSourcePermissions} SetGovernanceSourcePermissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetGovernanceSourcePermissions.decode = function decode(
      reader,
      length,
      error,
    ) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message =
          new $root.pyth_lazer_transaction.SetGovernanceSourcePermissions();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.permissions =
              $root.pyth_lazer_transaction.Permissions.decode(
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
     * Decodes a SetGovernanceSourcePermissions message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetGovernanceSourcePermissions} SetGovernanceSourcePermissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetGovernanceSourcePermissions.decodeDelimited = function decodeDelimited(
      reader,
    ) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetGovernanceSourcePermissions message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetGovernanceSourcePermissions.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.permissions != null &&
        message.hasOwnProperty("permissions")
      ) {
        properties._permissions = 1;
        {
          var error = $root.pyth_lazer_transaction.Permissions.verify(
            message.permissions,
          );
          if (error) return "permissions." + error;
        }
      }
      return null;
    };

    /**
     * Creates a SetGovernanceSourcePermissions message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetGovernanceSourcePermissions} SetGovernanceSourcePermissions
     */
    SetGovernanceSourcePermissions.fromObject = function fromObject(object) {
      if (
        object instanceof
        $root.pyth_lazer_transaction.SetGovernanceSourcePermissions
      )
        return object;
      var message =
        new $root.pyth_lazer_transaction.SetGovernanceSourcePermissions();
      if (object.permissions != null) {
        if (typeof object.permissions !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.SetGovernanceSourcePermissions.permissions: object expected",
          );
        message.permissions =
          $root.pyth_lazer_transaction.Permissions.fromObject(
            object.permissions,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from a SetGovernanceSourcePermissions message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {pyth_lazer_transaction.SetGovernanceSourcePermissions} message SetGovernanceSourcePermissions
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetGovernanceSourcePermissions.toObject = function toObject(
      message,
      options,
    ) {
      if (!options) options = {};
      var object = {};
      if (
        message.permissions != null &&
        message.hasOwnProperty("permissions")
      ) {
        object.permissions = $root.pyth_lazer_transaction.Permissions.toObject(
          message.permissions,
          options,
        );
        if (options.oneofs) object._permissions = "permissions";
      }
      return object;
    };

    /**
     * Converts this SetGovernanceSourcePermissions to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetGovernanceSourcePermissions.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetGovernanceSourcePermissions
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetGovernanceSourcePermissions
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetGovernanceSourcePermissions.getTypeUrl = function getTypeUrl(
      typeUrlPrefix,
    ) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return (
        typeUrlPrefix + "/pyth_lazer_transaction.SetGovernanceSourcePermissions"
      );
    };

    return SetGovernanceSourcePermissions;
  })();

  pyth_lazer_transaction.SetShardName = (function () {
    /**
     * Properties of a SetShardName.
     * @memberof pyth_lazer_transaction
     * @interface ISetShardName
     * @property {string|null} [shardName] SetShardName shardName
     */

    /**
     * Constructs a new SetShardName.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetShardName.
     * @implements ISetShardName
     * @constructor
     * @param {pyth_lazer_transaction.ISetShardName=} [properties] Properties to set
     */
    function SetShardName(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetShardName shardName.
     * @member {string|null|undefined} shardName
     * @memberof pyth_lazer_transaction.SetShardName
     * @instance
     */
    SetShardName.prototype.shardName = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * SetShardName _shardName.
     * @member {"shardName"|undefined} _shardName
     * @memberof pyth_lazer_transaction.SetShardName
     * @instance
     */
    Object.defineProperty(SetShardName.prototype, "_shardName", {
      get: $util.oneOfGetter(($oneOfFields = ["shardName"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new SetShardName instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {pyth_lazer_transaction.ISetShardName=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetShardName} SetShardName instance
     */
    SetShardName.create = function create(properties) {
      return new SetShardName(properties);
    };

    /**
     * Encodes the specified SetShardName message. Does not implicitly {@link pyth_lazer_transaction.SetShardName.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {pyth_lazer_transaction.ISetShardName} message SetShardName message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetShardName.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.shardName != null &&
        Object.hasOwnProperty.call(message, "shardName")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.shardName);
      return writer;
    };

    /**
     * Encodes the specified SetShardName message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetShardName.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {pyth_lazer_transaction.ISetShardName} message SetShardName message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetShardName.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetShardName message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetShardName} SetShardName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetShardName.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.SetShardName();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.shardName = reader.string();
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
     * Decodes a SetShardName message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetShardName} SetShardName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetShardName.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetShardName message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetShardName.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.shardName != null && message.hasOwnProperty("shardName")) {
        properties._shardName = 1;
        if (!$util.isString(message.shardName))
          return "shardName: string expected";
      }
      return null;
    };

    /**
     * Creates a SetShardName message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetShardName} SetShardName
     */
    SetShardName.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.SetShardName)
        return object;
      var message = new $root.pyth_lazer_transaction.SetShardName();
      if (object.shardName != null)
        message.shardName = String(object.shardName);
      return message;
    };

    /**
     * Creates a plain object from a SetShardName message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {pyth_lazer_transaction.SetShardName} message SetShardName
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetShardName.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.shardName != null && message.hasOwnProperty("shardName")) {
        object.shardName = message.shardName;
        if (options.oneofs) object._shardName = "shardName";
      }
      return object;
    };

    /**
     * Converts this SetShardName to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetShardName
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetShardName.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetShardName
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetShardName
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetShardName.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.SetShardName";
    };

    return SetShardName;
  })();

  pyth_lazer_transaction.SetShardGroup = (function () {
    /**
     * Properties of a SetShardGroup.
     * @memberof pyth_lazer_transaction
     * @interface ISetShardGroup
     * @property {string|null} [shardGroup] SetShardGroup shardGroup
     */

    /**
     * Constructs a new SetShardGroup.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetShardGroup.
     * @implements ISetShardGroup
     * @constructor
     * @param {pyth_lazer_transaction.ISetShardGroup=} [properties] Properties to set
     */
    function SetShardGroup(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetShardGroup shardGroup.
     * @member {string|null|undefined} shardGroup
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @instance
     */
    SetShardGroup.prototype.shardGroup = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * SetShardGroup _shardGroup.
     * @member {"shardGroup"|undefined} _shardGroup
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @instance
     */
    Object.defineProperty(SetShardGroup.prototype, "_shardGroup", {
      get: $util.oneOfGetter(($oneOfFields = ["shardGroup"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new SetShardGroup instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {pyth_lazer_transaction.ISetShardGroup=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetShardGroup} SetShardGroup instance
     */
    SetShardGroup.create = function create(properties) {
      return new SetShardGroup(properties);
    };

    /**
     * Encodes the specified SetShardGroup message. Does not implicitly {@link pyth_lazer_transaction.SetShardGroup.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {pyth_lazer_transaction.ISetShardGroup} message SetShardGroup message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetShardGroup.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.shardGroup != null &&
        Object.hasOwnProperty.call(message, "shardGroup")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.shardGroup);
      return writer;
    };

    /**
     * Encodes the specified SetShardGroup message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetShardGroup.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {pyth_lazer_transaction.ISetShardGroup} message SetShardGroup message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetShardGroup.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetShardGroup message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetShardGroup} SetShardGroup
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetShardGroup.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.SetShardGroup();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.shardGroup = reader.string();
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
     * Decodes a SetShardGroup message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetShardGroup} SetShardGroup
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetShardGroup.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetShardGroup message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetShardGroup.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.shardGroup != null && message.hasOwnProperty("shardGroup")) {
        properties._shardGroup = 1;
        if (!$util.isString(message.shardGroup))
          return "shardGroup: string expected";
      }
      return null;
    };

    /**
     * Creates a SetShardGroup message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetShardGroup} SetShardGroup
     */
    SetShardGroup.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.SetShardGroup)
        return object;
      var message = new $root.pyth_lazer_transaction.SetShardGroup();
      if (object.shardGroup != null)
        message.shardGroup = String(object.shardGroup);
      return message;
    };

    /**
     * Creates a plain object from a SetShardGroup message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {pyth_lazer_transaction.SetShardGroup} message SetShardGroup
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetShardGroup.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.shardGroup != null && message.hasOwnProperty("shardGroup")) {
        object.shardGroup = message.shardGroup;
        if (options.oneofs) object._shardGroup = "shardGroup";
      }
      return object;
    };

    /**
     * Converts this SetShardGroup to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetShardGroup.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetShardGroup
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetShardGroup
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetShardGroup.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.SetShardGroup";
    };

    return SetShardGroup;
  })();

  pyth_lazer_transaction.ResetLastSequenceNo = (function () {
    /**
     * Properties of a ResetLastSequenceNo.
     * @memberof pyth_lazer_transaction
     * @interface IResetLastSequenceNo
     * @property {number|Long|null} [lastSequenceNo] ResetLastSequenceNo lastSequenceNo
     */

    /**
     * Constructs a new ResetLastSequenceNo.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a ResetLastSequenceNo.
     * @implements IResetLastSequenceNo
     * @constructor
     * @param {pyth_lazer_transaction.IResetLastSequenceNo=} [properties] Properties to set
     */
    function ResetLastSequenceNo(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ResetLastSequenceNo lastSequenceNo.
     * @member {number|Long|null|undefined} lastSequenceNo
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @instance
     */
    ResetLastSequenceNo.prototype.lastSequenceNo = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * ResetLastSequenceNo _lastSequenceNo.
     * @member {"lastSequenceNo"|undefined} _lastSequenceNo
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @instance
     */
    Object.defineProperty(ResetLastSequenceNo.prototype, "_lastSequenceNo", {
      get: $util.oneOfGetter(($oneOfFields = ["lastSequenceNo"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new ResetLastSequenceNo instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {pyth_lazer_transaction.IResetLastSequenceNo=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.ResetLastSequenceNo} ResetLastSequenceNo instance
     */
    ResetLastSequenceNo.create = function create(properties) {
      return new ResetLastSequenceNo(properties);
    };

    /**
     * Encodes the specified ResetLastSequenceNo message. Does not implicitly {@link pyth_lazer_transaction.ResetLastSequenceNo.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {pyth_lazer_transaction.IResetLastSequenceNo} message ResetLastSequenceNo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ResetLastSequenceNo.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.lastSequenceNo != null &&
        Object.hasOwnProperty.call(message, "lastSequenceNo")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint64(message.lastSequenceNo);
      return writer;
    };

    /**
     * Encodes the specified ResetLastSequenceNo message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ResetLastSequenceNo.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {pyth_lazer_transaction.IResetLastSequenceNo} message ResetLastSequenceNo message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ResetLastSequenceNo.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a ResetLastSequenceNo message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.ResetLastSequenceNo} ResetLastSequenceNo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ResetLastSequenceNo.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.ResetLastSequenceNo();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.lastSequenceNo = reader.uint64();
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
     * Decodes a ResetLastSequenceNo message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.ResetLastSequenceNo} ResetLastSequenceNo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ResetLastSequenceNo.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ResetLastSequenceNo message.
     * @function verify
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ResetLastSequenceNo.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
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
      return null;
    };

    /**
     * Creates a ResetLastSequenceNo message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.ResetLastSequenceNo} ResetLastSequenceNo
     */
    ResetLastSequenceNo.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.ResetLastSequenceNo)
        return object;
      var message = new $root.pyth_lazer_transaction.ResetLastSequenceNo();
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
      return message;
    };

    /**
     * Creates a plain object from a ResetLastSequenceNo message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {pyth_lazer_transaction.ResetLastSequenceNo} message ResetLastSequenceNo
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ResetLastSequenceNo.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
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
      return object;
    };

    /**
     * Converts this ResetLastSequenceNo to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ResetLastSequenceNo.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ResetLastSequenceNo
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.ResetLastSequenceNo
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ResetLastSequenceNo.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.ResetLastSequenceNo";
    };

    return ResetLastSequenceNo;
  })();

  pyth_lazer_transaction.AddPublisher = (function () {
    /**
     * Properties of an AddPublisher.
     * @memberof pyth_lazer_transaction
     * @interface IAddPublisher
     * @property {number|null} [publisherId] AddPublisher publisherId
     * @property {string|null} [name] AddPublisher name
     * @property {Array.<Uint8Array>|null} [publicKeys] AddPublisher publicKeys
     * @property {boolean|null} [isActive] AddPublisher isActive
     */

    /**
     * Constructs a new AddPublisher.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an AddPublisher.
     * @implements IAddPublisher
     * @constructor
     * @param {pyth_lazer_transaction.IAddPublisher=} [properties] Properties to set
     */
    function AddPublisher(properties) {
      this.publicKeys = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AddPublisher publisherId.
     * @member {number|null|undefined} publisherId
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    AddPublisher.prototype.publisherId = null;

    /**
     * AddPublisher name.
     * @member {string|null|undefined} name
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    AddPublisher.prototype.name = null;

    /**
     * AddPublisher publicKeys.
     * @member {Array.<Uint8Array>} publicKeys
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    AddPublisher.prototype.publicKeys = $util.emptyArray;

    /**
     * AddPublisher isActive.
     * @member {boolean|null|undefined} isActive
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    AddPublisher.prototype.isActive = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * AddPublisher _publisherId.
     * @member {"publisherId"|undefined} _publisherId
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    Object.defineProperty(AddPublisher.prototype, "_publisherId", {
      get: $util.oneOfGetter(($oneOfFields = ["publisherId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * AddPublisher _name.
     * @member {"name"|undefined} _name
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    Object.defineProperty(AddPublisher.prototype, "_name", {
      get: $util.oneOfGetter(($oneOfFields = ["name"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * AddPublisher _isActive.
     * @member {"isActive"|undefined} _isActive
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     */
    Object.defineProperty(AddPublisher.prototype, "_isActive", {
      get: $util.oneOfGetter(($oneOfFields = ["isActive"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new AddPublisher instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {pyth_lazer_transaction.IAddPublisher=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.AddPublisher} AddPublisher instance
     */
    AddPublisher.create = function create(properties) {
      return new AddPublisher(properties);
    };

    /**
     * Encodes the specified AddPublisher message. Does not implicitly {@link pyth_lazer_transaction.AddPublisher.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {pyth_lazer_transaction.IAddPublisher} message AddPublisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddPublisher.encode = function encode(message, writer) {
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
     * Encodes the specified AddPublisher message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddPublisher.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {pyth_lazer_transaction.IAddPublisher} message AddPublisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddPublisher.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AddPublisher message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.AddPublisher} AddPublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddPublisher.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.AddPublisher();
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
     * Decodes an AddPublisher message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.AddPublisher} AddPublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddPublisher.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AddPublisher message.
     * @function verify
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AddPublisher.verify = function verify(message) {
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
     * Creates an AddPublisher message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.AddPublisher} AddPublisher
     */
    AddPublisher.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.AddPublisher)
        return object;
      var message = new $root.pyth_lazer_transaction.AddPublisher();
      if (object.publisherId != null)
        message.publisherId = object.publisherId >>> 0;
      if (object.name != null) message.name = String(object.name);
      if (object.publicKeys) {
        if (!Array.isArray(object.publicKeys))
          throw TypeError(
            ".pyth_lazer_transaction.AddPublisher.publicKeys: array expected",
          );
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
     * Creates a plain object from an AddPublisher message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {pyth_lazer_transaction.AddPublisher} message AddPublisher
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AddPublisher.toObject = function toObject(message, options) {
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
     * Converts this AddPublisher to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.AddPublisher
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AddPublisher.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AddPublisher
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.AddPublisher
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AddPublisher.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.AddPublisher";
    };

    return AddPublisher;
  })();

  pyth_lazer_transaction.UpdatePublisher = (function () {
    /**
     * Properties of an UpdatePublisher.
     * @memberof pyth_lazer_transaction
     * @interface IUpdatePublisher
     * @property {number|null} [publisherId] UpdatePublisher publisherId
     * @property {pyth_lazer_transaction.ISetPublisherName|null} [setPublisherName] UpdatePublisher setPublisherName
     * @property {pyth_lazer_transaction.IAddPublisherPublicKeys|null} [addPublisherPublicKeys] UpdatePublisher addPublisherPublicKeys
     * @property {pyth_lazer_transaction.IRemovePublisherPublicKeys|null} [removePublisherPublicKeys] UpdatePublisher removePublisherPublicKeys
     * @property {pyth_lazer_transaction.ISetPublisherPublicKeys|null} [setPublisherPublicKeys] UpdatePublisher setPublisherPublicKeys
     * @property {pyth_lazer_transaction.ISetPublisherActive|null} [setPublisherActive] UpdatePublisher setPublisherActive
     * @property {google.protobuf.IEmpty|null} [removePublisher] UpdatePublisher removePublisher
     */

    /**
     * Constructs a new UpdatePublisher.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an UpdatePublisher.
     * @implements IUpdatePublisher
     * @constructor
     * @param {pyth_lazer_transaction.IUpdatePublisher=} [properties] Properties to set
     */
    function UpdatePublisher(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UpdatePublisher publisherId.
     * @member {number|null|undefined} publisherId
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.publisherId = null;

    /**
     * UpdatePublisher setPublisherName.
     * @member {pyth_lazer_transaction.ISetPublisherName|null|undefined} setPublisherName
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.setPublisherName = null;

    /**
     * UpdatePublisher addPublisherPublicKeys.
     * @member {pyth_lazer_transaction.IAddPublisherPublicKeys|null|undefined} addPublisherPublicKeys
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.addPublisherPublicKeys = null;

    /**
     * UpdatePublisher removePublisherPublicKeys.
     * @member {pyth_lazer_transaction.IRemovePublisherPublicKeys|null|undefined} removePublisherPublicKeys
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.removePublisherPublicKeys = null;

    /**
     * UpdatePublisher setPublisherPublicKeys.
     * @member {pyth_lazer_transaction.ISetPublisherPublicKeys|null|undefined} setPublisherPublicKeys
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.setPublisherPublicKeys = null;

    /**
     * UpdatePublisher setPublisherActive.
     * @member {pyth_lazer_transaction.ISetPublisherActive|null|undefined} setPublisherActive
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.setPublisherActive = null;

    /**
     * UpdatePublisher removePublisher.
     * @member {google.protobuf.IEmpty|null|undefined} removePublisher
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    UpdatePublisher.prototype.removePublisher = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * UpdatePublisher _publisherId.
     * @member {"publisherId"|undefined} _publisherId
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    Object.defineProperty(UpdatePublisher.prototype, "_publisherId", {
      get: $util.oneOfGetter(($oneOfFields = ["publisherId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * UpdatePublisher action.
     * @member {"setPublisherName"|"addPublisherPublicKeys"|"removePublisherPublicKeys"|"setPublisherPublicKeys"|"setPublisherActive"|"removePublisher"|undefined} action
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     */
    Object.defineProperty(UpdatePublisher.prototype, "action", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "setPublisherName",
          "addPublisherPublicKeys",
          "removePublisherPublicKeys",
          "setPublisherPublicKeys",
          "setPublisherActive",
          "removePublisher",
        ]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new UpdatePublisher instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {pyth_lazer_transaction.IUpdatePublisher=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.UpdatePublisher} UpdatePublisher instance
     */
    UpdatePublisher.create = function create(properties) {
      return new UpdatePublisher(properties);
    };

    /**
     * Encodes the specified UpdatePublisher message. Does not implicitly {@link pyth_lazer_transaction.UpdatePublisher.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {pyth_lazer_transaction.IUpdatePublisher} message UpdatePublisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdatePublisher.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.publisherId != null &&
        Object.hasOwnProperty.call(message, "publisherId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.publisherId);
      if (
        message.setPublisherName != null &&
        Object.hasOwnProperty.call(message, "setPublisherName")
      )
        $root.pyth_lazer_transaction.SetPublisherName.encode(
          message.setPublisherName,
          writer.uint32(/* id 101, wireType 2 =*/ 810).fork(),
        ).ldelim();
      if (
        message.addPublisherPublicKeys != null &&
        Object.hasOwnProperty.call(message, "addPublisherPublicKeys")
      )
        $root.pyth_lazer_transaction.AddPublisherPublicKeys.encode(
          message.addPublisherPublicKeys,
          writer.uint32(/* id 102, wireType 2 =*/ 818).fork(),
        ).ldelim();
      if (
        message.removePublisherPublicKeys != null &&
        Object.hasOwnProperty.call(message, "removePublisherPublicKeys")
      )
        $root.pyth_lazer_transaction.RemovePublisherPublicKeys.encode(
          message.removePublisherPublicKeys,
          writer.uint32(/* id 103, wireType 2 =*/ 826).fork(),
        ).ldelim();
      if (
        message.setPublisherPublicKeys != null &&
        Object.hasOwnProperty.call(message, "setPublisherPublicKeys")
      )
        $root.pyth_lazer_transaction.SetPublisherPublicKeys.encode(
          message.setPublisherPublicKeys,
          writer.uint32(/* id 104, wireType 2 =*/ 834).fork(),
        ).ldelim();
      if (
        message.setPublisherActive != null &&
        Object.hasOwnProperty.call(message, "setPublisherActive")
      )
        $root.pyth_lazer_transaction.SetPublisherActive.encode(
          message.setPublisherActive,
          writer.uint32(/* id 105, wireType 2 =*/ 842).fork(),
        ).ldelim();
      if (
        message.removePublisher != null &&
        Object.hasOwnProperty.call(message, "removePublisher")
      )
        $root.google.protobuf.Empty.encode(
          message.removePublisher,
          writer.uint32(/* id 199, wireType 2 =*/ 1594).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified UpdatePublisher message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdatePublisher.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {pyth_lazer_transaction.IUpdatePublisher} message UpdatePublisher message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdatePublisher.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an UpdatePublisher message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.UpdatePublisher} UpdatePublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdatePublisher.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.UpdatePublisher();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.publisherId = reader.uint32();
            break;
          }
          case 101: {
            message.setPublisherName =
              $root.pyth_lazer_transaction.SetPublisherName.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 102: {
            message.addPublisherPublicKeys =
              $root.pyth_lazer_transaction.AddPublisherPublicKeys.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 103: {
            message.removePublisherPublicKeys =
              $root.pyth_lazer_transaction.RemovePublisherPublicKeys.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 104: {
            message.setPublisherPublicKeys =
              $root.pyth_lazer_transaction.SetPublisherPublicKeys.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 105: {
            message.setPublisherActive =
              $root.pyth_lazer_transaction.SetPublisherActive.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 199: {
            message.removePublisher = $root.google.protobuf.Empty.decode(
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
     * Decodes an UpdatePublisher message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.UpdatePublisher} UpdatePublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdatePublisher.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an UpdatePublisher message.
     * @function verify
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UpdatePublisher.verify = function verify(message) {
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
        message.setPublisherName != null &&
        message.hasOwnProperty("setPublisherName")
      ) {
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.SetPublisherName.verify(
            message.setPublisherName,
          );
          if (error) return "setPublisherName." + error;
        }
      }
      if (
        message.addPublisherPublicKeys != null &&
        message.hasOwnProperty("addPublisherPublicKeys")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error =
            $root.pyth_lazer_transaction.AddPublisherPublicKeys.verify(
              message.addPublisherPublicKeys,
            );
          if (error) return "addPublisherPublicKeys." + error;
        }
      }
      if (
        message.removePublisherPublicKeys != null &&
        message.hasOwnProperty("removePublisherPublicKeys")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error =
            $root.pyth_lazer_transaction.RemovePublisherPublicKeys.verify(
              message.removePublisherPublicKeys,
            );
          if (error) return "removePublisherPublicKeys." + error;
        }
      }
      if (
        message.setPublisherPublicKeys != null &&
        message.hasOwnProperty("setPublisherPublicKeys")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error =
            $root.pyth_lazer_transaction.SetPublisherPublicKeys.verify(
              message.setPublisherPublicKeys,
            );
          if (error) return "setPublisherPublicKeys." + error;
        }
      }
      if (
        message.setPublisherActive != null &&
        message.hasOwnProperty("setPublisherActive")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.SetPublisherActive.verify(
            message.setPublisherActive,
          );
          if (error) return "setPublisherActive." + error;
        }
      }
      if (
        message.removePublisher != null &&
        message.hasOwnProperty("removePublisher")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.google.protobuf.Empty.verify(
            message.removePublisher,
          );
          if (error) return "removePublisher." + error;
        }
      }
      return null;
    };

    /**
     * Creates an UpdatePublisher message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.UpdatePublisher} UpdatePublisher
     */
    UpdatePublisher.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.UpdatePublisher)
        return object;
      var message = new $root.pyth_lazer_transaction.UpdatePublisher();
      if (object.publisherId != null)
        message.publisherId = object.publisherId >>> 0;
      if (object.setPublisherName != null) {
        if (typeof object.setPublisherName !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.setPublisherName: object expected",
          );
        message.setPublisherName =
          $root.pyth_lazer_transaction.SetPublisherName.fromObject(
            object.setPublisherName,
          );
      }
      if (object.addPublisherPublicKeys != null) {
        if (typeof object.addPublisherPublicKeys !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.addPublisherPublicKeys: object expected",
          );
        message.addPublisherPublicKeys =
          $root.pyth_lazer_transaction.AddPublisherPublicKeys.fromObject(
            object.addPublisherPublicKeys,
          );
      }
      if (object.removePublisherPublicKeys != null) {
        if (typeof object.removePublisherPublicKeys !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.removePublisherPublicKeys: object expected",
          );
        message.removePublisherPublicKeys =
          $root.pyth_lazer_transaction.RemovePublisherPublicKeys.fromObject(
            object.removePublisherPublicKeys,
          );
      }
      if (object.setPublisherPublicKeys != null) {
        if (typeof object.setPublisherPublicKeys !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.setPublisherPublicKeys: object expected",
          );
        message.setPublisherPublicKeys =
          $root.pyth_lazer_transaction.SetPublisherPublicKeys.fromObject(
            object.setPublisherPublicKeys,
          );
      }
      if (object.setPublisherActive != null) {
        if (typeof object.setPublisherActive !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.setPublisherActive: object expected",
          );
        message.setPublisherActive =
          $root.pyth_lazer_transaction.SetPublisherActive.fromObject(
            object.setPublisherActive,
          );
      }
      if (object.removePublisher != null) {
        if (typeof object.removePublisher !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdatePublisher.removePublisher: object expected",
          );
        message.removePublisher = $root.google.protobuf.Empty.fromObject(
          object.removePublisher,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from an UpdatePublisher message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {pyth_lazer_transaction.UpdatePublisher} message UpdatePublisher
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UpdatePublisher.toObject = function toObject(message, options) {
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
        message.setPublisherName != null &&
        message.hasOwnProperty("setPublisherName")
      ) {
        object.setPublisherName =
          $root.pyth_lazer_transaction.SetPublisherName.toObject(
            message.setPublisherName,
            options,
          );
        if (options.oneofs) object.action = "setPublisherName";
      }
      if (
        message.addPublisherPublicKeys != null &&
        message.hasOwnProperty("addPublisherPublicKeys")
      ) {
        object.addPublisherPublicKeys =
          $root.pyth_lazer_transaction.AddPublisherPublicKeys.toObject(
            message.addPublisherPublicKeys,
            options,
          );
        if (options.oneofs) object.action = "addPublisherPublicKeys";
      }
      if (
        message.removePublisherPublicKeys != null &&
        message.hasOwnProperty("removePublisherPublicKeys")
      ) {
        object.removePublisherPublicKeys =
          $root.pyth_lazer_transaction.RemovePublisherPublicKeys.toObject(
            message.removePublisherPublicKeys,
            options,
          );
        if (options.oneofs) object.action = "removePublisherPublicKeys";
      }
      if (
        message.setPublisherPublicKeys != null &&
        message.hasOwnProperty("setPublisherPublicKeys")
      ) {
        object.setPublisherPublicKeys =
          $root.pyth_lazer_transaction.SetPublisherPublicKeys.toObject(
            message.setPublisherPublicKeys,
            options,
          );
        if (options.oneofs) object.action = "setPublisherPublicKeys";
      }
      if (
        message.setPublisherActive != null &&
        message.hasOwnProperty("setPublisherActive")
      ) {
        object.setPublisherActive =
          $root.pyth_lazer_transaction.SetPublisherActive.toObject(
            message.setPublisherActive,
            options,
          );
        if (options.oneofs) object.action = "setPublisherActive";
      }
      if (
        message.removePublisher != null &&
        message.hasOwnProperty("removePublisher")
      ) {
        object.removePublisher = $root.google.protobuf.Empty.toObject(
          message.removePublisher,
          options,
        );
        if (options.oneofs) object.action = "removePublisher";
      }
      return object;
    };

    /**
     * Converts this UpdatePublisher to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UpdatePublisher.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UpdatePublisher
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.UpdatePublisher
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UpdatePublisher.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.UpdatePublisher";
    };

    return UpdatePublisher;
  })();

  pyth_lazer_transaction.SetPublisherName = (function () {
    /**
     * Properties of a SetPublisherName.
     * @memberof pyth_lazer_transaction
     * @interface ISetPublisherName
     * @property {string|null} [name] SetPublisherName name
     */

    /**
     * Constructs a new SetPublisherName.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetPublisherName.
     * @implements ISetPublisherName
     * @constructor
     * @param {pyth_lazer_transaction.ISetPublisherName=} [properties] Properties to set
     */
    function SetPublisherName(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetPublisherName name.
     * @member {string|null|undefined} name
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @instance
     */
    SetPublisherName.prototype.name = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * SetPublisherName _name.
     * @member {"name"|undefined} _name
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @instance
     */
    Object.defineProperty(SetPublisherName.prototype, "_name", {
      get: $util.oneOfGetter(($oneOfFields = ["name"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new SetPublisherName instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherName=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetPublisherName} SetPublisherName instance
     */
    SetPublisherName.create = function create(properties) {
      return new SetPublisherName(properties);
    };

    /**
     * Encodes the specified SetPublisherName message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherName.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherName} message SetPublisherName message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherName.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.name);
      return writer;
    };

    /**
     * Encodes the specified SetPublisherName message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherName.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherName} message SetPublisherName message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherName.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetPublisherName message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetPublisherName} SetPublisherName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherName.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.SetPublisherName();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.name = reader.string();
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
     * Decodes a SetPublisherName message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetPublisherName} SetPublisherName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherName.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetPublisherName message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetPublisherName.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.name != null && message.hasOwnProperty("name")) {
        properties._name = 1;
        if (!$util.isString(message.name)) return "name: string expected";
      }
      return null;
    };

    /**
     * Creates a SetPublisherName message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetPublisherName} SetPublisherName
     */
    SetPublisherName.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.SetPublisherName)
        return object;
      var message = new $root.pyth_lazer_transaction.SetPublisherName();
      if (object.name != null) message.name = String(object.name);
      return message;
    };

    /**
     * Creates a plain object from a SetPublisherName message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {pyth_lazer_transaction.SetPublisherName} message SetPublisherName
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetPublisherName.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.name != null && message.hasOwnProperty("name")) {
        object.name = message.name;
        if (options.oneofs) object._name = "name";
      }
      return object;
    };

    /**
     * Converts this SetPublisherName to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetPublisherName.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetPublisherName
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetPublisherName
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetPublisherName.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.SetPublisherName";
    };

    return SetPublisherName;
  })();

  pyth_lazer_transaction.AddPublisherPublicKeys = (function () {
    /**
     * Properties of an AddPublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @interface IAddPublisherPublicKeys
     * @property {Array.<Uint8Array>|null} [publicKeys] AddPublisherPublicKeys publicKeys
     */

    /**
     * Constructs a new AddPublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an AddPublisherPublicKeys.
     * @implements IAddPublisherPublicKeys
     * @constructor
     * @param {pyth_lazer_transaction.IAddPublisherPublicKeys=} [properties] Properties to set
     */
    function AddPublisherPublicKeys(properties) {
      this.publicKeys = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AddPublisherPublicKeys publicKeys.
     * @member {Array.<Uint8Array>} publicKeys
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @instance
     */
    AddPublisherPublicKeys.prototype.publicKeys = $util.emptyArray;

    /**
     * Creates a new AddPublisherPublicKeys instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IAddPublisherPublicKeys=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.AddPublisherPublicKeys} AddPublisherPublicKeys instance
     */
    AddPublisherPublicKeys.create = function create(properties) {
      return new AddPublisherPublicKeys(properties);
    };

    /**
     * Encodes the specified AddPublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.AddPublisherPublicKeys.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IAddPublisherPublicKeys} message AddPublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddPublisherPublicKeys.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.publicKeys != null && message.publicKeys.length)
        for (var i = 0; i < message.publicKeys.length; ++i)
          writer
            .uint32(/* id 1, wireType 2 =*/ 10)
            .bytes(message.publicKeys[i]);
      return writer;
    };

    /**
     * Encodes the specified AddPublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddPublisherPublicKeys.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IAddPublisherPublicKeys} message AddPublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddPublisherPublicKeys.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AddPublisherPublicKeys message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.AddPublisherPublicKeys} AddPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddPublisherPublicKeys.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.AddPublisherPublicKeys();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.publicKeys && message.publicKeys.length))
              message.publicKeys = [];
            message.publicKeys.push(reader.bytes());
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
     * Decodes an AddPublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.AddPublisherPublicKeys} AddPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddPublisherPublicKeys.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AddPublisherPublicKeys message.
     * @function verify
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AddPublisherPublicKeys.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
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
      return null;
    };

    /**
     * Creates an AddPublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.AddPublisherPublicKeys} AddPublisherPublicKeys
     */
    AddPublisherPublicKeys.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.AddPublisherPublicKeys)
        return object;
      var message = new $root.pyth_lazer_transaction.AddPublisherPublicKeys();
      if (object.publicKeys) {
        if (!Array.isArray(object.publicKeys))
          throw TypeError(
            ".pyth_lazer_transaction.AddPublisherPublicKeys.publicKeys: array expected",
          );
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
      return message;
    };

    /**
     * Creates a plain object from an AddPublisherPublicKeys message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.AddPublisherPublicKeys} message AddPublisherPublicKeys
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AddPublisherPublicKeys.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.publicKeys = [];
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
      return object;
    };

    /**
     * Converts this AddPublisherPublicKeys to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AddPublisherPublicKeys.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AddPublisherPublicKeys
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.AddPublisherPublicKeys
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AddPublisherPublicKeys.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.AddPublisherPublicKeys";
    };

    return AddPublisherPublicKeys;
  })();

  pyth_lazer_transaction.RemovePublisherPublicKeys = (function () {
    /**
     * Properties of a RemovePublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @interface IRemovePublisherPublicKeys
     * @property {Array.<Uint8Array>|null} [publicKeys] RemovePublisherPublicKeys publicKeys
     */

    /**
     * Constructs a new RemovePublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a RemovePublisherPublicKeys.
     * @implements IRemovePublisherPublicKeys
     * @constructor
     * @param {pyth_lazer_transaction.IRemovePublisherPublicKeys=} [properties] Properties to set
     */
    function RemovePublisherPublicKeys(properties) {
      this.publicKeys = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RemovePublisherPublicKeys publicKeys.
     * @member {Array.<Uint8Array>} publicKeys
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @instance
     */
    RemovePublisherPublicKeys.prototype.publicKeys = $util.emptyArray;

    /**
     * Creates a new RemovePublisherPublicKeys instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IRemovePublisherPublicKeys=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.RemovePublisherPublicKeys} RemovePublisherPublicKeys instance
     */
    RemovePublisherPublicKeys.create = function create(properties) {
      return new RemovePublisherPublicKeys(properties);
    };

    /**
     * Encodes the specified RemovePublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.RemovePublisherPublicKeys.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IRemovePublisherPublicKeys} message RemovePublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RemovePublisherPublicKeys.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.publicKeys != null && message.publicKeys.length)
        for (var i = 0; i < message.publicKeys.length; ++i)
          writer
            .uint32(/* id 1, wireType 2 =*/ 10)
            .bytes(message.publicKeys[i]);
      return writer;
    };

    /**
     * Encodes the specified RemovePublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.RemovePublisherPublicKeys.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.IRemovePublisherPublicKeys} message RemovePublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RemovePublisherPublicKeys.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RemovePublisherPublicKeys message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.RemovePublisherPublicKeys} RemovePublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RemovePublisherPublicKeys.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.RemovePublisherPublicKeys();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.publicKeys && message.publicKeys.length))
              message.publicKeys = [];
            message.publicKeys.push(reader.bytes());
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
     * Decodes a RemovePublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.RemovePublisherPublicKeys} RemovePublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RemovePublisherPublicKeys.decodeDelimited = function decodeDelimited(
      reader,
    ) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RemovePublisherPublicKeys message.
     * @function verify
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RemovePublisherPublicKeys.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
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
      return null;
    };

    /**
     * Creates a RemovePublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.RemovePublisherPublicKeys} RemovePublisherPublicKeys
     */
    RemovePublisherPublicKeys.fromObject = function fromObject(object) {
      if (
        object instanceof $root.pyth_lazer_transaction.RemovePublisherPublicKeys
      )
        return object;
      var message =
        new $root.pyth_lazer_transaction.RemovePublisherPublicKeys();
      if (object.publicKeys) {
        if (!Array.isArray(object.publicKeys))
          throw TypeError(
            ".pyth_lazer_transaction.RemovePublisherPublicKeys.publicKeys: array expected",
          );
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
      return message;
    };

    /**
     * Creates a plain object from a RemovePublisherPublicKeys message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.RemovePublisherPublicKeys} message RemovePublisherPublicKeys
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RemovePublisherPublicKeys.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.publicKeys = [];
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
      return object;
    };

    /**
     * Converts this RemovePublisherPublicKeys to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RemovePublisherPublicKeys.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for RemovePublisherPublicKeys
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.RemovePublisherPublicKeys
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    RemovePublisherPublicKeys.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return (
        typeUrlPrefix + "/pyth_lazer_transaction.RemovePublisherPublicKeys"
      );
    };

    return RemovePublisherPublicKeys;
  })();

  pyth_lazer_transaction.SetPublisherPublicKeys = (function () {
    /**
     * Properties of a SetPublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @interface ISetPublisherPublicKeys
     * @property {Array.<Uint8Array>|null} [publicKeys] SetPublisherPublicKeys publicKeys
     */

    /**
     * Constructs a new SetPublisherPublicKeys.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetPublisherPublicKeys.
     * @implements ISetPublisherPublicKeys
     * @constructor
     * @param {pyth_lazer_transaction.ISetPublisherPublicKeys=} [properties] Properties to set
     */
    function SetPublisherPublicKeys(properties) {
      this.publicKeys = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetPublisherPublicKeys publicKeys.
     * @member {Array.<Uint8Array>} publicKeys
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @instance
     */
    SetPublisherPublicKeys.prototype.publicKeys = $util.emptyArray;

    /**
     * Creates a new SetPublisherPublicKeys instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherPublicKeys=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetPublisherPublicKeys} SetPublisherPublicKeys instance
     */
    SetPublisherPublicKeys.create = function create(properties) {
      return new SetPublisherPublicKeys(properties);
    };

    /**
     * Encodes the specified SetPublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherPublicKeys.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherPublicKeys} message SetPublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherPublicKeys.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.publicKeys != null && message.publicKeys.length)
        for (var i = 0; i < message.publicKeys.length; ++i)
          writer
            .uint32(/* id 1, wireType 2 =*/ 10)
            .bytes(message.publicKeys[i]);
      return writer;
    };

    /**
     * Encodes the specified SetPublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherPublicKeys.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherPublicKeys} message SetPublisherPublicKeys message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherPublicKeys.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetPublisherPublicKeys message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetPublisherPublicKeys} SetPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherPublicKeys.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.SetPublisherPublicKeys();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            if (!(message.publicKeys && message.publicKeys.length))
              message.publicKeys = [];
            message.publicKeys.push(reader.bytes());
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
     * Decodes a SetPublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetPublisherPublicKeys} SetPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherPublicKeys.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetPublisherPublicKeys message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetPublisherPublicKeys.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
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
      return null;
    };

    /**
     * Creates a SetPublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetPublisherPublicKeys} SetPublisherPublicKeys
     */
    SetPublisherPublicKeys.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.SetPublisherPublicKeys)
        return object;
      var message = new $root.pyth_lazer_transaction.SetPublisherPublicKeys();
      if (object.publicKeys) {
        if (!Array.isArray(object.publicKeys))
          throw TypeError(
            ".pyth_lazer_transaction.SetPublisherPublicKeys.publicKeys: array expected",
          );
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
      return message;
    };

    /**
     * Creates a plain object from a SetPublisherPublicKeys message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {pyth_lazer_transaction.SetPublisherPublicKeys} message SetPublisherPublicKeys
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetPublisherPublicKeys.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults) object.publicKeys = [];
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
      return object;
    };

    /**
     * Converts this SetPublisherPublicKeys to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetPublisherPublicKeys.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetPublisherPublicKeys
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetPublisherPublicKeys
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetPublisherPublicKeys.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.SetPublisherPublicKeys";
    };

    return SetPublisherPublicKeys;
  })();

  pyth_lazer_transaction.SetPublisherActive = (function () {
    /**
     * Properties of a SetPublisherActive.
     * @memberof pyth_lazer_transaction
     * @interface ISetPublisherActive
     * @property {boolean|null} [isActive] SetPublisherActive isActive
     */

    /**
     * Constructs a new SetPublisherActive.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a SetPublisherActive.
     * @implements ISetPublisherActive
     * @constructor
     * @param {pyth_lazer_transaction.ISetPublisherActive=} [properties] Properties to set
     */
    function SetPublisherActive(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * SetPublisherActive isActive.
     * @member {boolean|null|undefined} isActive
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @instance
     */
    SetPublisherActive.prototype.isActive = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * SetPublisherActive _isActive.
     * @member {"isActive"|undefined} _isActive
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @instance
     */
    Object.defineProperty(SetPublisherActive.prototype, "_isActive", {
      get: $util.oneOfGetter(($oneOfFields = ["isActive"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new SetPublisherActive instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherActive=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.SetPublisherActive} SetPublisherActive instance
     */
    SetPublisherActive.create = function create(properties) {
      return new SetPublisherActive(properties);
    };

    /**
     * Encodes the specified SetPublisherActive message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherActive.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherActive} message SetPublisherActive message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherActive.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.isActive != null &&
        Object.hasOwnProperty.call(message, "isActive")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).bool(message.isActive);
      return writer;
    };

    /**
     * Encodes the specified SetPublisherActive message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherActive.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {pyth_lazer_transaction.ISetPublisherActive} message SetPublisherActive message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    SetPublisherActive.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a SetPublisherActive message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.SetPublisherActive} SetPublisherActive
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherActive.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.SetPublisherActive();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
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
     * Decodes a SetPublisherActive message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.SetPublisherActive} SetPublisherActive
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    SetPublisherActive.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a SetPublisherActive message.
     * @function verify
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    SetPublisherActive.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.isActive != null && message.hasOwnProperty("isActive")) {
        properties._isActive = 1;
        if (typeof message.isActive !== "boolean")
          return "isActive: boolean expected";
      }
      return null;
    };

    /**
     * Creates a SetPublisherActive message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.SetPublisherActive} SetPublisherActive
     */
    SetPublisherActive.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.SetPublisherActive)
        return object;
      var message = new $root.pyth_lazer_transaction.SetPublisherActive();
      if (object.isActive != null) message.isActive = Boolean(object.isActive);
      return message;
    };

    /**
     * Creates a plain object from a SetPublisherActive message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {pyth_lazer_transaction.SetPublisherActive} message SetPublisherActive
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    SetPublisherActive.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.isActive != null && message.hasOwnProperty("isActive")) {
        object.isActive = message.isActive;
        if (options.oneofs) object._isActive = "isActive";
      }
      return object;
    };

    /**
     * Converts this SetPublisherActive to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    SetPublisherActive.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for SetPublisherActive
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.SetPublisherActive
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    SetPublisherActive.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.SetPublisherActive";
    };

    return SetPublisherActive;
  })();

  pyth_lazer_transaction.AddFeed = (function () {
    /**
     * Properties of an AddFeed.
     * @memberof pyth_lazer_transaction
     * @interface IAddFeed
     * @property {number|null} [feedId] AddFeed feedId
     * @property {pyth_lazer_transaction.DynamicValue.IMap|null} [metadata] AddFeed metadata
     * @property {Array.<number>|null} [permissionedPublishers] AddFeed permissionedPublishers
     */

    /**
     * Constructs a new AddFeed.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an AddFeed.
     * @implements IAddFeed
     * @constructor
     * @param {pyth_lazer_transaction.IAddFeed=} [properties] Properties to set
     */
    function AddFeed(properties) {
      this.permissionedPublishers = [];
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * AddFeed feedId.
     * @member {number|null|undefined} feedId
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     */
    AddFeed.prototype.feedId = null;

    /**
     * AddFeed metadata.
     * @member {pyth_lazer_transaction.DynamicValue.IMap|null|undefined} metadata
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     */
    AddFeed.prototype.metadata = null;

    /**
     * AddFeed permissionedPublishers.
     * @member {Array.<number>} permissionedPublishers
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     */
    AddFeed.prototype.permissionedPublishers = $util.emptyArray;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * AddFeed _feedId.
     * @member {"feedId"|undefined} _feedId
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     */
    Object.defineProperty(AddFeed.prototype, "_feedId", {
      get: $util.oneOfGetter(($oneOfFields = ["feedId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * AddFeed _metadata.
     * @member {"metadata"|undefined} _metadata
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     */
    Object.defineProperty(AddFeed.prototype, "_metadata", {
      get: $util.oneOfGetter(($oneOfFields = ["metadata"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new AddFeed instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {pyth_lazer_transaction.IAddFeed=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.AddFeed} AddFeed instance
     */
    AddFeed.create = function create(properties) {
      return new AddFeed(properties);
    };

    /**
     * Encodes the specified AddFeed message. Does not implicitly {@link pyth_lazer_transaction.AddFeed.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {pyth_lazer_transaction.IAddFeed} message AddFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddFeed.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.feedId != null &&
        Object.hasOwnProperty.call(message, "feedId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.feedId);
      if (
        message.metadata != null &&
        Object.hasOwnProperty.call(message, "metadata")
      )
        $root.pyth_lazer_transaction.DynamicValue.Map.encode(
          message.metadata,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      if (
        message.permissionedPublishers != null &&
        message.permissionedPublishers.length
      ) {
        writer.uint32(/* id 3, wireType 2 =*/ 26).fork();
        for (var i = 0; i < message.permissionedPublishers.length; ++i)
          writer.uint32(message.permissionedPublishers[i]);
        writer.ldelim();
      }
      return writer;
    };

    /**
     * Encodes the specified AddFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddFeed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {pyth_lazer_transaction.IAddFeed} message AddFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    AddFeed.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an AddFeed message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.AddFeed} AddFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddFeed.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.AddFeed();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.feedId = reader.uint32();
            break;
          }
          case 2: {
            message.metadata =
              $root.pyth_lazer_transaction.DynamicValue.Map.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 3: {
            if (
              !(
                message.permissionedPublishers &&
                message.permissionedPublishers.length
              )
            )
              message.permissionedPublishers = [];
            if ((tag & 7) === 2) {
              var end2 = reader.uint32() + reader.pos;
              while (reader.pos < end2)
                message.permissionedPublishers.push(reader.uint32());
            } else message.permissionedPublishers.push(reader.uint32());
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
     * Decodes an AddFeed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.AddFeed} AddFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    AddFeed.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an AddFeed message.
     * @function verify
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    AddFeed.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.feedId != null && message.hasOwnProperty("feedId")) {
        properties._feedId = 1;
        if (!$util.isInteger(message.feedId)) return "feedId: integer expected";
      }
      if (message.metadata != null && message.hasOwnProperty("metadata")) {
        properties._metadata = 1;
        {
          var error = $root.pyth_lazer_transaction.DynamicValue.Map.verify(
            message.metadata,
          );
          if (error) return "metadata." + error;
        }
      }
      if (
        message.permissionedPublishers != null &&
        message.hasOwnProperty("permissionedPublishers")
      ) {
        if (!Array.isArray(message.permissionedPublishers))
          return "permissionedPublishers: array expected";
        for (var i = 0; i < message.permissionedPublishers.length; ++i)
          if (!$util.isInteger(message.permissionedPublishers[i]))
            return "permissionedPublishers: integer[] expected";
      }
      return null;
    };

    /**
     * Creates an AddFeed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.AddFeed} AddFeed
     */
    AddFeed.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.AddFeed) return object;
      var message = new $root.pyth_lazer_transaction.AddFeed();
      if (object.feedId != null) message.feedId = object.feedId >>> 0;
      if (object.metadata != null) {
        if (typeof object.metadata !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.AddFeed.metadata: object expected",
          );
        message.metadata =
          $root.pyth_lazer_transaction.DynamicValue.Map.fromObject(
            object.metadata,
          );
      }
      if (object.permissionedPublishers) {
        if (!Array.isArray(object.permissionedPublishers))
          throw TypeError(
            ".pyth_lazer_transaction.AddFeed.permissionedPublishers: array expected",
          );
        message.permissionedPublishers = [];
        for (var i = 0; i < object.permissionedPublishers.length; ++i)
          message.permissionedPublishers[i] =
            object.permissionedPublishers[i] >>> 0;
      }
      return message;
    };

    /**
     * Creates a plain object from an AddFeed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {pyth_lazer_transaction.AddFeed} message AddFeed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    AddFeed.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (options.arrays || options.defaults)
        object.permissionedPublishers = [];
      if (message.feedId != null && message.hasOwnProperty("feedId")) {
        object.feedId = message.feedId;
        if (options.oneofs) object._feedId = "feedId";
      }
      if (message.metadata != null && message.hasOwnProperty("metadata")) {
        object.metadata =
          $root.pyth_lazer_transaction.DynamicValue.Map.toObject(
            message.metadata,
            options,
          );
        if (options.oneofs) object._metadata = "metadata";
      }
      if (
        message.permissionedPublishers &&
        message.permissionedPublishers.length
      ) {
        object.permissionedPublishers = [];
        for (var j = 0; j < message.permissionedPublishers.length; ++j)
          object.permissionedPublishers[j] = message.permissionedPublishers[j];
      }
      return object;
    };

    /**
     * Converts this AddFeed to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.AddFeed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    AddFeed.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for AddFeed
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.AddFeed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    AddFeed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.AddFeed";
    };

    return AddFeed;
  })();

  pyth_lazer_transaction.UpdateFeed = (function () {
    /**
     * Properties of an UpdateFeed.
     * @memberof pyth_lazer_transaction
     * @interface IUpdateFeed
     * @property {number|null} [feedId] UpdateFeed feedId
     * @property {pyth_lazer_transaction.IUpdateFeedMetadata|null} [updateFeedMetadata] UpdateFeed updateFeedMetadata
     * @property {pyth_lazer_transaction.IActivateFeed|null} [activateFeed] UpdateFeed activateFeed
     * @property {pyth_lazer_transaction.IDeactivateFeed|null} [deactivateFeed] UpdateFeed deactivateFeed
     * @property {google.protobuf.IEmpty|null} [removeFeed] UpdateFeed removeFeed
     */

    /**
     * Constructs a new UpdateFeed.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an UpdateFeed.
     * @implements IUpdateFeed
     * @constructor
     * @param {pyth_lazer_transaction.IUpdateFeed=} [properties] Properties to set
     */
    function UpdateFeed(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UpdateFeed feedId.
     * @member {number|null|undefined} feedId
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    UpdateFeed.prototype.feedId = null;

    /**
     * UpdateFeed updateFeedMetadata.
     * @member {pyth_lazer_transaction.IUpdateFeedMetadata|null|undefined} updateFeedMetadata
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    UpdateFeed.prototype.updateFeedMetadata = null;

    /**
     * UpdateFeed activateFeed.
     * @member {pyth_lazer_transaction.IActivateFeed|null|undefined} activateFeed
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    UpdateFeed.prototype.activateFeed = null;

    /**
     * UpdateFeed deactivateFeed.
     * @member {pyth_lazer_transaction.IDeactivateFeed|null|undefined} deactivateFeed
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    UpdateFeed.prototype.deactivateFeed = null;

    /**
     * UpdateFeed removeFeed.
     * @member {google.protobuf.IEmpty|null|undefined} removeFeed
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    UpdateFeed.prototype.removeFeed = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * UpdateFeed _feedId.
     * @member {"feedId"|undefined} _feedId
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    Object.defineProperty(UpdateFeed.prototype, "_feedId", {
      get: $util.oneOfGetter(($oneOfFields = ["feedId"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * UpdateFeed action.
     * @member {"updateFeedMetadata"|"activateFeed"|"deactivateFeed"|"removeFeed"|undefined} action
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     */
    Object.defineProperty(UpdateFeed.prototype, "action", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "updateFeedMetadata",
          "activateFeed",
          "deactivateFeed",
          "removeFeed",
        ]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new UpdateFeed instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeed=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.UpdateFeed} UpdateFeed instance
     */
    UpdateFeed.create = function create(properties) {
      return new UpdateFeed(properties);
    };

    /**
     * Encodes the specified UpdateFeed message. Does not implicitly {@link pyth_lazer_transaction.UpdateFeed.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeed} message UpdateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateFeed.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.feedId != null &&
        Object.hasOwnProperty.call(message, "feedId")
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.feedId);
      if (
        message.updateFeedMetadata != null &&
        Object.hasOwnProperty.call(message, "updateFeedMetadata")
      )
        $root.pyth_lazer_transaction.UpdateFeedMetadata.encode(
          message.updateFeedMetadata,
          writer.uint32(/* id 101, wireType 2 =*/ 810).fork(),
        ).ldelim();
      if (
        message.activateFeed != null &&
        Object.hasOwnProperty.call(message, "activateFeed")
      )
        $root.pyth_lazer_transaction.ActivateFeed.encode(
          message.activateFeed,
          writer.uint32(/* id 102, wireType 2 =*/ 818).fork(),
        ).ldelim();
      if (
        message.deactivateFeed != null &&
        Object.hasOwnProperty.call(message, "deactivateFeed")
      )
        $root.pyth_lazer_transaction.DeactivateFeed.encode(
          message.deactivateFeed,
          writer.uint32(/* id 103, wireType 2 =*/ 826).fork(),
        ).ldelim();
      if (
        message.removeFeed != null &&
        Object.hasOwnProperty.call(message, "removeFeed")
      )
        $root.google.protobuf.Empty.encode(
          message.removeFeed,
          writer.uint32(/* id 199, wireType 2 =*/ 1594).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified UpdateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateFeed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeed} message UpdateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateFeed.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an UpdateFeed message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.UpdateFeed} UpdateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateFeed.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.UpdateFeed();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.feedId = reader.uint32();
            break;
          }
          case 101: {
            message.updateFeedMetadata =
              $root.pyth_lazer_transaction.UpdateFeedMetadata.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 102: {
            message.activateFeed =
              $root.pyth_lazer_transaction.ActivateFeed.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 103: {
            message.deactivateFeed =
              $root.pyth_lazer_transaction.DeactivateFeed.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 199: {
            message.removeFeed = $root.google.protobuf.Empty.decode(
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
     * Decodes an UpdateFeed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.UpdateFeed} UpdateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateFeed.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an UpdateFeed message.
     * @function verify
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UpdateFeed.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.feedId != null && message.hasOwnProperty("feedId")) {
        properties._feedId = 1;
        if (!$util.isInteger(message.feedId)) return "feedId: integer expected";
      }
      if (
        message.updateFeedMetadata != null &&
        message.hasOwnProperty("updateFeedMetadata")
      ) {
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.UpdateFeedMetadata.verify(
            message.updateFeedMetadata,
          );
          if (error) return "updateFeedMetadata." + error;
        }
      }
      if (
        message.activateFeed != null &&
        message.hasOwnProperty("activateFeed")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.ActivateFeed.verify(
            message.activateFeed,
          );
          if (error) return "activateFeed." + error;
        }
      }
      if (
        message.deactivateFeed != null &&
        message.hasOwnProperty("deactivateFeed")
      ) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.pyth_lazer_transaction.DeactivateFeed.verify(
            message.deactivateFeed,
          );
          if (error) return "deactivateFeed." + error;
        }
      }
      if (message.removeFeed != null && message.hasOwnProperty("removeFeed")) {
        if (properties.action === 1) return "action: multiple values";
        properties.action = 1;
        {
          var error = $root.google.protobuf.Empty.verify(message.removeFeed);
          if (error) return "removeFeed." + error;
        }
      }
      return null;
    };

    /**
     * Creates an UpdateFeed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.UpdateFeed} UpdateFeed
     */
    UpdateFeed.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.UpdateFeed)
        return object;
      var message = new $root.pyth_lazer_transaction.UpdateFeed();
      if (object.feedId != null) message.feedId = object.feedId >>> 0;
      if (object.updateFeedMetadata != null) {
        if (typeof object.updateFeedMetadata !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateFeed.updateFeedMetadata: object expected",
          );
        message.updateFeedMetadata =
          $root.pyth_lazer_transaction.UpdateFeedMetadata.fromObject(
            object.updateFeedMetadata,
          );
      }
      if (object.activateFeed != null) {
        if (typeof object.activateFeed !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateFeed.activateFeed: object expected",
          );
        message.activateFeed =
          $root.pyth_lazer_transaction.ActivateFeed.fromObject(
            object.activateFeed,
          );
      }
      if (object.deactivateFeed != null) {
        if (typeof object.deactivateFeed !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateFeed.deactivateFeed: object expected",
          );
        message.deactivateFeed =
          $root.pyth_lazer_transaction.DeactivateFeed.fromObject(
            object.deactivateFeed,
          );
      }
      if (object.removeFeed != null) {
        if (typeof object.removeFeed !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateFeed.removeFeed: object expected",
          );
        message.removeFeed = $root.google.protobuf.Empty.fromObject(
          object.removeFeed,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from an UpdateFeed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {pyth_lazer_transaction.UpdateFeed} message UpdateFeed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UpdateFeed.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.feedId != null && message.hasOwnProperty("feedId")) {
        object.feedId = message.feedId;
        if (options.oneofs) object._feedId = "feedId";
      }
      if (
        message.updateFeedMetadata != null &&
        message.hasOwnProperty("updateFeedMetadata")
      ) {
        object.updateFeedMetadata =
          $root.pyth_lazer_transaction.UpdateFeedMetadata.toObject(
            message.updateFeedMetadata,
            options,
          );
        if (options.oneofs) object.action = "updateFeedMetadata";
      }
      if (
        message.activateFeed != null &&
        message.hasOwnProperty("activateFeed")
      ) {
        object.activateFeed =
          $root.pyth_lazer_transaction.ActivateFeed.toObject(
            message.activateFeed,
            options,
          );
        if (options.oneofs) object.action = "activateFeed";
      }
      if (
        message.deactivateFeed != null &&
        message.hasOwnProperty("deactivateFeed")
      ) {
        object.deactivateFeed =
          $root.pyth_lazer_transaction.DeactivateFeed.toObject(
            message.deactivateFeed,
            options,
          );
        if (options.oneofs) object.action = "deactivateFeed";
      }
      if (message.removeFeed != null && message.hasOwnProperty("removeFeed")) {
        object.removeFeed = $root.google.protobuf.Empty.toObject(
          message.removeFeed,
          options,
        );
        if (options.oneofs) object.action = "removeFeed";
      }
      return object;
    };

    /**
     * Converts this UpdateFeed to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UpdateFeed.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UpdateFeed
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.UpdateFeed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UpdateFeed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.UpdateFeed";
    };

    return UpdateFeed;
  })();

  pyth_lazer_transaction.UpdateFeedMetadata = (function () {
    /**
     * Properties of an UpdateFeedMetadata.
     * @memberof pyth_lazer_transaction
     * @interface IUpdateFeedMetadata
     * @property {string|null} [name] UpdateFeedMetadata name
     * @property {pyth_lazer_transaction.IDynamicValue|null} [value] UpdateFeedMetadata value
     */

    /**
     * Constructs a new UpdateFeedMetadata.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an UpdateFeedMetadata.
     * @implements IUpdateFeedMetadata
     * @constructor
     * @param {pyth_lazer_transaction.IUpdateFeedMetadata=} [properties] Properties to set
     */
    function UpdateFeedMetadata(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * UpdateFeedMetadata name.
     * @member {string|null|undefined} name
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @instance
     */
    UpdateFeedMetadata.prototype.name = null;

    /**
     * UpdateFeedMetadata value.
     * @member {pyth_lazer_transaction.IDynamicValue|null|undefined} value
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @instance
     */
    UpdateFeedMetadata.prototype.value = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * UpdateFeedMetadata _name.
     * @member {"name"|undefined} _name
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @instance
     */
    Object.defineProperty(UpdateFeedMetadata.prototype, "_name", {
      get: $util.oneOfGetter(($oneOfFields = ["name"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * UpdateFeedMetadata _value.
     * @member {"value"|undefined} _value
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @instance
     */
    Object.defineProperty(UpdateFeedMetadata.prototype, "_value", {
      get: $util.oneOfGetter(($oneOfFields = ["value"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new UpdateFeedMetadata instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeedMetadata=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.UpdateFeedMetadata} UpdateFeedMetadata instance
     */
    UpdateFeedMetadata.create = function create(properties) {
      return new UpdateFeedMetadata(properties);
    };

    /**
     * Encodes the specified UpdateFeedMetadata message. Does not implicitly {@link pyth_lazer_transaction.UpdateFeedMetadata.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeedMetadata} message UpdateFeedMetadata message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateFeedMetadata.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (message.name != null && Object.hasOwnProperty.call(message, "name"))
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.name);
      if (message.value != null && Object.hasOwnProperty.call(message, "value"))
        $root.pyth_lazer_transaction.DynamicValue.encode(
          message.value,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified UpdateFeedMetadata message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateFeedMetadata.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {pyth_lazer_transaction.IUpdateFeedMetadata} message UpdateFeedMetadata message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    UpdateFeedMetadata.encodeDelimited = function encodeDelimited(
      message,
      writer,
    ) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an UpdateFeedMetadata message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.UpdateFeedMetadata} UpdateFeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateFeedMetadata.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.UpdateFeedMetadata();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.name = reader.string();
            break;
          }
          case 2: {
            message.value = $root.pyth_lazer_transaction.DynamicValue.decode(
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
     * Decodes an UpdateFeedMetadata message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.UpdateFeedMetadata} UpdateFeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    UpdateFeedMetadata.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an UpdateFeedMetadata message.
     * @function verify
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    UpdateFeedMetadata.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (message.name != null && message.hasOwnProperty("name")) {
        properties._name = 1;
        if (!$util.isString(message.name)) return "name: string expected";
      }
      if (message.value != null && message.hasOwnProperty("value")) {
        properties._value = 1;
        {
          var error = $root.pyth_lazer_transaction.DynamicValue.verify(
            message.value,
          );
          if (error) return "value." + error;
        }
      }
      return null;
    };

    /**
     * Creates an UpdateFeedMetadata message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.UpdateFeedMetadata} UpdateFeedMetadata
     */
    UpdateFeedMetadata.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.UpdateFeedMetadata)
        return object;
      var message = new $root.pyth_lazer_transaction.UpdateFeedMetadata();
      if (object.name != null) message.name = String(object.name);
      if (object.value != null) {
        if (typeof object.value !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.UpdateFeedMetadata.value: object expected",
          );
        message.value = $root.pyth_lazer_transaction.DynamicValue.fromObject(
          object.value,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from an UpdateFeedMetadata message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {pyth_lazer_transaction.UpdateFeedMetadata} message UpdateFeedMetadata
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    UpdateFeedMetadata.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (message.name != null && message.hasOwnProperty("name")) {
        object.name = message.name;
        if (options.oneofs) object._name = "name";
      }
      if (message.value != null && message.hasOwnProperty("value")) {
        object.value = $root.pyth_lazer_transaction.DynamicValue.toObject(
          message.value,
          options,
        );
        if (options.oneofs) object._value = "value";
      }
      return object;
    };

    /**
     * Converts this UpdateFeedMetadata to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    UpdateFeedMetadata.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for UpdateFeedMetadata
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.UpdateFeedMetadata
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    UpdateFeedMetadata.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.UpdateFeedMetadata";
    };

    return UpdateFeedMetadata;
  })();

  pyth_lazer_transaction.ActivateFeed = (function () {
    /**
     * Properties of an ActivateFeed.
     * @memberof pyth_lazer_transaction
     * @interface IActivateFeed
     * @property {google.protobuf.ITimestamp|null} [activationTimestamp] ActivateFeed activationTimestamp
     */

    /**
     * Constructs a new ActivateFeed.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents an ActivateFeed.
     * @implements IActivateFeed
     * @constructor
     * @param {pyth_lazer_transaction.IActivateFeed=} [properties] Properties to set
     */
    function ActivateFeed(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * ActivateFeed activationTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} activationTimestamp
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @instance
     */
    ActivateFeed.prototype.activationTimestamp = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * ActivateFeed _activationTimestamp.
     * @member {"activationTimestamp"|undefined} _activationTimestamp
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @instance
     */
    Object.defineProperty(ActivateFeed.prototype, "_activationTimestamp", {
      get: $util.oneOfGetter(($oneOfFields = ["activationTimestamp"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new ActivateFeed instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {pyth_lazer_transaction.IActivateFeed=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.ActivateFeed} ActivateFeed instance
     */
    ActivateFeed.create = function create(properties) {
      return new ActivateFeed(properties);
    };

    /**
     * Encodes the specified ActivateFeed message. Does not implicitly {@link pyth_lazer_transaction.ActivateFeed.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {pyth_lazer_transaction.IActivateFeed} message ActivateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ActivateFeed.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.activationTimestamp != null &&
        Object.hasOwnProperty.call(message, "activationTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.activationTimestamp,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified ActivateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ActivateFeed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {pyth_lazer_transaction.IActivateFeed} message ActivateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ActivateFeed.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes an ActivateFeed message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.ActivateFeed} ActivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ActivateFeed.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.ActivateFeed();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.activationTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
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
     * Decodes an ActivateFeed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.ActivateFeed} ActivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ActivateFeed.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an ActivateFeed message.
     * @function verify
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ActivateFeed.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.activationTimestamp != null &&
        message.hasOwnProperty("activationTimestamp")
      ) {
        properties._activationTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.activationTimestamp,
          );
          if (error) return "activationTimestamp." + error;
        }
      }
      return null;
    };

    /**
     * Creates an ActivateFeed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.ActivateFeed} ActivateFeed
     */
    ActivateFeed.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.ActivateFeed)
        return object;
      var message = new $root.pyth_lazer_transaction.ActivateFeed();
      if (object.activationTimestamp != null) {
        if (typeof object.activationTimestamp !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.ActivateFeed.activationTimestamp: object expected",
          );
        message.activationTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.activationTimestamp,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from an ActivateFeed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {pyth_lazer_transaction.ActivateFeed} message ActivateFeed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ActivateFeed.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.activationTimestamp != null &&
        message.hasOwnProperty("activationTimestamp")
      ) {
        object.activationTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.activationTimestamp,
          options,
        );
        if (options.oneofs) object._activationTimestamp = "activationTimestamp";
      }
      return object;
    };

    /**
     * Converts this ActivateFeed to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ActivateFeed.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for ActivateFeed
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.ActivateFeed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    ActivateFeed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.ActivateFeed";
    };

    return ActivateFeed;
  })();

  pyth_lazer_transaction.DeactivateFeed = (function () {
    /**
     * Properties of a DeactivateFeed.
     * @memberof pyth_lazer_transaction
     * @interface IDeactivateFeed
     * @property {google.protobuf.ITimestamp|null} [deactivationTimestamp] DeactivateFeed deactivationTimestamp
     */

    /**
     * Constructs a new DeactivateFeed.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a DeactivateFeed.
     * @implements IDeactivateFeed
     * @constructor
     * @param {pyth_lazer_transaction.IDeactivateFeed=} [properties] Properties to set
     */
    function DeactivateFeed(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * DeactivateFeed deactivationTimestamp.
     * @member {google.protobuf.ITimestamp|null|undefined} deactivationTimestamp
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @instance
     */
    DeactivateFeed.prototype.deactivationTimestamp = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * DeactivateFeed _deactivationTimestamp.
     * @member {"deactivationTimestamp"|undefined} _deactivationTimestamp
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @instance
     */
    Object.defineProperty(DeactivateFeed.prototype, "_deactivationTimestamp", {
      get: $util.oneOfGetter(($oneOfFields = ["deactivationTimestamp"])),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new DeactivateFeed instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {pyth_lazer_transaction.IDeactivateFeed=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.DeactivateFeed} DeactivateFeed instance
     */
    DeactivateFeed.create = function create(properties) {
      return new DeactivateFeed(properties);
    };

    /**
     * Encodes the specified DeactivateFeed message. Does not implicitly {@link pyth_lazer_transaction.DeactivateFeed.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {pyth_lazer_transaction.IDeactivateFeed} message DeactivateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeactivateFeed.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.deactivationTimestamp != null &&
        Object.hasOwnProperty.call(message, "deactivationTimestamp")
      )
        $root.google.protobuf.Timestamp.encode(
          message.deactivationTimestamp,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified DeactivateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DeactivateFeed.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {pyth_lazer_transaction.IDeactivateFeed} message DeactivateFeed message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DeactivateFeed.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DeactivateFeed message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.DeactivateFeed} DeactivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeactivateFeed.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.DeactivateFeed();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.deactivationTimestamp =
              $root.google.protobuf.Timestamp.decode(reader, reader.uint32());
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
     * Decodes a DeactivateFeed message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.DeactivateFeed} DeactivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DeactivateFeed.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DeactivateFeed message.
     * @function verify
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DeactivateFeed.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.deactivationTimestamp != null &&
        message.hasOwnProperty("deactivationTimestamp")
      ) {
        properties._deactivationTimestamp = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.deactivationTimestamp,
          );
          if (error) return "deactivationTimestamp." + error;
        }
      }
      return null;
    };

    /**
     * Creates a DeactivateFeed message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.DeactivateFeed} DeactivateFeed
     */
    DeactivateFeed.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.DeactivateFeed)
        return object;
      var message = new $root.pyth_lazer_transaction.DeactivateFeed();
      if (object.deactivationTimestamp != null) {
        if (typeof object.deactivationTimestamp !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.DeactivateFeed.deactivationTimestamp: object expected",
          );
        message.deactivationTimestamp =
          $root.google.protobuf.Timestamp.fromObject(
            object.deactivationTimestamp,
          );
      }
      return message;
    };

    /**
     * Creates a plain object from a DeactivateFeed message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {pyth_lazer_transaction.DeactivateFeed} message DeactivateFeed
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DeactivateFeed.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.deactivationTimestamp != null &&
        message.hasOwnProperty("deactivationTimestamp")
      ) {
        object.deactivationTimestamp = $root.google.protobuf.Timestamp.toObject(
          message.deactivationTimestamp,
          options,
        );
        if (options.oneofs)
          object._deactivationTimestamp = "deactivationTimestamp";
      }
      return object;
    };

    /**
     * Converts this DeactivateFeed to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DeactivateFeed.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for DeactivateFeed
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.DeactivateFeed
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    DeactivateFeed.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.DeactivateFeed";
    };

    return DeactivateFeed;
  })();

  pyth_lazer_transaction.DynamicValue = (function () {
    /**
     * Properties of a DynamicValue.
     * @memberof pyth_lazer_transaction
     * @interface IDynamicValue
     * @property {string|null} [stringValue] DynamicValue stringValue
     * @property {number|null} [doubleValue] DynamicValue doubleValue
     * @property {number|Long|null} [uintValue] DynamicValue uintValue
     * @property {number|Long|null} [intValue] DynamicValue intValue
     * @property {boolean|null} [boolValue] DynamicValue boolValue
     * @property {Uint8Array|null} [bytesValue] DynamicValue bytesValue
     * @property {google.protobuf.IDuration|null} [durationValue] DynamicValue durationValue
     * @property {google.protobuf.ITimestamp|null} [timestampValue] DynamicValue timestampValue
     * @property {pyth_lazer_transaction.DynamicValue.IList|null} [list] DynamicValue list
     * @property {pyth_lazer_transaction.DynamicValue.IMap|null} [map] DynamicValue map
     */

    /**
     * Constructs a new DynamicValue.
     * @memberof pyth_lazer_transaction
     * @classdesc Represents a DynamicValue.
     * @implements IDynamicValue
     * @constructor
     * @param {pyth_lazer_transaction.IDynamicValue=} [properties] Properties to set
     */
    function DynamicValue(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * DynamicValue stringValue.
     * @member {string|null|undefined} stringValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.stringValue = null;

    /**
     * DynamicValue doubleValue.
     * @member {number|null|undefined} doubleValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.doubleValue = null;

    /**
     * DynamicValue uintValue.
     * @member {number|Long|null|undefined} uintValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.uintValue = null;

    /**
     * DynamicValue intValue.
     * @member {number|Long|null|undefined} intValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.intValue = null;

    /**
     * DynamicValue boolValue.
     * @member {boolean|null|undefined} boolValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.boolValue = null;

    /**
     * DynamicValue bytesValue.
     * @member {Uint8Array|null|undefined} bytesValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.bytesValue = null;

    /**
     * DynamicValue durationValue.
     * @member {google.protobuf.IDuration|null|undefined} durationValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.durationValue = null;

    /**
     * DynamicValue timestampValue.
     * @member {google.protobuf.ITimestamp|null|undefined} timestampValue
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.timestampValue = null;

    /**
     * DynamicValue list.
     * @member {pyth_lazer_transaction.DynamicValue.IList|null|undefined} list
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.list = null;

    /**
     * DynamicValue map.
     * @member {pyth_lazer_transaction.DynamicValue.IMap|null|undefined} map
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    DynamicValue.prototype.map = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * DynamicValue value.
     * @member {"stringValue"|"doubleValue"|"uintValue"|"intValue"|"boolValue"|"bytesValue"|"durationValue"|"timestampValue"|"list"|"map"|undefined} value
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     */
    Object.defineProperty(DynamicValue.prototype, "value", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "stringValue",
          "doubleValue",
          "uintValue",
          "intValue",
          "boolValue",
          "bytesValue",
          "durationValue",
          "timestampValue",
          "list",
          "map",
        ]),
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new DynamicValue instance using the specified properties.
     * @function create
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {pyth_lazer_transaction.IDynamicValue=} [properties] Properties to set
     * @returns {pyth_lazer_transaction.DynamicValue} DynamicValue instance
     */
    DynamicValue.create = function create(properties) {
      return new DynamicValue(properties);
    };

    /**
     * Encodes the specified DynamicValue message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.verify|verify} messages.
     * @function encode
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {pyth_lazer_transaction.IDynamicValue} message DynamicValue message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DynamicValue.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      if (
        message.stringValue != null &&
        Object.hasOwnProperty.call(message, "stringValue")
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.stringValue);
      if (
        message.doubleValue != null &&
        Object.hasOwnProperty.call(message, "doubleValue")
      )
        writer.uint32(/* id 2, wireType 1 =*/ 17).double(message.doubleValue);
      if (
        message.uintValue != null &&
        Object.hasOwnProperty.call(message, "uintValue")
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).uint64(message.uintValue);
      if (
        message.intValue != null &&
        Object.hasOwnProperty.call(message, "intValue")
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).sint64(message.intValue);
      if (
        message.boolValue != null &&
        Object.hasOwnProperty.call(message, "boolValue")
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).bool(message.boolValue);
      if (
        message.bytesValue != null &&
        Object.hasOwnProperty.call(message, "bytesValue")
      )
        writer.uint32(/* id 6, wireType 2 =*/ 50).bytes(message.bytesValue);
      if (
        message.durationValue != null &&
        Object.hasOwnProperty.call(message, "durationValue")
      )
        $root.google.protobuf.Duration.encode(
          message.durationValue,
          writer.uint32(/* id 7, wireType 2 =*/ 58).fork(),
        ).ldelim();
      if (
        message.timestampValue != null &&
        Object.hasOwnProperty.call(message, "timestampValue")
      )
        $root.google.protobuf.Timestamp.encode(
          message.timestampValue,
          writer.uint32(/* id 8, wireType 2 =*/ 66).fork(),
        ).ldelim();
      if (message.list != null && Object.hasOwnProperty.call(message, "list"))
        $root.pyth_lazer_transaction.DynamicValue.List.encode(
          message.list,
          writer.uint32(/* id 9, wireType 2 =*/ 74).fork(),
        ).ldelim();
      if (message.map != null && Object.hasOwnProperty.call(message, "map"))
        $root.pyth_lazer_transaction.DynamicValue.Map.encode(
          message.map,
          writer.uint32(/* id 10, wireType 2 =*/ 82).fork(),
        ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified DynamicValue message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {pyth_lazer_transaction.IDynamicValue} message DynamicValue message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    DynamicValue.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a DynamicValue message from the specified reader or buffer.
     * @function decode
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pyth_lazer_transaction.DynamicValue} DynamicValue
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DynamicValue.decode = function decode(reader, length, error) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      var end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.pyth_lazer_transaction.DynamicValue();
      while (reader.pos < end) {
        var tag = reader.uint32();
        if (tag === error) break;
        switch (tag >>> 3) {
          case 1: {
            message.stringValue = reader.string();
            break;
          }
          case 2: {
            message.doubleValue = reader.double();
            break;
          }
          case 3: {
            message.uintValue = reader.uint64();
            break;
          }
          case 4: {
            message.intValue = reader.sint64();
            break;
          }
          case 5: {
            message.boolValue = reader.bool();
            break;
          }
          case 6: {
            message.bytesValue = reader.bytes();
            break;
          }
          case 7: {
            message.durationValue = $root.google.protobuf.Duration.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 8: {
            message.timestampValue = $root.google.protobuf.Timestamp.decode(
              reader,
              reader.uint32(),
            );
            break;
          }
          case 9: {
            message.list =
              $root.pyth_lazer_transaction.DynamicValue.List.decode(
                reader,
                reader.uint32(),
              );
            break;
          }
          case 10: {
            message.map = $root.pyth_lazer_transaction.DynamicValue.Map.decode(
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
     * Decodes a DynamicValue message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pyth_lazer_transaction.DynamicValue} DynamicValue
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    DynamicValue.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a DynamicValue message.
     * @function verify
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    DynamicValue.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      var properties = {};
      if (
        message.stringValue != null &&
        message.hasOwnProperty("stringValue")
      ) {
        properties.value = 1;
        if (!$util.isString(message.stringValue))
          return "stringValue: string expected";
      }
      if (
        message.doubleValue != null &&
        message.hasOwnProperty("doubleValue")
      ) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        if (typeof message.doubleValue !== "number")
          return "doubleValue: number expected";
      }
      if (message.uintValue != null && message.hasOwnProperty("uintValue")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        if (
          !$util.isInteger(message.uintValue) &&
          !(
            message.uintValue &&
            $util.isInteger(message.uintValue.low) &&
            $util.isInteger(message.uintValue.high)
          )
        )
          return "uintValue: integer|Long expected";
      }
      if (message.intValue != null && message.hasOwnProperty("intValue")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        if (
          !$util.isInteger(message.intValue) &&
          !(
            message.intValue &&
            $util.isInteger(message.intValue.low) &&
            $util.isInteger(message.intValue.high)
          )
        )
          return "intValue: integer|Long expected";
      }
      if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        if (typeof message.boolValue !== "boolean")
          return "boolValue: boolean expected";
      }
      if (message.bytesValue != null && message.hasOwnProperty("bytesValue")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        if (
          !(
            (message.bytesValue &&
              typeof message.bytesValue.length === "number") ||
            $util.isString(message.bytesValue)
          )
        )
          return "bytesValue: buffer expected";
      }
      if (
        message.durationValue != null &&
        message.hasOwnProperty("durationValue")
      ) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        {
          var error = $root.google.protobuf.Duration.verify(
            message.durationValue,
          );
          if (error) return "durationValue." + error;
        }
      }
      if (
        message.timestampValue != null &&
        message.hasOwnProperty("timestampValue")
      ) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        {
          var error = $root.google.protobuf.Timestamp.verify(
            message.timestampValue,
          );
          if (error) return "timestampValue." + error;
        }
      }
      if (message.list != null && message.hasOwnProperty("list")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        {
          var error = $root.pyth_lazer_transaction.DynamicValue.List.verify(
            message.list,
          );
          if (error) return "list." + error;
        }
      }
      if (message.map != null && message.hasOwnProperty("map")) {
        if (properties.value === 1) return "value: multiple values";
        properties.value = 1;
        {
          var error = $root.pyth_lazer_transaction.DynamicValue.Map.verify(
            message.map,
          );
          if (error) return "map." + error;
        }
      }
      return null;
    };

    /**
     * Creates a DynamicValue message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pyth_lazer_transaction.DynamicValue} DynamicValue
     */
    DynamicValue.fromObject = function fromObject(object) {
      if (object instanceof $root.pyth_lazer_transaction.DynamicValue)
        return object;
      var message = new $root.pyth_lazer_transaction.DynamicValue();
      if (object.stringValue != null)
        message.stringValue = String(object.stringValue);
      if (object.doubleValue != null)
        message.doubleValue = Number(object.doubleValue);
      if (object.uintValue != null)
        if ($util.Long)
          (message.uintValue = $util.Long.fromValue(
            object.uintValue,
          )).unsigned = true;
        else if (typeof object.uintValue === "string")
          message.uintValue = parseInt(object.uintValue, 10);
        else if (typeof object.uintValue === "number")
          message.uintValue = object.uintValue;
        else if (typeof object.uintValue === "object")
          message.uintValue = new $util.LongBits(
            object.uintValue.low >>> 0,
            object.uintValue.high >>> 0,
          ).toNumber(true);
      if (object.intValue != null)
        if ($util.Long)
          (message.intValue = $util.Long.fromValue(object.intValue)).unsigned =
            false;
        else if (typeof object.intValue === "string")
          message.intValue = parseInt(object.intValue, 10);
        else if (typeof object.intValue === "number")
          message.intValue = object.intValue;
        else if (typeof object.intValue === "object")
          message.intValue = new $util.LongBits(
            object.intValue.low >>> 0,
            object.intValue.high >>> 0,
          ).toNumber();
      if (object.boolValue != null)
        message.boolValue = Boolean(object.boolValue);
      if (object.bytesValue != null)
        if (typeof object.bytesValue === "string")
          $util.base64.decode(
            object.bytesValue,
            (message.bytesValue = $util.newBuffer(
              $util.base64.length(object.bytesValue),
            )),
            0,
          );
        else if (object.bytesValue.length >= 0)
          message.bytesValue = object.bytesValue;
      if (object.durationValue != null) {
        if (typeof object.durationValue !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.DynamicValue.durationValue: object expected",
          );
        message.durationValue = $root.google.protobuf.Duration.fromObject(
          object.durationValue,
        );
      }
      if (object.timestampValue != null) {
        if (typeof object.timestampValue !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.DynamicValue.timestampValue: object expected",
          );
        message.timestampValue = $root.google.protobuf.Timestamp.fromObject(
          object.timestampValue,
        );
      }
      if (object.list != null) {
        if (typeof object.list !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.DynamicValue.list: object expected",
          );
        message.list =
          $root.pyth_lazer_transaction.DynamicValue.List.fromObject(
            object.list,
          );
      }
      if (object.map != null) {
        if (typeof object.map !== "object")
          throw TypeError(
            ".pyth_lazer_transaction.DynamicValue.map: object expected",
          );
        message.map = $root.pyth_lazer_transaction.DynamicValue.Map.fromObject(
          object.map,
        );
      }
      return message;
    };

    /**
     * Creates a plain object from a DynamicValue message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {pyth_lazer_transaction.DynamicValue} message DynamicValue
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    DynamicValue.toObject = function toObject(message, options) {
      if (!options) options = {};
      var object = {};
      if (
        message.stringValue != null &&
        message.hasOwnProperty("stringValue")
      ) {
        object.stringValue = message.stringValue;
        if (options.oneofs) object.value = "stringValue";
      }
      if (
        message.doubleValue != null &&
        message.hasOwnProperty("doubleValue")
      ) {
        object.doubleValue =
          options.json && !isFinite(message.doubleValue)
            ? String(message.doubleValue)
            : message.doubleValue;
        if (options.oneofs) object.value = "doubleValue";
      }
      if (message.uintValue != null && message.hasOwnProperty("uintValue")) {
        if (typeof message.uintValue === "number")
          object.uintValue =
            options.longs === String
              ? String(message.uintValue)
              : message.uintValue;
        else
          object.uintValue =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.uintValue)
              : options.longs === Number
                ? new $util.LongBits(
                    message.uintValue.low >>> 0,
                    message.uintValue.high >>> 0,
                  ).toNumber(true)
                : message.uintValue;
        if (options.oneofs) object.value = "uintValue";
      }
      if (message.intValue != null && message.hasOwnProperty("intValue")) {
        if (typeof message.intValue === "number")
          object.intValue =
            options.longs === String
              ? String(message.intValue)
              : message.intValue;
        else
          object.intValue =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.intValue)
              : options.longs === Number
                ? new $util.LongBits(
                    message.intValue.low >>> 0,
                    message.intValue.high >>> 0,
                  ).toNumber()
                : message.intValue;
        if (options.oneofs) object.value = "intValue";
      }
      if (message.boolValue != null && message.hasOwnProperty("boolValue")) {
        object.boolValue = message.boolValue;
        if (options.oneofs) object.value = "boolValue";
      }
      if (message.bytesValue != null && message.hasOwnProperty("bytesValue")) {
        object.bytesValue =
          options.bytes === String
            ? $util.base64.encode(
                message.bytesValue,
                0,
                message.bytesValue.length,
              )
            : options.bytes === Array
              ? Array.prototype.slice.call(message.bytesValue)
              : message.bytesValue;
        if (options.oneofs) object.value = "bytesValue";
      }
      if (
        message.durationValue != null &&
        message.hasOwnProperty("durationValue")
      ) {
        object.durationValue = $root.google.protobuf.Duration.toObject(
          message.durationValue,
          options,
        );
        if (options.oneofs) object.value = "durationValue";
      }
      if (
        message.timestampValue != null &&
        message.hasOwnProperty("timestampValue")
      ) {
        object.timestampValue = $root.google.protobuf.Timestamp.toObject(
          message.timestampValue,
          options,
        );
        if (options.oneofs) object.value = "timestampValue";
      }
      if (message.list != null && message.hasOwnProperty("list")) {
        object.list = $root.pyth_lazer_transaction.DynamicValue.List.toObject(
          message.list,
          options,
        );
        if (options.oneofs) object.value = "list";
      }
      if (message.map != null && message.hasOwnProperty("map")) {
        object.map = $root.pyth_lazer_transaction.DynamicValue.Map.toObject(
          message.map,
          options,
        );
        if (options.oneofs) object.value = "map";
      }
      return object;
    };

    /**
     * Converts this DynamicValue to JSON.
     * @function toJSON
     * @memberof pyth_lazer_transaction.DynamicValue
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    DynamicValue.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for DynamicValue
     * @function getTypeUrl
     * @memberof pyth_lazer_transaction.DynamicValue
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    DynamicValue.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/pyth_lazer_transaction.DynamicValue";
    };

    DynamicValue.List = (function () {
      /**
       * Properties of a List.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @interface IList
       * @property {Array.<pyth_lazer_transaction.IDynamicValue>|null} [items] List items
       */

      /**
       * Constructs a new List.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @classdesc Represents a List.
       * @implements IList
       * @constructor
       * @param {pyth_lazer_transaction.DynamicValue.IList=} [properties] Properties to set
       */
      function List(properties) {
        this.items = [];
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * List items.
       * @member {Array.<pyth_lazer_transaction.IDynamicValue>} items
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @instance
       */
      List.prototype.items = $util.emptyArray;

      /**
       * Creates a new List instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IList=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.DynamicValue.List} List instance
       */
      List.create = function create(properties) {
        return new List(properties);
      };

      /**
       * Encodes the specified List message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.List.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IList} message List message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      List.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (message.items != null && message.items.length)
          for (var i = 0; i < message.items.length; ++i)
            $root.pyth_lazer_transaction.DynamicValue.encode(
              message.items[i],
              writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
            ).ldelim();
        return writer;
      };

      /**
       * Encodes the specified List message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.List.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IList} message List message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      List.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a List message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.DynamicValue.List} List
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      List.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.pyth_lazer_transaction.DynamicValue.List();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              if (!(message.items && message.items.length)) message.items = [];
              message.items.push(
                $root.pyth_lazer_transaction.DynamicValue.decode(
                  reader,
                  reader.uint32(),
                ),
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
       * Decodes a List message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.DynamicValue.List} List
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      List.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a List message.
       * @function verify
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      List.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (message.items != null && message.hasOwnProperty("items")) {
          if (!Array.isArray(message.items)) return "items: array expected";
          for (var i = 0; i < message.items.length; ++i) {
            var error = $root.pyth_lazer_transaction.DynamicValue.verify(
              message.items[i],
            );
            if (error) return "items." + error;
          }
        }
        return null;
      };

      /**
       * Creates a List message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.DynamicValue.List} List
       */
      List.fromObject = function fromObject(object) {
        if (object instanceof $root.pyth_lazer_transaction.DynamicValue.List)
          return object;
        var message = new $root.pyth_lazer_transaction.DynamicValue.List();
        if (object.items) {
          if (!Array.isArray(object.items))
            throw TypeError(
              ".pyth_lazer_transaction.DynamicValue.List.items: array expected",
            );
          message.items = [];
          for (var i = 0; i < object.items.length; ++i) {
            if (typeof object.items[i] !== "object")
              throw TypeError(
                ".pyth_lazer_transaction.DynamicValue.List.items: object expected",
              );
            message.items[i] =
              $root.pyth_lazer_transaction.DynamicValue.fromObject(
                object.items[i],
              );
          }
        }
        return message;
      };

      /**
       * Creates a plain object from a List message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.List} message List
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      List.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.arrays || options.defaults) object.items = [];
        if (message.items && message.items.length) {
          object.items = [];
          for (var j = 0; j < message.items.length; ++j)
            object.items[j] =
              $root.pyth_lazer_transaction.DynamicValue.toObject(
                message.items[j],
                options,
              );
        }
        return object;
      };

      /**
       * Converts this List to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      List.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for List
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.DynamicValue.List
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      List.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/pyth_lazer_transaction.DynamicValue.List";
      };

      return List;
    })();

    DynamicValue.MapItem = (function () {
      /**
       * Properties of a MapItem.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @interface IMapItem
       * @property {string|null} [key] MapItem key
       * @property {pyth_lazer_transaction.IDynamicValue|null} [value] MapItem value
       */

      /**
       * Constructs a new MapItem.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @classdesc Represents a MapItem.
       * @implements IMapItem
       * @constructor
       * @param {pyth_lazer_transaction.DynamicValue.IMapItem=} [properties] Properties to set
       */
      function MapItem(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * MapItem key.
       * @member {string|null|undefined} key
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @instance
       */
      MapItem.prototype.key = null;

      /**
       * MapItem value.
       * @member {pyth_lazer_transaction.IDynamicValue|null|undefined} value
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @instance
       */
      MapItem.prototype.value = null;

      // OneOf field names bound to virtual getters and setters
      var $oneOfFields;

      /**
       * MapItem _key.
       * @member {"key"|undefined} _key
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @instance
       */
      Object.defineProperty(MapItem.prototype, "_key", {
        get: $util.oneOfGetter(($oneOfFields = ["key"])),
        set: $util.oneOfSetter($oneOfFields),
      });

      /**
       * MapItem _value.
       * @member {"value"|undefined} _value
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @instance
       */
      Object.defineProperty(MapItem.prototype, "_value", {
        get: $util.oneOfGetter(($oneOfFields = ["value"])),
        set: $util.oneOfSetter($oneOfFields),
      });

      /**
       * Creates a new MapItem instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMapItem=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.DynamicValue.MapItem} MapItem instance
       */
      MapItem.create = function create(properties) {
        return new MapItem(properties);
      };

      /**
       * Encodes the specified MapItem message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.MapItem.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMapItem} message MapItem message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      MapItem.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (message.key != null && Object.hasOwnProperty.call(message, "key"))
          writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.key);
        if (
          message.value != null &&
          Object.hasOwnProperty.call(message, "value")
        )
          $root.pyth_lazer_transaction.DynamicValue.encode(
            message.value,
            writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          ).ldelim();
        return writer;
      };

      /**
       * Encodes the specified MapItem message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.MapItem.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMapItem} message MapItem message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      MapItem.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a MapItem message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.DynamicValue.MapItem} MapItem
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      MapItem.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.pyth_lazer_transaction.DynamicValue.MapItem();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              message.key = reader.string();
              break;
            }
            case 2: {
              message.value = $root.pyth_lazer_transaction.DynamicValue.decode(
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
       * Decodes a MapItem message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.DynamicValue.MapItem} MapItem
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      MapItem.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a MapItem message.
       * @function verify
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      MapItem.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        var properties = {};
        if (message.key != null && message.hasOwnProperty("key")) {
          properties._key = 1;
          if (!$util.isString(message.key)) return "key: string expected";
        }
        if (message.value != null && message.hasOwnProperty("value")) {
          properties._value = 1;
          {
            var error = $root.pyth_lazer_transaction.DynamicValue.verify(
              message.value,
            );
            if (error) return "value." + error;
          }
        }
        return null;
      };

      /**
       * Creates a MapItem message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.DynamicValue.MapItem} MapItem
       */
      MapItem.fromObject = function fromObject(object) {
        if (object instanceof $root.pyth_lazer_transaction.DynamicValue.MapItem)
          return object;
        var message = new $root.pyth_lazer_transaction.DynamicValue.MapItem();
        if (object.key != null) message.key = String(object.key);
        if (object.value != null) {
          if (typeof object.value !== "object")
            throw TypeError(
              ".pyth_lazer_transaction.DynamicValue.MapItem.value: object expected",
            );
          message.value = $root.pyth_lazer_transaction.DynamicValue.fromObject(
            object.value,
          );
        }
        return message;
      };

      /**
       * Creates a plain object from a MapItem message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.MapItem} message MapItem
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      MapItem.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (message.key != null && message.hasOwnProperty("key")) {
          object.key = message.key;
          if (options.oneofs) object._key = "key";
        }
        if (message.value != null && message.hasOwnProperty("value")) {
          object.value = $root.pyth_lazer_transaction.DynamicValue.toObject(
            message.value,
            options,
          );
          if (options.oneofs) object._value = "value";
        }
        return object;
      };

      /**
       * Converts this MapItem to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      MapItem.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for MapItem
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.DynamicValue.MapItem
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      MapItem.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/pyth_lazer_transaction.DynamicValue.MapItem";
      };

      return MapItem;
    })();

    DynamicValue.Map = (function () {
      /**
       * Properties of a Map.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @interface IMap
       * @property {Array.<pyth_lazer_transaction.DynamicValue.IMapItem>|null} [items] Map items
       */

      /**
       * Constructs a new Map.
       * @memberof pyth_lazer_transaction.DynamicValue
       * @classdesc Represents a Map.
       * @implements IMap
       * @constructor
       * @param {pyth_lazer_transaction.DynamicValue.IMap=} [properties] Properties to set
       */
      function Map(properties) {
        this.items = [];
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * Map items.
       * @member {Array.<pyth_lazer_transaction.DynamicValue.IMapItem>} items
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @instance
       */
      Map.prototype.items = $util.emptyArray;

      /**
       * Creates a new Map instance using the specified properties.
       * @function create
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMap=} [properties] Properties to set
       * @returns {pyth_lazer_transaction.DynamicValue.Map} Map instance
       */
      Map.create = function create(properties) {
        return new Map(properties);
      };

      /**
       * Encodes the specified Map message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.Map.verify|verify} messages.
       * @function encode
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMap} message Map message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Map.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        if (message.items != null && message.items.length)
          for (var i = 0; i < message.items.length; ++i)
            $root.pyth_lazer_transaction.DynamicValue.MapItem.encode(
              message.items[i],
              writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
            ).ldelim();
        return writer;
      };

      /**
       * Encodes the specified Map message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.Map.verify|verify} messages.
       * @function encodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.IMap} message Map message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Map.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes a Map message from the specified reader or buffer.
       * @function decode
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {pyth_lazer_transaction.DynamicValue.Map} Map
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Map.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.pyth_lazer_transaction.DynamicValue.Map();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            case 1: {
              if (!(message.items && message.items.length)) message.items = [];
              message.items.push(
                $root.pyth_lazer_transaction.DynamicValue.MapItem.decode(
                  reader,
                  reader.uint32(),
                ),
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
       * Decodes a Map message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {pyth_lazer_transaction.DynamicValue.Map} Map
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Map.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies a Map message.
       * @function verify
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      Map.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        if (message.items != null && message.hasOwnProperty("items")) {
          if (!Array.isArray(message.items)) return "items: array expected";
          for (var i = 0; i < message.items.length; ++i) {
            var error =
              $root.pyth_lazer_transaction.DynamicValue.MapItem.verify(
                message.items[i],
              );
            if (error) return "items." + error;
          }
        }
        return null;
      };

      /**
       * Creates a Map message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {pyth_lazer_transaction.DynamicValue.Map} Map
       */
      Map.fromObject = function fromObject(object) {
        if (object instanceof $root.pyth_lazer_transaction.DynamicValue.Map)
          return object;
        var message = new $root.pyth_lazer_transaction.DynamicValue.Map();
        if (object.items) {
          if (!Array.isArray(object.items))
            throw TypeError(
              ".pyth_lazer_transaction.DynamicValue.Map.items: array expected",
            );
          message.items = [];
          for (var i = 0; i < object.items.length; ++i) {
            if (typeof object.items[i] !== "object")
              throw TypeError(
                ".pyth_lazer_transaction.DynamicValue.Map.items: object expected",
              );
            message.items[i] =
              $root.pyth_lazer_transaction.DynamicValue.MapItem.fromObject(
                object.items[i],
              );
          }
        }
        return message;
      };

      /**
       * Creates a plain object from a Map message. Also converts values to other types if specified.
       * @function toObject
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {pyth_lazer_transaction.DynamicValue.Map} message Map
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      Map.toObject = function toObject(message, options) {
        if (!options) options = {};
        var object = {};
        if (options.arrays || options.defaults) object.items = [];
        if (message.items && message.items.length) {
          object.items = [];
          for (var j = 0; j < message.items.length; ++j)
            object.items[j] =
              $root.pyth_lazer_transaction.DynamicValue.MapItem.toObject(
                message.items[j],
                options,
              );
        }
        return object;
      };

      /**
       * Converts this Map to JSON.
       * @function toJSON
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      Map.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for Map
       * @function getTypeUrl
       * @memberof pyth_lazer_transaction.DynamicValue.Map
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      Map.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/pyth_lazer_transaction.DynamicValue.Map";
      };

      return Map;
    })();

    return DynamicValue;
  })();

  return pyth_lazer_transaction;
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

    protobuf.Empty = (function () {
      /**
       * Properties of an Empty.
       * @memberof google.protobuf
       * @interface IEmpty
       */

      /**
       * Constructs a new Empty.
       * @memberof google.protobuf
       * @classdesc Represents an Empty.
       * @implements IEmpty
       * @constructor
       * @param {google.protobuf.IEmpty=} [properties] Properties to set
       */
      function Empty(properties) {
        if (properties)
          for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            if (properties[keys[i]] != null)
              this[keys[i]] = properties[keys[i]];
      }

      /**
       * Creates a new Empty instance using the specified properties.
       * @function create
       * @memberof google.protobuf.Empty
       * @static
       * @param {google.protobuf.IEmpty=} [properties] Properties to set
       * @returns {google.protobuf.Empty} Empty instance
       */
      Empty.create = function create(properties) {
        return new Empty(properties);
      };

      /**
       * Encodes the specified Empty message. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
       * @function encode
       * @memberof google.protobuf.Empty
       * @static
       * @param {google.protobuf.IEmpty} message Empty message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Empty.encode = function encode(message, writer) {
        if (!writer) writer = $Writer.create();
        return writer;
      };

      /**
       * Encodes the specified Empty message, length delimited. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
       * @function encodeDelimited
       * @memberof google.protobuf.Empty
       * @static
       * @param {google.protobuf.IEmpty} message Empty message or plain object to encode
       * @param {$protobuf.Writer} [writer] Writer to encode to
       * @returns {$protobuf.Writer} Writer
       */
      Empty.encodeDelimited = function encodeDelimited(message, writer) {
        return this.encode(message, writer).ldelim();
      };

      /**
       * Decodes an Empty message from the specified reader or buffer.
       * @function decode
       * @memberof google.protobuf.Empty
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @param {number} [length] Message length if known beforehand
       * @returns {google.protobuf.Empty} Empty
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Empty.decode = function decode(reader, length, error) {
        if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
        var end = length === undefined ? reader.len : reader.pos + length,
          message = new $root.google.protobuf.Empty();
        while (reader.pos < end) {
          var tag = reader.uint32();
          if (tag === error) break;
          switch (tag >>> 3) {
            default:
              reader.skipType(tag & 7);
              break;
          }
        }
        return message;
      };

      /**
       * Decodes an Empty message from the specified reader or buffer, length delimited.
       * @function decodeDelimited
       * @memberof google.protobuf.Empty
       * @static
       * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
       * @returns {google.protobuf.Empty} Empty
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      Empty.decodeDelimited = function decodeDelimited(reader) {
        if (!(reader instanceof $Reader)) reader = new $Reader(reader);
        return this.decode(reader, reader.uint32());
      };

      /**
       * Verifies an Empty message.
       * @function verify
       * @memberof google.protobuf.Empty
       * @static
       * @param {Object.<string,*>} message Plain object to verify
       * @returns {string|null} `null` if valid, otherwise the reason why it is not
       */
      Empty.verify = function verify(message) {
        if (typeof message !== "object" || message === null)
          return "object expected";
        return null;
      };

      /**
       * Creates an Empty message from a plain object. Also converts values to their respective internal types.
       * @function fromObject
       * @memberof google.protobuf.Empty
       * @static
       * @param {Object.<string,*>} object Plain object
       * @returns {google.protobuf.Empty} Empty
       */
      Empty.fromObject = function fromObject(object) {
        if (object instanceof $root.google.protobuf.Empty) return object;
        return new $root.google.protobuf.Empty();
      };

      /**
       * Creates a plain object from an Empty message. Also converts values to other types if specified.
       * @function toObject
       * @memberof google.protobuf.Empty
       * @static
       * @param {google.protobuf.Empty} message Empty
       * @param {$protobuf.IConversionOptions} [options] Conversion options
       * @returns {Object.<string,*>} Plain object
       */
      Empty.toObject = function toObject() {
        return {};
      };

      /**
       * Converts this Empty to JSON.
       * @function toJSON
       * @memberof google.protobuf.Empty
       * @instance
       * @returns {Object.<string,*>} JSON object
       */
      Empty.prototype.toJSON = function toJSON() {
        return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
      };

      /**
       * Gets the default type url for Empty
       * @function getTypeUrl
       * @memberof google.protobuf.Empty
       * @static
       * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns {string} The default type url
       */
      Empty.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
        if (typeUrlPrefix === undefined) {
          typeUrlPrefix = "type.googleapis.com";
        }
        return typeUrlPrefix + "/google.protobuf.Empty";
      };

      return Empty;
    })();

    return protobuf;
  })();

  return google;
})();

module.exports = $root;
