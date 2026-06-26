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

export const TREASURY       = new PublicKey("Q9MW41RZNygw2Uhg8LSVbJ333UW3DS8A7hnnwtM2eS1");
export const RUNEX_MINT     = new PublicKey("6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump");
export const SOLANA_RPC     = "https://lb.drpc.live/solana/An6mizDna0g2rZjqFdDX1KlA_FSOXTcR8beSIqM_iWcm";
export const RUNEX_DECIMALS = 6;

export const connection = new Connection(SOLANA_RPC, "confirmed");

export async function payRunex(uiAmount: number): Promise<string> {
  const provider = (window as Window & {
    solana?: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> };
  }).solana;
  if (!provider?.publicKey) throw new Error("Wallet not connected");

  const payer  = provider.publicKey;
  const rawAmt = BigInt(Math.round(uiAmount * 10 ** RUNEX_DECIMALS));

  const fromATA = await getAssociatedTokenAddress(RUNEX_MINT, payer,    false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const toATA   = await getAssociatedTokenAddress(RUNEX_MINT, TREASURY, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const tx = new Transaction();

  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    payer, toATA, TREASURY, RUNEX_MINT, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  ));

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
