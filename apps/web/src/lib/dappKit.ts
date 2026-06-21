import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const networks = ["testnet", "mainnet"] satisfies Array<
  "mainnet" | "testnet" | "devnet" | "localnet"
>;

export const dAppKit = createDAppKit({
  networks,
  defaultNetwork: "testnet",
  createClient: (network) =>
    new SuiJsonRpcClient({
      network,
      url: getJsonRpcFullnodeUrl(network),
    }),
});
