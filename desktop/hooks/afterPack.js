// electron-builder always injects a glob exclusion for node_modules into
// extraResources and extraFiles copies (see app-builder-lib fileMatcher.js),
// so the embedded Next.js server bundle shipped via extraResources loses its
// traced node_modules at pack time.
//
// This hook restores it immediately after packing (and before NSIS or
// portable compress win-unpacked), so the packaged app gets the full bundle:
//
//   desktop/resources/next-server/node_modules
//     -> copied to <appOutDir>/resources/next-server/node_modules
//
// Works identically for local Windows builds and cross-builds from Linux/macOS.

const fs = require('fs')
const path = require('path')

async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const src = path.join(projectDir, 'resources', 'next-server', 'node_modules')
  const dest = path.join(context.appOutDir, 'resources', 'next-server', 'node_modules')

  if (!fs.existsSync(src)) {
    console.warn('afterPack: nothing to restore — desktop/resources/next-server/node_modules missing (run prepare-server.js first)')
    return
  }
  if (fs.existsSync(dest)) {
    console.log('afterPack: embedded server node_modules already present')
    return
  }

  console.log('afterPack: restoring embedded server node_modules (this can take a moment) …')
  fs.cpSync(src, dest, { recursive: true })
  console.log('afterPack: embedded server node_modules restored')
}

module.exports = afterPack
module.exports.default = afterPack
