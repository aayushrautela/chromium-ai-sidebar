#!/usr/bin/env python3
"""
Simple script to create basic icons for the Chrome extension
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    margin = size // 8
    center = size // 2
    
    # Draw a circle background
    draw.ellipse([margin, margin, size-margin, size-margin], 
                 fill=(0, 123, 255, 255), outline=(0, 100, 200, 255), width=2)
    
    # Draw a simple "G" for Gemini
    try:
        # Try to use a system font
        font_size = size // 3
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    # Get text dimensions
    bbox = draw.textbbox((0, 0), "G", font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Center the text
    text_x = center - text_width // 2
    text_y = center - text_height // 2
    
    # Draw the "G"
    draw.text((text_x, text_y), "G", fill=(255, 255, 255, 255), font=font)
    
    # Save the image
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    # Create icons directory if it doesn't exist
    os.makedirs('icons', exist_ok=True)
    
    # Create different sizes
    sizes = [16, 32, 48, 128]
    for size in sizes:
        create_icon(size, f'icons/icon{size}.png')

if __name__ == '__main__':
    main()
