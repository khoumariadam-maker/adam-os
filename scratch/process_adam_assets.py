import os
import shutil
from PIL import Image

# Directories
src_root = 'adam_assets'
dst_root = 'public'

os.makedirs('public/mascot', exist_ok=True)
os.makedirs('public/icons', exist_ok=True)
os.makedirs('public/wallpapers', exist_ok=True)
os.makedirs('public/fonts', exist_ok=True)
os.makedirs('public/resumes', exist_ok=True)

# Copy PDFs
if os.path.exists(os.path.join(src_root, 'Khoumari_Adam_CV_EN.pdf')):
    shutil.copy(os.path.join(src_root, 'Khoumari_Adam_CV_EN.pdf'), 'public/resumes/Khoumari_Adam_CV_EN.pdf')
    shutil.copy(os.path.join(src_root, 'Khoumari_Adam_CV_EN.pdf'), 'public/Khoumari_Adam_Resume_EN.pdf')

if os.path.exists(os.path.join(src_root, 'Khoumari_Adam_CV_AR.pdf')):
    shutil.copy(os.path.join(src_root, 'Khoumari_Adam_CV_AR.pdf'), 'public/resumes/Khoumari_Adam_CV_AR.pdf')
    shutil.copy(os.path.join(src_root, 'Khoumari_Adam_CV_AR.pdf'), 'public/Khoumari_Adam_Resume_AR.pdf')

# Copy Font
if os.path.exists(os.path.join(src_root, 'PixelAE-Bold.ttf')):
    shutil.copy(os.path.join(src_root, 'PixelAE-Bold.ttf'), 'public/fonts/PixelAE-Bold.ttf')

# Map Mascots
mascot_dir = os.path.join(src_root, 'mascots')
if os.path.exists(mascot_dir):
    files = os.listdir(mascot_dir)
    for f in files:
        src_path = os.path.join(mascot_dir, f)
        if 'celebrating' in f:
            shutil.copy(src_path, 'public/mascot/celebrating-01.png')
        elif 'loading' in f:
            shutil.copy(src_path, 'public/mascot/loading-01.png')
        elif 'mascot' in f:
            shutil.copy(src_path, 'public/mascot/idle-01.png')
            shutil.copy(src_path, 'public/mascot/adam-portrait.png')
        elif 'sitting' in f and 'Spider-Adam' not in f:
            shutil.copy(src_path, 'public/mascot/sleeping-01.png')
        elif 'swinging' in f:
            shutil.copy(src_path, 'public/mascot/swinging-01.png')
        elif 'typing' in f:
            shutil.copy(src_path, 'public/mascot/typing-01.png')
        elif 'Spider-Adam_sitting' in f:
            shutil.copy(src_path, 'public/mascot/waving-01.png')
        elif 'sleeping' in f:
            shutil.copy(src_path, 'public/mascot/blink-01.png')

# Map Icons
icon_dir = os.path.join(src_root, 'icons')
if os.path.exists(icon_dir):
    files = os.listdir(icon_dir)
    mapping = {
        'Nav_icon_information': 'nav-about',
        'Briefcase_icon': 'nav-projects',
        'Downloads_nav_icon': 'nav-downloads',
        'Contact_nav_icon': 'nav-contact',
        'Home_nav_icon': 'nav-home',
        'Gear_symbol': 'nav-skills',
        'Stack_of_documents': 'nav-experience',
        'PDF_document': 'file-pdf',
        'Zip_archive': 'file-zip',
        'DOC_document': 'file-doc',
        'Manila_folder_icon': 'ui-folder-closed',
        'Open_manila_folder': 'ui-folder-open',
        'Terminal_window': 'ui-terminal',
        'AI_spark': 'ui-ai-spark',
        'Close_window_X': 'ui-close',
        'Start_menu_logo': 'ui-start-logo',
        'Octocat_silhouette': 'social-github-default',
        'LinkedIn_social': 'social-linkedin',
        'Email_envelope': 'social-email',
        'Arrow_pointing': 'social-external',
    }
    for f in files:
        src_path = os.path.join(icon_dir, f)
        for key, target_name in mapping.items():
            if key in f:
                shutil.copy(src_path, f'public/icons/{target_name}.png')

# Map Backgrounds
bg_dir = os.path.join(src_root, 'backgrounds')
if os.path.exists(bg_dir):
    files = os.listdir(bg_dir)
    for f in files:
        src_path = os.path.join(bg_dir, f)
        if 'night_cityscape' in f and f.endswith('.jpeg'):
            shutil.copy(src_path, 'public/wallpapers/night-city-16x9.jpg')
        elif 'cyberpunk_forest' in f or 'Cyberpunk_forest' in f:
            shutil.copy(src_path, 'public/wallpapers/cyber-forest-16x9.jpg')
        elif 'mountain_range' in f:
            shutil.copy(src_path, 'public/wallpapers/pixel-mountains-16x9.jpg')
        elif 'Y2K_pattern_desktop' in f:
            shutil.copy(src_path, 'public/wallpapers/y2k-pattern-16x9.jpg')

print("Copied all real assets from adam_assets to public/!")
