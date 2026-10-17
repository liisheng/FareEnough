import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const promptRoot = resolve(moduleDir, '../../prompts');

export type PromptName = 'rider-advocate' | 'driver-advocate' | 'judge';

export async function loadAgentPrompt(name: PromptName): Promise<string> {
  return readFile(resolve(promptRoot, `${name}.md`), 'utf8');
}
