"""Synthesizes the soundtrack (beat, bass, pad, whooshes on scene cuts). Usage: python3 music.py out.wav"""
import sys, wave, numpy as np
SR = 44100; DUR = 36.0; BPM = 120; B = 60 / BPM
CUTS = [3.4, 7.6, 11.4, 16.8, 21.4, 26.8, 30.2]
n = int(SR * DUR); t = np.arange(n) / SR
mix = np.zeros((n, 2))
rng = np.random.default_rng(3)

def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); j = min(n, i + len(sig))
    if j <= i: return
    s = sig[:j - i] * gain
    mix[i:j, 0] += s * (1 - pan) ; mix[i:j, 1] += s * (1 + pan)

def env(length, a=0.005, d=0.2):
    k = np.arange(int(length * SR)) / SR
    return np.minimum(1, k / a) * np.exp(-k / d)

def lp(x, alpha):  # one-pole lowpass
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += alpha * (v - acc); y[i] = acc
    return y

def kick():
    k = np.arange(int(.45 * SR)) / SR
    f = 45 + 110 * np.exp(-k * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-k * 7) * 1.0

def hat(d=.05):
    x = rng.standard_normal(int(.12 * SR)); x = x - lp(x, .5)
    return x * env(.12, .001, d)

def clap():
    x = rng.standard_normal(int(.3 * SR)); x = x - lp(x, .15)
    e = env(.3, .002, .09)
    return x * e

def saw(freq, length):
    k = np.arange(int(length * SR)) / SR
    return 2 * ((k * freq) % 1) - 1

def note(f, length, d=.25, cut=.08):
    s = saw(f, length) + .5 * saw(f * 1.005, length)
    return lp(s, cut) * env(length, .004, d)

def pad(freqs, length):
    k = np.arange(int(length * SR)) / SR
    s = sum(np.sin(2 * np.pi * f * k) + .3 * np.sin(2 * np.pi * 2 * f * k + 1) for f in freqs)
    e = np.minimum(1, k / .4) * np.minimum(1, (length - k) / .4)
    return s * e / len(freqs)

def whoosh(length=.9, rev=False):
    x = rng.standard_normal(int(length * SR))
    k = np.linspace(0, 1, len(x))
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        a = .01 + .25 * (k[i] ** 2); acc += a * (v - acc); y[i] = acc
    e = np.sin(np.pi * k) ** 2
    y = y * e
    return y[::-1] if rev else y

def impact():
    k = np.arange(int(1.2 * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-k * 12)) / SR) * np.exp(-k * 3)
    noise = lp(rng.standard_normal(len(k)), .2) * np.exp(-k * 9)
    return boom + .6 * noise

def blip(f=1400, length=.12):
    k = np.arange(int(length * SR)) / SR
    return np.sin(2 * np.pi * (f + 900 * k / length) * k) * env(length, .002, .04)

# chords (A minor feel): Am F C G, 2 beats... one bar = 4 beats = 2s
prog = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 261.63, 329.63), (196.0, 246.94, 293.66)]
roots = [55.0, 43.65, 65.41, 49.0]
start = CUTS[0]; end = 34.0
bar = 4 * B

# intro: riser into logo impact, pad from 0
add(whoosh(.6, rev=False), 0.0, .35)
add(impact(), .55, .9)
add(pad(prog[0], start + .2), 0, .18)
add(blip(900), 1.15, .15); add(blip(1200), 1.7, .15)

bi = 0; tb = start
while tb < end - 1e-6:
    c = bi % 4
    add(pad(prog[c], bar), tb, .16)
    for s in range(8):  # eighth-note bass
        add(note(roots[c] * (2 if s % 4 == 3 else 1), B / 2, .12, .06), tb + s * B / 2, .32)
    for q in range(4):
        tq = tb + q * B
        add(kick(), tq, .85)
        add(hat(), tq + B / 2, .12, .4)
        add(hat(.02), tq + B / 4, .05, -.4); add(hat(.02), tq + 3 * B / 4, .05, -.4)
        if q in (1, 3): add(clap(), tq, .28)
    # arp lead
    arp = [prog[c][0] * 2, prog[c][1] * 2, prog[c][2] * 2, prog[c][1] * 2]
    for s in range(8):
        add(note(arp[s % 4], B / 2, .09, .25), tb + s * B / 2, .07, .3 * (1 if s % 2 else -1))
    tb += bar; bi += 1

for c in CUTS:
    add(whoosh(.8), c - .55, .45)
    add(impact(), c, .45)
# UI ticks for staggered entries
for i in range(9): add(blip(1500 + 60 * i, .08), 11.4 + .6 + .12 * i, .06)
for i in range(3): add(blip(1100, .1), 16.8 + 1.2 + .35 * i, .12)
for i in range(3): add(blip(1300, .1), 21.4 + 1.8 + .45 * i, .1)
for i in range(3): add(blip(1800, .07), 30.2 + 2.75 + 1.2 * i, .12)
# outro: final pad + impact
add(impact(), 34.0, .6)
add(pad(prog[0], 2.0), 34.0, .22)

# fades + normalize + soft clip
fade = np.ones(n); fo = int(1.5 * SR); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.6) * .9
out = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'out/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('music ok')
