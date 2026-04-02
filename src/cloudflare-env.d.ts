/// <reference types="@cloudflare/workers-types" />

interface ImportMetaEnv {
  readonly VITE_BUILD_TIMESTAMP?: string;
  readonly VITE_SYNC_HOST?: string;
  readonly VITE_SYNC_PARTY?: string;
  readonly VITE_PARTYKIT_HOST?: string;
  readonly VITE_PARTYKIT_PARTY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface AssetFetcher {
  fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
}

interface Env {
  ASSETS?: AssetFetcher;
  KniffelSync: DurableObjectNamespace;
}
