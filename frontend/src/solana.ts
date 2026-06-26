import { Buffer } from "buffer";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Buffer === "undefined") (globalThis as any).Buffer = Buffer;

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const TREASURY = new PublicKey("2yeGpBaCFF8Q4jNFEmncL677wxjKaDHFnr7v5YGVX2T6");
export const SOLANA_RPC     = "https://lb.drpc.live/solana/An6mizDna0g2rZjqFdDX1KlA_FSOXTcR8beSIqM_iWcm";
export const RUNEX_DECIMALS = 6;

export const connection = new Connection(SOLANA_RPC, "confirmed");

export async function payRunex(uiAmount: number, mintStr: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = (window as any).solana;
  if (!provider?.publicKey) throw new Error("Wallet not connected");

  let step = "payer";
  try {
    const payer  = new PublicKey(provider.publicKey.toString());

    step = "mint";
    const mint   = new PublicKey(mintStr);

    step = "amount";
    const rawAmt = BigInt(Math.round(uiAmount * 10 ** RUNEX_DECIMALS));

    step = "fromATA";
    const fromATA = getAssociatedTokenAddressSync(mint, payer, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    step = "toATA";
    const toATA = getAssociatedTokenAddressSync(mint, TREASURY, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    step = "tx-create";
    const tx = new Transaction();

    step = "tx-addATA";
    tx.add(createAssociatedTokenAccountIdempotentInstruction(
      payer, toATA, TREASURY, mint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    ));

    step = "tx-addTransfer";
    tx.add(createTransferCheckedInstruction(
      fromATA, mint, toATA, payer, rawAmt, RUNEX_DECIMALS, [], TOKEN_2022_PROGRAM_ID,
    ));

    step = "blockhash";
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    step = "tx-set";
    tx.recentBlockhash = blockhash;
    tx.feePayer        = payer;

    step = "sign";
    const signed = await provider.signTransaction(tx);

    step = "send";
    const signature = await connection.sendRawTransaction(signed.serialize());

    step = "confirm";
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

    return signature;
  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? String(e);
    throw new Error(`[${step}] ${msg}`);
  }
}
