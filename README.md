# 🎙️ Transcribe — Transcribe & Sentiment Analysis

A beautiful, light-themed web application for audio transcription and deep sentiment intelligence. Built with Flask + vanilla HTML/CSS/JS.

---

## ✨ Features

- **🎙️ Live Recording** — Record audio directly in the browser with real-time waveform visualization and animated pulse rings
- **📁 File Upload** — Drag-and-drop or browse to upload MP3, WAV, M4A, OGG audio files (up to 50MB)
- **📝 Text Analysis** — Paste or type any text for instant sentiment analysis
- **😊 Sentiment Detection** — Positive / Negative / Neutral classification with confidence score
- **💡 Emotion Breakdown** — Detects Joy, Sadness, Anger, Fear, Surprise, and Trust
- **🔑 Key Phrases** — Automatically extracts emotionally significant phrases
- **📊 Text Statistics** — Word count, sentence count, average sentence length
- **🏆 Top Words** — Frequency analysis of meaningful words
- **📜 History** — Searchable history of all past analyses (persisted in localStorage)
- **📋 Copy / Download** — Export transcriptions as plain text

---

## 🎨 Design

| Element | Detail |
|---|---|
| **Color Palette** | Warm ivory + sage-mint greens + coral accents |
| **Display Font** | Syne (800 weight) |
| **Body Font** | DM Sans |
| **Theme** | Light, airy, editorial |
| **Animations** | Floating orbs, waveform, ring pulses, emotion bars |

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
pip install flask
```

### 2. Run the app

```bash
python app.py
```

### 3. Open in browser

```
http://localhost:5000
```

---

## 📁 Project Structure

```
transcribe_app/
│
├── app.py                  # Flask backend + sentiment engine
├── requirements.txt        # Python dependencies
├── README.md               # This file
│
├── templates/
│   └── index.html          # Main HTML template (3 tabs)
│
└── static/
    ├── css/
    │   └── style.css       # Full UI styling (CSS variables, animations)
    └── js/
        └── app.js          # Frontend logic (recording, analysis, history)
```

---

## 🧠 How Sentiment Analysis Works

The app uses a built-in lexicon-based engine (no external ML dependencies):

1. **Tokenization** — Text split into words and sentences
2. **Polarity Scoring** — Words matched against curated positive/negative lexicons
3. **Score Calculation** — Normalized score from -1.0 (very negative) to +1.0 (very positive)
4. **Emotion Detection** — Keywords mapped to 6 core emotions (Plutchik's wheel)
5. **Key Phrase Extraction** — Bigrams anchored by sentiment words
6. **Word Frequency** — Top words after stop-word filtering

### Sentiment Thresholds
| Score | Label |
|---|---|
| > 0.05 | 😊 Positive |
| -0.05 to 0.05 | 😐 Neutral |
| < -0.05 | 😟 Negative |

---

## 🔧 Configuration

| Setting | Default | Description |
|---|---|---|
| `MAX_CONTENT_LENGTH` | 50 MB | Max audio file upload size |
| `host` | `0.0.0.0` | Bind address |
| `port` | `5000` | Port number |
| `debug` | `True` | Flask debug mode (set to False in production) |

---

## 🌐 API Endpoints

### `GET /`
Returns the main application page.

### `POST /analyze`
Analyze text for sentiment.

**Request:**
```json
{ "text": "Your text here" }
```

**Response:**
```json
{
  "sentiment": "positive",
  "score": 0.42,
  "confidence": 65,
  "positive_count": 4,
  "negative_count": 1,
  "emotions": { "joy": 60, "trust": 40 },
  "key_phrases": ["great work", "truly amazing"],
  "word_count": 38,
  "sentence_count": 3,
  "avg_sentence_length": 12.7,
  "top_words": [{ "word": "amazing", "count": 2 }]
}
```

### `POST /analyze_text`
Same as `/analyze` but also echoes back the transcription text.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| Flask | ≥ 2.3.0 | Web framework |

No external NLP libraries required — the sentiment engine is fully self-contained.

---

## 🔮 Extending the App

To add real audio transcription, integrate one of these APIs in `app.py`:

- **OpenAI Whisper API** — `openai.audio.transcriptions.create()`
- **Google Speech-to-Text** — `google.cloud.speech`
- **AssemblyAI** — REST API with webhook support
- **Deepgram** — Real-time streaming transcription

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Built with 💚 using Flask & vanilla JS — Transcribe App*
