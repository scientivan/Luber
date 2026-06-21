import { WSContext } from "hono/ws";
import { WsMessage, WsClientInfo, WsEventType } from "./wsTypes.js";
import * as supabaseService from "../services/supabaseService.js";

class WebSocketHandler {
  // Map standard WebSocket objects to client metadata
  private clients = new Map<WSContext, WsClientInfo>();
  private pingInterval?: NodeJS.Timeout;

  /**
   * Register a new client connection
   */
  register(ws: WSContext, walletAddress?: string) {
    const clientInfo: WsClientInfo = {
      id: Math.random().toString(36).substring(2, 9),
      walletAddress,
      connectedAt: new Date().toISOString(),
      lastPingAt: new Date().toISOString(),
    };
    
    this.clients.set(ws, clientInfo);
    console.log(`[wsHandler] Client connected: ${clientInfo.id} (Wallet: ${walletAddress || "Anonymous"})`);

    // Send connection success acknowledgement
    this.send(ws, "connected", { id: clientInfo.id });

    // Load and send event history if wallet is registered
    if (walletAddress) {
      this.loadHistory(ws, walletAddress).catch(console.error);
    }
  }

  /**
   * Unregister client connection
   */
  unregister(ws: WSContext) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      console.log(`[wsHandler] Client disconnected: ${client.id}`);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast<T>(type: WsEventType, data: T) {
    const msg = this.createMessage(type, data);
    const payload = JSON.stringify(msg);
    
    for (const [ws, info] of this.clients.entries()) {
      try {
        ws.send(payload);
      } catch (err) {
        console.error(`[wsHandler] Failed to broadcast to ${info.id}:`, err);
        this.unregister(ws);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  send<T>(ws: WSContext, type: WsEventType, data: T) {
    const msg = this.createMessage(type, data);
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`[wsHandler] Failed to send to client:`, err);
      this.unregister(ws);
    }
  }

  /**
   * Update client's last active ping timestamp
   */
  handlePong(ws: WSContext) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastPingAt = new Date().toISOString();
    }
  }

  /**
   * Start Ping-Pong heartbeat interval
   */
  startHeartbeat() {
    if (this.pingInterval) return;

    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = 30000; // 30 seconds

      for (const [ws, info] of this.clients.entries()) {
        const lastPing = new Date(info.lastPingAt).getTime();
        
        if (now - lastPing > timeoutThreshold) {
          console.warn(`[wsHandler] Connection timed out: ${info.id}`);
          ws.close();
          this.unregister(ws);
          continue;
        }

        try {
          this.send(ws, "ping", {});
        } catch {
          this.unregister(ws);
        }
      }
    }, 10000); // Check every 10s
  }

  /**
   * Stop Ping-Pong heartbeat interval
   */
  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private createMessage<T>(type: WsEventType, data: T): WsMessage<T> {
    return {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  private async loadHistory(ws: WSContext, walletAddress: string) {
    try {
      const history = await supabaseService.getHistory(walletAddress, 10);
      this.send(ws, "history_load", { walletAddress, events: history });
    } catch (err) {
      console.error(`[wsHandler] Error loading history for ${walletAddress}:`, err);
    }
  }
}

export const wsHandler = new WebSocketHandler();
