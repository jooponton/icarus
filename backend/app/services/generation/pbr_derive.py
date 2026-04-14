"""Derive PBR auxiliary maps (normal, roughness, ambient occlusion) from a
single albedo texture via image processing.

No ML — just numpy + OpenCV. This is an approximation, not a real photogrammetry
scan, but it adds actual surface response to the rendered material: the normal
map makes lighting react to the albedo's luminance gradients (mortar between
bricks, wood grain, concrete roughness), the roughness map varies reflectivity
based on local texture variance, and the AO map darkens crevices.

For true photoreal materials we'd want a retrieval library of AmbientCG/PolyHaven
PBR packs, but the derive path works for *any* freeform material since it only
needs the albedo that diffusion already produced.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class PbrStack:
    albedo: Image.Image
    normal: Image.Image
    roughness: Image.Image
    ao: Image.Image


def _to_linear_gray(img: Image.Image) -> np.ndarray:
    """sRGB image → linear-ish grayscale in [0, 1]."""
    arr = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    # Approximate sRGB → linear
    lin = np.where(arr <= 0.04045, arr / 12.92, ((arr + 0.055) / 1.055) ** 2.4)
    # Luminance (Rec. 709)
    gray = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    return gray


def _derive_height(gray: np.ndarray) -> np.ndarray:
    """Treat luminance as a depth proxy and high-pass it so only local
    detail (mortar lines, grain, grooves) contributes to the bump."""
    # High-pass via subtracting a large-radius blur.
    blur = cv2.GaussianBlur(gray, (0, 0), sigmaX=gray.shape[1] * 0.04)
    high_pass = gray - blur
    # Normalize to [-1, 1]
    mx = float(max(np.abs(high_pass).max(), 1e-6))
    return (high_pass / mx).astype(np.float32)


def _derive_normal(height: np.ndarray, strength: float = 2.5) -> Image.Image:
    """Tangent-space normal map from a height field via Sobel."""
    gx = cv2.Sobel(height, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(height, cv2.CV_32F, 0, 1, ksize=3)
    # Normal vector: (-dH/dx, -dH/dy, 1/strength), normalized.
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    nx /= length
    ny /= length
    nz /= length
    # Encode to [0, 255]. GL convention: y up.
    r = ((nx * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    g = ((ny * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    b = ((nz * 0.5 + 0.5) * 255.0).clip(0, 255).astype(np.uint8)
    rgb = np.stack([r, g, b], axis=-1)
    return Image.fromarray(rgb, mode="RGB")


def _derive_roughness(gray: np.ndarray, base: float = 0.75) -> Image.Image:
    """High local variance → rougher (smaller reflections).
    base is the mean roughness when the texture is flat."""
    # Local std over a small window as a proxy for surface variation.
    mean = cv2.GaussianBlur(gray, (0, 0), sigmaX=3.0)
    mean_sq = cv2.GaussianBlur(gray * gray, (0, 0), sigmaX=3.0)
    var = np.clip(mean_sq - mean * mean, 0, None)
    std = np.sqrt(var)
    # Normalize to [0, 1]
    mx = float(max(std.max(), 1e-6))
    std = std / mx
    # Combine base roughness with variance-driven detail.
    rough = np.clip(base + (std - 0.5) * 0.4, 0.15, 1.0)
    return Image.fromarray((rough * 255.0).astype(np.uint8), mode="L")


def _derive_ao(gray: np.ndarray) -> Image.Image:
    """Multi-scale blur difference darkens crevices — cheap AO approximation."""
    blur_small = cv2.GaussianBlur(gray, (0, 0), sigmaX=4.0)
    blur_large = cv2.GaussianBlur(gray, (0, 0), sigmaX=24.0)
    ao = 1.0 - np.clip((blur_large - blur_small) * 3.0, 0, 1)
    # Keep most of the range bright so it modulates rather than dominates.
    ao = 0.5 + ao * 0.5
    return Image.fromarray((np.clip(ao, 0, 1) * 255.0).astype(np.uint8), mode="L")


def derive_pbr_stack(albedo: Image.Image) -> PbrStack:
    """Given an albedo PIL image, synthesize normal + roughness + AO maps."""
    gray = _to_linear_gray(albedo)
    height = _derive_height(gray)
    normal = _derive_normal(height)
    roughness = _derive_roughness(gray)
    ao = _derive_ao(gray)
    return PbrStack(albedo=albedo, normal=normal, roughness=roughness, ao=ao)
