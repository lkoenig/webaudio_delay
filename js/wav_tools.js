export function getDataAsWav(sampleRate, numChannels, data) {
  const wavHeader = generateWavHeader(sampleRate, numChannels, data);
  let waveBuffer = new Uint8Array(wavHeader.byteLength + data.byteLength);
  waveBuffer.set(new Uint8Array(wavHeader), 0);
  waveBuffer.set(new Uint8Array(data.buffer), wavHeader.byteLength);
  return waveBuffer;
}

/**
 * Returns a WAV header for the given format and data. The data is assumed to be
 * 32-bit float.
 */
function generateWavHeader(
  sampleRate,
  numChannels,
  data,
) {
  const BITS_PER_SAMPLE = 32;
  const HEADER_SIZE = 58;

  let dataSizeBytes = data.byteLength;

  const headerBuffer = new ArrayBuffer(HEADER_SIZE);
  const dataView = new DataView(headerBuffer);
  const setInt8 = (offset, value) => {
    dataView.setInt8(offset, value);
  };
  const setInt16 = (offset, value) => {
    dataView.setInt16(offset, value, /*littleEndian*/ true);
  };
  const setInt32 = (offset, value) => {
    dataView.setInt32(offset, value, /*littleEndian*/ true);
  };

  // Format explanation:
  // https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html

  // 4 bytes: FourCC tag 'RIFF'
  setInt8(0, 82); // 'R'
  setInt8(1, 73); // 'I'
  setInt8(2, 70); // 'F'
  setInt8(3, 70); // 'F'
  // 4 bytes: Remaining file size in bytes
  setInt32(4, HEADER_SIZE - 8 + dataSizeBytes);
  // 4 bytes: FourCC tag 'WAVE'
  setInt8(8, 87); // 'W'
  setInt8(9, 65); // 'A'
  setInt8(10, 86); // 'V'
  setInt8(11, 69); // 'E'

  // START OF FORMAT CHUNK
  // 4 bytes: Format chunk marker
  setInt8(12, 102); // 'f'
  setInt8(13, 109); // 'm'
  setInt8(14, 116); // 't'
  setInt8(15, 32); // ' '
  // 4 bytes: Length of remaining format chunk in bytes
  setInt32(16, 18);
  // 2 bytes: Sample format: WAVE_FORMAT_IEEE_FLOAT
  setInt32(20, 0x003);
  // 2 bytes: Number of channels
  setInt16(22, numChannels);
  // 4 bytes: Sample rate
  setInt32(24, sampleRate);
  // 4 bytes: Data rate (bytes per second)
  setInt32(28, (sampleRate * BITS_PER_SAMPLE * numChannels) / 8);
  // 2 bytes: Data block size (bytes per frame)
  setInt16(32, (BITS_PER_SAMPLE * numChannels) / 8);
  // 2 bytes: Bits per sample
  setInt16(34, BITS_PER_SAMPLE);
  // 2 bytes: Size of extension section. Required for WAVE_FORMAT_IEEE_FLOAT.
  setInt16(36, 0);
  // END OF FORMAT CHUNK

  // START OF FACT CHUNK
  // The fact chunk is required for format WAVE_FORMAT_IEEE_FLOAT.
  setInt8(38, 102); // 'f'
  setInt8(39, 97); // 'a'
  setInt8(40, 99); // 'c'
  setInt8(41, 116); // 't'
  // 4 bytes: Length of remaining fact chunk in bytes
  setInt32(42, 4);
  // 4 bytes: Number of samples per channel
  setInt32(46, (dataSizeBytes * 8) / BITS_PER_SAMPLE / numChannels);
  // END OF FACT CHUNK

  // START OF DATA CHUNK
  // 4 bytes: Data chunk marker
  setInt8(50, 100); // 'd'
  setInt8(51, 97); // 'a'
  setInt8(52, 116); // 't'
  setInt8(53, 97); // 'a'
  // 4 bytes: Data size in bytes
  setInt32(54, dataSizeBytes);
  // The rest of the data chunk is the actual audio data.

  return headerBuffer;
}
