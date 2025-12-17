# Required Images

This folder contains images for the portfolio site.

## Profile Image
- **File**: `profile.jpg` (or `.png`, `.webp`)
- **Location**: `/public/images/profile.jpg`
- **Recommended size**: 640x760px (or similar aspect ratio)
- **Used in**: Hero section

## Beyond the Code Images
Place these in `/public/images/beyond/`:

- **speaking.jpg** - Photo from a conference talk or meetup
- **mentoring.jpg** - Photo of team collaboration, pair programming, or teaching
- **opensource.jpg** - Could be a screenshot of GitHub contributions, code, or a creative representation

**Recommended size**: 800x500px (or similar 16:10 aspect ratio)

## Image Optimization

For best performance, optimize images before adding:

```bash
# Using ImageMagick
convert input.jpg -resize 800x500 -quality 85 output.jpg
```
