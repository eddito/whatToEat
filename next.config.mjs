/** @type {import('next').NextConfig} */
const supabaseImageHost =
  process.env.NEXT_PUBLIC_SUPABASE_URL && URL.canParse(process.env.NEXT_PUBLIC_SUPABASE_URL)
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : "lickxydbtkyijgjmpnqo.supabase.co";

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
