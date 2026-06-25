import { Buffer } from "buffer";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Buffer === "undefined") (globalThis as any).Buffer = Buffer;

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const RUNEX_MINT     = new PublicKey("6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump");
export const TREASURY       = new PublicKey("2yeGpBaCFF8Q4jNFEmncL677wxjKaDHFnr7v5YGVX2T6");
export const SOLANA_RPC     = "https://lb.drpc.live/solana/An6mizDna0g2rZjqFdDX1KlA_FSOXTcR8beSIqM_iWcm";
export const RUNEX_DECIMALS = 6;

export const connection = new Connection(SOLANA_RPC, "confirmed");

/**
 * Transfer `uiAmount` RuneX tokens (Token-2022) from Phantom wallet to treasury.
 * Pump.fun tokens use TOKEN_2022_PROGRAM_ID — all instructions and ATA derivations must match.
 */
export async function payRunex(uiAmount: number): Promise<string> {
  const provider = (window as Window & {
    solana?: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> };
  }).solana;
  if (!provider?.publicKey) throw new Error("Wallet not connected");

  const payer  = provider.publicKey;
  const rawAmt = BigInt(Math.round(uiAmount * 10 ** RUNEX_DECIMALS));

  // Token-2022: ATA addresses differ from legacy token — must pass TOKEN_2022_PROGRAM_ID
  const fromATA = await getAssociatedTokenAddress(RUNEX_MINT, payer,    false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const toATA   = await getAssociatedTokenAddress(RUNEX_MINT, TREASURY, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = new Transaction();

  // Idempotent ATA creation for treasury (only creates if missing)
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    payer, toATA, TREASURY, RUNEX_MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  ));

  // TransferChecked requires mint + decimals — mandatory for Token-2022
  tx.add(createTransferCheckedInstruction(
    fromATA, RUNEX_MINT, toATA, payer, rawAmt, RUNEX_DECIMALS, [], TOKEN_2022_PROGRAM_ID,
  ));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = payer;

  const signed    = await provider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  return signature;
}
