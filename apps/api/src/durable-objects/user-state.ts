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

  async addHistoryEntry(
    entry: Omit<HistoryEntry, "id" | "createdAt">
  ): Promise<void> {
    const createdAt = Date.now();
    const id = crypto.randomUUID();
    // Zero-padded timestamp so lexicographic key order == chronological order.
    const key = `history:${String(createdAt).padStart(15, "0")}:${id}`;
    await this.ctx.storage.put(key, { ...entry, id, createdAt });
  }

  async listHistory(limit = 20): Promise<HistoryEntry[]> {
    const entries = await this.ctx.storage.list<HistoryEntry>({
      prefix: "history:",
      reverse: true,
      limit,
    });
    return Array.from(entries.values());
  }
}
