import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
const treasury = new PublicKey("Gx4MBPb1vqZLJajZmsKLg8fGw9ErhoKsR8LeKcCKFyak");
const pyth = new PublicKey("HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3");
const dest = new PublicKey("AYBdhJU8Wao48SEDyKVRXgDRbo9SU8Thnytakof4HDDH");
const ata = getAssociatedTokenAddressSync(pyth, treasury, true);
console.log("Canonical ATA(treasury, PYTH):", ata.toBase58());
console.log("Proposal destination         :", dest.toBase58());
console.log("  match (dest is the treasury's PYTH ATA):", ata.equals(dest));
