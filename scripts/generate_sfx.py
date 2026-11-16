#!/usr/bin/env python3
"""Synthesizes the enemy sound effects into src/assets/audio, next to the existing effects.

Regenerate from the repository root (Python 3 standard library only):

    python3 scripts/generate_sfx.py

Mono 8-bit unsigned WAV at 22050 Hz, the format of the existing effects. Every sound is built from
oscillators, seeded noise and biquad filters, so the output is identical on every run. Each file
loses its DC offset, fades in and out, and is scaled to the mean loudness of the existing effects,
capped at -1 dBFS. The durations and pitches below are the tuning knobs.
"""

import math
import random
import wave
from pathlib import Path

RATE = 22050
MEAN_DB = -9.0  # RMS level; the existing effects measure -8.4 to -10.2 dB mean
PEAK = 10 ** (-1 / 20)  # -1 dBFS ceiling
FADE_IN_S = 0.004
FADE_OUT_S = 0.010
OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'audio'


def samples(seconds):
    return round(seconds * RATE)


def glide(start, end, n):
    """Exponential sweep in Hz from start to end over n samples."""
    return [start * (end / start) ** (i / (n - 1)) for i in range(n)]


def oscillate(freqs, shape):
    phase, out = 0.0, []
    for f in freqs:
        phase = (phase + f / RATE) % 1.0
        out.append(shape(phase))
    return out


def saw(p):
    return 2 * p - 1


def triangle(p):
    return 4 * abs(p - 0.5) - 1


def sine(p):
    return math.sin(2 * math.pi * p)


def biquad(x, kind, freqs, q):
    """RBJ low-pass ('lp') or constant-0dB-peak band-pass ('bp'); freqs gives one value per sample."""
    x1 = x2 = y1 = y2 = 0.0
    out = []
    for s, f in zip(x, freqs):
        w = 2 * math.pi * f / RATE
        cos, alpha = math.cos(w), math.sin(w) / (2 * q)
        a0 = 1 + alpha
        if kind == 'lp':
            b0 = (1 - cos) / 2 / a0
            b1 = (1 - cos) / a0
            b2 = b0
        else:
            b0, b1, b2 = alpha / a0, 0.0, -alpha / a0
        a1, a2 = -2 * cos / a0, (1 - alpha) / a0
        y = b0 * s + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, s, y1, y
        out.append(y)
    return out


def noise(rng, n):
    return [rng.uniform(-1, 1) for _ in range(n)]


def overlay(base, part, at=0):
    for i, s in enumerate(part):
        base[at + i] += s


def finish(x):
    """Removes DC, fades the ends, scales the RMS to MEAN_DB and soft-caps the peak at PEAK."""
    n = len(x)
    mean = sum(x) / n
    x = [s - mean for s in x]
    fade_in, fade_out = samples(FADE_IN_S), samples(FADE_OUT_S)
    for i in range(fade_in):
        x[i] *= i / fade_in
    for i in range(fade_out):
        x[n - 1 - i] *= i / fade_out
    target = 10 ** (MEAN_DB / 20)
    gain = 1.0
    # The soft clip also lowers the level it does not touch, so the gain is refined on its output.
    for _ in range(8):
        y = [PEAK * math.tanh(s * gain / PEAK) for s in x]
        gain *= target / math.sqrt(sum(s * s for s in y) / n)
    return [PEAK * math.tanh(s * gain / PEAK) for s in x]


def write_wav(path, x):
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(1)  # 8-bit WAV is unsigned, silence at 128
        f.setframerate(RATE)
        f.writeframes(bytes(round(128 + s * 127) for s in x))


def death_grunt():
    """0.25 s falling growl: a detuned saw pair glides down through a low-pass that closes (squelch)."""
    n = samples(0.25)
    t = [i / RATE for i in range(n)]
    pitch = glide(190, 70, n)
    voice = [
        a + b for a, b in zip(oscillate(pitch, saw), oscillate([p * 1.03 for p in pitch], saw))
    ]
    cutoff = [300 + 1500 * math.exp(-x * 12) for x in t]
    growl = biquad(voice, 'lp', cutoff, 1.2)
    wobble = [0.55 + 0.45 * math.sin(2 * math.pi * 32 * x) for x in t]
    amp = [w * math.exp(-x * 9) for w, x in zip(wobble, t)]
    return [math.tanh(3 * g) * a for g, a in zip(growl, amp)]


def death_kamikaze():
    """0.18 s high squeal: sine and triangle glide down from 1500 Hz with a quick vibrato."""
    n = samples(0.18)
    t = [i / RATE for i in range(n)]
    pitch = [p * (1 + 0.02 * math.sin(2 * math.pi * 42 * x)) for p, x in zip(glide(1500, 480, n), t)]
    tone = [0.75 * a + 0.25 * b for a, b in zip(oscillate(pitch, sine), oscillate(pitch, triangle))]
    amp = [min(1.0, x / 0.002) * math.exp(-x * 12) for x in t]
    return [s * a for s, a in zip(tone, amp)]


def death_tank():
    """0.9 s heavy groan (detuned saw through two dark band-passes, slow wobble) over a low thud."""
    n = samples(0.9)
    t = [i / RATE for i in range(n)]
    pitch = glide(110, 58, n)
    voice = [
        a + 0.6 * b
        for a, b in zip(oscillate(pitch, saw), oscillate([p * 1.012 for p in pitch], saw))
    ]
    vowel = [
        a + 0.6 * b
        for a, b in zip(biquad(voice, 'bp', [400] * n, 3), biquad(voice, 'bp', [800] * n, 4))
    ]
    swell = [min(1.0, x / 0.15) * math.exp(-max(0.0, x - 0.45) * 5) for x in t]
    wobble = [0.75 + 0.25 * math.sin(2 * math.pi * 6.5 * x) for x in t]
    out = [0.5 * v * e * w for v, e, w in zip(vowel, swell, wobble)]
    thud_n = samples(0.3)
    thud = oscillate(glide(75, 38, thud_n), sine)
    overlay(out, [0.9 * s * math.exp(-i / RATE * 14) for i, s in enumerate(thud)])
    click_n = samples(0.02)
    click = biquad(noise(random.Random(3), click_n), 'lp', [900] * click_n, 0.7)
    overlay(out, [0.3 * s * math.exp(-i / RATE * 250) for i, s in enumerate(click)])
    return out


def laugh_tank():
    """1.8 s demonic laugh: five falling "ha" bursts (voiced saw through vowel band-passes),
    then three dark echoes that carry the laugh out."""
    total = samples(1.8)
    out = [0.0] * total
    rng = random.Random(7)
    for k, start in enumerate((0.00, 0.30, 0.58, 0.84, 1.08)):
        n = samples(0.20)
        t = [i / RATE for i in range(n)]
        top = 105 * 0.93**k
        pitch = glide(top, top * 0.85, n)
        detuned = [p * 1.015 for p in pitch]
        voice = [a + 0.6 * b for a, b in zip(oscillate(pitch, saw), oscillate(detuned, saw))]
        f1 = biquad(voice, 'bp', [700] * n, 4)
        f2 = biquad(voice, 'bp', [1100] * n, 5)
        body = biquad(voice, 'lp', [300] * n, 0.7)
        rough = [0.7 + 0.3 * math.sin(2 * math.pi * 28 * x) for x in t]
        env = [min(1.0, x / 0.015) * math.exp(-9 * x) for x in t]
        level = 0.85**k
        burst = [
            level * (a + 0.7 * b + 0.25 * c) * e * r
            for a, b, c, e, r in zip(f1, f2, body, env, rough)
        ]
        breath_n = samples(0.025)
        breath = biquad(noise(rng, breath_n), 'bp', [1500] * breath_n, 1)
        overlay(out, [0.15 * s for s in breath], samples(start))
        overlay(out, burst, samples(start))
    wet = biquad(out, 'lp', [900] * total, 0.7)
    for delay, gain in ((0.11, 0.35), (0.19, 0.22), (0.31, 0.12)):
        at = samples(delay)
        overlay(out, [gain * s for s in wet[: total - at]], at)
    return out


def screech_kamikaze():
    """0.30 s warning screech: a rising, vibrating saw/triangle with a nasal band-pass and hiss."""
    n = samples(0.30)
    t = [i / RATE for i in range(n)]
    vibrato = [1 + 0.03 * math.sin(2 * math.pi * 55 * x) for x in t]
    pitch = [p * v for p, v in zip(glide(700, 2100, n), vibrato)]
    raw = [0.6 * a + 0.4 * b for a, b in zip(oscillate(pitch, saw), oscillate(pitch, triangle))]
    nasal = biquad(raw, 'bp', [1800] * n, 1.5)
    tone = [s + 0.5 * b for s, b in zip(raw, nasal)]
    centre = glide(1500, 3500, n)
    hiss = biquad(noise(random.Random(11), n), 'bp', centre, 2)
    env = [
        min(1.0, x / 0.01)
        * (0.6 + 0.4 * min(1.0, x / 0.22))
        * (math.exp(-(x - 0.22) * 30) if x > 0.22 else 1.0)
        for x in t
    ]
    return [(s + 0.2 * h) * e for s, h, e in zip(tone, hiss, env)]


SOUNDS = {
    'deathgrunt': death_grunt,
    'deathkamikaze': death_kamikaze,
    'deathtank': death_tank,
    'laughtank': laugh_tank,
    'screechkamikaze': screech_kamikaze,
}


def main():
    for name, make in SOUNDS.items():
        write_wav(OUT / f'{name}.wav', finish(make()))
        print(f'{name}.wav')


if __name__ == '__main__':
    main()
