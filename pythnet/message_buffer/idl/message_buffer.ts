export type MessageBuffer = {
  version: "0.1.0";
  name: "message_buffer";
  instructions: [
    {
      name: "initialize";
      docs: [
        "Initializes the whitelist and sets it's admin. Once initialized,",
        "the admin must sign all further changes to the whitelist.",
      ];
      accounts: [
        {
          name: "admin";
          isMut: false;
          isSigner: true;
          docs: [
            "Admin that can update the whitelist and create/resize/delete buffers",
          ];
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "whitelist";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [];
    },
    {
      name: "setAllowedPrograms";
      docs: [
        "Sets the programs that are allowed to invoke this program through CPI",
        "",
        "* `allowed_programs` - Entire list of programs that are allowed to",
        "invoke this program through CPI",
      ];
      accounts: [
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "whitelist";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
          relations: ["admin"];
        },
      ];
      args: [
        {
          name: "allowedPrograms";
          type: {
            vec: "publicKey";
          };
        },
      ];
    },
    {
      name: "updateWhitelistAdmin";
      docs: ["Sets the new admin for the whitelist"];
      accounts: [
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "whitelist";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
          relations: ["admin"];
        },
      ];
      args: [
        {
          name: "newAdmin";
          type: "publicKey";
        },
      ];
    },
    {
      name: "putAll";
      docs: [
        "Put messages into the Accumulator. All messages put for the same",
        "`base_account_key` go into the same buffer PDA. The PDA's address is",
        "`[allowed_program_auth, MESSAGE, base_account_key]`, where `allowed_program_auth`",
        "is the whitelisted pubkey who authorized this call.",
        "",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "* `messages`            - Vec of vec of bytes, each representing a message",
        "to be hashed and accumulated",
        "",
        "This ix will write as many of the messages up to the length",
        "of the `accumulator_input.data`.",
        "If `accumulator_input.data.len() < messages.map(|x| x.len()).sum()`",
        "then the remaining messages will be ignored.",
        "",
        "The current implementation assumes that each invocation of this",
        "ix is independent of any previous invocations. It will overwrite",
        "any existing contents.",
        "",
        "TODO:",
        '- handle updates ("paging/batches of messages")',
        "",
      ];
      accounts: [
        {
          name: "whitelistVerifier";
          accounts: [
            {
              name: "whitelist";
              isMut: false;
              isSigner: false;
              pda: {
                seeds: [
                  {
                    kind: "const";
                    type: "string";
                    value: "message";
                  },
                  {
                    kind: "const";
                    type: "string";
                    value: "whitelist";
                  },
                ];
              };
            },
            {
              name: "cpiCallerAuth";
              isMut: false;
              isSigner: true;
              docs: ["PDA representing authorized cpi caller"];
            },
          ];
        },
        {
          name: "messageBuffer";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "account";
                type: {
                  defined: "Signer<'info>";
                };
                account: "WhitelistVerifier";
                path: "whitelist_verifier.cpi_caller_auth";
              },
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "arg";
                type: "publicKey";
                path: "base_account_key";
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "baseAccountKey";
          type: "publicKey";
        },
        {
          name: "messages";
          type: {
            vec: "bytes";
          };
        },
      ];
    },
    {
      name: "createBuffer";
      docs: [
        "Initializes the buffer account with the `target_size`",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "*`target_size`          - Initial size to allocate for the",
        "`MessageBuffer` PDA. `target_size`",
        "must be >= HEADER_LEN && <= 10240",
      ];
      accounts: [
        {
          name: "whitelist";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
          relations: ["admin"];
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: ["pays for account initialization"];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
      ];
      args: [
        {
          name: "allowedProgramAuth";
          type: "publicKey";
        },
        {
          name: "baseAccountKey";
          type: "publicKey";
        },
        {
          name: "targetSize";
          type: "u32";
        },
      ];
    },
    {
      name: "resizeBuffer";
      docs: [
        "Resizes the buffer account to the `target_size`",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "*`target_size`          -  Size to re-allocate for the",
        "`MessageBuffer` PDA. If increasing the size,",
        "max delta of current_size & target_size is 10240",
      ];
      accounts: [
        {
          name: "whitelist";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
          relations: ["admin"];
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: [
            "Pays for any additional rent needed to increase the buffer size",
          ];
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "messageBuffer";
          isMut: true;
          isSigner: false;
          docs: [
            "If decreasing, Anchor will automatically check",
            "if target_size is < MessageBuffer::INIT_SPACE + 8",
            "and if so,then load() will fail.",
            "If increasing, Anchor also automatically checks if target_size delta",
            "exceeds MAX_PERMITTED_DATA_INCREASE",
          ];
          pda: {
            seeds: [
              {
                kind: "arg";
                type: "publicKey";
                path: "allowed_program_auth";
              },
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "arg";
                type: "publicKey";
                path: "base_account_key";
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "allowedProgramAuth";
          type: "publicKey";
        },
        {
          name: "baseAccountKey";
          type: "publicKey";
        },
        {
          name: "targetSize";
          type: "u32";
        },
      ];
    },
    {
      name: "deleteBuffer";
      docs: [
        "Closes the buffer account and transfers the remaining lamports to the",
        "`admin` account",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
      ];
      accounts: [
        {
          name: "whitelist";
          isMut: false;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "const";
                type: "string";
                value: "whitelist";
              },
            ];
          };
          relations: ["admin"];
        },
        {
          name: "admin";
          isMut: false;
          isSigner: true;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
          docs: ["Recipient of the lamports from closing the buffer account"];
        },
        {
          name: "messageBuffer";
          isMut: true;
          isSigner: false;
          pda: {
            seeds: [
              {
                kind: "arg";
                type: "publicKey";
                path: "allowed_program_auth";
              },
              {
                kind: "const";
                type: "string";
                value: "message";
              },
              {
                kind: "arg";
                type: "publicKey";
                path: "base_account_key";
              },
            ];
          };
        },
      ];
      args: [
        {
          name: "allowedProgramAuth";
          type: "publicKey";
        },
        {
          name: "baseAccountKey";
          type: "publicKey";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "messageBuffer";
      docs: [
        "A MessageBuffer will have the following structure",
        "```ignore",
        "struct MessageBuffer {",
        "header: BufferHeader,",
        "messages: [u8; accountInfo.data.len - header.header_len]",
        "}",
        "```",
        "",
        "where `MESSAGES_LEN` can be dynamic. There is actual",
        "no messages field in the `MessageBuffer` struct definition due to messages",
        "needing to be a dynamic length while supporting zero_copy",
        "at the same time.",
        "",
        "A `MessageBuffer` AccountInfo.data will look like:",
        "[  <discrimintator>, <buffer_header>, <messages> ]",
        "(0..8)       (8..header_len) (header_len...accountInfo.data.len)",
        "",
        "<br>",
        "",
        "NOTE: The defined fields are read as *Little Endian*. The actual messages",
        "are read as *Big Endian*. The MessageBuffer fields are only ever read",
        "by the Pythnet validator & Hermes so don't need to be in Big Endian",
        "for cross-platform compatibility.",
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "version";
            type: "u8";
          },
          {
            name: "headerLen";
            type: "u16";
          },
          {
            name: "endOffsets";
            docs: [
              "endpoints of every message.",
              "ex: [10, 14]",
              "=> msg1 = account_info.data[(header_len + 0)..(header_len + 10)]",
              "=> msg2 = account_info.data[(header_len + 10)..(header_len + 14)]",
            ];
            type: {
              array: ["u16", 255];
            };
          },
        ];
      };
    },
    {
      name: "whitelist";
      type: {
        kind: "struct";
        fields: [
          {
            name: "bump";
            type: "u8";
          },
          {
            name: "admin";
            type: "publicKey";
          },
          {
            name: "allowedPrograms";
            type: {
              vec: "publicKey";
            };
          },
        ];
      };
    },
  ];
  errors: [
    {
      code: 6000;
      name: "CallerNotAllowed";
      msg: "CPI Caller not allowed";
    },
    {
      code: 6001;
      name: "InvalidAllowedProgram";
      msg: "Invalid allowed program";
    },
    {
      code: 6002;
      name: "MaximumAllowedProgramsExceeded";
      msg: "Maximum number of allowed programs exceeded";
    },
    {
      code: 6003;
      name: "MessageBufferNotProvided";
      msg: "Message Buffer not provided";
    },
    {
      code: 6004;
      name: "MessageBufferTooSmall";
      msg: "Message Buffer target size is not sufficiently large";
    },
    {
      code: 6005;
      name: "TargetSizeDeltaExceeded";
      msg: "Target size too large for reallocation/initialization. Max delta is 10240";
    },
    {
      code: 6006;
      name: "TargetSizeExceedsMaxLen";
      msg: "Target size exceeds MessageBuffer::MAX_LEN";
    },
  ];
};

export const IDL: MessageBuffer = {
  version: "0.1.0",
  name: "message_buffer",
  instructions: [
    {
      name: "initialize",
      docs: [
        "Initializes the whitelist and sets it's admin. Once initialized,",
        "the admin must sign all further changes to the whitelist.",
      ],
      accounts: [
        {
          name: "admin",
          isMut: false,
          isSigner: true,
          docs: [
            "Admin that can update the whitelist and create/resize/delete buffers",
          ],
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "whitelist",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "setAllowedPrograms",
      docs: [
        "Sets the programs that are allowed to invoke this program through CPI",
        "",
        "* `allowed_programs` - Entire list of programs that are allowed to",
        "invoke this program through CPI",
      ],
      accounts: [
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "whitelist",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
          relations: ["admin"],
        },
      ],
      args: [
        {
          name: "allowedPrograms",
          type: {
            vec: "publicKey",
          },
        },
      ],
    },
    {
      name: "updateWhitelistAdmin",
      docs: ["Sets the new admin for the whitelist"],
      accounts: [
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "whitelist",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
          relations: ["admin"],
        },
      ],
      args: [
        {
          name: "newAdmin",
          type: "publicKey",
        },
      ],
    },
    {
      name: "putAll",
      docs: [
        "Put messages into the Accumulator. All messages put for the same",
        "`base_account_key` go into the same buffer PDA. The PDA's address is",
        "`[allowed_program_auth, MESSAGE, base_account_key]`, where `allowed_program_auth`",
        "is the whitelisted pubkey who authorized this call.",
        "",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "* `messages`            - Vec of vec of bytes, each representing a message",
        "to be hashed and accumulated",
        "",
        "This ix will write as many of the messages up to the length",
        "of the `accumulator_input.data`.",
        "If `accumulator_input.data.len() < messages.map(|x| x.len()).sum()`",
        "then the remaining messages will be ignored.",
        "",
        "The current implementation assumes that each invocation of this",
        "ix is independent of any previous invocations. It will overwrite",
        "any existing contents.",
        "",
        "TODO:",
        '- handle updates ("paging/batches of messages")',
        "",
      ],
      accounts: [
        {
          name: "whitelistVerifier",
          accounts: [
            {
              name: "whitelist",
              isMut: false,
              isSigner: false,
              pda: {
                seeds: [
                  {
                    kind: "const",
                    type: "string",
                    value: "message",
                  },
                  {
                    kind: "const",
                    type: "string",
                    value: "whitelist",
                  },
                ],
              },
            },
            {
              name: "cpiCallerAuth",
              isMut: false,
              isSigner: true,
              docs: ["PDA representing authorized cpi caller"],
            },
          ],
        },
        {
          name: "messageBuffer",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "account",
                type: {
                  defined: "Signer<'info>",
                },
                account: "WhitelistVerifier",
                path: "whitelist_verifier.cpi_caller_auth",
              },
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "arg",
                type: "publicKey",
                path: "base_account_key",
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "baseAccountKey",
          type: "publicKey",
        },
        {
          name: "messages",
          type: {
            vec: "bytes",
          },
        },
      ],
    },
    {
      name: "createBuffer",
      docs: [
        "Initializes the buffer account with the `target_size`",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "*`target_size`          - Initial size to allocate for the",
        "`MessageBuffer` PDA. `target_size`",
        "must be >= HEADER_LEN && <= 10240",
      ],
      accounts: [
        {
          name: "whitelist",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
          relations: ["admin"],
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: ["pays for account initialization"],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "allowedProgramAuth",
          type: "publicKey",
        },
        {
          name: "baseAccountKey",
          type: "publicKey",
        },
        {
          name: "targetSize",
          type: "u32",
        },
      ],
    },
    {
      name: "resizeBuffer",
      docs: [
        "Resizes the buffer account to the `target_size`",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
        "*`target_size`          -  Size to re-allocate for the",
        "`MessageBuffer` PDA. If increasing the size,",
        "max delta of current_size & target_size is 10240",
      ],
      accounts: [
        {
          name: "whitelist",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
          relations: ["admin"],
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: [
            "Pays for any additional rent needed to increase the buffer size",
          ],
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "messageBuffer",
          isMut: true,
          isSigner: false,
          docs: [
            "If decreasing, Anchor will automatically check",
            "if target_size is < MessageBuffer::INIT_SPACE + 8",
            "and if so,then load() will fail.",
            "If increasing, Anchor also automatically checks if target_size delta",
            "exceeds MAX_PERMITTED_DATA_INCREASE",
          ],
          pda: {
            seeds: [
              {
                kind: "arg",
                type: "publicKey",
                path: "allowed_program_auth",
              },
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "arg",
                type: "publicKey",
                path: "base_account_key",
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "allowedProgramAuth",
          type: "publicKey",
        },
        {
          name: "baseAccountKey",
          type: "publicKey",
        },
        {
          name: "targetSize",
          type: "u32",
        },
      ],
    },
    {
      name: "deleteBuffer",
      docs: [
        "Closes the buffer account and transfers the remaining lamports to the",
        "`admin` account",
        "",
        "*`allowed_program_auth` - The whitelisted pubkey representing an",
        "allowed program. Used as one of the seeds",
        "for deriving the `MessageBuffer` PDA.",
        "* `base_account_key`    - Pubkey of the original account the",
        "`MessageBuffer` is derived from",
        "(e.g. pyth price account)",
      ],
      accounts: [
        {
          name: "whitelist",
          isMut: false,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "const",
                type: "string",
                value: "whitelist",
              },
            ],
          },
          relations: ["admin"],
        },
        {
          name: "admin",
          isMut: false,
          isSigner: true,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
          docs: ["Recipient of the lamports from closing the buffer account"],
        },
        {
          name: "messageBuffer",
          isMut: true,
          isSigner: false,
          pda: {
            seeds: [
              {
                kind: "arg",
                type: "publicKey",
                path: "allowed_program_auth",
              },
              {
                kind: "const",
                type: "string",
                value: "message",
              },
              {
                kind: "arg",
                type: "publicKey",
                path: "base_account_key",
              },
            ],
          },
        },
      ],
      args: [
        {
          name: "allowedProgramAuth",
          type: "publicKey",
        },
        {
          name: "baseAccountKey",
          type: "publicKey",
        },
      ],
    },
  ],
  accounts: [
    {
      name: "messageBuffer",
      docs: [
        "A MessageBuffer will have the following structure",
        "```ignore",
        "struct MessageBuffer {",
        "header: BufferHeader,",
        "messages: [u8; accountInfo.data.len - header.header_len]",
        "}",
        "```",
        "",
        "where `MESSAGES_LEN` can be dynamic. There is actual",
        "no messages field in the `MessageBuffer` struct definition due to messages",
        "needing to be a dynamic length while supporting zero_copy",
        "at the same time.",
        "",
        "A `MessageBuffer` AccountInfo.data will look like:",
        "[  <discrimintator>, <buffer_header>, <messages> ]",
        "(0..8)       (8..header_len) (header_len...accountInfo.data.len)",
        "",
        "<br>",
        "",
        "NOTE: The defined fields are read as *Little Endian*. The actual messages",
        "are read as *Big Endian*. The MessageBuffer fields are only ever read",
        "by the Pythnet validator & Hermes so don't need to be in Big Endian",
        "for cross-platform compatibility.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "version",
            type: "u8",
          },
          {
            name: "headerLen",
            type: "u16",
          },
          {
            name: "endOffsets",
            docs: [
              "endpoints of every message.",
              "ex: [10, 14]",
              "=> msg1 = account_info.data[(header_len + 0)..(header_len + 10)]",
              "=> msg2 = account_info.data[(header_len + 10)..(header_len + 14)]",
            ],
            type: {
              array: ["u16", 255],
            },
          },
        ],
      },
    },
    {
      name: "whitelist",
      type: {
        kind: "struct",
        fields: [
          {
            name: "bump",
            type: "u8",
          },
          {
            name: "admin",
            type: "publicKey",
          },
          {
            name: "allowedPrograms",
            type: {
              vec: "publicKey",
            },
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "CallerNotAllowed",
      msg: "CPI Caller not allowed",
    },
    {
      code: 6001,
      name: "InvalidAllowedProgram",
      msg: "Invalid allowed program",
    },
    {
      code: 6002,
      name: "MaximumAllowedProgramsExceeded",
      msg: "Maximum number of allowed programs exceeded",
    },
    {
      code: 6003,
      name: "MessageBufferNotProvided",
      msg: "Message Buffer not provided",
    },
    {
      code: 6004,
      name: "MessageBufferTooSmall",
      msg: "Message Buffer target size is not sufficiently large",
    },
    {
      code: 6005,
      name: "TargetSizeDeltaExceeded",
      msg: "Target size too large for reallocation/initialization. Max delta is 10240",
    },
    {
      code: 6006,
      name: "TargetSizeExceedsMaxLen",
      msg: "Target size exceeds MessageBuffer::MAX_LEN",
    },
  ],
};
