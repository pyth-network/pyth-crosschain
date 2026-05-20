# Pythnet Authority Audit Tool

Lists the BPF upgrade authorities for known Pyth programs deployed on Pythnet.

## Usage

```bash
pnpm --filter @pythnetwork/contract-manager exec ts-node scripts/list_pythnet_authorities.ts
```

### CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--rpc <url>` | `https://pythnet.rpcpool.com` | Pythnet RPC endpoint |
| `--out <path>` | `pythnet-authorities.json` | Output JSON file path |
| `--programs <path>` | _(built-in list)_ | Custom program list JSON |

### Custom Program List

Supply a JSON file with `--programs` to override the built-in list:

```json
[
  {
    "name": "My Program",
    "program_id": "<base58 pubkey>",
    "source": "description of where this ID comes from",
    "is_validator_builtin": false
  }
]
```

## Program Registry

The built-in program list is sourced from:
- **[Pyth documentation](https://docs.pyth.network/price-feeds/core/contract-addresses/pythnet)** for program IDs
- **Existing repo constants** (`@pythnetwork/xc-admin-common`) for `REMOTE_EXECUTOR_ADDRESS` and `MESSAGE_BUFFER_PROGRAM_ID`

Current programs:
| Name | Program ID |
|------|-----------|
| Oracle Program | `FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH` |
| Remote Executor | `exe6S3AxPVNmy46L4Nj6HrnnAVQUhwyYzMSNcnRn3qq` |
| Message Buffer | `7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPb6JxDcffRHUM` |

## Validator-Built-in Investigation

The pythnet validator tree ([pyth-network/pythnet@pyth-v1.14.29/programs](https://github.com/pyth-network/pythnet/tree/pyth-v1.14.29/programs)) was investigated for Pyth oracle programs baked into the validator as builtin/native programs.

**Finding: No Pyth oracle programs are baked into the validator as builtins.**

The validator tree contains standard Solana system programs (vote, stake, system, etc.) but the Pyth oracle, Remote Executor, and Message Buffer programs are deployed as regular BPF upgradeable programs with ProgramData accounts. This means all three have inspectable upgrade authorities via the BPF Upgradeable Loader.

## Output Schema

The JSON output follows this schema (fields `state_authorities` and `validators` are placeholders for future PRs):

```json
{
  "rpc": "https://pythnet.rpcpool.com",
  "generated_at": "2024-01-01T00:00:00.000Z",
  "programs": [
    {
      "name": "Oracle Program",
      "program_id": "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH",
      "source": "docs.pyth.network/price-feeds/core/contract-addresses/pythnet",
      "upgrade_authority": "<pubkey or null>",
      "programdata_address": "<pubkey or null>",
      "last_deploy_slot": 12345678,
      "notes": "",
      "state_authorities": []
    }
  ],
  "validators": []
}
```

## Extending

To add a new program, edit `contract_manager/src/core/pythnet-programs.ts` and add an entry to the `PYTHNET_PROGRAMS` array. If the program is a validator builtin (no ProgramData account), set `isValidatorBuiltin: true`.
