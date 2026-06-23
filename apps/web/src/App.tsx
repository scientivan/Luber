import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing.js";
import { Docs } from "./pages/Docs.js";
import { History } from "./pages/History.js";
import { StatusHub } from "./pages/StatusHub.js";
import {
  GuardSetup,
  PoolDiagnosis,
  PortfolioDiagnosis,
  RebalanceTerminal,
} from "./pages/ProductFlows.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/history/:walletAddress" element={<History />} />
      <Route path="/history" element={<History />} />
      <Route path="/status" element={<StatusHub />} />
      <Route path="/d/:walletAddress" element={<PortfolioDiagnosis />} />
      <Route path="/d/:walletAddress/pool/:poolId" element={<PoolDiagnosis />} />
      <Route path="/diagnose" element={<PortfolioDiagnosis />} />
      <Route path="/rebalance/:walletAddress" element={<RebalanceTerminal />} />
      <Route path="/rebalance" element={<RebalanceTerminal />} />
      <Route path="/guard/:walletAddress" element={<GuardSetup />} />
    </Routes>
  );
}
