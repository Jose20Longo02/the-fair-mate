/** PM2 production: next start + ws-server. NODE_ENV=production, max_memory_restart 500M. Para varias instancias de Next, usar un reverse proxy (nginx) que balancee a varios puertos. */
module.exports = {
  apps: [
    {
      name: "nextjs",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001 -H 0.0.0.0",
      cwd: __dirname,
      watch: false,
      instances: 1,
      max_memory_restart: "500M",
      env: { NODE_ENV: "production" },
    },
    {
      name: "ws-server",
      script: "ws-server/server.cjs",
      cwd: __dirname,
      watch: false,
      instances: 1,
      max_memory_restart: "500M",
      env: { NODE_ENV: "production" },
    },
  ],
};
