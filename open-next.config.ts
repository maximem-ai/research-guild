import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache binding: learn pages are fully static and served from assets.
export default defineCloudflareConfig({});
