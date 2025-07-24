/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/pyth_lazer_solana_contract.json`.
 */
export type PythLazerSolanaContract = {
  "address": "pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt",
  "metadata": {
    "name": "pythLazerSolanaContract",
    "version": "0.4.2",
    "spec": "0.1.0",
    "description": "Pyth Lazer Solana contract and SDK.",
    "repository": "https://github.com/pyth-network/pyth-crosschain"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "storage",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  97,
                  103,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "topAuthority",
          "type": "pubkey"
        },
        {
          "name": "treasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "update",
      "discriminator": [
        219,
        200,
        88,
        176,
        158,
        63,
        253,
        127
      ],
      "accounts": [
        {
          "name": "topAuthority",
          "signer": true,
          "relations": [
            "storage"
          ]
        },
        {
          "name": "storage",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  97,
                  103,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "trustedSigner",
          "type": "pubkey"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "updateEcdsaSigner",
      "discriminator": [
        22,
        110,
        222,
        141,
        112,
        219,
        27,
        200
      ],
      "accounts": [
        {
          "name": "topAuthority",
          "signer": true,
          "relations": [
            "storage"
          ]
        },
        {
          "name": "storage",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  97,
                  103,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "trustedSigner",
          "type": {
            "array": [
              "u8",
              20
            ]
          }
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "verifyEcdsaMessage",
      "discriminator": [
        207,
        170,
        89,
        179,
        216,
        67,
        129,
        146
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "storage",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  97,
                  103,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "relations": [
            "storage"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "messageData",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "verifyMessage",
      "docs": [
        "Verifies a ed25519 signature on Solana by checking that the transaction contains",
        "a correct call to the built-in `ed25519_program`.",
        "",
        "- `message_data` is the signed message that is being verified.",
        "- `ed25519_instruction_index` is the index of the `ed25519_program` instruction",
        "within the transaction. This instruction must precede the current instruction.",
        "- `signature_index` is the index of the signature within the inputs to the `ed25519_program`.",
        "- `message_offset` is the offset of the signed message within the",
        "input data for the current instruction."
      ],
      "discriminator": [
        180,
        193,
        120,
        55,
        189,
        135,
        203,
        83
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "storage",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  97,
                  103,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "relations": [
            "storage"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "(e.g. in `sysvar::instructions::load_instruction_at_checked`).",
            "This account is not usable with anchor's `Program` account type because it's not executable."
          ]
        }
      ],
      "args": [
        {
          "name": "messageData",
          "type": "bytes"
        },
        {
          "name": "ed25519InstructionIndex",
          "type": "u16"
        },
        {
          "name": "signatureIndex",
          "type": "u8"
        }
      ],
      "returns": {
        "defined": {
          "name": "verifiedMessage"
        }
      }
    }
  ],
  "accounts": [
    {
      "name": "storage",
      "discriminator": [
        209,
        117,
        255,
        185,
        196,
        175,
        68,
        9
      ]
    }
  ],
  "types": [
    {
      "name": "storage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "topAuthority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "singleUpdateFeeInLamports",
            "type": "u64"
          },
          {
            "name": "numTrustedSigners",
            "type": "u8"
          },
          {
            "name": "trustedSigners",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "trustedSignerInfo",
                    "generics": [
                      {
                        "kind": "type",
                        "type": "pubkey"
                      }
                    ]
                  }
                },
                5
              ]
            }
          },
          {
            "name": "numTrustedEcdsaSigners",
            "type": "u8"
          },
          {
            "name": "trustedEcdsaSigners",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "trustedSignerInfo",
                    "generics": [
                      {
                        "kind": "type",
                        "type": {
                          "array": [
                            "u8",
                            20
                          ]
                        }
                      }
                    ]
                  }
                },
                2
              ]
            }
          },
          {
            "name": "extraSpace",
            "type": {
              "array": [
                "u8",
                43
              ]
            }
          }
        ]
      }
    },
    {
      "name": "trustedSignerInfo",
      "generics": [
        {
          "kind": "type",
          "name": "t"
        }
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": {
              "generic": "t"
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifiedMessage",
      "docs": [
        "A message with a verified ed25519 signature."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "publicKey",
            "docs": [
              "Public key that signed the message."
            ],
            "type": "pubkey"
          },
          {
            "name": "payload",
            "docs": [
              "Signed message payload."
            ],
            "type": "bytes"
          }
        ]
      }
    }
  ]
};
