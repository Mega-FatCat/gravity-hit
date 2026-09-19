from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'qa'/'ground-fill-02'
views=['01-stream-banks','02-left-bank','03-right-ground','04-rear-ground']
w,h=960,580
out=Image.new('RGB',(w*2,h*len(views)+52),'#182019')
d=ImageDraw.Draw(out)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
d.text((20,12),'PRZED',font=font,fill='white'); d.text((w+20,12),'PO',font=font,fill='white')
for row,name in enumerate(views):
 for col,folder in enumerate(['before','final']):
  im=Image.open((root.parent/'ground-fill-01'/'final' if folder=='before' else root/'final-verified')/(name+'.png')).convert('RGB'); im.thumbnail((w,h))
  out.paste(im,(col*w,52+row*h))
out.save(root/'before-after.jpg',quality=93)


