"""Compare unaligned forest images by masked luminance, never pixel error."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'qa' / 'atm-01'
inputs = {'target': root/'references'/'target-forest.png', 'user_game': root/'references'/'user-game.png'}
for filename in sys.argv[1:]:
    p = Path(filename)
    inputs[p.parent.name + '/' + p.stem] = p
results = {}
for name, filename in inputs.items():
    rgb = np.asarray(Image.open(filename).convert('RGB'), dtype=np.float32)/255
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    # Identical normalized crop plus known HUD corners. Preserve the target's
    # bright clearing; geometry is unaligned so these are diagnostics only.
    mask = (yy > h*.10) & (yy < h*.86) & (xx > w*.02) & (xx < w*.98)
    mask &= ~((xx < w*.24) & (yy < h*.25))
    mask &= ~((xx > w*.85) & (yy > h*.63))
    pixels = rgb[mask]
    display = pixels @ np.array([.2126,.7152,.0722])
    linear_rgb = np.where(pixels <= .04045, pixels/12.92, ((pixels+.055)/1.055)**2.4)
    linear = linear_rgb @ np.array([.2126,.7152,.0722])
    maximum, minimum = pixels.max(axis=1), pixels.min(axis=1)
    sat = (maximum-minimum)/np.maximum(maximum, .0001)
    results[name] = {'path':str(filename.resolve()), 'size':[w,h], 'pixels':int(mask.sum()),
        'display_mean':float(display.mean()), 'display_std':float(display.std()),
        'display_percentiles':dict(zip(['p10','p50','p90','p95','p99'],map(float,np.percentile(display,[10,50,90,95,99])))),
        'linear_mean':float(linear.mean()), 'fraction_above_0_9':float((display>.9).mean()),
        'mean_saturation':float(sat.mean())}
result = {'method':'same normalized HUD exclusion; unaligned image distributions are descriptive, not an acceptance score', 'images':results}
(root/'reference-analysis.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print(json.dumps(result,indent=2))
