/**
 * A very small ZIP reader and writer, enough to bundle a handful of text files into one download
 * and read them back. Files are stored without compression when written; when reading, files
 * compressed by other tools (e.g. a backup that was unzipped and zipped again) are handled too.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fixed-size little-endian record builder. */
function record(size, fields) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  for (const [width, value] of fields) {
    if (width === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    offset += width;
  }
  return bytes;
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Build a ZIP from `[{ name, text }]`. Returns the bytes. */
export function zipFiles(files, date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const UTF8 = 0x0800;
  const local = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const crc = crc32(data);
    const shared = [
      [2, 20],
      [2, UTF8],
      [2, 0],
      [2, time],
      [2, day],
      [4, crc],
      [4, data.length],
      [4, data.length],
      [2, name.length],
      [2, 0],
    ];
    const header = record(30, [[4, 0x04034b50], ...shared]);
    local.push(header, name, data);
    central.push(
      record(46, [[4, 0x02014b50], [2, 20], ...shared, [2, 0], [2, 0], [2, 0], [4, 0], [4, offset]]),
      name,
    );
    offset += header.length + name.length + data.length;
  }
  const directory = concat(central);
  const end = record(22, [
    [4, 0x06054b50],
    [2, 0],
    [2, 0],
    [2, files.length],
    [2, files.length],
    [4, directory.length],
    [4, offset],
    [2, 0],
  ]);
  return concat([...local, directory, end]);
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Read a ZIP's files as `[{ name, text }]`. Folders inside the ZIP are flattened to file names. */
export async function unzipFiles(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a ZIP file');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('Damaged ZIP file');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const skip = view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const headerAt = view.getUint32(at + 42, true);
    const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + skip;
    if (path.endsWith('/')) continue;
    const start = headerAt + 30 + view.getUint16(headerAt + 26, true) + view.getUint16(headerAt + 28, true);
    const packed = bytes.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression in ${path}`);
    const data = method === 0 ? packed : await inflate(packed);
    files.push({ name: path.split('/').pop(), text: decoder.decode(data) });
  }
  return files;
}
