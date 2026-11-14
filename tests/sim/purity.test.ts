import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SIM = join(__dirname, '../../src/sim');
const FORBIDDEN = [/from ['"]three/, /from ['"]vue/, /Math\.random/, /Date\.now/, /performance\.now/, /\bwindow\./, /\bdocument\./];

describe('sim purity', () => {
  for (const file of readdirSync(SIM).filter((f) => f.endsWith('.ts'))) {
    it(`${file} uses no rendering, DOM or non-deterministic APIs`, () => {
      const src = readFileSync(join(SIM, file), 'utf8');
      for (const re of FORBIDDEN) expect(src, `${file} matches ${re}`).not.toMatch(re);
    });
  }
});
