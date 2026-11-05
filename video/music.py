# Original score for the Kerb launch film (27 s), adapted from Allow's; first lines below are Allow's notes.
# Original score for the 30 s video, synthesized from scratch (no samples): a dark pad in A minor,
# a sub pulse that starts with the logo, risers into each scene, impacts on the reveals.
import numpy as np, wave
SR, DUR = 44100, 27.0
t = np.arange(int(SR * DUR)) / SR
out = np.zeros((len(t), 2))
def note(f): return 440 * 2 ** ((f - 69) / 12)
def env(start, end, a=.8, r=1.2):
    e = np.clip((t - start) / a, 0, 1) * np.clip((end - t) / r, 0, 1); return e
# Pad: detuned saws through a soft low-pass, chord per scene.
chords = [(0, 3.7, [45, 52, 57, 60]), (3.7, 12.4, [48, 55, 60, 64]), (12.4, 19.1, [41, 48, 53, 57]), (19.1, 27, [43, 50, 55, 62])]
for s, e, ns in chords:
    m = env(s, e + .6, 1.2, 1.6)
    for n in ns:
        for det, pan in [(-.08, .3), (.08, .7)]:
            f = note(n + det); ph = (t * f) % 1
            saw = 2 * ph - 1
            saw = np.convolve(saw, np.ones(18) / 18, mode="same")  # crude low-pass
            out[:, 0] += saw * m * .045 * (1 - pan); out[:, 1] += saw * m * .045 * pan
# Sub pulse from the logo on: a short sine kick on every beat at 100 bpm.
beat = 60 / 110
for k in np.arange(3.7, 25.6, beat):
    i = int(k * SR); n = int(.45 * SR); tt = np.arange(n) / SR
    kick = np.sin(2 * np.pi * (48 + 90 * np.exp(-tt * 28)) * tt) * np.exp(-tt * 7) * .5
    out[i:i + n, :] += kick[: len(out) - i, None]
# Hats: filtered noise on the off-beats in the screen scenes.
rng = np.random.default_rng(3)
for k in np.arange(7.7 + beat / 2, 23.6, beat):
    i = int(k * SR); n = int(.06 * SR); nz = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 60) * .05
    nz = nz - np.convolve(nz, np.ones(6) / 6, mode="same")
    out[i:i + n, 0] += nz[: len(out) - i] * .8; out[i:i + n, 1] += nz[: len(out) - i]
# Risers into each scene and an impact on it.
for cut in [1.7, 3.7, 7.7, 12.4, 15.7, 19.1, 23.7]:
    a, n = int((cut - 1.2) * SR), int(1.2 * SR)
    tt = np.arange(n) / SR; nz = rng.standard_normal(n) * (tt / 1.2) ** 2 * .07
    sweep = np.sin(2 * np.pi * (200 + 1400 * (tt / 1.2) ** 2) * tt) * (tt / 1.2) ** 3 * .03
    out[a:a + n, :] += (nz + sweep)[:, None]
    i = int(cut * SR); m = int(1.4 * SR); tt = np.arange(m) / SR
    boom = (np.sin(2 * np.pi * 42 * tt) * .5 + rng.standard_normal(m) * .05 * np.exp(-tt * 20)) * np.exp(-tt * 3.2) * (.9 if cut in (3.7, 23.7) else .45)
    out[i:i + m, :] += boom[: len(out) - i, None]
# Bell motif on the final logo.
for j, n in enumerate([76, 72, 69, 81]):
    s = 23.9 + j * .35; i = int(s * SR); m = int(2.5 * SR); tt = np.arange(m) / SR
    bell = (np.sin(2 * np.pi * note(n) * tt) + .3 * np.sin(2 * np.pi * note(n) * 2.01 * tt)) * np.exp(-tt * 2.2) * .08
    out[i:i + m, :] += bell[: len(out) - i, None]
# Master: fade, soft clip, normalize.
out *= np.clip(t / .3, 0, 1)[:, None] * np.clip((DUR - t) / 1.5, 0, 1)[:, None]
out = np.tanh(out * 1.4); out /= np.abs(out).max() / .89
with wave.open("out/music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype("<i2").tobytes())
