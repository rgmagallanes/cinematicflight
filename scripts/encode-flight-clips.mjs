#!/usr/bin/env node
// Re-encodes the flight clips for scroll scrubbing.
//
// The source exports ran at ~22 Mbit/s (720p) and ~5.5 Mbit/s (480p), which no
// visitor can stream while the hero seeks on every scroll frame. These settings
// hold the same dense keyframe spacing the scrubbing needs but at a third of
// the bytes. Originals are kept alongside as *.orig.mp4.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flight = path.join(root, "public", "assets", "flight");
const originals = path.join(root, "media-src", "flight");

const variants = [
  { dir: flight, src: originals, crf: 30, label: "mobile" },
  { dir: path.join(flight, "desktop"), src: path.join(originals, "desktop"), crf: 28, label: "desktop" },
];

const kb = (file) => Math.round(statSync(file).size / 1024);

for (const { dir, src, crf, label } of variants) {
  mkdirSync(src, { recursive: true });
  for (let index = 1; index <= 6; index += 1) {
    const target = path.join(dir, `f${index}.mp4`);
    const original = path.join(src, `f${index}.mp4`);
    if (!existsSync(original)) renameSync(target, original);

    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-i", original,
      "-an",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", String(crf),
      // ~0.33s keyframe spacing at 24fps: close enough that a scrub seek never
      // decodes a long run of inter frames.
      "-g", "8", "-keyint_min", "8", "-sc_threshold", "0",
      "-pix_fmt", "yuv420p", "-profile:v", "high",
      "-movflags", "+faststart",
      target,
    ]);

    console.log(`${label} f${index}: ${kb(original)} KB -> ${kb(target)} KB`);
  }
}
