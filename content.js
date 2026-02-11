async function concatAudioFromPage() {
  const BASE_URL = "https://lingopolo.org";
  const audioContext = new AudioContext();

  // 🔹 Get breakdown audio (table words)
  const breakdownAudioEls = document.querySelectorAll(
    ".entry-literal-breakdown table audio"
  );

  const breakdownUrls = [...breakdownAudioEls].map(a =>
    BASE_URL + a.getAttribute("src")
  );

  // 🔹 Get main sentence audio
  const mainAudioEl = document.querySelector(
    ".entry-recording audio"
  );

  if (!mainAudioEl) {
    console.error("Main audio not found");
    return;
  }

  const mainUrl = BASE_URL + mainAudioEl.getAttribute("src");

  console.log("Main audio:", mainUrl);
  console.log("Breakdown audio:", breakdownUrls);

  // 🔹 Helper to load + decode
  async function loadBuffer(url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  // 🔹 Load all buffers
  const mainBuffer = await loadBuffer(mainUrl);
  const breakdownBuffers = await Promise.all(
    breakdownUrls.map(loadBuffer)
  );

  // 🔹 Final order: main → breakdown → main
  const buffers = [
    mainBuffer,
    ...breakdownBuffers,
    mainBuffer
  ];

  // 🔹 Calculate total length
  const totalLength = buffers.reduce(
    (sum, buf) => sum + buf.length,
    0
  );

  // 🔹 Create mono output buffer (safe for mixed channels)
  const output = audioContext.createBuffer(
    1,
    totalLength,
    buffers[0].sampleRate
  );

  // 🔹 Copy + mix to mono if needed
  let offset = 0;
  const outputData = output.getChannelData(0);

  buffers.forEach(buf => {
    if (buf.numberOfChannels === 1) {
      outputData.set(buf.getChannelData(0), offset);
    } else {
      const ch0 = buf.getChannelData(0);
      const ch1 = buf.getChannelData(1);

      for (let i = 0; i < buf.length; i++) {
        outputData[offset + i] = (ch0[i] + ch1[i]) / 2;
      }
    }

    offset += buf.length;
  });

  // 🔹 Convert to WAV
  const wavBlob = bufferToWav(output);

  // 🔹 Download file
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sentence.wav";
  a.click();

  URL.revokeObjectURL(url);
}

// 🔊 Convert AudioBuffer → WAV
function bufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  let offset = 0;

  writeString(offset, "RIFF"); offset += 4;
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString(offset, "WAVE"); offset += 4;
  writeString(offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numChannels * 2, true); offset += 4;
  view.setUint16(offset, numChannels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(offset, "data"); offset += 4;
  view.setUint32(offset, length - offset - 4, true); offset += 4;

  // Interleave audio
  const channelData = buffer.getChannelData(0);
  let index = offset;

  for (let i = 0; i < channelData.length; i++) {
    let sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(index, sample * 0x7fff, true);
    index += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}


function addButton() {
  const btn = document.createElement("button");
  btn.innerText = "Download Sentence Audio";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = "9999";
  btn.style.padding = "10px 15px";
  btn.style.background = "#111";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "14px";

  btn.onclick = concatAudioFromPage;

  document.body.appendChild(btn);
}

addButton();
