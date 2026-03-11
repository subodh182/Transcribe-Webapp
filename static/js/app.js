/* ═══════════════════════════════════════════════════
   Transcribe — Frontend Logic
   Web Speech API for real transcription
   ═══════════════════════════════════════════════════ */

// ── State ──
let recognition   = null;
let isRecording   = false;
let timerInterval = null;
let timerSecs     = 0;
let audioBlob     = null;
let finalTranscript = '';
let interimTranscript = '';
let analyzerNode  = null;
let animFrame     = null;
let audioCtx      = null;
let history       = [];

try { history = JSON.parse(localStorage.getItem('transcribe_history') || '[]'); } catch(e){ history=[]; }

// ── DOM ──
const $ = id => document.getElementById(id);
const micBtn         = $('micBtn');
const micOrbit       = $('micOrbit');
const micStatusText  = $('micStatusText');
const micTimer       = $('micTimer');
const liveTranscript = $('liveTranscript');
const liveText       = $('liveText');
const waveCanvas     = $('waveCanvas');
const waveCtx        = waveCanvas ? waveCanvas.getContext('2d') : null;
const uploadBox      = $('uploadBox');
const fileInput      = $('fileInput');
const audioChip      = $('audioChip');
const achipName      = $('achipName');
const achipSize      = $('achipSize');
const audioEl        = $('audioEl');
const transcribeBtn  = $('transcribeBtn');
const transcriptBox  = $('transcriptBox');
const outActions     = $('outActions');
const outBadge       = $('outBadge');
const quickSentiment = $('quickSentiment');
const textInput      = $('textInput');
const analyzeBtn     = $('analyzeBtn');
const resultsWrap    = $('resultsWrap');
const wcBadge        = $('wcBadge');
const histList       = $('histList');
const histSearch     = $('histSearch');

// ══════════════════════════════════════
//  TABS
// ══════════════════════════════════════
function initTabs() {
  const pills  = document.querySelectorAll('.tnav');
  const panes  = document.querySelectorAll('.tab-pane');
  const slider = document.querySelector('.tnav-slider');

  function moveSlider(btn) {
    const nav = btn.closest('.tab-nav');
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    slider.style.left  = (btnRect.left - navRect.left - 4) + 'px';
    slider.style.width = btnRect.width + 'px';
  }

  // Init position on active
  const activeBtn = document.querySelector('.tnav.active');
  if (activeBtn) setTimeout(() => moveSlider(activeBtn), 50);

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const pane = $('tab-' + pill.dataset.tab);
      if (pane) pane.classList.add('active');
      moveSlider(pill);
      if (pill.dataset.tab === 'history') renderHistory();
    });
  });
}
initTabs();

// ══════════════════════════════════════
//  WEB SPEECH API — REAL TRANSCRIPTION
// ══════════════════════════════════════
function initSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return null;

  const rec = new SpeechRec();
  rec.continuous     = true;
  rec.interimResults = true;
  rec.lang           = 'en-US'; // change to 'hi-IN' for Hindi

  rec.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    micOrbit.classList.add('recording');
    micBtn.querySelector('.icon-mic').style.display  = 'none';
    micBtn.querySelector('.icon-stop').style.display = 'block';
    micStatusText.textContent = 'Recording… speak now';
    micTimer.classList.remove('hidden');
    liveTranscript.classList.remove('hidden');
    liveText.textContent = 'Listening…';
    startTimer();
    transcribeBtn.disabled = false;
  };

  rec.onresult = (e) => {
    interimTranscript = '';
    finalTranscript   = '';
    for (let i = 0; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' ';
      else interimTranscript += t;
    }
    liveText.textContent = (finalTranscript + interimTranscript).trim() || 'Listening…';
  };

  rec.onerror = (e) => {
    if (e.error === 'no-speech') return;
    showToast('Mic error: ' + e.error);
    stopRecording();
  };

  rec.onend = () => {
    if (isRecording) {
      // auto-restart for continuous
      try { rec.start(); } catch(err) {}
    }
  };

  return rec;
}

async function startRecording() {
  // Request mic for waveform
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    drawLiveWave(stream);
    audioCtx = new AudioContext();
  } catch(err) {
    showToast('Microphone access denied.');
    return;
  }

  recognition = initSpeechRecognition();

  if (!recognition) {
    // fallback: no speech API
    showToast('Speech API not supported in this browser. Try Chrome/Edge.');
    micStatusText.textContent = 'Not supported — use Chrome/Edge';
    return;
  }

  finalTranscript   = '';
  interimTranscript = '';
  recognition.start();
}

function stopRecording() {
  isRecording = false;
  if (recognition) { try { recognition.stop(); } catch(e){} }
  micBtn.classList.remove('recording');
  micOrbit.classList.remove('recording');
  micBtn.querySelector('.icon-mic').style.display  = 'block';
  micBtn.querySelector('.icon-stop').style.display = 'none';
  micStatusText.textContent = 'Recording complete';
  micTimer.classList.add('hidden');
  clearInterval(timerInterval);
  if (animFrame) cancelAnimationFrame(animFrame);

  const text = finalTranscript.trim();
  if (text) {
    liveText.textContent = text;
    micStatusText.textContent = '✓ Transcription ready';
    transcribeBtn.disabled = false;
  } else {
    liveText.textContent = 'No speech detected. Try again.';
    micStatusText.textContent = 'Tap to try again';
  }
}

micBtn.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});

function startTimer() {
  timerSecs = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSecs++;
    const m = String(Math.floor(timerSecs/60)).padStart(2,'0');
    const s = String(timerSecs%60).padStart(2,'0');
    micTimer.textContent = m + ':' + s;
  }, 1000);
}

// ══════════════════════════════════════
//  WAVEFORM
// ══════════════════════════════════════
function drawLiveWave(stream) {
  if (!waveCtx) return;
  const aCtx    = new AudioContext();
  const src     = aCtx.createMediaStreamSource(stream);
  analyzerNode  = aCtx.createAnalyser();
  analyzerNode.fftSize = 256;
  src.connect(analyzerNode);

  const W = waveCanvas.width, H = waveCanvas.height;
  const data = new Uint8Array(analyzerNode.frequencyBinCount);

  function draw() {
    animFrame = requestAnimationFrame(draw);
    analyzerNode.getByteTimeDomainData(data);
    waveCtx.clearRect(0,0,W,H);
    waveCtx.fillStyle = 'rgba(255,255,255,0.02)';
    waveCtx.fillRect(0,0,W,H);

    // gradient stroke
    const grad = waveCtx.createLinearGradient(0,0,W,0);
    grad.addColorStop(0,   '#7C5FE8');
    grad.addColorStop(0.5, '#36D9A0');
    grad.addColorStop(1,   '#FF6B6B');
    waveCtx.lineWidth = 2.5;
    waveCtx.strokeStyle = grad;
    waveCtx.beginPath();
    const sw = W / data.length;
    let x = 0;
    for (let i=0; i<data.length; i++) {
      const v = data[i]/128;
      const y = (v*H)/2;
      i===0 ? waveCtx.moveTo(x,y) : waveCtx.lineTo(x,y);
      x += sw;
    }
    waveCtx.stroke();
  }
  draw();
}

// ══════════════════════════════════════
//  UPLOAD
// ══════════════════════════════════════
uploadBox.addEventListener('click', () => fileInput.click());
uploadBox.addEventListener('dragover', e => { e.preventDefault(); uploadBox.classList.add('drag'); });
uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('drag'));
uploadBox.addEventListener('drop', e => {
  e.preventDefault(); uploadBox.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', () => { if(fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
  if (!file.type.startsWith('audio/')) { showToast('Please upload an audio file'); return; }
  audioBlob = file;
  audioEl.src = URL.createObjectURL(file);
  achipName.textContent = file.name;
  achipSize.textContent = fmtSize(file.size);
  audioChip.classList.remove('hidden');
  transcribeBtn.disabled = false;
  showToast('Audio file ready!');
}

// ══════════════════════════════════════
//  TRANSCRIBE BUTTON
// ══════════════════════════════════════
transcribeBtn.addEventListener('click', async () => {
  // Use live speech result if recording was used
  const speechText = finalTranscript.trim();

  if (speechText) {
    // We already have the transcription from Web Speech API
    setOutText(speechText);
    const data = await callAnalyze(speechText);
    if (data) { showQuickSentiment(data); saveHist(speechText, data); }
    return;
  }

  // If file uploaded, show a note since we can't transcribe without external API
  if (audioBlob) {
    setLoading(transcribeBtn, 'tBtnText','tBtnLoader', true);
    await sleep(1200);
    const msg = "⚠️ Audio file transcription requires an external API key (e.g. OpenAI Whisper or AssemblyAI). For now, please use the microphone to record and get real-time transcription via your browser's Speech Recognition. Alternatively, paste your text in the 'Analyze' tab.";
    setOutText(msg, true);
    setLoading(transcribeBtn, 'tBtnText','tBtnLoader', false);
    showToast('Use mic recording for live transcription');
    return;
  }

  showToast('Please record audio first');
});

function setOutText(text, isNote=false) {
  transcriptBox.innerHTML = `<p style="white-space:pre-wrap;color:${isNote?'var(--t3)':'var(--t1)'};font-size:15px;line-height:1.75">${escHtml(text)}</p>`;
  outActions.classList.remove('hidden');
  outBadge.textContent = isNote ? '⚠️ Info' : '✓ Transcribed';
  window._lastTranscript = isNote ? '' : text;
}

// ── Action buttons ──
$('copyBtn').addEventListener('click', () => {
  const t = window._lastTranscript || '';
  if (!t) { showToast('Nothing to copy'); return; }
  navigator.clipboard.writeText(t).then(() => showToast('Copied! ✓'));
});

$('dlBtn').addEventListener('click', () => {
  const t = window._lastTranscript || '';
  if (!t) { showToast('Nothing to download'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([t],{type:'text/plain'}));
  a.download = 'transcription.txt'; a.click();
  showToast('Downloaded!');
});

$('toAnalyzeBtn').addEventListener('click', () => {
  const t = window._lastTranscript || '';
  if (!t) { showToast('No transcription available'); return; }
  textInput.value = t;
  updateWC();
  // switch tab
  document.querySelectorAll('.tnav').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const ab = document.querySelector('[data-tab="analyze"]');
  ab.classList.add('active');
  const slider = document.querySelector('.tnav-slider');
  const nav = ab.closest('.tab-nav');
  const navR = nav.getBoundingClientRect();
  const btnR = ab.getBoundingClientRect();
  slider.style.left  = (btnR.left - navR.left - 4) + 'px';
  slider.style.width = btnR.width + 'px';
  $('tab-analyze').classList.add('active');
  analyzeText();
});

// ══════════════════════════════════════
//  QUICK SENTIMENT STRIP
// ══════════════════════════════════════
function showQuickSentiment(data) {
  quickSentiment.classList.remove('hidden');
  $('qsEmoji').textContent  = sentEmoji(data.sentiment);
  $('qsLabel').textContent  = cap(data.sentiment);
  $('qsScore').textContent  = Math.round(Math.abs(data.score)*100);
  const fill = $('qsFill');
  const pct  = Math.abs(data.score) * 100;
  const col  = data.sentiment==='positive' ? 'var(--mint)' : data.sentiment==='negative' ? 'var(--coral)' : 'rgba(255,255,255,0.3)';
  fill.style.background = col;
  setTimeout(() => { fill.style.width = pct + '%'; }, 50);
}

// ══════════════════════════════════════
//  ANALYZE TEXT TAB
// ══════════════════════════════════════
textInput.addEventListener('input', updateWC);
function updateWC() {
  const w = textInput.value.trim().split(/\s+/).filter(Boolean).length;
  wcBadge.textContent = w + ' word' + (w===1?'':'s');
}

// Samples
$('samplePos').addEventListener('click', () => {
  textInput.value = "Today was absolutely incredible! I got promoted at work and my team threw me a surprise party. Everyone was so warm, supportive, and genuinely happy for me. I feel grateful, confident, and inspired to keep working hard. This is exactly the kind of success and recognition that motivates me. Life is wonderful and I'm thrilled for the future!";
  updateWC(); resultsWrap.classList.add('hidden');
});
$('sampleNeg').addEventListener('click', () => {
  textInput.value = "The project was a complete disaster and I feel utterly frustrated. Everything went wrong from the start — deadlines were missed, communication was terrible, and the team was exhausted and overwhelmed. I'm worried we'll never recover from this failure. It's hard not to feel hopeless and stuck. The whole experience was painful and deeply disappointing.";
  updateWC(); resultsWrap.classList.add('hidden');
});
$('sampleNeu').addEventListener('click', () => {
  textInput.value = "The quarterly report was reviewed in the meeting today. The team covered current project status, resource allocation, and upcoming milestones. A few items need further analysis before final decisions can be made. The next meeting is scheduled for Friday at 2pm. Please review the attached documents before then.";
  updateWC(); resultsWrap.classList.add('hidden');
});

$('clearBtn').addEventListener('click', () => {
  textInput.value = '';
  updateWC();
  resultsWrap.classList.add('hidden');
});

analyzeBtn.addEventListener('click', analyzeText);

async function analyzeText() {
  const text = textInput.value.trim();
  if (!text) { showToast('Please enter some text first'); return; }
  setLoading(analyzeBtn, 'aBtnText','aBtnLoader', true);
  const data = await callAnalyze(text);
  setLoading(analyzeBtn, 'aBtnText','aBtnLoader', false);
  if (data) { renderResults(data); saveHist(text, data); }
}

async function callAnalyze(text) {
  try {
    const r = await fetch('/analyze', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({text})
    });
    return await r.json();
  } catch(e) {
    showToast('Analysis failed. Is the Flask server running?');
    return null;
  }
}

// ══════════════════════════════════════
//  RENDER RESULTS
// ══════════════════════════════════════
const EMOTION_ICONS = {
  joy:'😄', sadness:'😢', anger:'😠', fear:'😨',
  surprise:'😲', trust:'🤝', disgust:'🤢', anticipation:'🌅'
};

function renderResults(d) {
  resultsWrap.classList.remove('hidden');

  // Big card class
  const card = $('sentBigCard');
  card.className = 'glass-card sentiment-big-card ' + d.sentiment;
  $('sbcEmoji').textContent = sentEmoji(d.sentiment);
  $('sbcLabel').textContent = cap(d.sentiment);

  // Arc
  const pct    = Math.abs(d.score);
  const offset = 251 - (pct * 251);
  const arc    = $('arcCircle');
  arc.style.strokeDashoffset = 251; // reset
  $('arcNum').textContent = Math.round(pct * 100);
  setTimeout(() => { arc.style.strokeDashoffset = offset; }, 80);

  // Polarity thumb
  const pos = ((d.score + 1) / 2) * 100;
  $('polarThumb').style.left = Math.max(4, Math.min(96, pos)) + '%';

  // Stats
  $('spPos').textContent   = d.positive_count;
  $('spNeg').textContent   = d.negative_count;
  $('spWords').textContent = d.word_count;
  $('spConf').textContent  = d.confidence + '%';

  // Text stats
  $('stWords').textContent = d.word_count;
  $('stSent').textContent  = d.sentence_count;
  $('stAvg').textContent   = d.avg_sentence_length + ' words';
  $('stRead').textContent  = d.readability;

  // Emotions
  const emoList = $('emoList');
  const emos = d.emotions || {};
  if (!Object.keys(emos).length) {
    emoList.innerHTML = '<div class="emo-empty">No strong emotions detected</div>';
  } else {
    emoList.innerHTML = '';
    Object.entries(emos).forEach(([name, pct], i) => {
      const el = document.createElement('div');
      el.className = `emo-item emo-${name}`;
      el.style.animationDelay = (i*0.08)+'s';
      el.innerHTML = `
        <span class="emo-icon">${EMOTION_ICONS[name]||'💭'}</span>
        <span class="emo-name">${name}</span>
        <div class="emo-track"><div class="emo-fill" style="width:0%"></div></div>
        <span class="emo-pct">${pct}%</span>`;
      emoList.appendChild(el);
      setTimeout(() => { el.querySelector('.emo-fill').style.width = pct+'%'; }, 100 + i*80);
    });
  }

  // Key phrases
  const kpTags = $('kpTags');
  if (!d.key_phrases || !d.key_phrases.length) {
    kpTags.innerHTML = '<span class="kp-empty">—</span>';
  } else {
    kpTags.innerHTML = d.key_phrases.slice(0,10).map((p,i) =>
      `<span class="kp-tag" style="animation-delay:${i*0.05}s">${escHtml(p)}</span>`
    ).join('');
  }

  // Highlighted words
  const hwPos = $('hwPos');
  const hwNeg = $('hwNeg');
  hwPos.innerHTML = (d.positive_words||[]).map(w=>
    `<span class="hw-pos-tag">${w}</span>`).join('') || '<span style="color:var(--t4);font-size:11px">—</span>';
  hwNeg.innerHTML = (d.negative_words||[]).map(w=>
    `<span class="hw-neg-tag">${w}</span>`).join('') || '<span style="color:var(--t4);font-size:11px">—</span>';

  // Top words cloud
  const tw = $('twCloud');
  tw.innerHTML = (d.top_words||[]).map((w,i)=>
    `<div class="tw-chip" style="animation-delay:${i*0.04}s">
      <span class="tw-word">${w.word}</span>
      <span class="tw-count">${w.count}</span>
    </div>`).join('');

  // Scroll smoothly
  setTimeout(() => resultsWrap.scrollIntoView({behavior:'smooth', block:'start'}), 120);
}

// ══════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════
function saveHist(text, data) {
  history.unshift({
    id: Date.now(),
    text: text.substring(0,250),
    sentiment: data.sentiment,
    score: data.score,
    wc: data.word_count,
    ts: new Date().toLocaleString()
  });
  if (history.length > 60) history.pop();
  try { localStorage.setItem('transcribe_history', JSON.stringify(history)); } catch(e){}
}

function renderHistory(filter='') {
  const fil = history.filter(h => h.text.toLowerCase().includes(filter.toLowerCase()));
  if (!fil.length) {
    histList.innerHTML = `<div class="hist-empty">
      <div class="hist-empty-art">📭</div>
      <p>${filter ? 'No matches found' : 'No history yet'}</p>
      <span>${filter ? 'Try a different search term' : 'Start transcribing or analyzing text'}</span>
    </div>`;
    return;
  }
  histList.innerHTML = fil.map((h,i) => `
    <div class="hist-item" onclick="loadHist(${h.id})" style="animation-delay:${i*0.04}s">
      <div class="hist-badge ${h.sentiment}">${sentEmoji(h.sentiment)}</div>
      <div class="hist-body">
        <div class="hist-text">${escHtml(h.text)}</div>
        <div class="hist-meta">
          <span class="hist-sent ${h.sentiment}">${cap(h.sentiment)}</span>
          <span>${h.wc} words</span>
          <span>${h.ts}</span>
        </div>
      </div>
    </div>`).join('');
}

window.loadHist = function(id) {
  const item = history.find(h=>h.id===id);
  if (!item) return;
  document.querySelectorAll('.tnav').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  const ab = document.querySelector('[data-tab="analyze"]');
  ab.classList.add('active');
  const slider = document.querySelector('.tnav-slider');
  const nav = ab.closest('.tab-nav');
  const navR = nav.getBoundingClientRect();
  const btnR = ab.getBoundingClientRect();
  slider.style.left  = (btnR.left - navR.left - 4) + 'px';
  slider.style.width = btnR.width + 'px';
  $('tab-analyze').classList.add('active');
  textInput.value = item.text;
  updateWC();
  analyzeText();
};

histSearch.addEventListener('input', () => renderHistory(histSearch.value));
$('clearHistBtn').addEventListener('click', () => {
  if (!confirm('Clear all history?')) return;
  history = [];
  try { localStorage.setItem('transcribe_history','[]'); } catch(e){}
  renderHistory();
});

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
function setLoading(btn, txtId, loadId, loading) {
  $(txtId).classList.toggle('hidden', loading);
  $(loadId).classList.toggle('hidden', !loading);
  btn.disabled = loading;
}

function sentEmoji(s) {
  return {positive:'😊', negative:'😟', neutral:'😐'}[s] || '😐';
}

function cap(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }

function fmtSize(b) {
  if (b<1024) return b+' B';
  if (b<1048576) return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}

function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function escHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let _toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>t.classList.remove('show'), 3200);
}

// Init
renderHistory();
