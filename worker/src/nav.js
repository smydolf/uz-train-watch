// Shared top menu for /trip and /guide. Self-contained styles, so it looks the same on both pages.
export function nav(active) {
  const link = (href, id, label) => `<a href="${href}" class="tn-link${active === id ? " on" : ""}">${label}</a>`;
  return `
<style>
.tn-bar{position:relative;z-index:10;background:#ffffffcc;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #e4e4ea;font:600 14px/1 Inter,-apple-system,system-ui,sans-serif}
.tn-in{max-width:1040px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:6px}
.tn-brand{margin-right:auto;color:#15151a;text-decoration:none;font-weight:800;letter-spacing:-.01em}
.tn-link{color:#6e6e7a;text-decoration:none;padding:8px 14px;border-radius:999px}
.tn-link.on{background:#15151a;color:#fff}
@media (prefers-color-scheme:dark){.tn-bar{background:#0d0d11cc;border-color:#2a2a33}.tn-brand{color:#f1f1f4}.tn-link{color:#8d8d99}.tn-link.on{background:#f1f1f4;color:#0d0d11}}
</style>
<nav class="tn-bar" aria-label="Main"><div class="tn-in">
  <a class="tn-brand" href="/trip">🇺🇿 Uzbekistan</a>
  ${link("/trip", "trip", "🚆 Trip")}${link("/guide", "guide", "📖 Guide")}
</div></nav>
<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});</script>`;
}
