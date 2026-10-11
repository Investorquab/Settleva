import type { Metadata } from "next";
import LiveSettlementConsole from "./live-settlement-console";

export const metadata: Metadata = {
  title: "Live Settlement | Settleva",
  description: "Create a real Arc USDC escrow, verify payment-bound GitHub deployment evidence with Reclaim, and release funds to the payee."
};

export default function LiveSettlementPage() {
  return <LiveSettlementConsole />;
}
