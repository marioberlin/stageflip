// packages/renderer-cdp/src/artifact-store.ts
// The home for completed exports: an opaque key → bytes store with two
// reference implementations in this PR:
//
//   - InMemoryArtifactStore  — tests + harnesses, zero IO.
//   - LocalFsArtifactStore    — a directory on disk, one file per key.
//
// The Firebase Storage adapter is deferred (same pattern as the Phase 1
// Firebase storage tasks T-035..T-039 — see docs/implementation-plan.md
// Phase 4's T-088 row marker).
//
// Keys are path-safe strings: `[A-Za-z0-9._-]` and single-level `/`. Keys
// are NOT user-supplied paths on disk; the local FS store maps a key to a
// file inside its rootDir with explicit sanitation to block traversal.
// Absolute paths, `..`, and leading/trailing slashes are rejected.

import { access, copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

export interface StoredArtifact {
  readonly key: string;
  /**
   * Best-effort local file path. Local-FS stores return the path inside
   * their rootDir; in-memory stores return a synthetic `memory:<key>`
   * URL that is not readable via `fs`.
   */
  readonly localPath: string;
  readonly sizeBytes: number;
}

export interface ArtifactStore {
  /**
   * Store the file at `sourcePath` under `key`. If an artifact already
   * exists at `key` the implementation is free to overwrite — callers
   * that need guarantees should `has` first and decide.
   */
  put(key: string, sourcePath: string): Promise<StoredArtifact>;

  has(key: string): Promise<boolean>;

  /** Returns the artifact record, or null if not present. */
  get(key: string): Promise<StoredArtifact | null>;

  /** Keys currently stored, in implementation-defined order. */
  list(): Promise<readonly string[]>;

  /** No-op when the key is absent. */
  delete(key: string): Promise<void>;
}

/**
 * Validate an artifact key. Thrown errors identify the offending input so
 * callers can surface a useful message; returning a normalised key keeps
 * implementations pinned to the same rules.
 */
export function sanitizeArtifactKey(key: string): string {
  if (typeof key !== 'string') {
    throw new TypeError('artifact-store: key must be a string');
  }
  if (key.length === 0) {
    throw new Error('artifact-store: key must be non-empty');
  }
  if (key.startsWith('/') || key.endsWith('/')) {
    throw new Error(`artifact-store: key must not start or end with '/' (got '${key}')`);
  }
  if (key.includes('//')) {
    throw new Error(`artifact-store: key must not contain '//' (got '${key}')`);
  }
  for (const part of key.split('/')) {
    if (part === '.' || part === '..') {
      throw new Error(`artifact-store: key segment must not be '.' or '..' (got '${key}')`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(part)) {
      throw new Error(
        `artifact-store: key segment '${part}' contains characters outside [A-Za-z0-9._-] (got '${key}')`,
      );
    }
  }
  return key;
}

// ---- in-memory implementation --------------------------------------------

/**
 * Zero-IO artifact store for tests + harnesses. Retains the file's bytes
 * in memory; `localPath` is a synthetic `memory:<key>` URL.
 */
export class InMemoryArtifactStore implements ArtifactStore {
  private readonly entries = new Map<string, Uint8Array>();
  /** Expose for test assertions; do not mutate. */
  public readonly calls: Array<{ op: string; key: string }> = [];

  async put(key: string, sourcePath: string): Promise<StoredArtifact> {
    const k = sanitizeArtifactKey(key);
    this.calls.push({ op: 'put', key: k });
    // Read the file into memory so tests don't have to create real sources
    // — but still exercise the "what would the FS store do" path.
    const bytes = await readFile(sourcePath);
    this.entries.set(k, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return {
      key: k,
      localPath: `memory:${k}`,
      sizeBytes: bytes.byteLength,
    };
  }

  async has(key: string): Promise<boolean> {
    const k = sanitizeArtifactKey(key);
    this.calls.push({ op: 'has', key: k });
    return this.entries.has(k);
  }

  async get(key: string): Promise<StoredArtifact | null> {
    const k = sanitizeArtifactKey(key);
    this.calls.push({ op: 'get', key: k });
    const bytes = this.entries.get(k);
    if (bytes === undefined) return null;
    return {
      key: k,
      localPath: `memory:${k}`,
      sizeBytes: bytes.byteLength,
    };
  }

  async list(): Promise<readonly string[]> {
    this.calls.push({ op: 'list', key: '' });
    return Array.from(this.entries.keys()).sort();
  }

  async delete(key: string): Promise<void> {
    const k = sanitizeArtifactKey(key);
    this.calls.push({ op: 'delete', key: k });
    this.entries.delete(k);
  }

  /** Test-only escape hatch. */
  bytesFor(key: string): Uint8Array | undefined {
    return this.entries.get(sanitizeArtifactKey(key));
  }
}

// ---- local-FS implementation ---------------------------------------------

export interface LocalFsArtifactStoreOptions {
  /** Root directory for stored artifacts. Created on demand. */
  readonly rootDir: string;
}

/**
 * Filesystem-backed store: each key maps to a file at `<rootDir>/<key>`.
 * Sub-directories are created on write. Outside-of-root access is
 * structurally impossible because keys are sanitised; we also assert the
 * resolved target path stays inside rootDir as a defence-in-depth check.
 */
export class LocalFsArtifactStore implements ArtifactStore {
  public readonly rootDir: string;

  constructor(opts: LocalFsArtifactStoreOptions) {
    if (typeof opts?.rootDir !== 'string' || opts.rootDir.length === 0) {
      throw new Error('LocalFsArtifactStore: rootDir must be a non-empty string');
    }
    this.rootDir = resolve(opts.rootDir);
  }

  async put(key: string, sourcePath: string): Promise<StoredArtifact> {
    const k = sanitizeArtifactKey(key);
    const target = this.resolveKeyPath(k);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(sourcePath, target);
    const st = await stat(target);
    return { key: k, localPath: target, sizeBytes: st.size };
  }

  async has(key: string): Promise<boolean> {
    // Mirror `get`'s file-only semantics: a directory at the key path does
    // NOT count as "present" — otherwise `has(key) === true` followed by
    // `get(key) === null` would be an observable inconsistency on nested
    // keys whose intermediate directories were created by a prior `put`.
    const target = this.resolveKeyPath(key);
    try {
      const st = await stat(target);
      return st.isFile();
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<StoredArtifact | null> {
    const k = sanitizeArtifactKey(key);
    const target = this.resolveKeyPath(k);
    try {
      const st = await stat(target);
      if (!st.isFile()) return null;
      return { key: k, localPath: target, sizeBytes: st.size };
    } catch {
      return null;
    }
  }

  async list(): Promise<readonly string[]> {
    try {
      await access(this.rootDir);
    } catch {
      return [];
    }
    const out: string[] = [];
    await this.walk(this.rootDir, '', out);
    return out.sort();
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKeyPath(key);
    await rm(target, { force: true });
  }

  private resolveKeyPath(key: string): string {
    const sanitised = sanitizeArtifactKey(key);
    const resolved = resolve(this.rootDir, sanitised);
    const rootWithSep = this.rootDir.endsWith(sep) ? this.rootDir : this.rootDir + sep;
    if (!resolved.startsWith(rootWithSep) && resolved !== this.rootDir) {
      // Defence in depth — sanitiser should already prevent this.
      throw new Error(`LocalFsArtifactStore: resolved path escapes rootDir (key='${key}')`);
    }
    return resolved;
  }

  private async walk(dir: string, prefix: string, out: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const segment = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await this.walk(join(dir, entry.name), segment, out);
      } else if (entry.isFile()) {
        out.push(segment);
      }
    }
  }
}
