/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure external packages for server-side rendering
  serverExternalPackages: ['canvas', 'tesseract.js', 'pdf-parse', 'pdf-parse-debugging-disabled'],
}

module.exports = nextConfig