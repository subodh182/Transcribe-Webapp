# 🎙️ Transcribe — AI Speech & Sentiment Analysis

A premium dark-themed web app with real-time speech transcription using the Web Speech API and deep sentiment intelligence. Built with Flask + HTML/CSS/JS.

---

## ✨ Features

- **🎙️ Real-time Speech Recognition** — Uses browser's Web Speech API; your actual words get transcribed live as you speak
- **📊 Live Waveform Visualizer** — Gradient animated waveform while recording
- **📁 Audio File Upload** — Drag & drop MP3/WAV/M4A/OGG (requires external API for file transcription)
- **😊 Accurate Sentiment Analysis** — Positive/Negative/Neutral with negation handling & intensifiers
- **💡 8 Emotion Types** — Joy, Sadness, Anger, Fear, Surprise, Trust, Disgust, Anticipation
- **🔑 Key Phrases + Highlighted Words** — Positive & negative word tagging
- **📊 Text Statistics** — Word count, sentence count, readability level
- **🏆 Top Words Cloud** — Frequency analysis
- **📜 Searchable History** — Persisted via localStorage
- **📱 Fully Mobile Responsive** — Works on all screen sizes
- **🎨 Premium Dark UI** — Animated blobs, gradient shimmer text, glass morphism cards

---

## 🚀 Quick Start

```bash
pip install flask
python app.py
# Open http://localhost:5000
```

## 🎤 How to Use Transcription

1. Click the **mic button** — allow microphone access when prompted
2. **Speak clearly** — your words appear live in the transcript box
3. Click mic again to **stop recording**
4. Hit **"Transcribe Audio"** to confirm and get sentiment
5. Or click **"Deep Analyze"** to go to full sentiment breakdown

> **Note:** Real-time transcription uses Chrome/Edge's built-in Web Speech API. For audio file transcription, integrate OpenAI Whisper or AssemblyAI.

---

## 📁 Structure

```
transcribe_app/
├── app.py              ← Flask + sentiment engine
├── requirements.txt    ← flask only
├── README.md
└── static/
    ├── css/style.css   ← Full dark animated UI
    └── js/app.js       ← Web Speech API + logic
└── templates/
    └── index.html      ← 3-tab app layout
```

---

## 🌐 API

### POST /analyze
```json
Request:  { "text": "your text here" }
Response: {
  "sentiment": "positive",
  "score": 0.85,
  "confidence": 72,
  "positive_count": 4,
  "negative_count": 0,
  "positive_words": ["amazing", "love"],
  "negative_words": [],
  "emotions": {"joy": 60, "trust": 40},
  "key_phrases": ["really amazing"],
  "word_count": 18,
  "sentence_count": 2,
  "avg_sentence_length": 9.0,
  "top_words": [{"word": "amazing", "count": 2}],
  "readability": "Simple"
}
```

---

*Built with 💜 Flask & Web Speech API — Transcribe App*
