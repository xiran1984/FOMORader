module.exports = {
  apps: [
    {
      name: "fomorader",
      script: "node_modules/tsx/dist/cli.cjs",
      args: "watch server/index.ts"
    }
  ]
};
