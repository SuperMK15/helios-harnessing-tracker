declare namespace Cloudflare {
  interface Env {
    WARG_EDITOR_PASSWORD?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
