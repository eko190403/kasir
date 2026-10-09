import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

function runNodeCli(script, ...args) {
  execFileSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  })
}

if (process.env.VERCEL_ENV === "production") {
  runNodeCli("node_modules/prisma/build/index.js", "migrate", "deploy")
}

runNodeCli("node_modules/prisma/build/index.js", "generate")
runNodeCli("node_modules/next/dist/bin/next", "build")
