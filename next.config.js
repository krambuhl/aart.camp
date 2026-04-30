/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Allow dev server access from non-localhost hostnames so SSH/remote
  // dev workflows (tailnet, OrbStack containers, etc.) can use HMR.
  // Without this, Next dev rejects WebSocket connections from any
  // origin other than localhost, breaking client-side hydration.
  allowedDevOrigins: [
    '*.tailb642ca.ts.net',
    '*.orb.local',
    'localhost',
    '127.0.0.1',
  ],
};
