import os
from PIL import Image, ImageDraw

# Create target directories
os.makedirs('public/mascot', exist_ok=True)
os.makedirs('public/icons', exist_ok=True)
os.makedirs('public/wallpapers', exist_ok=True)
os.makedirs('public/decor', exist_ok=True)

# Locked 10-token palette
PALETTE = {
    'base':     (11, 11, 16, 255),      # #0B0B10
    'panel':    (23, 23, 34, 255),      # #171722
    'panel2':   (31, 31, 46, 255),      # #1f1f2e
    'spidey':   (33, 44, 244, 255),     # #212CF4
    'text':     (255, 255, 255, 255),   # #FFFFFF
    'textDim':  (225, 226, 231, 255),   # #E1E2E7
    'lavender': (195, 198, 237, 255),   # #C3C6ED
    'green':    (114, 255, 180, 255),   # #72FFB4
    'red':      (255, 58, 102, 255),    # #FF3A66
    'yellow':   (255, 229, 92, 255),    # #FFE55C
    'slate':    (176, 179, 188, 255),   # #B0B3BC
    'black':    (11, 11, 16, 255),
    'trans':    (0, 0, 0, 0),
}

def draw_pixel_spider(img_size=256, expression='idle'):
    img = Image.new('RGBA', (img_size, img_size), PALETTE['trans'])
    draw = ImageDraw.Draw(img)
    scale = img_size / 32.0

    # Chibi proportions on 32x32 pixel grid
    # Head: center (16, 14), radius 9
    head_cx, head_cy, r = 16, 14, 8
    
    # Body
    for x in range(32):
        for y in range(32):
            dx = x - head_cx
            dy = y - head_cy
            if dx*dx + dy*dy <= r*r:
                draw.rectangle([x*scale, y*scale, (x+1)*scale, (y+1)*scale], fill=PALETTE['base'])
    
    # Body lower blob
    for x in range(12, 21):
        for y in range(22, 28):
            draw.rectangle([x*scale, y*scale, (x+1)*scale, (y+1)*scale], fill=PALETTE['base'])

    # Outline (1px black)
    for x in range(32):
        for y in range(32):
            dx = x - head_cx
            dy = y - head_cy
            dist = dx*dx + dy*dy
            if dist > (r-1)*(r-1) and dist <= (r+1)*(r+1):
                draw.rectangle([x*scale, y*scale, (x+1)*scale, (y+1)*scale], fill=PALETTE['spidey'])

    # Cobalt Web Pattern lines on head
    web_y = [8, 11, 14, 17]
    for wy in web_y:
        for wx in range(10, 23):
            if (wx - head_cx)**2 + (wy - head_cy)**2 <= r*r:
                draw.rectangle([wx*scale, wy*scale, (wx+1)*scale, (wy+0.5)*scale], fill=PALETTE['spidey'])

    # White Lens Eyes
    eye_y = 12
    if expression == 'blink':
        # Slit eyes
        draw.rectangle([11*scale, 14*scale, 15*scale, 15*scale], fill=PALETTE['text'])
        draw.rectangle([18*scale, 14*scale, 22*scale, 15*scale], fill=PALETTE['text'])
    elif expression == 'celebrating':
        # Star / Up-curved eyes
        draw.rectangle([11*scale, 12*scale, 15*scale, 16*scale], fill=PALETTE['green'])
        draw.rectangle([18*scale, 12*scale, 22*scale, 16*scale], fill=PALETTE['green'])
    else:
        # Standard white oval lenses
        draw.rectangle([11*scale, 12*scale, 15*scale, 16*scale], fill=PALETTE['text'])
        draw.rectangle([18*scale, 12*scale, 22*scale, 16*scale], fill=PALETTE['text'])
        draw.rectangle([12*scale, 13*scale, 14*scale, 15*scale], fill=PALETTE['base'])
        draw.rectangle([19*scale, 13*scale, 21*scale, 15*scale], fill=PALETTE['base'])

    return img

def create_icon(name, symbol='EXE', color=PALETTE['spidey']):
    img = Image.new('RGBA', (64, 64), PALETTE['trans'])
    draw = ImageDraw.Draw(img)

    # 9x Beveled Box Icon Surface
    draw.rectangle([4, 4, 59, 59], fill=PALETTE['panel'], outline=PALETTE['slate'], width=2)
    draw.rectangle([6, 6, 57, 57], fill=PALETTE['panel2'])

    # Symbol fill
    draw.rectangle([16, 16, 47, 47], fill=color)
    draw.rectangle([18, 18, 45, 45], fill=PALETTE['panel'])
    
    # 2px black outline
    draw.rectangle([4, 4, 59, 59], outline=PALETTE['black'], width=1)

    return img

# Generate Mascot frames
frames = ['idle', 'blink', 'loading', 'celebrating', 'sleeping', 'typing', 'waving', 'swinging']
for frame in frames:
    spider_img = draw_pixel_spider(256, frame)
    spider_img.save(f'public/mascot/{frame}-01.png')

# Portrait
draw_pixel_spider(256, 'idle').save('public/mascot/adam-portrait.png')

# Generate Icons
icon_names = [
    'nav-about', 'nav-projects', 'nav-skills', 'nav-experience', 'nav-downloads', 'nav-contact', 'nav-home',
    'file-pdf', 'file-zip', 'file-doc', 'ui-folder-closed', 'ui-folder-open', 'ui-terminal', 'ui-ai-spark',
    'ui-close', 'ui-start-logo', 'social-github-default', 'social-linkedin', 'social-email', 'social-external'
]

for name in icon_names:
    color = PALETTE['spidey']
    if 'pdf' in name or 'close' in name:
        color = PALETTE['red']
    elif 'terminal' in name:
        color = PALETTE['green']
    elif 'zip' in name or 'start' in name:
        color = PALETTE['yellow']

    icon_img = create_icon(name, color=color)
    icon_img.save(f'public/icons/{name}.png')

print("All pixel assets generated successfully!")
