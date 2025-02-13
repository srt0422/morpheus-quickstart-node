/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    OPENAI_API_URL: process.env.OPENAI_API_URL,
    CHAT_COMPLETIONS_PATH: process.env.CHAT_COMPLETIONS_PATH || '/v1/chat/completions',
    NEXT_PUBLIC_CHAT_COMPLETIONS_PATH: process.env.NEXT_PUBLIC_CHAT_COMPLETIONS_PATH || '/api/v1/chat/completions',
    MODEL_NAME: process.env.MODEL_NAME || 'nfa-llama2',
  },
  async rewrites() {
    return [
      {
        source: '/v1/chat/completions',
        destination: '/api/v1/chat/completions',
      },
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
