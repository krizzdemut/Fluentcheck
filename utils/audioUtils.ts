export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/wav;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Decodes raw PCM audio data (16-bit signed integer) into an AudioBuffer.
 * Gemini TTS returns raw PCM data without headers.
 */
export const decodePcmAudioData = (
  pcmData: ArrayBuffer,
  audioContext: AudioContext,
  sampleRate: number = 24000, // Gemini TTS default
  numChannels: number = 1
): AudioBuffer => {
  const dataInt16 = new Int16Array(pcmData);
  const frameCount = dataInt16.length / numChannels;
  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert 16-bit PCM to float [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

/**
 * Converts raw 16-bit linear PCM audio into a standard WAV format Blob.
 * This enables native HTMLAudioElement playback with play, pause, seek, and duration capabilities.
 */
export const pcmToWavBlob = (
  pcmData: ArrayBuffer,
  sampleRate: number = 24000,
  numChannels: number = 1
): Blob => {
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  /* fmt sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample

  /* data sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM samples
  const pcmBytes = new Uint8Array(pcmData);
  const wavBytes = new Uint8Array(buffer, 44);
  wavBytes.set(pcmBytes);

  return new Blob([buffer], { type: 'audio/wav' });
};
