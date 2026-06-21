/**
 * WebSocket Message Protocol Definitions
 */

export type WsEventType = 
  | 'connected'
  | 'history_load'
  | 'threshold_breach' 
  | 'rebalance_start' 
  | 'rebalance_complete'
  | 'error'
  | 'ping'
  | 'pong';

export interface WsMessage<T = any> {
  type: WsEventType;
  timestamp: string;
  data: T;
}

export interface WsClientInfo {
  id: string;
  walletAddress?: string; // Optional for MVP
  connectedAt: string;
  lastPingAt: string;
}

// Payload Types
export interface BreachPayload {
  walletAddress: string;
  asset: string;
  dropPct: number;
  text: string;
}

export interface RebalanceStartPayload {
  walletAddress: string;
  text: string;
}

export interface RebalanceCompletePayload {
  walletAddress: string;
  txDigest: string;
  explorerUrl: string;
  moneySaved: number;
  text: string;
}

export interface HistoryPayload {
  walletAddress: string;
  events: any[]; // Supabase history logs
}
