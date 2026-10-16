#!/usr/bin/env node
/**
 * Nyaksai — assemble the self-contained server bundle for packaging into a .exe.
 *
 * Run on the BUILD machine (your laptop):  node prepare-server.js   (or via `npm run dist`)
 *
 * What it does:
 *   1. npx prisma generate        → fresh Prisma client (native engine + Windows engine via binaryTargets)
 *   2. npx prisma db push         → creates db/custom.db (the empty template database)
 *   3. npx next build             → Next.js standalone output ($NEXT_DIST_DIR/standalone, default .next)
 *   4. Assembles desktop/resources/next-server:
 *        <dist>/standalone/*  → resources/next-server/          (server.js + traced node_modules)
 *        <dist>/static/*      → resources/next-server/.next/static
 *        public/*            → resources/next-server/public     (hosted *.exe downloads excluded)
 *      + copies the Windows Prisma query engine into the bundle's .prisma/client
 *   5. Copies db/custom.db → resources/nyaksai-template.db       (first-run database template)
 *
 * The result is everything main.js needs to run the whole app embedded in the packaged
 * executable — no Node.js, no dev server and no project folder on the target machine.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const desktop = __dirname
const resources = path.join(desktop, 'resources')
const serverDir = path.join(resources, 'next-server')
// NEXT_DIST_DIR: build into a separate folder (e.g. when a dev server owns .next).
// Unset on your laptop → default '.next', exactly as before.
const distDir = process.env.NEXT_DIST_DIR || '.next'

const run = (cmd) => {
  console.log(`\n> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: root })
}

const copy = (from, to, filter) => {
  fs.cpSync(from, to, { recursive: true, ...(filter ? { filter } : {}) })
}

const dirSizeMB = (dir) => {
  let total = 0
  const walk = (p) => {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name)
      if (entry.isDirectory()) walk(full)
      else total += fs.statSync(full).size
    }
  }
  walk(dir)
  return (total / 1024 / 1024).toFixed(1)
}

console.log('Nyaksai — preparing the embedded Next.js server bundle…')

// 1-3. generate client, create database, build standalone
run('npx prisma generate')
run('npx prisma db push')
run('npx next build')

// 4. assemble resources/next-server
console.log(`\n> assembling desktop/resources/next-server (from ${distDir}/standalone)`)
fs.rmSync(serverDir, { recursive: true, force: true })
fs.mkdirSync(serverDir, { recursive: true })

copy(path.join(root, distDir, 'standalone'), serverDir)
// static assets live inside the distDir-named folder the standalone server serves from
copy(path.join(root, distDir, 'static'), path.join(serverDir, distDir, 'static'))
// hosted .exe downloads (public/Nyaksai-*.exe) must not be embedded into the app itself
copy(path.join(root, 'public'), path.join(serverDir, 'public'), (src) => !/\.exe$/i.test(src))

if (!fs.existsSync(path.join(serverDir, 'server.js'))) {
  console.error(`✗ ${distDir}/standalone/server.js not found — did \`next build\` succeed?`)
  process.exit(1)
}

// 4b. cross-platform Prisma: make sure the Windows query engine ships in the bundle.
// (binaryTargets = ["native", "windows"] in prisma/schema.prisma fetches it during generate.)
const prismaClientSrc = path.join(root, 'node_modules', '.prisma', 'client')
const prismaClientDst = path.join(serverDir, 'node_modules', '.prisma', 'client')
if (fs.existsSync(prismaClientSrc) && fs.existsSync(prismaClientDst)) {
  const engines = fs.readdirSync(prismaClientSrc).filter((f) => /windows/i.test(f) && f.endsWith('.node'))
  for (const engine of engines) {
    fs.copyFileSync(path.join(prismaClientSrc, engine), path.join(prismaClientDst, engine))
    console.log(`✔ copied Windows Prisma engine into bundle: ${engine}`)
  }
  if (engines.length === 0) {
    console.warn('⚠ no Windows Prisma engine found in node_modules/.prisma/client — add binaryTargets = ["native", "windows"] to prisma/schema.prisma and re-run.')
  }
}

// 5. first-run database template
const dbSrc = path.join(root, 'db', 'custom.db')
if (!fs.existsSync(dbSrc)) {
  console.error('✗ db/custom.db missing — `npx prisma db push` should have created it.')
  process.exit(1)
}
fs.copyFileSync(dbSrc, path.join(resources, 'nyaksai-template.db'))

console.log(`\n✔ Server bundle ready: desktop/resources/next-server (${dirSizeMB(serverDir)} MB)`)
console.log('✔ Database template ready: desktop/resources/nyaksai-template.db')
console.log('\nNext: npm run dist  (packages the Windows .exe via electron-builder)')
