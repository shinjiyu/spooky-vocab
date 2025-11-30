# Icons

This folder should contain the extension icons:

- `icon16.png` - 16x16 pixels (toolbar)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Temporary Solution

For development and testing, you can:

1. Use any PNG images of the required sizes
2. Create simple colored squares as placeholders
3. Or use online tools like:
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/

## Recommended Icon Design

The icon should represent:
- Language learning
- Translation
- Book or text symbol
- Use colors: #667eea (purple-blue) as primary color

## Quick Generate Command (if you have ImageMagick)

```bash
# Create simple colored square icons
convert -size 16x16 xc:'#667eea' icon16.png
convert -size 48x48 xc:'#667eea' icon48.png
convert -size 128x128 xc:'#667eea' icon128.png
```

