/**
 * Creates symlinks for vendor directories, pointing to spike-a-ruleset's vendor.
 * Run once before using: node scripts/setup-vendor.js
 */
import { symlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const vendorDir = resolve(__dir, '../vendor');
const spikeAVendor = resolve(__dir, '../../spike-a-ruleset/vendor');

for (const name of ['cdb', 'scripts']) {
  const link = resolve(vendorDir, name);
  const target = resolve(spikeAVendor, name);
  if (!existsSync(link)) {
    symlinkSync(target, link, 'dir');
    console.log(`Created symlink: vendor/${name} → ${target}`);
  } else {
    console.log(`Already exists: vendor/${name}`);
  }
}
console.log('Vendor setup complete.');
