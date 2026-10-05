"use client";

import * as THREE from "three";

export interface CardTexture {
  texture: THREE.Texture;
  size: THREE.Vector2;
  dispose: () => void;
}

/** loads an mp4 as a looping video texture (or image texture for stills) */
export async function loadCardTexture(src: string): Promise<CardTexture> {
  if (/\.(jpe?g|png|webp|avif|svg)$/i.test(src) || src.startsWith("data:image/")) {
    const tex = await new THREE.TextureLoader().loadAsync(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return {
      texture: tex,
      size: new THREE.Vector2(tex.image.width, tex.image.height),
      dispose: () => tex.dispose(),
    };
  }

  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve) => {
    if (video.readyState >= 2) return resolve();
    video.addEventListener("canplay", () => resolve(), { once: true });
    video.addEventListener("error", () => resolve(), { once: true });
    setTimeout(resolve, 8000);
  });

  try {
    await video.play();
  } catch {
    // autoplay may need a gesture; retry on first interaction
    const retry = () => {
      video.play().catch(() => {});
      window.removeEventListener("pointerdown", retry);
    };
    window.addEventListener("pointerdown", retry);
  }

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return {
    texture,
    size: new THREE.Vector2(video.videoWidth || 16, video.videoHeight || 9),
    dispose: () => {
      texture.dispose();
      video.pause();
      video.src = "";
    },
  };
}
