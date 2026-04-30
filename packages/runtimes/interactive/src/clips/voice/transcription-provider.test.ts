// packages/runtimes/interactive/src/clips/voice/transcription-provider.test.ts
// T-387 ACs #13–#17 — TranscriptionProvider implementations.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  InMemoryTranscriptionProvider,
  WebSpeechApiTranscriptionProvider,
  WebSpeechApiUnavailableError,
} from './transcription-provider.js';
import type { TranscriptEvent } from './types.js';

// ---------- Web Speech API provider ----------

interface FakeRecognitionEvent {
  resultIndex: number;
  results: Array<{ isFinal: boolean; 0: { transcript: string }; length: 1 }>;
}

interface FakeRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: FakeRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  startCalled: number;
  abortCalled: number;
}

function makeFakeRecognition(): FakeRecognition {
  const rec: FakeRecognition = {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    startCalled: 0,
    abortCalled: 0,
    start() {
      this.startCalled += 1;
    },
    stop() {
      /* no-op */
    },
    abort() {
      this.abortCalled += 1;
    },
  };
  return rec;
}

function fakeResultEvent(text: string, isFinal: boolean): FakeRecognitionEvent {
  return {
    resultIndex: 0,
    results: [{ isFinal, 0: { transcript: text }, length: 1 }],
  };
}

describe('WebSpeechApiTranscriptionProvider (T-387)', () => {
  it('AC #16 — throws WebSpeechApiUnavailableError when neither global is present', async () => {
    const provider = new WebSpeechApiTranscriptionProvider({ globalObj: {} });
    const stream = new MediaStream();
    await expect(
      provider.start({ stream, language: 'en-US', partial: true, onTranscript: () => {} }),
    ).rejects.toThrow(WebSpeechApiUnavailableError);
  });

  it('AC #13 — emits final TranscriptEvent on result with isFinal=true', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const events: TranscriptEvent[] = [];
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    fake.onresult?.(fakeResultEvent('hello world', true));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('final');
    if (events[0]?.kind === 'final') {
      expect(events[0].text).toBe('hello world');
    }
    handle.stop();
  });

  it('AC #14 — partial:true surfaces interim events', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const events: TranscriptEvent[] = [];
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    fake.onresult?.(fakeResultEvent('partial', false));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('partial');
    handle.stop();
  });

  it('AC #15 — partial:false suppresses interim events; finals still surface', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const events: TranscriptEvent[] = [];
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: false,
      onTranscript: (e) => events.push(e),
    });
    fake.onresult?.(fakeResultEvent('partial', false));
    expect(events).toHaveLength(0);
    fake.onresult?.(fakeResultEvent('final', true));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('final');
    handle.stop();
  });

  it('falls back to webkitSpeechRecognition when SpeechRecognition is absent', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { webkitSpeechRecognition: vi.fn(() => fake) as never },
    });
    const stream = new MediaStream();
    await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: () => {},
    });
    expect(fake.startCalled).toBe(1);
  });

  it('forwards language to recognition.lang', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const stream = new MediaStream();
    await provider.start({
      stream,
      language: 'de-DE',
      partial: false,
      onTranscript: () => {},
    });
    expect(fake.lang).toBe('de-DE');
    expect(fake.continuous).toBe(true);
    expect(fake.interimResults).toBe(false);
  });

  it('emits error events via onerror', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const events: TranscriptEvent[] = [];
    const stream = new MediaStream();
    await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    fake.onerror?.({ error: 'no-speech' });
    expect(events.find((e) => e.kind === 'error')).toBeDefined();
  });

  it('stop() calls abort and suppresses post-stop events', async () => {
    const fake = makeFakeRecognition();
    const provider = new WebSpeechApiTranscriptionProvider({
      globalObj: { SpeechRecognition: vi.fn(() => fake) as never },
    });
    const events: TranscriptEvent[] = [];
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    handle.stop();
    expect(fake.abortCalled).toBe(1);
    fake.onresult?.(fakeResultEvent('after stop', true));
    expect(events).toHaveLength(0);
    handle.stop(); // idempotent
    expect(fake.abortCalled).toBe(1);
  });
});

// ---------- InMemory provider ----------

describe('InMemoryTranscriptionProvider (T-387 AC #17)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC #17 — emits scripted events in order at the given delays', async () => {
    const events: TranscriptEvent[] = [];
    const provider = new InMemoryTranscriptionProvider({
      scripted: [
        { delayMs: 10, event: { kind: 'partial', text: 'he', timestampMs: 0 } },
        { delayMs: 20, event: { kind: 'partial', text: 'hel', timestampMs: 0 } },
        { delayMs: 30, event: { kind: 'final', text: 'hello', timestampMs: 0 } },
      ],
    });
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    vi.advanceTimersByTime(35);
    expect(
      events.map((e) => (e.kind === 'final' || e.kind === 'partial' ? e.text : 'err')),
    ).toEqual(['he', 'hel', 'hello']);
    handle.stop();
  });

  it('partial:false suppresses scripted partial events but lets finals through', async () => {
    const events: TranscriptEvent[] = [];
    const provider = new InMemoryTranscriptionProvider({
      scripted: [
        { delayMs: 10, event: { kind: 'partial', text: 'p', timestampMs: 0 } },
        { delayMs: 20, event: { kind: 'final', text: 'f', timestampMs: 0 } },
      ],
    });
    const stream = new MediaStream();
    await provider.start({
      stream,
      language: 'en-US',
      partial: false,
      onTranscript: (e) => events.push(e),
    });
    vi.advanceTimersByTime(25);
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe('final');
  });

  it('stop() suppresses pending scripted events', async () => {
    const events: TranscriptEvent[] = [];
    const provider = new InMemoryTranscriptionProvider({
      scripted: [{ delayMs: 100, event: { kind: 'final', text: 'late', timestampMs: 0 } }],
    });
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: (e) => events.push(e),
    });
    handle.stop();
    vi.advanceTimersByTime(200);
    expect(events).toHaveLength(0);
  });

  it('honours injected timer host', async () => {
    const setT = vi.fn(() => 1 as unknown);
    const clearT = vi.fn();
    const provider = new InMemoryTranscriptionProvider({
      scripted: [{ delayMs: 5, event: { kind: 'final', text: 'x', timestampMs: 0 } }],
      timers: { setTimeout: setT, clearTimeout: clearT },
    });
    const stream = new MediaStream();
    const handle = await provider.start({
      stream,
      language: 'en-US',
      partial: true,
      onTranscript: () => {},
    });
    expect(setT).toHaveBeenCalled();
    handle.stop();
    expect(clearT).toHaveBeenCalled();
  });
});
