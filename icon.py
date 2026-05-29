from PIL import Image

# Open the master icon file
master = Image.open(r"C:/Users/ELaunch/OneDrive/nitin-p/support-finder/support_finder/support_finder_icon_original_Cropped.png")

# Target dimensions for Chrome Extensions
sizes = [16, 32, 48, 128]

for size in sizes:
    resized_img = master.resize((size, size), Image.Resampling.LANCZOS)
    resized_img.save(f"icon-{size}.png")
    print(f"Generated icon-{size}.png")
