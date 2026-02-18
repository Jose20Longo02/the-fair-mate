/** PM2: mantiene los servidores corriendo en segundo plano aunque cierres la terminal. */
module.exports = {
  apps: [
    {
      name: "nextjs",
      script: "node_modules/next/dist/bin/next",
      args: "dev -p 3001 -H 0.0.0.0",
      cwd: __dirname,
      watch: false,
      env: { NODE_ENV: "development" },
    },
    {
      name: "ws-server",
      script: "ws-server/server.cjs",
      cwd: __dirname,
      watch: false,
    },
  ],
};
