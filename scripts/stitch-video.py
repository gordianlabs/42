#!/usr/bin/env python3
"""
Stitch all clips in public/video/ into a single birthday.mp4.
Clips play in full — no content is cut. Brief fade-in/out at each boundary.

Usage:
  python3 scripts/stitch-video.py
  python3 scripts/stitch-video.py --fade 0.25 --fps 30 --width 720 --height 1280
  python3 scripts/stitch-video.py --music public/video/music.mp3 --music-vol 0.18

Clips are processed in alphabetical order — rename files to control order.
Output: public/video/birthday.mp4
"""

import subprocess, sys, argparse
from pathlib import Path

ROOT = Path(__file__).parent.parent
VIDEO_DIR = ROOT / 'public' / 'video'
OUTPUT = VIDEO_DIR / 'birthday.mp4'
EXTS = {'.mp4', '.mov', '.m4v', '.avi', '.mkv'}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--fade', type=float, default=0.25, help='Fade in/out duration at clip boundaries')
    p.add_argument('--fps', type=int, default=30)
    p.add_argument('--width', type=int, default=720)
    p.add_argument('--height', type=int, default=1280)
    p.add_argument('--music', default=None)
    p.add_argument('--music-vol', type=float, default=0.18)
    return p.parse_args()


def get_duration(path: Path) -> float:
    r = subprocess.run(
        ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
         '-of', 'csv=p=0', str(path)],
        capture_output=True, text=True
    )
    return float(r.stdout.strip())


def build_filter(clips, fade, fps, w, h, music_path=None, music_vol=0.18):
    n = len(clips)
    lines = []

    # ── Normalize each clip: blur bg + centered fg, full content preserved ──
    for i, (_, dur) in enumerate(clips):
        fade_out_start = max(0.0, dur - fade)

        lines += [
            f'[{i}:v]split=2[bg{i}s][fg{i}s];',
            # Blurred background: scale to fill, crop
            f'[bg{i}s]fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase,'
            f'crop={w}:{h},boxblur=20:5[bg{i}];',
            # Foreground: scale to fit, centered
            f'[fg{i}s]fps={fps},scale={w}:{h}:force_original_aspect_ratio=decrease,'
            f'setsar=1[fg{i}];',
            f'[bg{i}][fg{i}]overlay=(W-w)/2:(H-h)/2,'
            # Fade in at start, fade out at end (within the clip — no content removed)
            f'fade=t=in:st=0:d={fade},fade=t=out:st={fade_out_start:.3f}:d={fade}[v{i}];',
        ]

        # Audio fade to match
        lines += [
            f'[{i}:a]afade=t=in:st=0:d={fade},'
            f'afade=t=out:st={fade_out_start:.3f}:d={fade}[a{i}];',
        ]

    # ── Concat all normalized clips (video and audio together) ──
    v_inputs = ''.join(f'[v{i}]' for i in range(n))
    a_inputs = ''.join(f'[a{i}]' for i in range(n))
    lines.append(f'{v_inputs}concat=n={n}:v=1:a=0[outv];')
    lines.append(f'{a_inputs}concat=n={n}:v=0:a=1[voice];')

    # ── Optional background music ──
    total_dur = sum(dur for _, dur in clips)
    music_idx = n
    if music_path:
        lines += [
            f'[{music_idx}:a]aloop=loop=-1:size=2e9,atrim=duration={total_dur:.3f},'
            f'volume={music_vol:.2f}[music];',
            f'[voice][music]amix=inputs=2:duration=first:dropout_transition=2[outa]',
        ]
    else:
        lines.append('[voice]acopy[outa]')

    return '\n'.join(lines)


def main():
    args = parse_args()

    clips_paths = sorted(
        p for p in VIDEO_DIR.iterdir()
        if p.suffix.lower() in EXTS and p.name != 'birthday.mp4'
    )

    if not clips_paths:
        print('No clips found in public/video/  (supported: mp4 mov m4v avi mkv)')
        sys.exit(1)

    print(f'Stitching {len(clips_paths)} clips in order:')
    clips = []
    for p in clips_paths:
        dur = get_duration(p)
        print(f'  {p.name:45s}  {dur:.3f}s')
        clips.append((p, dur))

    total = sum(d for _, d in clips)
    print(f'  {"TOTAL":45s}  {total:.3f}s')

    music_path = Path(args.music) if args.music else None
    if music_path and not music_path.exists():
        print(f'Music file not found: {music_path}')
        sys.exit(1)

    filter_complex = build_filter(
        clips, args.fade, args.fps, args.width, args.height,
        music_path, args.music_vol
    )

    cmd = ['ffmpeg', '-y']
    for p, _ in clips:
        cmd += ['-i', str(p)]
    if music_path:
        cmd += ['-i', str(music_path)]

    cmd += [
        '-filter_complex', filter_complex,
        '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'aac', '-ar', '44100', '-b:a', '128k',
        '-movflags', '+faststart',
        str(OUTPUT),
    ]

    print(f'\nOutputting → {OUTPUT.relative_to(ROOT)}')
    result = subprocess.run(cmd)
    if result.returncode == 0:
        size = OUTPUT.stat().st_size / 1_000_000
        print(f'\nDone — birthday.mp4  ({size:.1f} MB,  {total:.1f}s)')
    else:
        print('\nffmpeg failed — see output above')
        sys.exit(1)


if __name__ == '__main__':
    main()
