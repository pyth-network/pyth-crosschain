import { BorshCoder, IdlTypes, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Position } from "./types";
import { Staking } from "../../types/staking";
import { POSITION_BUFFER_SIZE, POSITIONS_ACCOUNT_SIZE } from "../constants";

export class StakeAccountPositions {
  public address: PublicKey;
  public data: PositionAccountData;

  constructor(address: PublicKey, data: Buffer, idl: Staking) {
    this.address = address;
    this.data = new PositionAccountData(data, idl);
  }
}

export class PositionAccountData {
  public owner: PublicKey;
  public positions: (Position | null)[];

  constructor(buffer: Buffer, idl: Staking) {
    const coder = new BorshCoder(idl);
    let i = 8; // Skip discriminator
    this.owner = new PublicKey(buffer.slice(i, i + 32));
    let numberOfPositions = Math.floor(
      (buffer.length - POSITIONS_ACCOUNT_SIZE) / POSITION_BUFFER_SIZE
    );
    i += 32;
    this.positions = [];
    for (let j = 0; j < numberOfPositions; j++) {
      if (buffer[i] === 1) {
        this.positions.push(
          coder.types.decode("position", buffer.subarray(i + 1))
        );
      } else {
        this.positions.push(null);
      }
      i += POSITION_BUFFER_SIZE;
    }
  }
}
