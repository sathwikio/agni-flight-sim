// Downloads the Earth textures used by the simulation into public/textures
// and creates reduced-resolution copies for the reduced-quality mode.
//
// Source: three.js example assets (NASA Blue Marble / Black Marble derived),
// https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets
import { mkdir, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/';
const FILES = ['earth_day_4096.jpg', 'earth_night_4096.jpg', 'earth_bump_roughness_clouds_4096.jpg'];
const OUT = path.resolve('public/textures');

await mkdir(OUT, { recursive: true });

for (const file of FILES) {
  const target = path.join(OUT, file);
  try {
    await access(target);
    console.log(`✓ ${file} (cached)`);
  } catch {
    process.stdout.write(`↓ ${file} … `);
    const res = await fetch(BASE + file);
    if (!res.ok) throw new Error(`Failed to download ${file}: ${res.status}`);
    await writeFile(target, Buffer.from(await res.arrayBuffer()));
    console.log('done');
  }
  // Reduced quality copy (2048 px wide). Uses `sips` on macOS when available.
  const small = path.join(OUT, file.replace('4096', '2048'));
  try {
    await access(small);
  } catch {
    try {
      execFileSync('sips', ['-Z', '2048', target, '--out', small], { stdio: 'ignore' });
      console.log(`  ↳ ${path.basename(small)}`);
    } catch {
      console.warn(`  ! could not create ${path.basename(small)} (reduced mode will use 4096 textures)`);
    }
  }
}
