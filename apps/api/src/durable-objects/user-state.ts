import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { refreshSpotifyAccessToken } from "../lib/spotify";
import type { SpotifyPlaylistResult } from "../lib/spotify";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

export interface UserProfile {
  spotifyUserId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  moodText: string;
  vibeSummary: string;
  searchQueries: string[];
  playlists: SpotifyPlaylistResult[];
  createdAt: number;
}

export class UserState extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.ctx.storage.put("profile", profile);
  }

  async getProfile(): Promise<UserProfile | undefined> {
    return this.ctx.storage.get<UserProfile>("profile");
  }

  async saveTokens(tokens: StoredTokens): Promise<void> {
    await this.ctx.storage.put("tokens", tokens);
  }

  async getValidAccessToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    const tokens = await this.ctx.storage.get<StoredTokens>("tokens");
    if (!tokens) throw new Error("Not authenticated");

    // Refresh a little before actual expiry to avoid races.
    if (tokens.expiresAt > Date.now() + 30_000) {
      return tokens.accessToken;
    }

    const refreshed = await refreshSpotifyAccessToken(
      tokens.refreshToken,
      clientId,
      clientSecret
    );

    const updated: StoredTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      scope: refreshed.scope,
    };
    await this.ctx.storage.put("tokens", updated);
    return updated.accessToken;
  }

  // Guards against persisting a duplicate history row for a mood search
  // that was just recorded — e.g. a double-click, two tabs racing on the
  // same request, or a result served from the shared mood-results cache
  // (which means this exact search was already fresh/persisted recently,
  // by this user or someone else, within `ttlMs`). The marker shares the
  // mood-results cache's TTL so both go stale together: after that window,
  // Claude/Spotify are re-queried for genuinely fresh data and a new
  // history entry is fair game again.
  async hasRecentHistoryForMood(moodHash: string): Promise<boolean> {
    const expiresAt = await this.ctx.storage.get<number>(
      `history-seen:${moodHash}`
    );
    return expiresAt !== undefined && expiresAt > Date.now();
  }

  async addHistoryEntry(
    entry: Omit<HistoryEntry, "id" | "createdAt">,
    moodHash: string,
    ttlMs: number
  ): Promise<void> {
    const createdAt = Date.now();
    const id = crypto.randomUUID();
    // Zero-padded timestamp so lexicographic key order == chronological order.
    const key = `history:${String(createdAt).padStart(15, "0")}:${id}`;
    await this.ctx.storage.put(key, { ...entry, id, createdAt });
    await this.ctx.storage.put(`history-seen:${moodHash}`, createdAt + ttlMs);
  }

  async listHistory(limit = 20): Promise<HistoryEntry[]> {
    const entries = await this.ctx.storage.list<HistoryEntry>({
      prefix: "history:",
      reverse: true,
      limit,
    });
    return Array.from(entries.values());
  }

  // --- Weekly quota on the shared Anthropic key ---
  // Only calls that actually hit Claude using the app's own shared key
  // count against this — cache hits cost nothing, and a user's own key
  // (see below) is exempt entirely. Checking and recording happen in one
  // DO method so it's atomic: a Durable Object processes one request to
  // completion before starting the next, so two concurrent searches can't
  // both slip through past the limit.
  async tryConsumeSharedKeyQuota(
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; count: number }> {
    const cutoff = Date.now() - windowMs;
    const all = await this.ctx.storage.list<number>({ prefix: "quota:shared:" });

    let count = 0;
    const stale: string[] = [];
    for (const [key, ts] of all) {
      if (ts >= cutoff) count++;
      else stale.push(key);
    }
    if (stale.length > 0) {
      await this.ctx.storage.delete(stale);
    }

    if (count >= limit) {
      return { allowed: false, count };
    }

    const now = Date.now();
    await this.ctx.storage.put(`quota:shared:${String(now).padStart(15, "0")}`, now);
    return { allowed: true, count: count + 1 };
  }

  // --- Bring-your-own Anthropic key (bypasses the shared-key quota) ---
  async saveOwnAnthropicKey(apiKey: string): Promise<void> {
    await this.ctx.storage.put("own-anthropic-key", apiKey);
  }

  async getOwnAnthropicKey(): Promise<string | undefined> {
    return this.ctx.storage.get<string>("own-anthropic-key");
  }

  async clearOwnAnthropicKey(): Promise<void> {
    await this.ctx.storage.delete("own-anthropic-key");
  }
}
