/** @type {import('next').NextConfig} */
const isMobile = process.env.MOBILE_BUILD === "1";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const connectSrc = ["'self'", apiOrigin, "http://localhost:8010", "http://127.0.0.1:8010"]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
      "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "connect-src " + connectSrc + ";",
  },
];

const nextConfig = {
  ...(isMobile ? { output: "export", trailingSlash: true } : { output: "standalone" }),
  images: { unoptimized: isMobile },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
