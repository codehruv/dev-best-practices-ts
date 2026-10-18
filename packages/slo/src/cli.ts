import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform } from 'node:os';
import { dirname } from 'node:path';

import { type CommandIo, runSloCommand } from './command.js';

/** The process boundary: real file system, stdout, and machine details. */
const io: CommandIo = {
  readFile: async (path) => {
    try {
      return await readFile(path, 'utf8');
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  },
  writeFile: async (path, text) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, text);
  },
  appendFile: async (path, text) => {
    await appendFile(path, text);
  },
  listDir: async (path) => readdir(path),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  environment: {
    platform: platform(),
    arch: arch(),
    cpuModel: cpus()[0]?.model.trim() ?? 'unknown',
    nodeMajor: Number(process.versions.node.split('.')[0]),
  },
  stepSummaryPath: process.env['GITHUB_STEP_SUMMARY'],
  now: () => new Date(),
};

process.exitCode = await runSloCommand(process.argv.slice(2), io);
