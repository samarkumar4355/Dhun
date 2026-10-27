#!/usr/bin/env python3
"""
Generate all Android launcher icons, adaptive icons, and splash icons
using the official 3D metallic gold Dhun logo (assets/images/dhun-gold-logo.jpg).
"""

import os
import glob
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_LOGO_PATH = os.path.join(BASE_DIR, 'assets', 'images', 'dhun-gold-logo.jpg')

def create_isolated_logo():
    src = Image.open(SRC_LOGO_PATH).convert('RGB')
    w, h = src.size
    arr = np.array(src, dtype=float)

    # Calculate luminance
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

    # Smooth alpha ramp for the gold symbol and ambient glow
    # Pixels with lum <= 12 are transparent; >= 42 are fully opaque
    alpha = np.clip((lum - 12.0) / 30.0 * 255.0, 0, 255).astype(np.uint8)

    # Radial falloff to prevent any corner artifacts
    y, x = np.ogrid[:h, :w]
    dist = np.sqrt((x - 512)**2 + (y - 512)**2)
    radial_falloff = np.clip((460.0 - dist) / 50.0, 0, 1.0)
    alpha = (alpha.astype(float) * radial_falloff).astype(np.uint8)

    rgba = np.dstack([arr.astype(np.uint8), alpha])
    logo_rgba = Image.fromarray(rgba, 'RGBA')

    # Crop to content bbox with a little breathing room
    bbox = logo_rgba.getbbox()
    cropped = logo_rgba.crop(bbox)
    return cropped

def make_adaptive_foreground(logo_cropped, size):
    """
    Android adaptive icon foreground: 108dp canvas.
    Safe zone is the inner 66% (72dp diameter).
    """
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    target_dim = int(size * 0.66)
    
    # Scale logo preserving aspect ratio
    lw, lh = logo_cropped.size
    scale = target_dim / max(lw, lh)
    nw = int(lw * scale)
    nh = int(lh * scale)
    
    resized = logo_cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    offset_x = (size - nw) // 2
    offset_y = (size - nh) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas

def make_background(size):
    """Deep obsidian / luxury black background matching Dhun design system"""
    bg = Image.new('RGBA', (size, size), (10, 9, 14, 255))
    return bg

def make_legacy_icon(logo_cropped, size, is_round=False):
    """
    Legacy icon (ic_launcher and ic_launcher_round)
    """
    bg = Image.new('RGBA', (size, size), (10, 9, 14, 255))
    target_dim = int(size * 0.76) if is_round else int(size * 0.72)
    lw, lh = logo_cropped.size
    scale = target_dim / max(lw, lh)
    nw = int(lw * scale)
    nh = int(lh * scale)
    resized = logo_cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    offset_x = (size - nw) // 2
    offset_y = (size - nh) // 2
    bg.paste(resized, (offset_x, offset_y), resized)

    # Mask for round icon
    if is_round:
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((1, 1, size - 2, size - 2), fill=255)
        # Add subtle gold rim
        rim = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rim_draw = ImageDraw.Draw(rim)
        rim_draw.ellipse((1, 1, size - 2, size - 2), outline=(229, 184, 66, 120), width=max(1, size // 48))
        bg.paste(rim, (0, 0), rim)
        
        output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        output.paste(bg, (0, 0), mask)
        return output
    else:
        # Rounded rect mask
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        r = int(size * 0.22)
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
        rim = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rim_draw = ImageDraw.Draw(rim)
        rim_draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, outline=(229, 184, 66, 100), width=max(1, size // 48))
        bg.paste(rim, (0, 0), rim)
        
        output = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        output.paste(bg, (0, 0), mask)
        return output

def make_monochrome(foreground_img):
    """Convert foreground to high-contrast monochrome for Android 13+ themed icons"""
    gray = foreground_img.convert('L')
    alpha = foreground_img.split()[-1]
    mono = Image.merge('LA', (gray, alpha)).convert('RGBA')
    return mono

def main():
    print('Extracting Dhun 3D Gold Logo...')
    logo_cropped = create_isolated_logo()
    print(f'Cropped logo dimension: {logo_cropped.size}')

    # 1. Update Expo Assets in assets/images/
    print('Generating assets/images/ icons...')
    # App icon 1024x1024
    icon_1024 = Image.open(SRC_LOGO_PATH).convert('RGB')
    icon_1024.save(os.path.join(BASE_DIR, 'assets', 'images', 'icon.png'), 'PNG')
    
    # Adaptive foreground 512x512
    fg_512 = make_adaptive_foreground(logo_cropped, 512)
    fg_512.save(os.path.join(BASE_DIR, 'assets', 'images', 'android-icon-foreground.png'), 'PNG')

    # Adaptive background 512x512
    bg_512 = make_background(512)
    bg_512.save(os.path.join(BASE_DIR, 'assets', 'images', 'android-icon-background.png'), 'PNG')

    # Monochrome 512x512
    mono_512 = make_monochrome(fg_512)
    mono_512.save(os.path.join(BASE_DIR, 'assets', 'images', 'android-icon-monochrome.png'), 'PNG')

    # Splash icon 512x512
    fg_512.save(os.path.join(BASE_DIR, 'assets', 'images', 'splash-icon.png'), 'PNG')

    # 2. Update Android Native Mipmap Resources
    mipmap_configs = {
        'mipmap-mdpi':    {'legacy': 48,  'adaptive': 108},
        'mipmap-hdpi':    {'legacy': 72,  'adaptive': 162},
        'mipmap-xhdpi':   {'legacy': 96,  'adaptive': 216},
        'mipmap-xxhdpi':  {'legacy': 144, 'adaptive': 324},
        'mipmap-xxxhdpi': {'legacy': 192, 'adaptive': 432},
    }

    res_dir = os.path.join(BASE_DIR, 'android', 'app', 'src', 'main', 'res')

    for folder, dims in mipmap_configs.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        leg_sz = dims['legacy']
        adp_sz = dims['adaptive']

        print(f'Processing {folder} (legacy={leg_sz}, adaptive={adp_sz})...')

        # ic_launcher.webp
        ic_launcher = make_legacy_icon(logo_cropped, leg_sz, is_round=False)
        ic_launcher.save(os.path.join(folder_path, 'ic_launcher.webp'), 'WEBP', quality=100)

        # ic_launcher_round.webp
        ic_launcher_round = make_legacy_icon(logo_cropped, leg_sz, is_round=True)
        ic_launcher_round.save(os.path.join(folder_path, 'ic_launcher_round.webp'), 'WEBP', quality=100)

        # ic_launcher_foreground.webp
        ic_fg = make_adaptive_foreground(logo_cropped, adp_sz)
        ic_fg.save(os.path.join(folder_path, 'ic_launcher_foreground.webp'), 'WEBP', quality=100)

        # ic_launcher_background.webp
        ic_bg = make_background(adp_sz)
        ic_bg.save(os.path.join(folder_path, 'ic_launcher_background.webp'), 'WEBP', quality=100)

        # ic_launcher_monochrome.webp
        ic_mono = make_monochrome(ic_fg)
        ic_mono.save(os.path.join(folder_path, 'ic_launcher_monochrome.webp'), 'WEBP', quality=100)

    # 3. Update Splashscreen drawables
    splash_configs = {
        'drawable-mdpi': 288,
        'drawable-hdpi': 432,
        'drawable-xhdpi': 576,
        'drawable-xxhdpi': 864,
        'drawable-xxxhdpi': 1152,
    }

    for folder, sz in splash_configs.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        splash_fg = make_adaptive_foreground(logo_cropped, sz)
        splash_fg.save(os.path.join(folder_path, 'splashscreen_logo.png'), 'PNG')

    print('All icons and splash resources generated successfully!')

if __name__ == '__main__':
    main()
