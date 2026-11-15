#!/usr/bin/env python3
"""Synthesizes the background loop (src/assets/audio/music.ogg + music.mp3).

Regenerate from the repository root (Python 3 standard library + /usr/bin/ffmpeg only):

    python3 scripts/generate_music.py

D minor, 112 BPM, 24 bars (about 51 s): A (8 bars) / B (8 bars) / A' (8 bars).
Voices: pulse lead with echo, triangle bass, 12.5% pulse arpeggio (B and A' only), noise drums.
Every note and echo wraps around the end of the buffer, so the loop has no click and no gap.
OGG Vorbis is the gapless primary; MP3 encoders add padding, so it is only a fallback.
Tune the constants below and rerun. The intermediate WAV lives in a temp dir and is discarded.
"""

import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 44100
BPM = 112
STEP = 60 / BPM / 4  # one 16th note, in seconds
BARS = 24
STEPS = BARS * 16
N = round(STEPS * STEP * RATE)  # loop length in samples
PEAK = 0.7  # normalised peak, about -3 dBFS: headroom for the lossy encoders
ECHO = [(0.375, 0.35), (0.75, 0.18)]  # (seconds, gain): dotted-eighth echo on the lead
OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'audio'

NOTE_INDEX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """'C#5' -> 73, 'Bb4' -> 70."""
    value = NOTE_INDEX[name[0]]
    rest = name[1:]
    if rest[0] == '#':
        value, rest = value + 1, rest[1:]
    elif rest[0] == 'b':
        value, rest = value - 1, rest[1:]
    return value + 12 * (int(rest) + 1)


def freq(m):
    return 440 * 2 ** ((m - 69) / 12)


# Chord per bar: (bass root, triad for the arpeggio).
DM = (midi('D2'), ['D4', 'F4', 'A4'])
GM = (midi('G2'), ['G4', 'Bb4', 'D5'])
BB = (midi('Bb2'), ['Bb3', 'D4', 'F4'])
A = (midi('A2'), ['A3', 'C#4', 'E4'])
PROG_A = [DM, DM, BB, A, DM, GM, BB, A]
PROG_B = [GM, GM, DM, DM, BB, BB, A, A]
PROGRESSION = PROG_A + PROG_B + PROG_A

# Lead phrases, one list per bar of (start step, length in steps, note).
MEL_A = [
    [(0, 6, 'A4'), (6, 2, 'D5'), (8, 8, 'F5')],
    [(0, 4, 'E5'), (4, 4, 'D5'), (8, 8, 'A4')],
    [(0, 6, 'D5'), (6, 2, 'F5'), (8, 8, 'D5')],
    [(0, 4, 'C#5'), (4, 4, 'E5'), (8, 6, 'G5'), (14, 2, 'E5')],
    [(0, 6, 'A4'), (6, 2, 'D5'), (8, 4, 'F5'), (12, 4, 'A5')],
    [(0, 6, 'G5'), (6, 2, 'F5'), (8, 4, 'D5'), (12, 4, 'Bb4')],
    [(0, 6, 'F5'), (6, 2, 'D5'), (8, 8, 'Bb4')],
    [(0, 4, 'E5'), (4, 4, 'C#5'), (8, 4, 'A4'), (12, 2, 'C#5'), (14, 2, 'E5')],
]
MEL_B = [
    [(0, 2, 'G5'), (2, 2, 'F5'), (4, 4, 'D5'), (8, 8, 'Bb4')],
    [(0, 2, 'G5'), (2, 2, 'A5'), (4, 4, 'Bb5'), (8, 8, 'A5')],
    [(0, 2, 'F5'), (2, 2, 'E5'), (4, 4, 'D5'), (8, 8, 'A4')],
    [(0, 2, 'F5'), (2, 2, 'G5'), (4, 4, 'A5'), (8, 4, 'F5'), (12, 4, 'D5')],
    [(0, 2, 'D5'), (2, 2, 'F5'), (4, 4, 'Bb5'), (8, 8, 'A5')],
    [(0, 4, 'G5'), (4, 4, 'F5'), (8, 4, 'D5'), (12, 4, 'F5')],
    [(0, 2, 'E5'), (2, 2, 'F5'), (4, 2, 'E5'), (6, 2, 'C#5'), (8, 8, 'A4')],
    [(0, 8, 'E5'), (8, 4, 'C#5'), (12, 4, 'E5')],
]
# A' repeats A with a higher answer in bar 4 and a turn that lands back on D in bar 8.
MEL_A2 = MEL_A[:3] + [
    [(0, 4, 'C#5'), (4, 4, 'E5'), (8, 4, 'A5'), (12, 4, 'G5')],
] + MEL_A[4:7] + [
    [(0, 4, 'E5'), (4, 4, 'C#5'), (8, 4, 'E5'), (12, 4, 'A5')],
]
MELODY = MEL_A + MEL_B + MEL_A2

BASS_PATTERN = [0, 0, 12, 0, 0, 0, 12, 7]  # semitones above the root, one per eighth note
ARP_PATTERN = [0, 1, 2, 1, 0, 1, 2, 1]  # chord tone per eighth note
ARP_FROM_BAR = 8  # the arpeggio enters with section B

rng = random.Random(7)


def env(i, total, attack, release, sustain=1.0, decay=0.0):
    """Linear attack, optional decay to a sustain level, linear release at the end."""
    t = i / RATE
    end = total / RATE
    if t < attack:
        level = t / attack
    elif decay and t < attack + decay:
        level = 1 - (1 - sustain) * (t - attack) / decay
    else:
        level = sustain
    if t > end - release:
        level *= max(0.0, (end - t) / release)
    return level


def pulse(phase, width):
    return 1.0 if (phase % 1.0) < width else -1.0


def triangle(phase):
    return 4 * abs(phase % 1.0 - 0.5) - 1


def add(buf, start, samples):
    for i, s in enumerate(samples):
        buf[(start + i) % N] += s


def lead_note(note, length_steps):
    total = round(length_steps * STEP * RATE * 1.15)  # slight overlap into the next note
    base, phase, out = freq(midi(note)), 0.0, []
    for i in range(total):
        t = i / RATE
        vibrato = math.sin(2 * math.pi * 5.5 * t) * 0.3 * min(1.0, max(0.0, t - 0.15) * 4)
        phase += base * 2 ** (vibrato / 12) / RATE
        out.append(0.22 * pulse(phase, 0.25) * env(i, total, 0.006, 0.09, 0.75, 0.15))
    return out


def bass_note(m, length):
    total = round(length * RATE)
    base, phase, out = freq(m), 0.0, []
    for i in range(total):
        phase += base / RATE
        # tanh adds harmonics so the bass stays audible on small speakers
        out.append(0.42 * math.tanh(2.2 * triangle(phase)) * env(i, total, 0.003, 0.04, 0.8, 0.12))
    return out


def arp_note(m, length):
    total = round(length * RATE)
    base, phase, out = freq(m), 0.0, []
    for i in range(total):
        phase += base / RATE
        out.append(0.07 * pulse(phase, 0.125) * env(i, total, 0.002, 0.03, 0.4, 0.1))
    return out


def kick():
    total, phase, out = round(0.22 * RATE), 0.0, []
    for i in range(total):
        t = i / RATE
        phase += (45 + 90 * math.exp(-t * 28)) / RATE
        out.append(0.55 * math.sin(2 * math.pi * phase) * math.exp(-t * 14))
    return out


def snare():
    total, phase, out = round(0.16 * RATE), 0.0, []
    for i in range(total):
        t = i / RATE
        phase += 190 / RATE
        noise = rng.uniform(-1, 1)
        out.append(0.22 * (0.8 * noise + 0.3 * math.sin(2 * math.pi * phase)) * math.exp(-t * 26))
    return out


def hat(open_):
    total, last, out = round((0.09 if open_ else 0.035) * RATE), 0.0, []
    for i in range(total):
        noise = rng.uniform(-1, 1)
        out.append(0.07 * (noise - last) * math.exp(-i / RATE * (30 if open_ else 90)))
        last = noise
    return out


def render():
    lead, mix = [0.0] * N, [0.0] * N
    drums = {'kick': kick(), 'snare': snare(), 'hat': hat(False), 'open': hat(True)}
    for bar in range(BARS):
        root, triad = PROGRESSION[bar]
        origin = bar * 16
        at = lambda step: round((origin + step) * STEP * RATE)  # noqa: E731
        for start, length, note in MELODY[bar]:
            add(lead, at(start), lead_note(note, length))
        for k, offset in enumerate(BASS_PATTERN):
            add(mix, at(k * 2), bass_note(root + offset, STEP * 1.7))
        if bar >= ARP_FROM_BAR:
            for k, tone in enumerate(ARP_PATTERN):
                add(mix, at(k * 2), arp_note(midi(triad[tone]) + 12, STEP * 1.5))
        for step in (0, 8):
            add(mix, at(step), drums['kick'])
        if bar % 4 == 3:  # extra kick before the phrase turns over
            add(mix, at(14), drums['kick'])
        for step in (4, 12):
            add(mix, at(step), drums['snare'])
        if bar >= ARP_FROM_BAR:
            for k in range(8):
                add(mix, at(k * 2), drums['open' if k % 4 == 3 else 'hat'])
    # Echo wraps too: the last notes' repeats land at the start of the loop.
    wet = lead[:]
    for delay, gain in ECHO:
        shift = round(delay * RATE)
        for i, s in enumerate(lead):
            wet[(i + shift) % N] += s * gain
    out = [math.tanh(a + b) for a, b in zip(mix, wet)]
    scale = PEAK / max(abs(s) for s in out)
    return [s * scale for s in out]


def write_wav(path, samples):
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(RATE)
        f.writeframes(b''.join(struct.pack('<h', round(s * 32767)) for s in samples))


def encode(wav, target, *codec_args):
    subprocess.run(
        ['/usr/bin/ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), *codec_args, str(target)],
        check=True,
    )


def main():
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'music.wav'
        write_wav(wav, render())
        encode(wav, OUT / 'music.ogg', '-c:a', 'libvorbis', '-q:a', '2')
        encode(wav, OUT / 'music.mp3', '-c:a', 'libmp3lame', '-b:a', '80k')
    print(f'{N / RATE:.2f} s loop -> {OUT}')


if __name__ == '__main__':
    main()
