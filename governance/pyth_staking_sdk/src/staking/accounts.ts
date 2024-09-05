import { BorshCoder } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import type { Staking } from "../../types/staking";
import { POSITION_BUFFER_SIZE, POSITIONS_ACCOUNT_SIZE } from "../constants";
import type { Position, PositionAnchor } from "../types";
import { convertBNToBigInt } from "../utils/bn";

export type StakeAccountPositions = {
  address: PublicKey;
  data: {
    owner: PublicKey;
    positions: Position[];
  };
};

export class StakeAccountPositionsAnchor {
  public address: PublicKey;
  public data: PositionAccountDataAnchor;

  constructor(address: PublicKey, data: Buffer, idl: Staking) {
    this.address = address;
    this.data = new PositionAccountDataAnchor(data, idl);
  }

  public toStakeAccountPositions(): StakeAccountPositions {
    return {
      address: this.address,
      data: {
        owner: this.data.owner,
        positions: this.data.positions.map((p) => convertBNToBigInt(p)),
      },
    };
  }
}
export class PositionAccountDataAnchor {
  public owner: PublicKey;
  public positions: PositionAnchor[];

  constructor(buffer: Buffer, idl: Staking) {
    const coder = new BorshCoder(idl);
    let i = 8; // Skip discriminator
    this.owner = new PublicKey(buffer.slice(i, i + 32));
    const numberOfPositions = Math.floor(
      (buffer.length - POSITIONS_ACCOUNT_SIZE) / POSITION_BUFFER_SIZE,
    );
    i += 32;
    this.positions = [];
    for (let j = 0; j < numberOfPositions; j++) {
      if (buffer[i] === 1) {
        this.positions.push(
          coder.types.decode("position", buffer.subarray(i + 1)),
        );
      }
      i += POSITION_BUFFER_SIZE;
    }
  }
}
