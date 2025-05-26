import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace pyth_lazer_transaction. */
export namespace pyth_lazer_transaction {
  /** Properties of a GovernanceInstruction. */
  interface IGovernanceInstruction {
    /** GovernanceInstruction source */
    source?: pyth_lazer_transaction.IGovernanceSource | null;

    /** GovernanceInstruction directives */
    directives?: pyth_lazer_transaction.IGovernanceDirective[] | null;

    /** GovernanceInstruction minExecutionTimestamp */
    minExecutionTimestamp?: google.protobuf.ITimestamp | null;

    /** GovernanceInstruction maxExecutionTimestamp */
    maxExecutionTimestamp?: google.protobuf.ITimestamp | null;

    /** GovernanceInstruction governanceSequenceNo */
    governanceSequenceNo?: number | null;
  }

  /** Represents a GovernanceInstruction. */
  class GovernanceInstruction implements IGovernanceInstruction {
    /**
     * Constructs a new GovernanceInstruction.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IGovernanceInstruction);

    /** GovernanceInstruction source. */
    public source?: pyth_lazer_transaction.IGovernanceSource | null;

    /** GovernanceInstruction directives. */
    public directives: pyth_lazer_transaction.IGovernanceDirective[];

    /** GovernanceInstruction minExecutionTimestamp. */
    public minExecutionTimestamp?: google.protobuf.ITimestamp | null;

    /** GovernanceInstruction maxExecutionTimestamp. */
    public maxExecutionTimestamp?: google.protobuf.ITimestamp | null;

    /** GovernanceInstruction governanceSequenceNo. */
    public governanceSequenceNo?: number | null;

    /** GovernanceInstruction _source. */
    public _source?: "source";

    /** GovernanceInstruction _minExecutionTimestamp. */
    public _minExecutionTimestamp?: "minExecutionTimestamp";

    /** GovernanceInstruction _maxExecutionTimestamp. */
    public _maxExecutionTimestamp?: "maxExecutionTimestamp";

    /** GovernanceInstruction _governanceSequenceNo. */
    public _governanceSequenceNo?: "governanceSequenceNo";

    /**
     * Creates a new GovernanceInstruction instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GovernanceInstruction instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IGovernanceInstruction,
    ): pyth_lazer_transaction.GovernanceInstruction;

    /**
     * Encodes the specified GovernanceInstruction message. Does not implicitly {@link pyth_lazer_transaction.GovernanceInstruction.verify|verify} messages.
     * @param message GovernanceInstruction message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IGovernanceInstruction,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GovernanceInstruction message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceInstruction.verify|verify} messages.
     * @param message GovernanceInstruction message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IGovernanceInstruction,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GovernanceInstruction message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GovernanceInstruction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.GovernanceInstruction;

    /**
     * Decodes a GovernanceInstruction message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GovernanceInstruction
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.GovernanceInstruction;

    /**
     * Verifies a GovernanceInstruction message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GovernanceInstruction message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GovernanceInstruction
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.GovernanceInstruction;

    /**
     * Creates a plain object from a GovernanceInstruction message. Also converts values to other types if specified.
     * @param message GovernanceInstruction
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.GovernanceInstruction,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GovernanceInstruction to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GovernanceInstruction
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ShardFilter. */
  interface IShardFilter {
    /** ShardFilter allShards */
    allShards?: google.protobuf.IEmpty | null;

    /** ShardFilter shardNames */
    shardNames?: pyth_lazer_transaction.ShardFilter.IShardNames | null;

    /** ShardFilter shardGroups */
    shardGroups?: pyth_lazer_transaction.ShardFilter.IShardGroups | null;
  }

  /** Represents a ShardFilter. */
  class ShardFilter implements IShardFilter {
    /**
     * Constructs a new ShardFilter.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IShardFilter);

    /** ShardFilter allShards. */
    public allShards?: google.protobuf.IEmpty | null;

    /** ShardFilter shardNames. */
    public shardNames?: pyth_lazer_transaction.ShardFilter.IShardNames | null;

    /** ShardFilter shardGroups. */
    public shardGroups?: pyth_lazer_transaction.ShardFilter.IShardGroups | null;

    /** ShardFilter filter. */
    public filter?: "allShards" | "shardNames" | "shardGroups";

    /**
     * Creates a new ShardFilter instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ShardFilter instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IShardFilter,
    ): pyth_lazer_transaction.ShardFilter;

    /**
     * Encodes the specified ShardFilter message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.verify|verify} messages.
     * @param message ShardFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IShardFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ShardFilter message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.verify|verify} messages.
     * @param message ShardFilter message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IShardFilter,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ShardFilter message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ShardFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.ShardFilter;

    /**
     * Decodes a ShardFilter message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ShardFilter
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.ShardFilter;

    /**
     * Verifies a ShardFilter message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ShardFilter message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ShardFilter
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.ShardFilter;

    /**
     * Creates a plain object from a ShardFilter message. Also converts values to other types if specified.
     * @param message ShardFilter
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.ShardFilter,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ShardFilter to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ShardFilter
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace ShardFilter {
    /** Properties of a ShardNames. */
    interface IShardNames {
      /** ShardNames shardNames */
      shardNames?: string[] | null;
    }

    /** Represents a ShardNames. */
    class ShardNames implements IShardNames {
      /**
       * Constructs a new ShardNames.
       * @param [properties] Properties to set
       */
      constructor(properties?: pyth_lazer_transaction.ShardFilter.IShardNames);

      /** ShardNames shardNames. */
      public shardNames: string[];

      /**
       * Creates a new ShardNames instance using the specified properties.
       * @param [properties] Properties to set
       * @returns ShardNames instance
       */
      public static create(
        properties?: pyth_lazer_transaction.ShardFilter.IShardNames,
      ): pyth_lazer_transaction.ShardFilter.ShardNames;

      /**
       * Encodes the specified ShardNames message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardNames.verify|verify} messages.
       * @param message ShardNames message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.ShardFilter.IShardNames,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified ShardNames message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardNames.verify|verify} messages.
       * @param message ShardNames message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.ShardFilter.IShardNames,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a ShardNames message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns ShardNames
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.ShardFilter.ShardNames;

      /**
       * Decodes a ShardNames message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns ShardNames
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.ShardFilter.ShardNames;

      /**
       * Verifies a ShardNames message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a ShardNames message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns ShardNames
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.ShardFilter.ShardNames;

      /**
       * Creates a plain object from a ShardNames message. Also converts values to other types if specified.
       * @param message ShardNames
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.ShardFilter.ShardNames,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this ShardNames to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for ShardNames
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ShardGroups. */
    interface IShardGroups {
      /** ShardGroups shardGroups */
      shardGroups?: string[] | null;
    }

    /** Represents a ShardGroups. */
    class ShardGroups implements IShardGroups {
      /**
       * Constructs a new ShardGroups.
       * @param [properties] Properties to set
       */
      constructor(properties?: pyth_lazer_transaction.ShardFilter.IShardGroups);

      /** ShardGroups shardGroups. */
      public shardGroups: string[];

      /**
       * Creates a new ShardGroups instance using the specified properties.
       * @param [properties] Properties to set
       * @returns ShardGroups instance
       */
      public static create(
        properties?: pyth_lazer_transaction.ShardFilter.IShardGroups,
      ): pyth_lazer_transaction.ShardFilter.ShardGroups;

      /**
       * Encodes the specified ShardGroups message. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardGroups.verify|verify} messages.
       * @param message ShardGroups message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.ShardFilter.IShardGroups,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified ShardGroups message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ShardFilter.ShardGroups.verify|verify} messages.
       * @param message ShardGroups message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.ShardFilter.IShardGroups,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a ShardGroups message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns ShardGroups
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.ShardFilter.ShardGroups;

      /**
       * Decodes a ShardGroups message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns ShardGroups
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.ShardFilter.ShardGroups;

      /**
       * Verifies a ShardGroups message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a ShardGroups message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns ShardGroups
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.ShardFilter.ShardGroups;

      /**
       * Creates a plain object from a ShardGroups message. Also converts values to other types if specified.
       * @param message ShardGroups
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.ShardFilter.ShardGroups,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this ShardGroups to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for ShardGroups
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }
  }

  /** Properties of a GovernanceDirective. */
  interface IGovernanceDirective {
    /** GovernanceDirective shardFilter */
    shardFilter?: pyth_lazer_transaction.IShardFilter | null;

    /** GovernanceDirective createShard */
    createShard?: pyth_lazer_transaction.ICreateShard | null;

    /** GovernanceDirective addGovernanceSource */
    addGovernanceSource?: pyth_lazer_transaction.IAddGovernanceSource | null;

    /** GovernanceDirective updateGovernanceSource */
    updateGovernanceSource?: pyth_lazer_transaction.IUpdateGovernanceSource | null;

    /** GovernanceDirective setShardName */
    setShardName?: pyth_lazer_transaction.ISetShardName | null;

    /** GovernanceDirective setShardGroup */
    setShardGroup?: pyth_lazer_transaction.ISetShardGroup | null;

    /** GovernanceDirective resetLastSequenceNo */
    resetLastSequenceNo?: pyth_lazer_transaction.IResetLastSequenceNo | null;

    /** GovernanceDirective addPublisher */
    addPublisher?: pyth_lazer_transaction.IAddPublisher | null;

    /** GovernanceDirective updatePublisher */
    updatePublisher?: pyth_lazer_transaction.IUpdatePublisher | null;

    /** GovernanceDirective addFeed */
    addFeed?: pyth_lazer_transaction.IAddFeed | null;

    /** GovernanceDirective updateFeed */
    updateFeed?: pyth_lazer_transaction.IUpdateFeed | null;
  }

  /** Represents a GovernanceDirective. */
  class GovernanceDirective implements IGovernanceDirective {
    /**
     * Constructs a new GovernanceDirective.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IGovernanceDirective);

    /** GovernanceDirective shardFilter. */
    public shardFilter?: pyth_lazer_transaction.IShardFilter | null;

    /** GovernanceDirective createShard. */
    public createShard?: pyth_lazer_transaction.ICreateShard | null;

    /** GovernanceDirective addGovernanceSource. */
    public addGovernanceSource?: pyth_lazer_transaction.IAddGovernanceSource | null;

    /** GovernanceDirective updateGovernanceSource. */
    public updateGovernanceSource?: pyth_lazer_transaction.IUpdateGovernanceSource | null;

    /** GovernanceDirective setShardName. */
    public setShardName?: pyth_lazer_transaction.ISetShardName | null;

    /** GovernanceDirective setShardGroup. */
    public setShardGroup?: pyth_lazer_transaction.ISetShardGroup | null;

    /** GovernanceDirective resetLastSequenceNo. */
    public resetLastSequenceNo?: pyth_lazer_transaction.IResetLastSequenceNo | null;

    /** GovernanceDirective addPublisher. */
    public addPublisher?: pyth_lazer_transaction.IAddPublisher | null;

    /** GovernanceDirective updatePublisher. */
    public updatePublisher?: pyth_lazer_transaction.IUpdatePublisher | null;

    /** GovernanceDirective addFeed. */
    public addFeed?: pyth_lazer_transaction.IAddFeed | null;

    /** GovernanceDirective updateFeed. */
    public updateFeed?: pyth_lazer_transaction.IUpdateFeed | null;

    /** GovernanceDirective _shardFilter. */
    public _shardFilter?: "shardFilter";

    /** GovernanceDirective action. */
    public action?:
      | "createShard"
      | "addGovernanceSource"
      | "updateGovernanceSource"
      | "setShardName"
      | "setShardGroup"
      | "resetLastSequenceNo"
      | "addPublisher"
      | "updatePublisher"
      | "addFeed"
      | "updateFeed";

    /**
     * Creates a new GovernanceDirective instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GovernanceDirective instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IGovernanceDirective,
    ): pyth_lazer_transaction.GovernanceDirective;

    /**
     * Encodes the specified GovernanceDirective message. Does not implicitly {@link pyth_lazer_transaction.GovernanceDirective.verify|verify} messages.
     * @param message GovernanceDirective message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IGovernanceDirective,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GovernanceDirective message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceDirective.verify|verify} messages.
     * @param message GovernanceDirective message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IGovernanceDirective,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GovernanceDirective message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GovernanceDirective
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.GovernanceDirective;

    /**
     * Decodes a GovernanceDirective message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GovernanceDirective
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.GovernanceDirective;

    /**
     * Verifies a GovernanceDirective message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GovernanceDirective message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GovernanceDirective
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.GovernanceDirective;

    /**
     * Creates a plain object from a GovernanceDirective message. Also converts values to other types if specified.
     * @param message GovernanceDirective
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.GovernanceDirective,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GovernanceDirective to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GovernanceDirective
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Permissions. */
  interface IPermissions {
    /** Permissions allActions */
    allActions?: boolean | null;

    /** Permissions shardActions */
    shardActions?: pyth_lazer_transaction.Permissions.ShardAction[] | null;

    /** Permissions allUpdateGovernanceSourceActions */
    allUpdateGovernanceSourceActions?: boolean | null;

    /** Permissions updateGovernanceSourceActions */
    updateGovernanceSourceActions?:
      | pyth_lazer_transaction.Permissions.UpdateGovernanceSourceAction[]
      | null;

    /** Permissions allUpdatePublisherAction */
    allUpdatePublisherAction?: boolean | null;

    /** Permissions updatePublisherActions */
    updatePublisherActions?:
      | pyth_lazer_transaction.Permissions.UpdatePublisherAction[]
      | null;

    /** Permissions allUpdateFeedActions */
    allUpdateFeedActions?: boolean | null;

    /** Permissions updateFeedActions */
    updateFeedActions?:
      | pyth_lazer_transaction.Permissions.UpdateFeedAction[]
      | null;
  }

  /** Represents a Permissions. */
  class Permissions implements IPermissions {
    /**
     * Constructs a new Permissions.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IPermissions);

    /** Permissions allActions. */
    public allActions?: boolean | null;

    /** Permissions shardActions. */
    public shardActions: pyth_lazer_transaction.Permissions.ShardAction[];

    /** Permissions allUpdateGovernanceSourceActions. */
    public allUpdateGovernanceSourceActions?: boolean | null;

    /** Permissions updateGovernanceSourceActions. */
    public updateGovernanceSourceActions: pyth_lazer_transaction.Permissions.UpdateGovernanceSourceAction[];

    /** Permissions allUpdatePublisherAction. */
    public allUpdatePublisherAction?: boolean | null;

    /** Permissions updatePublisherActions. */
    public updatePublisherActions: pyth_lazer_transaction.Permissions.UpdatePublisherAction[];

    /** Permissions allUpdateFeedActions. */
    public allUpdateFeedActions?: boolean | null;

    /** Permissions updateFeedActions. */
    public updateFeedActions: pyth_lazer_transaction.Permissions.UpdateFeedAction[];

    /** Permissions _allActions. */
    public _allActions?: "allActions";

    /** Permissions _allUpdateGovernanceSourceActions. */
    public _allUpdateGovernanceSourceActions?: "allUpdateGovernanceSourceActions";

    /** Permissions _allUpdatePublisherAction. */
    public _allUpdatePublisherAction?: "allUpdatePublisherAction";

    /** Permissions _allUpdateFeedActions. */
    public _allUpdateFeedActions?: "allUpdateFeedActions";

    /**
     * Creates a new Permissions instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Permissions instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IPermissions,
    ): pyth_lazer_transaction.Permissions;

    /**
     * Encodes the specified Permissions message. Does not implicitly {@link pyth_lazer_transaction.Permissions.verify|verify} messages.
     * @param message Permissions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IPermissions,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Permissions message, length delimited. Does not implicitly {@link pyth_lazer_transaction.Permissions.verify|verify} messages.
     * @param message Permissions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IPermissions,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Permissions message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Permissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.Permissions;

    /**
     * Decodes a Permissions message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Permissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.Permissions;

    /**
     * Verifies a Permissions message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Permissions message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Permissions
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.Permissions;

    /**
     * Creates a plain object from a Permissions message. Also converts values to other types if specified.
     * @param message Permissions
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.Permissions,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Permissions to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Permissions
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace Permissions {
    /** ShardAction enum. */
    enum ShardAction {
      SHARD_ACTION_UNSPECIFIED = 0,
      CREATE_SHARD = 101,
      ADD_GOVERNANCE_SOURCE = 102,
      UPDATE_GOVERNANCE_SOURCE = 103,
      SET_SHARD_NAME = 104,
      SET_SHARD_GROUP = 105,
      RESET_LAST_SEQUENCE_NO = 106,
      ADD_PUBLISHER = 107,
      ADD_FEED = 109,
    }

    /** UpdateGovernanceSourceAction enum. */
    enum UpdateGovernanceSourceAction {
      UPDATE_GOVERNANCE_SOURCE_ACTION_UNSPECIFIED = 0,
      SET_GOVERNANCE_SOURCE_PERMISSIONS = 101,
      REMOVE_GOVERNANCE_SOURCE = 199,
    }

    /** UpdatePublisherAction enum. */
    enum UpdatePublisherAction {
      UPDATE_PUBLISHER_ACTION_UNSPECIFIED = 0,
      SET_PUBLISHER_NAME = 101,
      ADD_PUBLISHER_PUBLIC_KEYS = 102,
      REMOVE_PUBLISHER_PUBLIC_KEYS = 103,
      SET_PUBLISHER_PUBLIC_KEYS = 104,
      SET_PUBLISHER_ACTIVE = 105,
      REMOVE_PUBLISHER = 199,
    }

    /** UpdateFeedAction enum. */
    enum UpdateFeedAction {
      UPDATE_FEED_ACTION_UNSPECIFIED = 0,
      UPDATE_FEED_METADATA = 101,
      ACTIVATE_FEED = 102,
      DEACTIVATE_FEED = 103,
      REMOVE_FEED = 199,
    }
  }

  /** Properties of a GovernanceSource. */
  interface IGovernanceSource {
    /** GovernanceSource singleEd25519 */
    singleEd25519?: pyth_lazer_transaction.GovernanceSource.ISingleEd25519 | null;
  }

  /** Represents a GovernanceSource. */
  class GovernanceSource implements IGovernanceSource {
    /**
     * Constructs a new GovernanceSource.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IGovernanceSource);

    /** GovernanceSource singleEd25519. */
    public singleEd25519?: pyth_lazer_transaction.GovernanceSource.ISingleEd25519 | null;

    /** GovernanceSource source. */
    public source?: "singleEd25519";

    /**
     * Creates a new GovernanceSource instance using the specified properties.
     * @param [properties] Properties to set
     * @returns GovernanceSource instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IGovernanceSource,
    ): pyth_lazer_transaction.GovernanceSource;

    /**
     * Encodes the specified GovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.verify|verify} messages.
     * @param message GovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified GovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.verify|verify} messages.
     * @param message GovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a GovernanceSource message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns GovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.GovernanceSource;

    /**
     * Decodes a GovernanceSource message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns GovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.GovernanceSource;

    /**
     * Verifies a GovernanceSource message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a GovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns GovernanceSource
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.GovernanceSource;

    /**
     * Creates a plain object from a GovernanceSource message. Also converts values to other types if specified.
     * @param message GovernanceSource
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.GovernanceSource,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this GovernanceSource to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for GovernanceSource
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace GovernanceSource {
    /** Properties of a SingleEd25519. */
    interface ISingleEd25519 {
      /** SingleEd25519 publicKey */
      publicKey?: Uint8Array | null;
    }

    /** Represents a SingleEd25519. */
    class SingleEd25519 implements ISingleEd25519 {
      /**
       * Constructs a new SingleEd25519.
       * @param [properties] Properties to set
       */
      constructor(
        properties?: pyth_lazer_transaction.GovernanceSource.ISingleEd25519,
      );

      /** SingleEd25519 publicKey. */
      public publicKey?: Uint8Array | null;

      /** SingleEd25519 _publicKey. */
      public _publicKey?: "publicKey";

      /**
       * Creates a new SingleEd25519 instance using the specified properties.
       * @param [properties] Properties to set
       * @returns SingleEd25519 instance
       */
      public static create(
        properties?: pyth_lazer_transaction.GovernanceSource.ISingleEd25519,
      ): pyth_lazer_transaction.GovernanceSource.SingleEd25519;

      /**
       * Encodes the specified SingleEd25519 message. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.SingleEd25519.verify|verify} messages.
       * @param message SingleEd25519 message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.GovernanceSource.ISingleEd25519,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified SingleEd25519 message, length delimited. Does not implicitly {@link pyth_lazer_transaction.GovernanceSource.SingleEd25519.verify|verify} messages.
       * @param message SingleEd25519 message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.GovernanceSource.ISingleEd25519,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a SingleEd25519 message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns SingleEd25519
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.GovernanceSource.SingleEd25519;

      /**
       * Decodes a SingleEd25519 message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns SingleEd25519
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.GovernanceSource.SingleEd25519;

      /**
       * Verifies a SingleEd25519 message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a SingleEd25519 message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns SingleEd25519
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.GovernanceSource.SingleEd25519;

      /**
       * Creates a plain object from a SingleEd25519 message. Also converts values to other types if specified.
       * @param message SingleEd25519
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.GovernanceSource.SingleEd25519,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this SingleEd25519 to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for SingleEd25519
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }
  }

  /** Properties of a CreateShard. */
  interface ICreateShard {
    /** CreateShard shardId */
    shardId?: number | null;

    /** CreateShard shardGroup */
    shardGroup?: string | null;

    /** CreateShard minRate */
    minRate?: google.protobuf.IDuration | null;
  }

  /** Represents a CreateShard. */
  class CreateShard implements ICreateShard {
    /**
     * Constructs a new CreateShard.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ICreateShard);

    /** CreateShard shardId. */
    public shardId?: number | null;

    /** CreateShard shardGroup. */
    public shardGroup?: string | null;

    /** CreateShard minRate. */
    public minRate?: google.protobuf.IDuration | null;

    /** CreateShard _shardId. */
    public _shardId?: "shardId";

    /** CreateShard _shardGroup. */
    public _shardGroup?: "shardGroup";

    /** CreateShard _minRate. */
    public _minRate?: "minRate";

    /**
     * Creates a new CreateShard instance using the specified properties.
     * @param [properties] Properties to set
     * @returns CreateShard instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ICreateShard,
    ): pyth_lazer_transaction.CreateShard;

    /**
     * Encodes the specified CreateShard message. Does not implicitly {@link pyth_lazer_transaction.CreateShard.verify|verify} messages.
     * @param message CreateShard message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ICreateShard,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified CreateShard message, length delimited. Does not implicitly {@link pyth_lazer_transaction.CreateShard.verify|verify} messages.
     * @param message CreateShard message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ICreateShard,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a CreateShard message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns CreateShard
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.CreateShard;

    /**
     * Decodes a CreateShard message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns CreateShard
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.CreateShard;

    /**
     * Verifies a CreateShard message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a CreateShard message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns CreateShard
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.CreateShard;

    /**
     * Creates a plain object from a CreateShard message. Also converts values to other types if specified.
     * @param message CreateShard
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.CreateShard,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this CreateShard to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for CreateShard
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AddGovernanceSource. */
  interface IAddGovernanceSource {
    /** AddGovernanceSource newSource */
    newSource?: pyth_lazer_transaction.IGovernanceSource | null;

    /** AddGovernanceSource permissions */
    permissions?: pyth_lazer_transaction.IPermissions | null;
  }

  /** Represents an AddGovernanceSource. */
  class AddGovernanceSource implements IAddGovernanceSource {
    /**
     * Constructs a new AddGovernanceSource.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IAddGovernanceSource);

    /** AddGovernanceSource newSource. */
    public newSource?: pyth_lazer_transaction.IGovernanceSource | null;

    /** AddGovernanceSource permissions. */
    public permissions?: pyth_lazer_transaction.IPermissions | null;

    /** AddGovernanceSource _newSource. */
    public _newSource?: "newSource";

    /** AddGovernanceSource _permissions. */
    public _permissions?: "permissions";

    /**
     * Creates a new AddGovernanceSource instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AddGovernanceSource instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IAddGovernanceSource,
    ): pyth_lazer_transaction.AddGovernanceSource;

    /**
     * Encodes the specified AddGovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.AddGovernanceSource.verify|verify} messages.
     * @param message AddGovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IAddGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AddGovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddGovernanceSource.verify|verify} messages.
     * @param message AddGovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IAddGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AddGovernanceSource message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AddGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.AddGovernanceSource;

    /**
     * Decodes an AddGovernanceSource message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AddGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.AddGovernanceSource;

    /**
     * Verifies an AddGovernanceSource message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AddGovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AddGovernanceSource
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.AddGovernanceSource;

    /**
     * Creates a plain object from an AddGovernanceSource message. Also converts values to other types if specified.
     * @param message AddGovernanceSource
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.AddGovernanceSource,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AddGovernanceSource to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AddGovernanceSource
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an UpdateGovernanceSource. */
  interface IUpdateGovernanceSource {
    /** UpdateGovernanceSource source */
    source?: pyth_lazer_transaction.IGovernanceSource | null;

    /** UpdateGovernanceSource setGovernanceSourcePermissions */
    setGovernanceSourcePermissions?: pyth_lazer_transaction.ISetGovernanceSourcePermissions | null;

    /** UpdateGovernanceSource removeGovernanceSource */
    removeGovernanceSource?: google.protobuf.IEmpty | null;
  }

  /** Represents an UpdateGovernanceSource. */
  class UpdateGovernanceSource implements IUpdateGovernanceSource {
    /**
     * Constructs a new UpdateGovernanceSource.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IUpdateGovernanceSource);

    /** UpdateGovernanceSource source. */
    public source?: pyth_lazer_transaction.IGovernanceSource | null;

    /** UpdateGovernanceSource setGovernanceSourcePermissions. */
    public setGovernanceSourcePermissions?: pyth_lazer_transaction.ISetGovernanceSourcePermissions | null;

    /** UpdateGovernanceSource removeGovernanceSource. */
    public removeGovernanceSource?: google.protobuf.IEmpty | null;

    /** UpdateGovernanceSource _source. */
    public _source?: "source";

    /** UpdateGovernanceSource action. */
    public action?: "setGovernanceSourcePermissions" | "removeGovernanceSource";

    /**
     * Creates a new UpdateGovernanceSource instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UpdateGovernanceSource instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IUpdateGovernanceSource,
    ): pyth_lazer_transaction.UpdateGovernanceSource;

    /**
     * Encodes the specified UpdateGovernanceSource message. Does not implicitly {@link pyth_lazer_transaction.UpdateGovernanceSource.verify|verify} messages.
     * @param message UpdateGovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IUpdateGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UpdateGovernanceSource message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateGovernanceSource.verify|verify} messages.
     * @param message UpdateGovernanceSource message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IUpdateGovernanceSource,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an UpdateGovernanceSource message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UpdateGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.UpdateGovernanceSource;

    /**
     * Decodes an UpdateGovernanceSource message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UpdateGovernanceSource
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.UpdateGovernanceSource;

    /**
     * Verifies an UpdateGovernanceSource message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an UpdateGovernanceSource message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UpdateGovernanceSource
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.UpdateGovernanceSource;

    /**
     * Creates a plain object from an UpdateGovernanceSource message. Also converts values to other types if specified.
     * @param message UpdateGovernanceSource
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.UpdateGovernanceSource,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UpdateGovernanceSource to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UpdateGovernanceSource
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetGovernanceSourcePermissions. */
  interface ISetGovernanceSourcePermissions {
    /** SetGovernanceSourcePermissions permissions */
    permissions?: pyth_lazer_transaction.IPermissions | null;
  }

  /** Represents a SetGovernanceSourcePermissions. */
  class SetGovernanceSourcePermissions
    implements ISetGovernanceSourcePermissions
  {
    /**
     * Constructs a new SetGovernanceSourcePermissions.
     * @param [properties] Properties to set
     */
    constructor(
      properties?: pyth_lazer_transaction.ISetGovernanceSourcePermissions,
    );

    /** SetGovernanceSourcePermissions permissions. */
    public permissions?: pyth_lazer_transaction.IPermissions | null;

    /** SetGovernanceSourcePermissions _permissions. */
    public _permissions?: "permissions";

    /**
     * Creates a new SetGovernanceSourcePermissions instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetGovernanceSourcePermissions instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetGovernanceSourcePermissions,
    ): pyth_lazer_transaction.SetGovernanceSourcePermissions;

    /**
     * Encodes the specified SetGovernanceSourcePermissions message. Does not implicitly {@link pyth_lazer_transaction.SetGovernanceSourcePermissions.verify|verify} messages.
     * @param message SetGovernanceSourcePermissions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetGovernanceSourcePermissions,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetGovernanceSourcePermissions message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetGovernanceSourcePermissions.verify|verify} messages.
     * @param message SetGovernanceSourcePermissions message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetGovernanceSourcePermissions,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetGovernanceSourcePermissions message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetGovernanceSourcePermissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetGovernanceSourcePermissions;

    /**
     * Decodes a SetGovernanceSourcePermissions message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetGovernanceSourcePermissions
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetGovernanceSourcePermissions;

    /**
     * Verifies a SetGovernanceSourcePermissions message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetGovernanceSourcePermissions message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetGovernanceSourcePermissions
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetGovernanceSourcePermissions;

    /**
     * Creates a plain object from a SetGovernanceSourcePermissions message. Also converts values to other types if specified.
     * @param message SetGovernanceSourcePermissions
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetGovernanceSourcePermissions,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetGovernanceSourcePermissions to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetGovernanceSourcePermissions
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetShardName. */
  interface ISetShardName {
    /** SetShardName shardName */
    shardName?: string | null;
  }

  /** Represents a SetShardName. */
  class SetShardName implements ISetShardName {
    /**
     * Constructs a new SetShardName.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ISetShardName);

    /** SetShardName shardName. */
    public shardName?: string | null;

    /** SetShardName _shardName. */
    public _shardName?: "shardName";

    /**
     * Creates a new SetShardName instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetShardName instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetShardName,
    ): pyth_lazer_transaction.SetShardName;

    /**
     * Encodes the specified SetShardName message. Does not implicitly {@link pyth_lazer_transaction.SetShardName.verify|verify} messages.
     * @param message SetShardName message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetShardName,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetShardName message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetShardName.verify|verify} messages.
     * @param message SetShardName message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetShardName,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetShardName message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetShardName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetShardName;

    /**
     * Decodes a SetShardName message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetShardName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetShardName;

    /**
     * Verifies a SetShardName message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetShardName message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetShardName
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetShardName;

    /**
     * Creates a plain object from a SetShardName message. Also converts values to other types if specified.
     * @param message SetShardName
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetShardName,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetShardName to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetShardName
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetShardGroup. */
  interface ISetShardGroup {
    /** SetShardGroup shardGroup */
    shardGroup?: string | null;
  }

  /** Represents a SetShardGroup. */
  class SetShardGroup implements ISetShardGroup {
    /**
     * Constructs a new SetShardGroup.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ISetShardGroup);

    /** SetShardGroup shardGroup. */
    public shardGroup?: string | null;

    /** SetShardGroup _shardGroup. */
    public _shardGroup?: "shardGroup";

    /**
     * Creates a new SetShardGroup instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetShardGroup instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetShardGroup,
    ): pyth_lazer_transaction.SetShardGroup;

    /**
     * Encodes the specified SetShardGroup message. Does not implicitly {@link pyth_lazer_transaction.SetShardGroup.verify|verify} messages.
     * @param message SetShardGroup message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetShardGroup,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetShardGroup message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetShardGroup.verify|verify} messages.
     * @param message SetShardGroup message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetShardGroup,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetShardGroup message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetShardGroup
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetShardGroup;

    /**
     * Decodes a SetShardGroup message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetShardGroup
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetShardGroup;

    /**
     * Verifies a SetShardGroup message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetShardGroup message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetShardGroup
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetShardGroup;

    /**
     * Creates a plain object from a SetShardGroup message. Also converts values to other types if specified.
     * @param message SetShardGroup
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetShardGroup,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetShardGroup to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetShardGroup
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a ResetLastSequenceNo. */
  interface IResetLastSequenceNo {
    /** ResetLastSequenceNo lastSequenceNo */
    lastSequenceNo?: number | Long | null;
  }

  /** Represents a ResetLastSequenceNo. */
  class ResetLastSequenceNo implements IResetLastSequenceNo {
    /**
     * Constructs a new ResetLastSequenceNo.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IResetLastSequenceNo);

    /** ResetLastSequenceNo lastSequenceNo. */
    public lastSequenceNo?: number | Long | null;

    /** ResetLastSequenceNo _lastSequenceNo. */
    public _lastSequenceNo?: "lastSequenceNo";

    /**
     * Creates a new ResetLastSequenceNo instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ResetLastSequenceNo instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IResetLastSequenceNo,
    ): pyth_lazer_transaction.ResetLastSequenceNo;

    /**
     * Encodes the specified ResetLastSequenceNo message. Does not implicitly {@link pyth_lazer_transaction.ResetLastSequenceNo.verify|verify} messages.
     * @param message ResetLastSequenceNo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IResetLastSequenceNo,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ResetLastSequenceNo message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ResetLastSequenceNo.verify|verify} messages.
     * @param message ResetLastSequenceNo message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IResetLastSequenceNo,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a ResetLastSequenceNo message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ResetLastSequenceNo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.ResetLastSequenceNo;

    /**
     * Decodes a ResetLastSequenceNo message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ResetLastSequenceNo
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.ResetLastSequenceNo;

    /**
     * Verifies a ResetLastSequenceNo message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a ResetLastSequenceNo message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ResetLastSequenceNo
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.ResetLastSequenceNo;

    /**
     * Creates a plain object from a ResetLastSequenceNo message. Also converts values to other types if specified.
     * @param message ResetLastSequenceNo
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.ResetLastSequenceNo,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ResetLastSequenceNo to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ResetLastSequenceNo
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AddPublisher. */
  interface IAddPublisher {
    /** AddPublisher publisherId */
    publisherId?: number | null;

    /** AddPublisher name */
    name?: string | null;

    /** AddPublisher publicKeys */
    publicKeys?: Uint8Array[] | null;

    /** AddPublisher isActive */
    isActive?: boolean | null;
  }

  /** Represents an AddPublisher. */
  class AddPublisher implements IAddPublisher {
    /**
     * Constructs a new AddPublisher.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IAddPublisher);

    /** AddPublisher publisherId. */
    public publisherId?: number | null;

    /** AddPublisher name. */
    public name?: string | null;

    /** AddPublisher publicKeys. */
    public publicKeys: Uint8Array[];

    /** AddPublisher isActive. */
    public isActive?: boolean | null;

    /** AddPublisher _publisherId. */
    public _publisherId?: "publisherId";

    /** AddPublisher _name. */
    public _name?: "name";

    /** AddPublisher _isActive. */
    public _isActive?: "isActive";

    /**
     * Creates a new AddPublisher instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AddPublisher instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IAddPublisher,
    ): pyth_lazer_transaction.AddPublisher;

    /**
     * Encodes the specified AddPublisher message. Does not implicitly {@link pyth_lazer_transaction.AddPublisher.verify|verify} messages.
     * @param message AddPublisher message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IAddPublisher,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AddPublisher message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddPublisher.verify|verify} messages.
     * @param message AddPublisher message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IAddPublisher,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AddPublisher message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AddPublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.AddPublisher;

    /**
     * Decodes an AddPublisher message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AddPublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.AddPublisher;

    /**
     * Verifies an AddPublisher message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AddPublisher message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AddPublisher
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.AddPublisher;

    /**
     * Creates a plain object from an AddPublisher message. Also converts values to other types if specified.
     * @param message AddPublisher
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.AddPublisher,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AddPublisher to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AddPublisher
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an UpdatePublisher. */
  interface IUpdatePublisher {
    /** UpdatePublisher publisherId */
    publisherId?: number | null;

    /** UpdatePublisher setPublisherName */
    setPublisherName?: pyth_lazer_transaction.ISetPublisherName | null;

    /** UpdatePublisher addPublisherPublicKeys */
    addPublisherPublicKeys?: pyth_lazer_transaction.IAddPublisherPublicKeys | null;

    /** UpdatePublisher removePublisherPublicKeys */
    removePublisherPublicKeys?: pyth_lazer_transaction.IRemovePublisherPublicKeys | null;

    /** UpdatePublisher setPublisherPublicKeys */
    setPublisherPublicKeys?: pyth_lazer_transaction.ISetPublisherPublicKeys | null;

    /** UpdatePublisher setPublisherActive */
    setPublisherActive?: pyth_lazer_transaction.ISetPublisherActive | null;

    /** UpdatePublisher removePublisher */
    removePublisher?: google.protobuf.IEmpty | null;
  }

  /** Represents an UpdatePublisher. */
  class UpdatePublisher implements IUpdatePublisher {
    /**
     * Constructs a new UpdatePublisher.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IUpdatePublisher);

    /** UpdatePublisher publisherId. */
    public publisherId?: number | null;

    /** UpdatePublisher setPublisherName. */
    public setPublisherName?: pyth_lazer_transaction.ISetPublisherName | null;

    /** UpdatePublisher addPublisherPublicKeys. */
    public addPublisherPublicKeys?: pyth_lazer_transaction.IAddPublisherPublicKeys | null;

    /** UpdatePublisher removePublisherPublicKeys. */
    public removePublisherPublicKeys?: pyth_lazer_transaction.IRemovePublisherPublicKeys | null;

    /** UpdatePublisher setPublisherPublicKeys. */
    public setPublisherPublicKeys?: pyth_lazer_transaction.ISetPublisherPublicKeys | null;

    /** UpdatePublisher setPublisherActive. */
    public setPublisherActive?: pyth_lazer_transaction.ISetPublisherActive | null;

    /** UpdatePublisher removePublisher. */
    public removePublisher?: google.protobuf.IEmpty | null;

    /** UpdatePublisher _publisherId. */
    public _publisherId?: "publisherId";

    /** UpdatePublisher action. */
    public action?:
      | "setPublisherName"
      | "addPublisherPublicKeys"
      | "removePublisherPublicKeys"
      | "setPublisherPublicKeys"
      | "setPublisherActive"
      | "removePublisher";

    /**
     * Creates a new UpdatePublisher instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UpdatePublisher instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IUpdatePublisher,
    ): pyth_lazer_transaction.UpdatePublisher;

    /**
     * Encodes the specified UpdatePublisher message. Does not implicitly {@link pyth_lazer_transaction.UpdatePublisher.verify|verify} messages.
     * @param message UpdatePublisher message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IUpdatePublisher,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UpdatePublisher message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdatePublisher.verify|verify} messages.
     * @param message UpdatePublisher message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IUpdatePublisher,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an UpdatePublisher message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UpdatePublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.UpdatePublisher;

    /**
     * Decodes an UpdatePublisher message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UpdatePublisher
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.UpdatePublisher;

    /**
     * Verifies an UpdatePublisher message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an UpdatePublisher message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UpdatePublisher
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.UpdatePublisher;

    /**
     * Creates a plain object from an UpdatePublisher message. Also converts values to other types if specified.
     * @param message UpdatePublisher
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.UpdatePublisher,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UpdatePublisher to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UpdatePublisher
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetPublisherName. */
  interface ISetPublisherName {
    /** SetPublisherName name */
    name?: string | null;
  }

  /** Represents a SetPublisherName. */
  class SetPublisherName implements ISetPublisherName {
    /**
     * Constructs a new SetPublisherName.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ISetPublisherName);

    /** SetPublisherName name. */
    public name?: string | null;

    /** SetPublisherName _name. */
    public _name?: "name";

    /**
     * Creates a new SetPublisherName instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetPublisherName instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetPublisherName,
    ): pyth_lazer_transaction.SetPublisherName;

    /**
     * Encodes the specified SetPublisherName message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherName.verify|verify} messages.
     * @param message SetPublisherName message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetPublisherName,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetPublisherName message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherName.verify|verify} messages.
     * @param message SetPublisherName message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetPublisherName,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetPublisherName message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetPublisherName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetPublisherName;

    /**
     * Decodes a SetPublisherName message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetPublisherName
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetPublisherName;

    /**
     * Verifies a SetPublisherName message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetPublisherName message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetPublisherName
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetPublisherName;

    /**
     * Creates a plain object from a SetPublisherName message. Also converts values to other types if specified.
     * @param message SetPublisherName
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetPublisherName,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetPublisherName to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetPublisherName
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AddPublisherPublicKeys. */
  interface IAddPublisherPublicKeys {
    /** AddPublisherPublicKeys publicKeys */
    publicKeys?: Uint8Array[] | null;
  }

  /** Represents an AddPublisherPublicKeys. */
  class AddPublisherPublicKeys implements IAddPublisherPublicKeys {
    /**
     * Constructs a new AddPublisherPublicKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IAddPublisherPublicKeys);

    /** AddPublisherPublicKeys publicKeys. */
    public publicKeys: Uint8Array[];

    /**
     * Creates a new AddPublisherPublicKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AddPublisherPublicKeys instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IAddPublisherPublicKeys,
    ): pyth_lazer_transaction.AddPublisherPublicKeys;

    /**
     * Encodes the specified AddPublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.AddPublisherPublicKeys.verify|verify} messages.
     * @param message AddPublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IAddPublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AddPublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddPublisherPublicKeys.verify|verify} messages.
     * @param message AddPublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IAddPublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AddPublisherPublicKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AddPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.AddPublisherPublicKeys;

    /**
     * Decodes an AddPublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AddPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.AddPublisherPublicKeys;

    /**
     * Verifies an AddPublisherPublicKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AddPublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AddPublisherPublicKeys
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.AddPublisherPublicKeys;

    /**
     * Creates a plain object from an AddPublisherPublicKeys message. Also converts values to other types if specified.
     * @param message AddPublisherPublicKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.AddPublisherPublicKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AddPublisherPublicKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AddPublisherPublicKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a RemovePublisherPublicKeys. */
  interface IRemovePublisherPublicKeys {
    /** RemovePublisherPublicKeys publicKeys */
    publicKeys?: Uint8Array[] | null;
  }

  /** Represents a RemovePublisherPublicKeys. */
  class RemovePublisherPublicKeys implements IRemovePublisherPublicKeys {
    /**
     * Constructs a new RemovePublisherPublicKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IRemovePublisherPublicKeys);

    /** RemovePublisherPublicKeys publicKeys. */
    public publicKeys: Uint8Array[];

    /**
     * Creates a new RemovePublisherPublicKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RemovePublisherPublicKeys instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IRemovePublisherPublicKeys,
    ): pyth_lazer_transaction.RemovePublisherPublicKeys;

    /**
     * Encodes the specified RemovePublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.RemovePublisherPublicKeys.verify|verify} messages.
     * @param message RemovePublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IRemovePublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified RemovePublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.RemovePublisherPublicKeys.verify|verify} messages.
     * @param message RemovePublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IRemovePublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a RemovePublisherPublicKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RemovePublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.RemovePublisherPublicKeys;

    /**
     * Decodes a RemovePublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RemovePublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.RemovePublisherPublicKeys;

    /**
     * Verifies a RemovePublisherPublicKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RemovePublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RemovePublisherPublicKeys
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.RemovePublisherPublicKeys;

    /**
     * Creates a plain object from a RemovePublisherPublicKeys message. Also converts values to other types if specified.
     * @param message RemovePublisherPublicKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.RemovePublisherPublicKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this RemovePublisherPublicKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RemovePublisherPublicKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetPublisherPublicKeys. */
  interface ISetPublisherPublicKeys {
    /** SetPublisherPublicKeys publicKeys */
    publicKeys?: Uint8Array[] | null;
  }

  /** Represents a SetPublisherPublicKeys. */
  class SetPublisherPublicKeys implements ISetPublisherPublicKeys {
    /**
     * Constructs a new SetPublisherPublicKeys.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ISetPublisherPublicKeys);

    /** SetPublisherPublicKeys publicKeys. */
    public publicKeys: Uint8Array[];

    /**
     * Creates a new SetPublisherPublicKeys instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetPublisherPublicKeys instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetPublisherPublicKeys,
    ): pyth_lazer_transaction.SetPublisherPublicKeys;

    /**
     * Encodes the specified SetPublisherPublicKeys message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherPublicKeys.verify|verify} messages.
     * @param message SetPublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetPublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetPublisherPublicKeys message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherPublicKeys.verify|verify} messages.
     * @param message SetPublisherPublicKeys message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetPublisherPublicKeys,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetPublisherPublicKeys message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetPublisherPublicKeys;

    /**
     * Decodes a SetPublisherPublicKeys message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetPublisherPublicKeys
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetPublisherPublicKeys;

    /**
     * Verifies a SetPublisherPublicKeys message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetPublisherPublicKeys message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetPublisherPublicKeys
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetPublisherPublicKeys;

    /**
     * Creates a plain object from a SetPublisherPublicKeys message. Also converts values to other types if specified.
     * @param message SetPublisherPublicKeys
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetPublisherPublicKeys,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetPublisherPublicKeys to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetPublisherPublicKeys
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a SetPublisherActive. */
  interface ISetPublisherActive {
    /** SetPublisherActive isActive */
    isActive?: boolean | null;
  }

  /** Represents a SetPublisherActive. */
  class SetPublisherActive implements ISetPublisherActive {
    /**
     * Constructs a new SetPublisherActive.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.ISetPublisherActive);

    /** SetPublisherActive isActive. */
    public isActive?: boolean | null;

    /** SetPublisherActive _isActive. */
    public _isActive?: "isActive";

    /**
     * Creates a new SetPublisherActive instance using the specified properties.
     * @param [properties] Properties to set
     * @returns SetPublisherActive instance
     */
    public static create(
      properties?: pyth_lazer_transaction.ISetPublisherActive,
    ): pyth_lazer_transaction.SetPublisherActive;

    /**
     * Encodes the specified SetPublisherActive message. Does not implicitly {@link pyth_lazer_transaction.SetPublisherActive.verify|verify} messages.
     * @param message SetPublisherActive message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.ISetPublisherActive,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified SetPublisherActive message, length delimited. Does not implicitly {@link pyth_lazer_transaction.SetPublisherActive.verify|verify} messages.
     * @param message SetPublisherActive message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.ISetPublisherActive,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a SetPublisherActive message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns SetPublisherActive
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.SetPublisherActive;

    /**
     * Decodes a SetPublisherActive message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns SetPublisherActive
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.SetPublisherActive;

    /**
     * Verifies a SetPublisherActive message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a SetPublisherActive message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns SetPublisherActive
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.SetPublisherActive;

    /**
     * Creates a plain object from a SetPublisherActive message. Also converts values to other types if specified.
     * @param message SetPublisherActive
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.SetPublisherActive,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this SetPublisherActive to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for SetPublisherActive
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an AddFeed. */
  interface IAddFeed {
    /** AddFeed priceFeedId */
    priceFeedId?: number | null;

    /** AddFeed metadata */
    metadata?: pyth_lazer_transaction.DynamicValue.IMap | null;

    /** AddFeed permissionedPublishers */
    permissionedPublishers?: number[] | null;
  }

  /** Represents an AddFeed. */
  class AddFeed implements IAddFeed {
    /**
     * Constructs a new AddFeed.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IAddFeed);

    /** AddFeed priceFeedId. */
    public priceFeedId?: number | null;

    /** AddFeed metadata. */
    public metadata?: pyth_lazer_transaction.DynamicValue.IMap | null;

    /** AddFeed permissionedPublishers. */
    public permissionedPublishers: number[];

    /** AddFeed _priceFeedId. */
    public _priceFeedId?: "priceFeedId";

    /** AddFeed _metadata. */
    public _metadata?: "metadata";

    /**
     * Creates a new AddFeed instance using the specified properties.
     * @param [properties] Properties to set
     * @returns AddFeed instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IAddFeed,
    ): pyth_lazer_transaction.AddFeed;

    /**
     * Encodes the specified AddFeed message. Does not implicitly {@link pyth_lazer_transaction.AddFeed.verify|verify} messages.
     * @param message AddFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IAddFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified AddFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.AddFeed.verify|verify} messages.
     * @param message AddFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IAddFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an AddFeed message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns AddFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.AddFeed;

    /**
     * Decodes an AddFeed message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns AddFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.AddFeed;

    /**
     * Verifies an AddFeed message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an AddFeed message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns AddFeed
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.AddFeed;

    /**
     * Creates a plain object from an AddFeed message. Also converts values to other types if specified.
     * @param message AddFeed
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.AddFeed,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this AddFeed to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for AddFeed
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an UpdateFeed. */
  interface IUpdateFeed {
    /** UpdateFeed priceFeedId */
    priceFeedId?: number | null;

    /** UpdateFeed updateFeedMetadata */
    updateFeedMetadata?: pyth_lazer_transaction.IUpdateFeedMetadata | null;

    /** UpdateFeed activateFeed */
    activateFeed?: pyth_lazer_transaction.IActivateFeed | null;

    /** UpdateFeed deactivateFeed */
    deactivateFeed?: pyth_lazer_transaction.IDeactivateFeed | null;

    /** UpdateFeed removeFeed */
    removeFeed?: google.protobuf.IEmpty | null;
  }

  /** Represents an UpdateFeed. */
  class UpdateFeed implements IUpdateFeed {
    /**
     * Constructs a new UpdateFeed.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IUpdateFeed);

    /** UpdateFeed priceFeedId. */
    public priceFeedId?: number | null;

    /** UpdateFeed updateFeedMetadata. */
    public updateFeedMetadata?: pyth_lazer_transaction.IUpdateFeedMetadata | null;

    /** UpdateFeed activateFeed. */
    public activateFeed?: pyth_lazer_transaction.IActivateFeed | null;

    /** UpdateFeed deactivateFeed. */
    public deactivateFeed?: pyth_lazer_transaction.IDeactivateFeed | null;

    /** UpdateFeed removeFeed. */
    public removeFeed?: google.protobuf.IEmpty | null;

    /** UpdateFeed _priceFeedId. */
    public _priceFeedId?: "priceFeedId";

    /** UpdateFeed action. */
    public action?:
      | "updateFeedMetadata"
      | "activateFeed"
      | "deactivateFeed"
      | "removeFeed";

    /**
     * Creates a new UpdateFeed instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UpdateFeed instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IUpdateFeed,
    ): pyth_lazer_transaction.UpdateFeed;

    /**
     * Encodes the specified UpdateFeed message. Does not implicitly {@link pyth_lazer_transaction.UpdateFeed.verify|verify} messages.
     * @param message UpdateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IUpdateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UpdateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateFeed.verify|verify} messages.
     * @param message UpdateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IUpdateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an UpdateFeed message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UpdateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.UpdateFeed;

    /**
     * Decodes an UpdateFeed message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UpdateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.UpdateFeed;

    /**
     * Verifies an UpdateFeed message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an UpdateFeed message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UpdateFeed
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.UpdateFeed;

    /**
     * Creates a plain object from an UpdateFeed message. Also converts values to other types if specified.
     * @param message UpdateFeed
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.UpdateFeed,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UpdateFeed to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UpdateFeed
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an UpdateFeedMetadata. */
  interface IUpdateFeedMetadata {
    /** UpdateFeedMetadata name */
    name?: string | null;

    /** UpdateFeedMetadata value */
    value?: pyth_lazer_transaction.IDynamicValue | null;
  }

  /** Represents an UpdateFeedMetadata. */
  class UpdateFeedMetadata implements IUpdateFeedMetadata {
    /**
     * Constructs a new UpdateFeedMetadata.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IUpdateFeedMetadata);

    /** UpdateFeedMetadata name. */
    public name?: string | null;

    /** UpdateFeedMetadata value. */
    public value?: pyth_lazer_transaction.IDynamicValue | null;

    /** UpdateFeedMetadata _name. */
    public _name?: "name";

    /** UpdateFeedMetadata _value. */
    public _value?: "value";

    /**
     * Creates a new UpdateFeedMetadata instance using the specified properties.
     * @param [properties] Properties to set
     * @returns UpdateFeedMetadata instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IUpdateFeedMetadata,
    ): pyth_lazer_transaction.UpdateFeedMetadata;

    /**
     * Encodes the specified UpdateFeedMetadata message. Does not implicitly {@link pyth_lazer_transaction.UpdateFeedMetadata.verify|verify} messages.
     * @param message UpdateFeedMetadata message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IUpdateFeedMetadata,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified UpdateFeedMetadata message, length delimited. Does not implicitly {@link pyth_lazer_transaction.UpdateFeedMetadata.verify|verify} messages.
     * @param message UpdateFeedMetadata message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IUpdateFeedMetadata,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an UpdateFeedMetadata message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns UpdateFeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.UpdateFeedMetadata;

    /**
     * Decodes an UpdateFeedMetadata message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns UpdateFeedMetadata
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.UpdateFeedMetadata;

    /**
     * Verifies an UpdateFeedMetadata message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an UpdateFeedMetadata message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns UpdateFeedMetadata
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.UpdateFeedMetadata;

    /**
     * Creates a plain object from an UpdateFeedMetadata message. Also converts values to other types if specified.
     * @param message UpdateFeedMetadata
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.UpdateFeedMetadata,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this UpdateFeedMetadata to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for UpdateFeedMetadata
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of an ActivateFeed. */
  interface IActivateFeed {
    /** ActivateFeed activationTimestamp */
    activationTimestamp?: google.protobuf.ITimestamp | null;
  }

  /** Represents an ActivateFeed. */
  class ActivateFeed implements IActivateFeed {
    /**
     * Constructs a new ActivateFeed.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IActivateFeed);

    /** ActivateFeed activationTimestamp. */
    public activationTimestamp?: google.protobuf.ITimestamp | null;

    /** ActivateFeed _activationTimestamp. */
    public _activationTimestamp?: "activationTimestamp";

    /**
     * Creates a new ActivateFeed instance using the specified properties.
     * @param [properties] Properties to set
     * @returns ActivateFeed instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IActivateFeed,
    ): pyth_lazer_transaction.ActivateFeed;

    /**
     * Encodes the specified ActivateFeed message. Does not implicitly {@link pyth_lazer_transaction.ActivateFeed.verify|verify} messages.
     * @param message ActivateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IActivateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified ActivateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.ActivateFeed.verify|verify} messages.
     * @param message ActivateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IActivateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes an ActivateFeed message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns ActivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.ActivateFeed;

    /**
     * Decodes an ActivateFeed message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns ActivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.ActivateFeed;

    /**
     * Verifies an ActivateFeed message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates an ActivateFeed message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns ActivateFeed
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.ActivateFeed;

    /**
     * Creates a plain object from an ActivateFeed message. Also converts values to other types if specified.
     * @param message ActivateFeed
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.ActivateFeed,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this ActivateFeed to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for ActivateFeed
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DeactivateFeed. */
  interface IDeactivateFeed {
    /** DeactivateFeed deactivationTimestamp */
    deactivationTimestamp?: google.protobuf.ITimestamp | null;
  }

  /** Represents a DeactivateFeed. */
  class DeactivateFeed implements IDeactivateFeed {
    /**
     * Constructs a new DeactivateFeed.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IDeactivateFeed);

    /** DeactivateFeed deactivationTimestamp. */
    public deactivationTimestamp?: google.protobuf.ITimestamp | null;

    /** DeactivateFeed _deactivationTimestamp. */
    public _deactivationTimestamp?: "deactivationTimestamp";

    /**
     * Creates a new DeactivateFeed instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DeactivateFeed instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IDeactivateFeed,
    ): pyth_lazer_transaction.DeactivateFeed;

    /**
     * Encodes the specified DeactivateFeed message. Does not implicitly {@link pyth_lazer_transaction.DeactivateFeed.verify|verify} messages.
     * @param message DeactivateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IDeactivateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DeactivateFeed message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DeactivateFeed.verify|verify} messages.
     * @param message DeactivateFeed message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IDeactivateFeed,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DeactivateFeed message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DeactivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.DeactivateFeed;

    /**
     * Decodes a DeactivateFeed message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DeactivateFeed
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.DeactivateFeed;

    /**
     * Verifies a DeactivateFeed message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DeactivateFeed message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DeactivateFeed
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.DeactivateFeed;

    /**
     * Creates a plain object from a DeactivateFeed message. Also converts values to other types if specified.
     * @param message DeactivateFeed
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.DeactivateFeed,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DeactivateFeed to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DeactivateFeed
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a DynamicValue. */
  interface IDynamicValue {
    /** DynamicValue stringValue */
    stringValue?: string | null;

    /** DynamicValue doubleValue */
    doubleValue?: number | null;

    /** DynamicValue uintValue */
    uintValue?: number | Long | null;

    /** DynamicValue intValue */
    intValue?: number | Long | null;

    /** DynamicValue boolValue */
    boolValue?: boolean | null;

    /** DynamicValue bytesValue */
    bytesValue?: Uint8Array | null;

    /** DynamicValue durationValue */
    durationValue?: google.protobuf.IDuration | null;

    /** DynamicValue timestampValue */
    timestampValue?: google.protobuf.ITimestamp | null;

    /** DynamicValue list */
    list?: pyth_lazer_transaction.DynamicValue.IList | null;

    /** DynamicValue map */
    map?: pyth_lazer_transaction.DynamicValue.IMap | null;
  }

  /** Represents a DynamicValue. */
  class DynamicValue implements IDynamicValue {
    /**
     * Constructs a new DynamicValue.
     * @param [properties] Properties to set
     */
    constructor(properties?: pyth_lazer_transaction.IDynamicValue);

    /** DynamicValue stringValue. */
    public stringValue?: string | null;

    /** DynamicValue doubleValue. */
    public doubleValue?: number | null;

    /** DynamicValue uintValue. */
    public uintValue?: number | Long | null;

    /** DynamicValue intValue. */
    public intValue?: number | Long | null;

    /** DynamicValue boolValue. */
    public boolValue?: boolean | null;

    /** DynamicValue bytesValue. */
    public bytesValue?: Uint8Array | null;

    /** DynamicValue durationValue. */
    public durationValue?: google.protobuf.IDuration | null;

    /** DynamicValue timestampValue. */
    public timestampValue?: google.protobuf.ITimestamp | null;

    /** DynamicValue list. */
    public list?: pyth_lazer_transaction.DynamicValue.IList | null;

    /** DynamicValue map. */
    public map?: pyth_lazer_transaction.DynamicValue.IMap | null;

    /** DynamicValue value. */
    public value?:
      | "stringValue"
      | "doubleValue"
      | "uintValue"
      | "intValue"
      | "boolValue"
      | "bytesValue"
      | "durationValue"
      | "timestampValue"
      | "list"
      | "map";

    /**
     * Creates a new DynamicValue instance using the specified properties.
     * @param [properties] Properties to set
     * @returns DynamicValue instance
     */
    public static create(
      properties?: pyth_lazer_transaction.IDynamicValue,
    ): pyth_lazer_transaction.DynamicValue;

    /**
     * Encodes the specified DynamicValue message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.verify|verify} messages.
     * @param message DynamicValue message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: pyth_lazer_transaction.IDynamicValue,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified DynamicValue message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.verify|verify} messages.
     * @param message DynamicValue message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: pyth_lazer_transaction.IDynamicValue,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a DynamicValue message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns DynamicValue
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): pyth_lazer_transaction.DynamicValue;

    /**
     * Decodes a DynamicValue message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns DynamicValue
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): pyth_lazer_transaction.DynamicValue;

    /**
     * Verifies a DynamicValue message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a DynamicValue message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns DynamicValue
     */
    public static fromObject(object: {
      [k: string]: any;
    }): pyth_lazer_transaction.DynamicValue;

    /**
     * Creates a plain object from a DynamicValue message. Also converts values to other types if specified.
     * @param message DynamicValue
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: pyth_lazer_transaction.DynamicValue,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this DynamicValue to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for DynamicValue
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace DynamicValue {
    /** Properties of a List. */
    interface IList {
      /** List items */
      items?: pyth_lazer_transaction.IDynamicValue[] | null;
    }

    /** Represents a List. */
    class List implements IList {
      /**
       * Constructs a new List.
       * @param [properties] Properties to set
       */
      constructor(properties?: pyth_lazer_transaction.DynamicValue.IList);

      /** List items. */
      public items: pyth_lazer_transaction.IDynamicValue[];

      /**
       * Creates a new List instance using the specified properties.
       * @param [properties] Properties to set
       * @returns List instance
       */
      public static create(
        properties?: pyth_lazer_transaction.DynamicValue.IList,
      ): pyth_lazer_transaction.DynamicValue.List;

      /**
       * Encodes the specified List message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.List.verify|verify} messages.
       * @param message List message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.DynamicValue.IList,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified List message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.List.verify|verify} messages.
       * @param message List message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.DynamicValue.IList,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a List message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns List
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.DynamicValue.List;

      /**
       * Decodes a List message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns List
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.DynamicValue.List;

      /**
       * Verifies a List message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a List message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns List
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.DynamicValue.List;

      /**
       * Creates a plain object from a List message. Also converts values to other types if specified.
       * @param message List
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.DynamicValue.List,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this List to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for List
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MapItem. */
    interface IMapItem {
      /** MapItem key */
      key?: string | null;

      /** MapItem value */
      value?: pyth_lazer_transaction.IDynamicValue | null;
    }

    /** Represents a MapItem. */
    class MapItem implements IMapItem {
      /**
       * Constructs a new MapItem.
       * @param [properties] Properties to set
       */
      constructor(properties?: pyth_lazer_transaction.DynamicValue.IMapItem);

      /** MapItem key. */
      public key?: string | null;

      /** MapItem value. */
      public value?: pyth_lazer_transaction.IDynamicValue | null;

      /** MapItem _key. */
      public _key?: "key";

      /** MapItem _value. */
      public _value?: "value";

      /**
       * Creates a new MapItem instance using the specified properties.
       * @param [properties] Properties to set
       * @returns MapItem instance
       */
      public static create(
        properties?: pyth_lazer_transaction.DynamicValue.IMapItem,
      ): pyth_lazer_transaction.DynamicValue.MapItem;

      /**
       * Encodes the specified MapItem message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.MapItem.verify|verify} messages.
       * @param message MapItem message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.DynamicValue.IMapItem,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified MapItem message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.MapItem.verify|verify} messages.
       * @param message MapItem message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.DynamicValue.IMapItem,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a MapItem message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns MapItem
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.DynamicValue.MapItem;

      /**
       * Decodes a MapItem message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns MapItem
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.DynamicValue.MapItem;

      /**
       * Verifies a MapItem message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a MapItem message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns MapItem
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.DynamicValue.MapItem;

      /**
       * Creates a plain object from a MapItem message. Also converts values to other types if specified.
       * @param message MapItem
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.DynamicValue.MapItem,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this MapItem to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for MapItem
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Map. */
    interface IMap {
      /** Map items */
      items?: pyth_lazer_transaction.DynamicValue.IMapItem[] | null;
    }

    /** Represents a Map. */
    class Map implements IMap {
      /**
       * Constructs a new Map.
       * @param [properties] Properties to set
       */
      constructor(properties?: pyth_lazer_transaction.DynamicValue.IMap);

      /** Map items. */
      public items: pyth_lazer_transaction.DynamicValue.IMapItem[];

      /**
       * Creates a new Map instance using the specified properties.
       * @param [properties] Properties to set
       * @returns Map instance
       */
      public static create(
        properties?: pyth_lazer_transaction.DynamicValue.IMap,
      ): pyth_lazer_transaction.DynamicValue.Map;

      /**
       * Encodes the specified Map message. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.Map.verify|verify} messages.
       * @param message Map message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: pyth_lazer_transaction.DynamicValue.IMap,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified Map message, length delimited. Does not implicitly {@link pyth_lazer_transaction.DynamicValue.Map.verify|verify} messages.
       * @param message Map message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: pyth_lazer_transaction.DynamicValue.IMap,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a Map message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns Map
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): pyth_lazer_transaction.DynamicValue.Map;

      /**
       * Decodes a Map message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns Map
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): pyth_lazer_transaction.DynamicValue.Map;

      /**
       * Verifies a Map message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a Map message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns Map
       */
      public static fromObject(object: {
        [k: string]: any;
      }): pyth_lazer_transaction.DynamicValue.Map;

      /**
       * Creates a plain object from a Map message. Also converts values to other types if specified.
       * @param message Map
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: pyth_lazer_transaction.DynamicValue.Map,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this Map to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for Map
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }
  }
}

/** Namespace google. */
export namespace google {
  /** Namespace protobuf. */
  namespace protobuf {
    /** Properties of a Timestamp. */
    interface ITimestamp {
      /** Timestamp seconds */
      seconds?: number | Long | null;

      /** Timestamp nanos */
      nanos?: number | null;
    }

    /** Represents a Timestamp. */
    class Timestamp implements ITimestamp {
      /**
       * Constructs a new Timestamp.
       * @param [properties] Properties to set
       */
      constructor(properties?: google.protobuf.ITimestamp);

      /** Timestamp seconds. */
      public seconds: number | Long;

      /** Timestamp nanos. */
      public nanos: number;

      /**
       * Creates a new Timestamp instance using the specified properties.
       * @param [properties] Properties to set
       * @returns Timestamp instance
       */
      public static create(
        properties?: google.protobuf.ITimestamp,
      ): google.protobuf.Timestamp;

      /**
       * Encodes the specified Timestamp message. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
       * @param message Timestamp message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: google.protobuf.ITimestamp,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified Timestamp message, length delimited. Does not implicitly {@link google.protobuf.Timestamp.verify|verify} messages.
       * @param message Timestamp message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: google.protobuf.ITimestamp,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a Timestamp message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns Timestamp
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): google.protobuf.Timestamp;

      /**
       * Decodes a Timestamp message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns Timestamp
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): google.protobuf.Timestamp;

      /**
       * Verifies a Timestamp message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a Timestamp message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns Timestamp
       */
      public static fromObject(object: {
        [k: string]: any;
      }): google.protobuf.Timestamp;

      /**
       * Creates a plain object from a Timestamp message. Also converts values to other types if specified.
       * @param message Timestamp
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: google.protobuf.Timestamp,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

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

    /** Properties of a Duration. */
    interface IDuration {
      /** Duration seconds */
      seconds?: number | Long | null;

      /** Duration nanos */
      nanos?: number | null;
    }

    /** Represents a Duration. */
    class Duration implements IDuration {
      /**
       * Constructs a new Duration.
       * @param [properties] Properties to set
       */
      constructor(properties?: google.protobuf.IDuration);

      /** Duration seconds. */
      public seconds: number | Long;

      /** Duration nanos. */
      public nanos: number;

      /**
       * Creates a new Duration instance using the specified properties.
       * @param [properties] Properties to set
       * @returns Duration instance
       */
      public static create(
        properties?: google.protobuf.IDuration,
      ): google.protobuf.Duration;

      /**
       * Encodes the specified Duration message. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
       * @param message Duration message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: google.protobuf.IDuration,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified Duration message, length delimited. Does not implicitly {@link google.protobuf.Duration.verify|verify} messages.
       * @param message Duration message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: google.protobuf.IDuration,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes a Duration message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns Duration
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): google.protobuf.Duration;

      /**
       * Decodes a Duration message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns Duration
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): google.protobuf.Duration;

      /**
       * Verifies a Duration message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates a Duration message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns Duration
       */
      public static fromObject(object: {
        [k: string]: any;
      }): google.protobuf.Duration;

      /**
       * Creates a plain object from a Duration message. Also converts values to other types if specified.
       * @param message Duration
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: google.protobuf.Duration,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

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

    /** Properties of an Empty. */
    interface IEmpty {}

    /** Represents an Empty. */
    class Empty implements IEmpty {
      /**
       * Constructs a new Empty.
       * @param [properties] Properties to set
       */
      constructor(properties?: google.protobuf.IEmpty);

      /**
       * Creates a new Empty instance using the specified properties.
       * @param [properties] Properties to set
       * @returns Empty instance
       */
      public static create(
        properties?: google.protobuf.IEmpty,
      ): google.protobuf.Empty;

      /**
       * Encodes the specified Empty message. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
       * @param message Empty message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encode(
        message: google.protobuf.IEmpty,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Encodes the specified Empty message, length delimited. Does not implicitly {@link google.protobuf.Empty.verify|verify} messages.
       * @param message Empty message or plain object to encode
       * @param [writer] Writer to encode to
       * @returns Writer
       */
      public static encodeDelimited(
        message: google.protobuf.IEmpty,
        writer?: $protobuf.Writer,
      ): $protobuf.Writer;

      /**
       * Decodes an Empty message from the specified reader or buffer.
       * @param reader Reader or buffer to decode from
       * @param [length] Message length if known beforehand
       * @returns Empty
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
      ): google.protobuf.Empty;

      /**
       * Decodes an Empty message from the specified reader or buffer, length delimited.
       * @param reader Reader or buffer to decode from
       * @returns Empty
       * @throws {Error} If the payload is not a reader or valid buffer
       * @throws {$protobuf.util.ProtocolError} If required fields are missing
       */
      public static decodeDelimited(
        reader: $protobuf.Reader | Uint8Array,
      ): google.protobuf.Empty;

      /**
       * Verifies an Empty message.
       * @param message Plain object to verify
       * @returns `null` if valid, otherwise the reason why it is not
       */
      public static verify(message: { [k: string]: any }): string | null;

      /**
       * Creates an Empty message from a plain object. Also converts values to their respective internal types.
       * @param object Plain object
       * @returns Empty
       */
      public static fromObject(object: {
        [k: string]: any;
      }): google.protobuf.Empty;

      /**
       * Creates a plain object from an Empty message. Also converts values to other types if specified.
       * @param message Empty
       * @param [options] Conversion options
       * @returns Plain object
       */
      public static toObject(
        message: google.protobuf.Empty,
        options?: $protobuf.IConversionOptions,
      ): { [k: string]: any };

      /**
       * Converts this Empty to JSON.
       * @returns JSON object
       */
      public toJSON(): { [k: string]: any };

      /**
       * Gets the default type url for Empty
       * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
       * @returns The default type url
       */
      public static getTypeUrl(typeUrlPrefix?: string): string;
    }
  }
}
