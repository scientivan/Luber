// Top-level router. /deck mirrors the submission PDF as a webpage.
import { Route, Routes, Navigate } from "react-router-dom";
import { Agent } from "./pages/Agent.js";
import { Atlas } from "./pages/Atlas.js";
import { Deck } from "./pages/Deck.js";
import { Developers } from "./pages/Developers.js";
import { Diagnose } from "./pages/Diagnose.js";
import { Landing } from "./pages/Landing.js";
import { Report } from "./pages/Report.js";
import { Roadmap } from "./pages/Roadmap.js";

// Docs
import { DocsLayout } from "./components/DocsLayout.js";
import { DocsIntro } from "./pages/docs/DocsIntro.js";
import { DocsInstall } from "./pages/docs/DocsInstall.js";
import { DocsConfig } from "./pages/docs/DocsConfig.js";
import { DocsTools } from "./pages/docs/DocsTools.js";
import { DocsSecurity } from "./pages/docs/DocsSecurity.js";
import { DocsTroubleshoot } from "./pages/docs/DocsTroubleshoot.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/atlas" element={<Atlas />} />
      <Route path="/agent" element={<Agent />} />
      <Route path="/developers" element={<Developers />} />
      <Route path="/deck" element={<Deck />} />
      <Route path="/diagnose/:tokenId" element={<Diagnose />} />
      <Route path="/report/:rootHash" element={<Report />} />
      <Route path="/roadmap" element={<Roadmap />} />
      
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<DocsIntro />} />
        <Route path="install" element={<DocsInstall />} />
        <Route path="config" element={<DocsConfig />} />
        <Route path="tools" element={<DocsTools />} />
        <Route path="security" element={<DocsSecurity />} />
        <Route path="zod" element={<Navigate to="/docs/security" replace />} />
        <Route path="troubleshoot" element={<DocsTroubleshoot />} />
      </Route>
    </Routes>
  );
}
