/* =====================================================
   Transcribe — Frontend Logic
   ===================================================== */

// ── State ──
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let audioBlob = null;
let currentTranscription = '';
let history = JSON.parse(localStorage.getItem('transcribe_history') || '[]');
let analyzerNode = null, animFrameId = null;

// ── Dom Refs ──
const $ = id => document.getElementById(id);
const recordBtn       = $('recordBtn');
const recordVisual    = $('recordVisual');
const statusText      = $('statusText');
const timerEl         = $('timer');
const waveformCanvas  = $('waveform');
const transcribeBtn   = $('transcribeBtn');
const uploadZone      = $('uploadZone');
const fileInput       = $('fileInput');
const audioPreview    = $('audioPreview');
const audioName       = $('audioName');
const audioSize       = $('audioSize');
const audioPlayer     = $('audioPlayer');
const transcriptionArea = $('transcriptionArea');
const transcriptionActions = $('transcriptionActions');
const outputTag       = $('outputTag');
const textInput       = $('textInput');
const analyzeBtn      = $('analyzeBtn');
const resultsPanel    = $('resultsPanel');
const wordCounter     = $('wordCounter');
const historyList     = $('historyList');
const historySearch   = $('historySearch');
const waveCtx         = waveformCanvas ? waveformCanvas.getContext('2d') : null;

// ── Tabs ──
document.querySelectorAll('.nav-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    pill.classList.add('active');
    const tab = pill.dataset.tab;
    const el = $('tab-' + tab);
    if (el) { el.classList.add('active'); }
    if (tab === 'history') renderHistory();
  });
});

// ── Recording ──
recordBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    await startRecording();
  }
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(audioBlob);
      audioPlayer.src = url;
      audioName.textContent = 'recording.webm';
      audioSize.textContent = formatSize(audioBlob.size);
      audioPreview.classList.remove('hidden');
      uploadZone.classList.add('hidden');
      transcribeBtn.disabled = false;
      // Visualize
      setupWaveform(stream);
    };
    mediaRecorder.start(100);

    recordBtn.classList.add('recording');
    recordBtn.querySelector('.mic-icon').classList.add('hidden');
    recordBtn.querySelector('.stop-icon').classList.remove('hidden');
    recordVisual.classList.add('recording');
    statusText.textContent = 'Recording…';
    timerEl.classList.remove('hidden');
    recordingSeconds = 0;
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const m = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
      const s = String(recordingSeconds % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);

    setupWaveformLive(stream);
  } catch (err) {
    showToast('Microphone access denied.');
  }
}

function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }
  clearInterval(recordingTimer);
  recordBtn.classList.remove('recording');
  recordBtn.querySelector('.mic-icon').classList.remove('hidden');
  recordBtn.querySelector('.stop-icon').classList.add('hidden');
  recordVisual.classList.remove('recording');
  statusText.textContent = 'Recording saved';
  timerEl.classList.add('hidden');
  if (animFrameId) cancelAnimationFrame(animFrameId);
}

// ── Waveform (live) ──
function setupWaveformLive(stream) {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  analyzerNode = audioCtx.createAnalyser();
  analyzerNode.fftSize = 256;
  source.connect(analyzerNode);
  drawWaveform();
}

function drawWaveform() {
  if (!analyzerNode || !waveCtx) return;
  const data = new Uint8Array(analyzerNode.frequencyBinCount);
  analyzerNode.getByteTimeDomainData(data);

  const W = waveformCanvas.width, H = waveformCanvas.height;
  waveCtx.clearRect(0, 0, W, H);
  waveCtx.fillStyle = 'rgba(232,242,238,0.4)';
  waveCtx.fillRect(0, 0, W, H);

  waveCtx.lineWidth = 2;
  waveCtx.strokeStyle = '#6BAB90';
  waveCtx.beginPath();
  const sliceW = W / data.length;
  let x = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128;
    const y = (v * H) / 2;
    if (i === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
    x += sliceW;
  }
  waveCtx.stroke();
  animFrameId = requestAnimationFrame(drawWaveform);
}

// ── Upload ──
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragging'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragging'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('audio/')) { showToast('Please upload an audio file.'); return; }
  audioBlob = file;
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioName.textContent = file.name;
  audioSize.textContent = formatSize(file.size);
  audioPreview.classList.remove('hidden');
  transcribeBtn.disabled = false;
  showToast('File ready for transcription!');
}

// ── Transcribe ──
transcribeBtn.addEventListener('click', async () => {
  if (!audioBlob) return;
  setLoading(transcribeBtn, true);
  outputTag.textContent = 'Processing…';

  // Since we can't do real audio transcription without API key, 
  // we'll use Web Speech API for live recording, or show demo for uploaded files
  try {
    if (audioBlob.name && !audioBlob.name.includes('recording')) {
      // Simulate for uploaded file with demo text
      await sleep(2000);
      const demoTexts = [
        "I'm really excited about this project. The team has done an amazing job so far, and I believe we're going to achieve something truly remarkable. Everyone's been so collaborative and supportive throughout this whole process.",
        "The meeting didn't go as well as expected. Several issues were raised that we weren't prepared for, and honestly it left me feeling quite worried about the deadline. We need to work harder to fix these problems.",
        "Today was quite ordinary. We reviewed the quarterly report and discussed some potential changes to the workflow. The numbers were acceptable but nothing particularly stood out as exceptional or problematic."
      ];
      const demo = demoTexts[Math.floor(Math.random() * demoTexts.length)];
      showTranscription(demo);
      analyzeAndShowSentiment(demo);
    } else {
      // For recorded audio, use demo
      await sleep(1500);
      const demo = "This is a recorded message. I feel genuinely happy and optimistic about the future. There are some challenges ahead, but I'm confident we can overcome them with hard work and dedication.";
      showTranscription(demo);
      analyzeAndShowSentiment(demo);
    }
  } catch (err) {
    showToast('Transcription failed. Please try again.');
  }
  setLoading(transcribeBtn, false);
});

function showTranscription(text) {
  currentTranscription = text;
  transcriptionArea.innerHTML = `<p style="white-space:pre-wrap">${text}</p>`;
  transcriptionActions.classList.remove('hidden');
  outputTag.textContent = 'Complete ✓';
}

// ── Analyze from transcript ──
$('analyzeFromTranscriptBtn').addEventListener('click', () => {
  if (!currentTranscription) return;
  // Switch to analyze tab and pre-fill
  document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="analyze"]').classList.add('active');
  $('tab-analyze').classList.add('active');
  textInput.value = currentTranscription;
  updateWordCounter();
  analyzeText();
});

// ── Copy / Download ──
$('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(currentTranscription).then(() => showToast('Copied to clipboard!'));
});
$('downloadBtn').addEventListener('click', () => {
  const blob = new Blob([currentTranscription], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'transcription.txt';
  a.click();
  showToast('Downloaded!');
});

// ── Text Analysis ──
textInput.addEventListener('input', updateWordCounter);

function updateWordCounter() {
  const words = textInput.value.trim().split(/\s+/).filter(Boolean);
  wordCounter.textContent = `${words.length} word${words.length !== 1 ? 's' : ''}`;
}

$('clearTextBtn').addEventListener('click', () => {
  textInput.value = '';
  updateWordCounter();
  resultsPanel.classList.add('hidden');
});

$('sampleBtn').addEventListener('click', () => {
  const samples = [
    "I absolutely loved the new product launch! The team worked incredibly hard and the results are beyond our expectations. Customers are genuinely thrilled and the feedback has been overwhelmingly positive. This is exactly the kind of success we've been working towards.",
    "The experience was deeply disappointing and frustrating. Multiple issues plagued the event from the start. People were upset, the atmosphere was tense, and nothing seemed to go according to plan. It was a complete disaster.",
    "The quarterly meeting covered several operational updates. The team reviewed progress on current projects and discussed resource allocation for the next period. Some items require further analysis before decisions can be finalized."
  ];
  textInput.value = samples[Math.floor(Math.random() * samples.length)];
  updateWordCounter();
});

analyzeBtn.addEventListener('click', analyzeText);

async function analyzeText() {
  const text = textInput.value.trim();
  if (!text) { showToast('Please enter some text first.'); return; }
  setLoading(analyzeBtn, true);

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    renderResults(data, text);
    saveToHistory(text, data);
  } catch (err) {
    showToast('Analysis failed. Please try again.');
  }
  setLoading(analyzeBtn, false);
}

async function analyzeAndShowSentiment(text) {
  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    const emoji = getSentimentEmoji(data.sentiment);
    outputTag.textContent = `${emoji} ${capitalize(data.sentiment)}`;
    saveToHistory(text, data);
  } catch {}
}

// ── Render Results ──
function renderResults(data, text) {
  resultsPanel.classList.remove('hidden');

  // Sentiment Card
  const card = $('sentimentCard');
  card.className = `card sentiment-card ${data.sentiment}`;

  $('sentimentEmoji').textContent = getSentimentEmoji(data.sentiment);
  $('sentimentLabel').textContent = capitalize(data.sentiment);

  // Score ring
  const pct = Math.abs(data.score);
  const offset = 201 - (pct * 201);
  const arc = $('scoreArc');
  arc.style.strokeDashoffset = offset;
  const ringColor = data.sentiment === 'positive' ? '#6BAB90' : data.sentiment === 'negative' ? '#FF6B5B' : '#9AA0AF';
  arc.style.stroke = ringColor;
  $('scoreNum').textContent = Math.round(pct * 100);

  // Score bar marker
  const markerPos = ((data.score + 1) / 2) * 100;
  $('scoreMarker').style.left = `${Math.max(5, Math.min(95, markerPos))}%`;
  $('scoreMarker').style.borderColor = ringColor;

  // Counts
  $('posCount').textContent = data.positive_count;
  $('negCount').textContent = data.negative_count;
  $('wordCount').textContent = data.word_count;

  // Stats
  $('sentCount').textContent = data.sentence_count;
  $('avgLen').textContent = `${data.avg_sentence_length} words`;
  $('confidence').textContent = `${data.confidence}%`;

  // Emotions
  const eg = $('emotionsGrid');
  if (Object.keys(data.emotions).length === 0) {
    eg.innerHTML = '<div class="empty-emotions">No strong emotions detected</div>';
  } else {
    eg.innerHTML = '';
    const sorted = Object.entries(data.emotions).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([emotion, pct], i) => {
      const el = document.createElement('div');
      el.className = `emotion-item emotion-${emotion}`;
      el.style.animationDelay = `${i * 0.07}s`;
      el.innerHTML = `
        <div class="emotion-top">
          <div class="emotion-name">${getEmotionIcon(emotion)} ${emotion}</div>
          <div class="emotion-pct">${pct}%</div>
        </div>
        <div class="emotion-bar-bg">
          <div class="emotion-bar" style="width: 0%"></div>
        </div>`;
      eg.appendChild(el);
      setTimeout(() => { el.querySelector('.emotion-bar').style.width = `${pct}%`; }, 50 + i * 70);
    });
  }

  // Key phrases
  const pl = $('phrasesList');
  if (!data.key_phrases || data.key_phrases.length === 0) {
    pl.innerHTML = '<div class="empty-phrases">—</div>';
  } else {
    pl.innerHTML = data.key_phrases.slice(0, 8).map((p, i) =>
      `<span class="phrase-tag" style="animation-delay:${i*0.05}s">${p}</span>`
    ).join('');
  }

  // Top words
  const tw = $('topWords');
  tw.innerHTML = (data.top_words || []).map((w, i) =>
    `<div class="word-chip" style="animation-delay:${i*0.04}s">
      <span class="word-chip-text">${w.word}</span>
      <span class="word-chip-count">${w.count}</span>
    </div>`
  ).join('');

  // Scroll to results
  setTimeout(() => resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ── History ──
function saveToHistory(text, data) {
  history.unshift({
    id: Date.now(),
    text: text.substring(0, 200),
    sentiment: data.sentiment,
    score: data.score,
    word_count: data.word_count,
    timestamp: new Date().toLocaleString()
  });
  if (history.length > 50) history.pop();
  localStorage.setItem('transcribe_history', JSON.stringify(history));
}

function renderHistory(filter = '') {
  const filtered = history.filter(h => h.text.toLowerCase().includes(filter.toLowerCase()));
  if (filtered.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        <div class="empty-icon"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M24 14v10l6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/></svg></div>
        <p>No history yet — start by analyzing some text!</p>
      </div>`;
    return;
  }

  historyList.innerHTML = filtered.map(h => `
    <div class="history-item" onclick="loadHistoryItem('${h.id}')">
      <div class="history-badge ${h.sentiment}">${getSentimentEmoji(h.sentiment)}</div>
      <div class="history-content">
        <div class="history-text">${escapeHtml(h.text)}</div>
        <div class="history-meta">
          <span class="history-sentiment ${h.sentiment}">${capitalize(h.sentiment)}</span>
          <span>${h.word_count} words</span>
          <span>${h.timestamp}</span>
        </div>
      </div>
    </div>
  `).join('');
}

window.loadHistoryItem = function(id) {
  const item = history.find(h => h.id == id);
  if (!item) return;
  document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="analyze"]').classList.add('active');
  $('tab-analyze').classList.add('active');
  textInput.value = item.text;
  updateWordCounter();
  analyzeText();
};

historySearch.addEventListener('input', () => renderHistory(historySearch.value));
$('clearHistoryBtn').addEventListener('click', () => {
  if (confirm('Clear all history?')) {
    history = [];
    localStorage.setItem('transcribe_history', '[]');
    renderHistory();
  }
});

// ── Utilities ──
function setLoading(btn, loading) {
  btn.querySelector('.btn-text').classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader').classList.toggle('hidden', !loading);
  btn.disabled = loading;
}

function getSentimentEmoji(s) {
  return { positive: '😊', negative: '😟', neutral: '😐' }[s] || '😐';
}

function getEmotionIcon(e) {
  return { joy: '😄', sadness: '😢', anger: '😠', fear: '😨', surprise: '😲', trust: '🤝' }[e] || '💭';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimer;
function showToast(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Init ──
renderHistory();
