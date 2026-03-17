"""
以純 Python 程式化生成最小有效 PNG 圖示（無需第三方套件）
在沒有圖示素材時使用，產出 icons/icon16.png、icon48.png、icon128.png
"""
import struct, zlib, os

def make_solid_png(size, rgb):
    r, g, b = rgb
    raw = b''
    for _ in range(size):
        row = bytes([r, g, b, 255] * size)
        raw += b'\x00' + row
    compressed = zlib.compress(raw)
    def chunk(name, data):
        crc = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', crc)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0]))
    idat = chunk(b'IDAT', compressed)
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(make_solid_png(size, (49, 130, 206)))  # 藍色
    print(f'Generated icons/icon{size}.png')
