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

  // 🔹 Convert to MP3
  const mp3Blob = bufferToMp3(output);

  // 🔹 Generate filename from main audio src
  const rawSrc = mainAudioEl.getAttribute("src");

  // Get file name from path
  const fileNameWithExt = rawSrc.split("/").pop(); 
  // Decode URL encoding
  const decodedName = decodeURIComponent(fileNameWithExt);
  // Remove .mp3 extension
  const baseName = decodedName.replace(/\.mp3$/i, "");

  // Final filename
  const finalFileName = baseName + ".mp3";

  // 🔹 Download
  const url = URL.createObjectURL(mp3Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalFileName;
  a.click();

  URL.revokeObjectURL(url);
}

// 🔊 Convert AudioBuffer → WAV
function bufferToMp3(buffer) {
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const blockSize = 1152;
  const mp3Data = [];

  let i = 0;
  while (i < samples.length) {
    const slice = samples.subarray(i, i + blockSize);

    // Convert Float32 → Int16
    const int16 = new Int16Array(slice.length);
    for (let j = 0; j < slice.length; j++) {
      int16[j] = Math.max(-1, Math.min(1, slice[j])) * 32767;
    }

    const mp3buf = mp3encoder.encodeBuffer(int16);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    i += blockSize;
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(new Uint8Array(endBuf));
  }

  return new Blob(mp3Data, { type: "audio/mp3" });
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
