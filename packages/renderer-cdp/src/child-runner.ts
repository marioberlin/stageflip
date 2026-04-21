// packages/renderer-cdp/src/child-runner.ts
// Seam for spawning external processes. The renderer's only child process
// today is `ffmpeg`; more will follow (`ffprobe`, possibly `ffmpeg-doctor`
// one-shots). The seam exists so tests can inject a fake runner and assert
// against the exact `argv` without a real system binary, and so alternative
// runners (container-sandboxed, remote-exec) can slot in without touching
// the encoder.
//
// The shape is deliberately narrow: spawn returns a handle with a stdin
// sink, a stderr capture tap, and a `wait()` that resolves with the exit
// code + accumulated stderr text. No streaming stdout — ffmpeg writes video
// to a file path, not to stdout, so stdout is ignored.

import { spawn as nodeSpawn } from 'node:child_process';

export interface ChildStdin {
  /** Write one chunk of bytes. Resolves when the chunk is flushed. */
  write(chunk: Uint8Array): Promise<void>;
  /** Close the pipe. Resolves when the writer confirms EOF. */
  end(): Promise<void>;
}

export interface SpawnedProcess {
  readonly stdin: ChildStdin;
  /**
   * Resolve when the process exits, with the exit code (null on signal)
   * and any accumulated stderr text. Reject if spawn itself errored — a
   * non-zero exit code is NOT a rejection, so callers can inspect it.
   */
  wait(): Promise<{ code: number | null; stderr: string }>;
  /** Force-terminate the process. No-op if already exited. */
  kill(): void;
}

export interface ChildRunner {
  spawn(command: string, args: readonly string[]): SpawnedProcess;
}

/**
 * The production runner: uses Node's `child_process.spawn`. Not called in
 * tests; the Puppeteer-backed session path (T-085+/T-090) will be the first
 * caller in practice.
 */
export function createNodeChildRunner(): ChildRunner {
  return {
    spawn(command: string, args: readonly string[]): SpawnedProcess {
      const child = nodeSpawn(command, [...args], {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let stderrBuf = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString('utf8');
      });

      const stdin: ChildStdin = {
        async write(chunk: Uint8Array): Promise<void> {
          return new Promise<void>((resolve, reject) => {
            const stream = child.stdin;
            if (stream === null) {
              reject(new Error('child-runner: stdin stream is null'));
              return;
            }
            const ok = stream.write(chunk, (err) => {
              if (err) reject(err);
              else resolve();
            });
            if (!ok) stream.once('drain', resolve);
          });
        },
        async end(): Promise<void> {
          return new Promise<void>((resolve) => {
            const stream = child.stdin;
            if (stream === null) {
              resolve();
              return;
            }
            stream.end(() => resolve());
          });
        },
      };

      return {
        stdin,
        wait(): Promise<{ code: number | null; stderr: string }> {
          return new Promise((resolve, reject) => {
            child.once('error', reject);
            child.once('close', (code) => {
              resolve({ code, stderr: stderrBuf });
            });
          });
        },
        kill(): void {
          if (child.exitCode === null && child.signalCode === null) child.kill();
        },
      };
    },
  };
}
