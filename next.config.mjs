/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/wedding-video",
        destination: "/services/wedding-videography",
        permanent: true,
      },
      {
        source: "/web-development",
        destination: "/services/web-development",
        permanent: true,
      },
      {
        source: "/product-photography",
        destination: "/services/design/product-photography",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
