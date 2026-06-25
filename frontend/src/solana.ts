import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const RUNEX_MINT     = new PublicKey("6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump");
export const TREASURY       = new PublicKey("2yeGpBaCFF8Q4jNFEmncL677wxjKaDHFnr7v5YGVX2T6");
export const SOLANA_RPC     = "https://api.mainnet-beta.solana.com";
export const RUNEX_DECIMALS = 6;

export const connection = new Connection(SOLANA_RPC, "confirmed");

/**
 * Transfer `uiAmount` RuneX tokens from the connected Phantom wallet to the treasury.
 * Returns the confirmed transaction signature.
 */
export async function payRunex(uiAmount: number): Promise<string> {
  const provider = (window as Window & { solana?: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> } }).solana;
  if (!provider?.publicKey) throw new Error("Wallet not connected");

  const payer    = provider.publicKey;
  const rawAmt   = BigInt(Math.round(uiAmount * 10 ** RUNEX_DECIMALS));

  const fromATA  = await getAssociatedTokenAddress(RUNEX_MINT, payer);
  const toATA    = await getAssociatedTokenAddress(RUNEX_MINT, TREASURY);

  const tx = new Transaction();

  // Create treasury ATA if it doesn't exist yet
  const toAcct = await connection.getAccountInfo(toATA);
  if (!toAcct) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer, toATA, TREASURY, RUNEX_MINT,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      )
    );
  }

  tx.add(createTransferInstruction(fromATA, toATA, payer, rawAmt));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer        = payer;

  const signed    = await provider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  return signature;
}
