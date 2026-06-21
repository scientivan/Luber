import { Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing.js";
import { Docs } from "./pages/Docs.js";
import { History } from "./pages/History.js";
import { StatusHub } from "./pages/StatusHub.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/docs/*" element={<Docs />} />
      <Route path="/atlas" element={<History />} />
      <Route path="/history/:walletAddress" element={<History />} />
      <Route path="/history" element={<History />} />
      <Route path="/status" element={<StatusHub />} />
    </Routes>
  );
}