/** @type {import('next').NextConfig} */
const isMobile = process.env.MOBILE_BUILD === "1";

const nextConfig = {
  ...(isMobile ? { output: "export", trailingSlash: true } : { output: "standalone" }),
  images: { unoptimized: isMobile },
};

export default nextConfig;
