import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPositions } from '../lib/api.js';
import { classifyHealth } from '../lib/health.js';
import '../styles/atlas.css';

export function Atlas() {
  const currentAccount = useCurrentAccount();
  const [address, setAddress] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'pool'>('portfolio');

  useEffect(() => {
    if (currentAccount?.address) {
      setAddress(currentAccount.address);
      setSubmitted(currentAccount.address);
    }
  }, [currentAccount]);

  const { data, isLoading } = useQuery({
    queryKey: ['positions', submitted],
    queryFn: () => fetchPositions(submitted!),
    enabled: !!submitted,
  });

  const positions = data?.positions ?? [];

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (address) setSubmitted(address);
  };

  if (!submitted) {
    return (
      <main className="atlas-theme atlas-logged-out">
        <div className="atlas-connect-panel">
          <img src="/lp-guardian-logo.webp" alt="LPGuardian" />
          <h2>Diagnostic History</h2>
          <p>Connect your wallet or enter an address to view diagnostic history and pool risk analysis.</p>
          
          <form onSubmit={handleConnect} style={{ width: '100%', display: 'flex', gap: '8px' }}>
            <input 
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Sui Address..."
              style={{ flex: 1, padding: '12px', border: 'var(--of-line)', background: 'var(--of-paper)', fontFamily: 'monospace' }}
            />
            <button 
              type="submit"
              style={{ padding: '12px 24px', background: 'var(--of-blue)', color: 'var(--of-ink)', border: 'var(--of-line)', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Connect
            </button>
          </form>

          <div className="atlas-safety-note">
            &gt; Signing in verifies wallet ownership. It does not move funds.
          </div>
        </div>
      </main>
    );
  }

  // Aggregate metrics
  let totalDeposited = 0;
  let bleeding = 0;
  let drift = 0;
  let healthy = 0;

  for (const p of positions) {
    totalDeposited += parseFloat(p.depositedToken0) + parseFloat(p.depositedToken1);
    const h = classifyHealth(p);
    if (h === 'red') bleeding++;
    else if (h === 'amber') drift++;
    else healthy++;
  }

  return (
    <main className="atlas-theme atlas-dashboard">
      <header className="atlas-header">
        <div className="atlas-header-cell">
          <span className="atlas-header-label">Wallet</span>
          <span className="atlas-header-value">{submitted.slice(0, 6)}...{submitted.slice(-4)}</span>
        </div>
        <div className="atlas-header-cell">
          <span className="atlas-header-label">Network</span>
          <span className="atlas-header-value">Sui Mainnet</span>
        </div>
        <div className="atlas-header-cell">
          <span className="atlas-header-label">Session</span>
          <span className="atlas-header-value">Connected</span>
        </div>
        <div className="atlas-header-cell">
          <span className="atlas-header-label">Last Diagnosis</span>
          <span className="atlas-header-value">Just now</span>
        </div>
      </header>

      <div className="atlas-tabs">
        <button 
          className={`atlas-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => setActiveTab('portfolio')}
        >
          Portfolio Level
        </button>
        <button 
          className={`atlas-tab ${activeTab === 'pool' ? 'active' : ''}`}
          onClick={() => setActiveTab('pool')}
        >
          Pool Level
        </button>
      </div>

      <div className="atlas-content">
        {isLoading ? (
          <div>Loading diagnostic data...</div>
        ) : activeTab === 'portfolio' ? (
          <div>
            <div className="atlas-metrics">
              <div className="atlas-metric-card healthy">
                <span className="atlas-metric-label">Healthy Pools</span>
                <span className="atlas-metric-value">{healthy}</span>
              </div>
              <div className="atlas-metric-card drift">
                <span className="atlas-metric-label">Drifting Pools</span>
                <span className="atlas-metric-value">{drift}</span>
              </div>
              <div className="atlas-metric-card bleeding">
                <span className="atlas-metric-label">At Risk / Out of Range</span>
                <span className="atlas-metric-value">{bleeding}</span>
              </div>
            </div>

            <div className="of-section-top" style={{ marginBottom: '16px' }}>
              <span style={{ color: 'var(--of-ink)' }}>Recent AI Diagnostics</span>
              <span>&lt;logs&gt;</span>
            </div>

            <div className="atlas-logs">
              <div className="atlas-log-card">
                <span className="timestamp">2026-06-21 14:02:11</span>
                <span className="agent">agent: diagnose_portfolio</span>
                <span className="summary">Identified {bleeding} positions requiring attention.</span>
                <span className="atlas-status-pill">Completed</span>
              </div>
              <div className="atlas-log-card">
                <span className="timestamp">2026-06-21 13:45:00</span>
                <span className="agent">agent: run_rebalance</span>
                <span className="summary">User rejected rebalance PTB.</span>
                <span className="atlas-status-pill warning">Cancelled</span>
              </div>
              <div className="atlas-log-card">
                <span className="timestamp">2026-06-20 09:12:33</span>
                <span className="agent">agent: diagnose_portfolio</span>
                <span className="summary">All positions healthy and in range.</span>
                <span className="atlas-status-pill healthy">Healthy</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="of-section-top" style={{ marginBottom: '16px', background: 'var(--of-yellow)' }}>
              <span style={{ color: 'var(--of-ink)' }}>Pool Technical Ledger</span>
              <span>&lt;table&gt;</span>
            </div>
            
            <table className="atlas-table">
              <thead>
                <tr>
                  <th>Pool ID</th>
                  <th>Fee Tier</th>
                  <th>Health Status</th>
                  <th>Value</th>
                  <th>AI Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const health = classifyHealth(p);
                  const isWarning = health === 'red';
                  
                  return (
                    <tr key={p.id} className={isWarning ? 'warning' : ''}>
                      <td className="monospace">{p.pool.id.slice(0, 8)}...</td>
                      <td>{p.pool.feeTier}%</td>
                      <td>
                        <span className={`atlas-status-pill ${isWarning ? 'warning' : 'healthy'}`}>
                          {isWarning ? 'Out of Range' : 'In Range'}
                        </span>
                      </td>
                      <td className="monospace">${parseFloat(p.depositedToken0).toFixed(2)}</td>
                      <td>
                        <button className="atlas-table-action">
                          {isWarning ? 'Review in App' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
