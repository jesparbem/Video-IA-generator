#!/usr/bin/env python3
"""
Narration -> per-segment WAVs + sentence/word timings (audio-first: scenes are
animated against these timings, never the other way round).

  python3 engine/audio.py videos/<slug> [seg ...]

Reads  <ep>/narration.md   — one `## <segName>` heading per segment, prose below.
       Pronunciation override inline: {Display|spoken}  e.g. {SynthID|Synth I D}.
       A paragraph that is only `(pause N)` inserts N seconds of silence (think time).
Writes <ep>/audio/NN-<seg>.wav and <ep>/audio/timings.json.

Each sentence is synthesised separately, so sentence starts are exact (no
alignment model needed). Word times inside a sentence are interpolated by
character length — good to ~0.2s, enough to land a visual on a keyword.
Passing segment names regenerates only those; the rest keep their timings.

TTS engine (precedence: --tts flag > `tts:` line in narration.md > tts.engine in
project.config.json / video.json):
  edge        Microsoft Edge neural voices, free, no key (default)
  elevenlabs  best quality; ELEVENLABS_API_KEY from the environment or .env (gitignored)
  kokoro      local ONNX model in kokoro-models/ (offline, free)
  none        silent audio + timings estimated from words-per-minute (preview a video
              or a style without network or credits; replace with a real engine later)
Voices, gaps and tail come from the config (tts.*). Test the engine with
`audio.py --check` (one short sentence, writes nothing into the project). It uses the with-timestamps
endpoint, so word times come from real character alignment instead of
interpolation, and passes previous/next sentence text for continuous prosody.
No atempo is applied to ElevenLabs audio (its pace is already natural).
"""

import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent


def _merge(a, b):
    if not isinstance(b, dict) or not isinstance(a, dict):
        return a if b is None else b
    out = dict(a)
    for k, v in b.items():
        out[k] = _merge(out.get(k), v)
    return out


def load_config(ep=None):
    """project.config.json deep-merged with <ep>/video.json"""
    def rd(p):
        try:
            return json.loads(Path(p).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
    return _merge(rd(ROOT / "project.config.json"), rd(Path(ep) / "video.json") if ep else {})


CFG = load_config(next((a for a in sys.argv[1:] if not a.startswith("-") and Path(a).is_dir()), None))
TTS = CFG.get("tts", {})
MODELS = Path(os.environ.get("KOKORO_MODELS") or ROOT / "kokoro-models")   # optional local TTS weights
VOICE = os.environ.get("KOKORO_VOICE") or TTS.get("kokoro", {}).get("voice") or "em_alex"
SPEED = 1.0
ATEMPO = 1.1            # Kokoro only: slightly brisker cadence
SENT_GAP = float(TTS.get("sentenceGap", 0.22))     # seconds between sentences (pre-atempo)
PARA_GAP = float(TTS.get("paragraphGap", 0.45))    # seconds between paragraphs (pre-atempo)
TAIL = float(TTS.get("tail", 0.6))                 # silence the scene holds after the last word
WPM = float(CFG.get("video", {}).get("wordsPerMinute", 150))
OVERRIDE = re.compile(r"\{([^|}]+)\|([^}]+)\}")
PAUSE = re.compile(r"^\(pause\s+([\d.]+)\)$")

def _load_dotenv():
    """<repo>/.env → os.environ (only keys not already set, empty values ignored)"""
    f = ROOT / ".env"
    if not f.exists():
        return
    for ln in f.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if not ln or ln.startswith("#") or "=" not in ln:
            continue
        k, v = ln.split("=", 1)
        v = v.strip().strip('"').strip("'")
        if v and not os.environ.get(k.strip()):
            os.environ[k.strip()] = v


_load_dotenv()
EL_VOICE = os.environ.get("ELEVENLABS_VOICE_ID") or TTS.get("elevenlabs", {}).get("voiceId") or ""
EL_MODEL = os.environ.get("ELEVENLABS_MODEL") or TTS.get("elevenlabs", {}).get("model") or "eleven_multilingual_v2"
EL_SR = 44100
CACHE_DIR = None      # set per episode in main(): <ep>/audio/.cache (raw API responses, so re-runs cost no credits)
ENGINE = TTS.get("engine") or "edge"


class KokoroTTS:
    atempo = ATEMPO

    def __init__(self):
        from kokoro_onnx import Kokoro
        self.k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))

    def synth(self, text, prev="", nxt=""):
        samples, sr = self.k.create(text, voice=VOICE, speed=SPEED, lang=os.environ.get("KOKORO_LANG") or TTS.get("kokoro", {}).get("lang") or "es")
        return samples.astype(np.float32), sr, None


class ElevenTTS:
    """ElevenLabs with-timestamps: returns audio + per-character start times (seconds)."""
    atempo = float(os.environ.get("ELEVENLABS_ATEMPO") or 1.0)   # >1 speeds up slow voices (cached, no extra credits)

    def __init__(self):
        self.key = os.environ.get("ELEVENLABS_API_KEY")
        if not self.key:
            sys.exit("ELEVENLABS_API_KEY is not set (paste it into .env or export it)")
        if not EL_VOICE:
            sys.exit("No ElevenLabs voice: set tts.elevenlabs.voiceId in project.config.json or ELEVENLABS_VOICE_ID in .env")

    def synth(self, text, prev="", nxt=""):
        import hashlib
        key = hashlib.sha1(json.dumps([text, prev, nxt, EL_VOICE, EL_MODEL]).encode()).hexdigest()[:16]
        cache = CACHE_DIR / f"{key}.json" if CACHE_DIR else None
        if cache and cache.exists():
            return self._decode(json.loads(cache.read_text(encoding="utf-8")))
        body = {"text": text, "model_id": EL_MODEL, "previous_text": prev or None, "next_text": nxt or None,
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True}}
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{EL_VOICE}/with-timestamps?output_format=mp3_44100_128",
            data=json.dumps({k: v for k, v in body.items() if v is not None}).encode(),
            headers={"xi-api-key": self.key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read())
        except urllib.error.HTTPError as e:
            sys.exit(f"ElevenLabs HTTP {e.code}: {e.read()[:300].decode(errors='replace')}")
        if cache:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(d), encoding="utf-8")
        return self._decode(d)

    def _decode(self, d):
        mp3 = base64.b64decode(d["audio_base64"])
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(EL_SR), "pipe:1"],
                             input=mp3, capture_output=True, check=True).stdout
        al = d.get("alignment") or {}
        x = np.frombuffer(pcm, dtype=np.float32).copy()
        # ElevenLabs pads clips with up to ~1.2 s of trailing silence; keep 80 ms
        idx = np.where(np.abs(x) > 0.01)[0]
        if len(idx):
            x = x[: min(len(x), idx[-1] + int(0.08 * EL_SR))]
        return x, EL_SR, list(zip(al.get("characters", []), al.get("character_start_times_seconds", [])))


class EdgeTTS:
    """Microsoft Edge neural voices (free, no key) via edge-tts; word boundaries -> per-character start times."""
    atempo = float(os.environ.get("EDGE_ATEMPO") or 1.0)
    voice = os.environ.get("EDGE_VOICE") or TTS.get("edge", {}).get("voice") or "es-ES-AlvaroNeural"
    rate = os.environ.get("EDGE_RATE") or TTS.get("edge", {}).get("rate") or "+0%"

    def synth(self, text, prev="", nxt=""):
        import asyncio, hashlib
        key = hashlib.sha1(json.dumps([text, self.voice, self.rate]).encode()).hexdigest()[:16]
        cache = CACHE_DIR / f"edge-{key}.json" if CACHE_DIR else None
        if cache and cache.exists():
            d = json.loads(cache.read_text(encoding="utf-8"))
        else:
            try:
                import truststore; truststore.inject_into_ssl()   # corporate TLS inspection: trust the OS store
            except ImportError:
                pass
            import edge_tts

            async def go():
                c = edge_tts.Communicate(text, self.voice, rate=self.rate, boundary="WordBoundary")
                mp3, wb = b"", []
                async for ch in c.stream():
                    if ch["type"] == "audio":
                        mp3 += ch["data"]
                    elif ch["type"] == "WordBoundary":
                        wb.append([ch["offset"] / 1e7, ch["text"]])
                return mp3, wb
            mp3, wb = asyncio.run(go())
            d = {"audio_base64": base64.b64encode(mp3).decode(), "words": wb}
            if cache:
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_text(json.dumps(d), encoding="utf-8")
        mp3 = base64.b64decode(d["audio_base64"])
        pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(EL_SR), "pipe:1"],
                             input=mp3, capture_output=True, check=True).stdout
        x = np.frombuffer(pcm, dtype=np.float32).copy()
        idx = np.where(np.abs(x) > 0.01)[0]
        if len(idx):
            x = x[: min(len(x), idx[-1] + int(0.08 * EL_SR))]
        # map each word boundary onto the characters of the spoken text
        starts, pos, last = [0.0] * len(text), 0, 0.0
        for t0, w in d["words"]:
            j = text.find(w, pos)
            if j < 0:
                continue
            for c in range(pos, j + len(w)):
                starts[c] = t0 if c >= j else last
            pos, last = j + len(w), t0
        for c in range(pos, len(text)):
            starts[c] = last
        return x, EL_SR, list(zip(text, starts))


class SilentTTS:
    """No voice: silence sized by words-per-minute, words spread by character length. For previews."""
    atempo = 1.0

    def synth(self, text, prev="", nxt=""):
        n = max(1, len(text.split()))
        d = max(0.8, n * 60.0 / WPM)
        sr = 24000
        x = np.zeros(int(d * sr), dtype=np.float32)
        total = max(1, len(text))
        return x, sr, [(c, d * i / total) for i, c in enumerate(text)]


def word_spans(sent):
    """display words of a raw sentence, each with its (start, end) char span in the spoken string"""
    out, spoken, pos = [], "", 0
    for m in list(OVERRIDE.finditer(sent)) + [None]:
        plain = sent[pos:m.start()] if m else sent[pos:]
        for w in re.finditer(r"\S+", plain):
            a = len(spoken) + w.start()
            out.append((w.group(), a, a + len(w.group())))
        spoken += plain
        if m:
            a = len(spoken)
            spoken += m.group(2)
            for dw in m.group(1).split():
                out.append((dw, a, len(spoken)))
            pos = m.end()
    return out, spoken


def parse(md: str):
    segs, cur = [], None
    for line in md.splitlines():
        m = re.match(r"^##\s+(\w+)\s*$", line)
        if m:
            cur = {"name": m.group(1), "paras": [], "buf": []}
            segs.append(cur)
        elif cur is not None:
            if line.strip():
                cur["buf"].append(line.strip())
            elif cur["buf"]:
                cur["paras"].append(" ".join(cur["buf"]))
                cur["buf"] = []
    for s in segs:
        if s["buf"]:
            s["paras"].append(" ".join(s.pop("buf")))
        s.pop("buf", None)
    return segs


def sentences(para: str):
    # split after . ! ? … when the next sentence opens with an uppercase letter (any script), ¿ ¡ quotes or {
    return [s for s in SENT_SPLIT.split(para) if s.strip()]


SENT_SPLIT = re.compile(r"(?<=[.!?…])\s+(?=[¿¡\"'{«“]|[A-ZÀ-ÖØ-ÞĀ-ſΑ-ΩА-Я])")


def display(s): return OVERRIDE.sub(lambda m: m.group(1), s)
def spoken(s): return OVERRIDE.sub(lambda m: m.group(2), s)


def rms(path: Path, fps: int = 30):
    """per-frame loudness 0..1 (normalised to the segment's 95th percentile) — drives mouths, meters, pulses"""
    data, sr = sf.read(path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    hop = sr // fps
    n = len(data) // hop
    v = np.sqrt(np.mean(data[: n * hop].reshape(n, hop) ** 2, axis=1))
    ref = np.percentile(v, 95) or 1.0
    return [round(float(min(1.0, x / ref)), 3) for x in v]


def make_tts(engine):
    return {"elevenlabs": ElevenTTS, "edge": EdgeTTS, "kokoro": KokoroTTS, "none": SilentTTS}.get(engine, EdgeTTS)()


def check():
    """one short sentence through the configured engine; never prints keys"""
    args = sys.argv[1:]
    engine = args[args.index("--tts") + 1] if "--tts" in args else ENGINE
    if engine == "elevenlabs":
        k = os.environ.get("ELEVENLABS_API_KEY", "")
        print(f"key: {'set' if k else 'MISSING'} ({len(k)} chars) · voice {EL_VOICE or 'MISSING'} · model {EL_MODEL}")
    elif engine == "edge":
        print(f"edge voice {EdgeTTS.voice} · rate {EdgeTTS.rate}")
    samples, sr, align = make_tts(engine).synth("Esto es una prueba de la voz de narración.")
    print(f"OK [{engine}]: {len(samples) / sr:.2f}s of audio, {len(align or [])} aligned characters")


def main():
    if "--check" in sys.argv:
        return check()
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    global ENGINE
    args = sys.argv[1:]
    if "--tts" in args:
        i = args.index("--tts"); ENGINE = args[i + 1]; del args[i:i + 2]
    ep = Path(args[0]).resolve()
    only = set(args[1:])
    md = (ep / "narration.md").read_text(encoding="utf-8")
    m = re.search(r"^tts:\s*(\w+)\s*$", md.split("\n## ", 1)[0], re.M)
    if m and "--tts" not in sys.argv:
        ENGINE = m.group(1)
    segs = parse(md)
    global CACHE_DIR
    CACHE_DIR = ep / "audio" / ".cache"
    out = ep / "audio"
    out.mkdir(exist_ok=True)
    tpath = out / "timings.json"
    prev = {s["name"]: s for s in json.loads(tpath.read_text(encoding="utf-8"))["segments"]} if tpath.exists() else {}

    tts = make_tts(ENGINE)
    AT = tts.atempo
    result = []
    for i, seg in enumerate(segs, 1):
        name = seg["name"]
        fname = f"{i:02d}-{name}.wav"
        if only and name not in only and name in prev:
            result.append({**prev[name], "file": fname})
            continue
        chunks, sents, cursor, sr = [], [], 0.0, 24000
        flat = [(pi, s_) for pi, para in enumerate(seg["paras"]) if not PAUSE.match(para.strip()) for s_ in sentences(para)]
        k = 0
        for pi, para in enumerate(seg["paras"]):
            pm = PAUSE.match(para.strip())
            if pm:      # silence measured post-atempo, so the scene gets exactly N seconds
                n = float(pm.group(1)) * AT
                chunks.append(np.zeros(int(n * sr), dtype=np.float32))
                cursor += n
                continue
            for si, sent in enumerate(sentences(para)):
                prev_t = spoken(flat[k - 1][1]) if k > 0 else ""
                next_t = spoken(flat[k + 1][1]) if k + 1 < len(flat) else ""
                k += 1
                samples, sr_new, align = tts.synth(spoken(sent), prev_t, next_t)
                if sr_new != sr and chunks:
                    sys.exit("sample rate changed mid-segment")
                sr = sr_new
                if sents:
                    gap = PARA_GAP if si == 0 else SENT_GAP
                    chunks.append(np.zeros(int(gap * sr), dtype=np.float32))
                    cursor += gap
                d = len(samples) / sr
                shown = display(sent)
                spans, spk = word_spans(sent)
                wt = []
                if align and len(align) >= len(spk.strip()) * 0.8:
                    starts = [t for _, t in align]
                    at = lambda c: starts[min(c, len(starts) - 1)]
                    for j, (w, a, b) in enumerate(spans):
                        ws = cursor + at(a)
                        we = cursor + (at(spans[j + 1][1]) if j + 1 < len(spans) else d)
                        wt.append({"w": w, "start": ws / AT, "end": we / AT})
                else:
                    weights = [len(w) + 1 for w, _, _ in spans]
                    total, acc = sum(weights), 0.0
                    for (w, _, _), kk in zip(spans, weights):
                        ws = cursor + d * acc / total
                        acc += kk
                        wt.append({"w": w, "start": ws / AT, "end": (cursor + d * acc / total) / AT})
                sents.append({"text": shown, "para": pi, "start": cursor / AT, "end": (cursor + d) / AT, "words": wt})
                chunks.append(samples.astype(np.float32))
                cursor += d
        raw = out / f".{fname}.raw.wav"
        sf.write(raw, np.concatenate(chunks), sr, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", f"atempo={AT}", "-ar", "48000", str(out / fname)], check=True)
        raw.unlink()
        dur = float(subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", str(out / fname)],
                                   capture_output=True, text=True).stdout)
        for s in sents:
            s["start"], s["end"] = round(s["start"], 3), round(s["end"], 3)
            for w in s["words"]:
                w["start"], w["end"] = round(w["start"], 3), round(w["end"], 3)
        result.append({"name": name, "file": fname, "duration": round(dur, 3), "sentences": sents, "rms": rms(out / fname)})
        words = sum(len(s["words"]) for s in sents)
        print(f"  {fname:28s} {dur:6.1f}s  {len(sents):2d} sentences  {words:4d} words")

    tpath.write_text(json.dumps({"fps": 30, "tail": TAIL, "tts": ENGINE, "voice": EL_VOICE if ENGINE == "elevenlabs" else EdgeTTS.voice if ENGINE == "edge" else VOICE if ENGINE == "kokoro" else "none", "atempo": AT, "segments": result}, indent=1), encoding="utf-8")
    total = sum(s["duration"] + TAIL for s in result)
    print(f"  total {total:.1f}s ({total/60:.2f} min) -> {tpath.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
