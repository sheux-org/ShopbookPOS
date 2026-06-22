const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../'),
  webpack: (config, { webpack }) => {
    // react-thermal-printer imports iconv-lite, which needs a Buffer polyfill
    // at import time (via safer-buffer). We pass a UTF-8 encoder so iconv is
    // never actually invoked, but the module must still load in the browser.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
      stream: false,
    };
    config.plugins.push(new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }));
    return config;
  },
};

module.exports = nextConfig;
