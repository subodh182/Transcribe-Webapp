from flask import Flask, render_template, request, jsonify
import os
import json
import re
from collections import Counter

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

# Simple sentiment analysis without external dependencies
POSITIVE_WORDS = set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
    'happy', 'joy', 'love', 'like', 'best', 'beautiful', 'brilliant', 'perfect',
    'positive', 'success', 'win', 'winning', 'pleased', 'glad', 'thankful',
    'grateful', 'outstanding', 'superb', 'magnificent', 'incredible', 'marvelous',
    'delightful', 'exciting', 'enjoy', 'enjoyed', 'helpful', 'hope', 'hopeful',
    'optimistic', 'thrilled', 'proud', 'confidence', 'confident', 'strong',
    'innovative', 'creative', 'impressive', 'admire', 'celebrate', 'cheerful',
    'energetic', 'enthusiastic', 'inspiring', 'motivated', 'peaceful', 'productive',
    'refreshing', 'remarkable', 'satisfied', 'smart', 'supportive', 'terrific',
    'uplifting', 'vibrant', 'warmth', 'welcoming', 'wonderful', 'youthful'
])

NEGATIVE_WORDS = set([
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'hate', 'dislike',
    'sad', 'angry', 'upset', 'disappointing', 'disappointed', 'failure', 'fail',
    'failed', 'wrong', 'error', 'mistake', 'problem', 'issue', 'difficult',
    'hard', 'struggle', 'struggling', 'pain', 'painful', 'fear', 'afraid',
    'worried', 'worry', 'concern', 'concerned', 'frustrated', 'frustrating',
    'annoying', 'annoyed', 'boring', 'bored', 'dull', 'ugly', 'broken',
    'damaged', 'weak', 'slow', 'lazy', 'useless', 'waste', 'wasted',
    'dangerous', 'risk', 'risky', 'threat', 'harmful', 'hurt', 'lost',
    'missing', 'neglect', 'negative', 'never', 'none', 'nothing', 'doubt',
    'doubtful', 'impossible', 'miserable', 'overwhelmed', 'rejected', 'stuck'
])

EMOTION_KEYWORDS = {
    'joy': ['happy', 'joy', 'joyful', 'excited', 'thrilled', 'delighted', 'cheerful', 'elated', 'ecstatic'],
    'sadness': ['sad', 'unhappy', 'sorrow', 'grief', 'miserable', 'depressed', 'heartbroken', 'lonely', 'gloomy'],
    'anger': ['angry', 'furious', 'rage', 'mad', 'irritated', 'frustrated', 'annoyed', 'outraged', 'hostile'],
    'fear': ['afraid', 'scared', 'fear', 'terrified', 'anxious', 'worried', 'nervous', 'panic', 'dread'],
    'surprise': ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'unexpected', 'incredible'],
    'trust': ['trust', 'reliable', 'confident', 'secure', 'believe', 'faith', 'honest', 'loyal', 'certain']
}


def analyze_sentiment(text):
    if not text or not text.strip():
        return {
            'sentiment': 'neutral',
            'score': 0,
            'confidence': 0,
            'positive_count': 0,
            'negative_count': 0,
            'emotions': {},
            'key_phrases': [],
            'word_count': 0,
            'sentence_count': 0,
            'avg_sentence_length': 0,
            'top_words': []
        }

    # Tokenize
    words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
    sentences = re.split(r'[.!?]+', text.strip())
    sentences = [s.strip() for s in sentences if s.strip()]

    # Count sentiment words
    positive_count = sum(1 for w in words if w in POSITIVE_WORDS)
    negative_count = sum(1 for w in words if w in NEGATIVE_WORDS)
    total_sentiment = positive_count + negative_count

    # Calculate score (-1 to 1)
    if total_sentiment == 0:
        score = 0
        confidence = 0
    else:
        score = (positive_count - negative_count) / max(len(words), 1)
        score = max(-1, min(1, score * 10))  # Scale and clamp
        confidence = min(100, int((total_sentiment / max(len(words), 1)) * 200))

    # Determine sentiment label
    if score > 0.05:
        sentiment = 'positive'
    elif score < -0.05:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'

    # Emotion detection
    emotions = {}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        count = sum(1 for w in words if w in keywords)
        if count > 0:
            emotions[emotion] = min(100, count * 25)

    # Normalize emotions to percentages
    if emotions:
        total_emotion = sum(emotions.values())
        emotions = {k: round((v / total_emotion) * 100) for k, v in emotions.items()}

    # Key phrases (simple bigrams with sentiment words)
    key_phrases = []
    for i in range(len(words) - 1):
        if words[i] in POSITIVE_WORDS or words[i] in NEGATIVE_WORDS:
            phrase = f"{words[i]} {words[i+1]}"
            key_phrases.append(phrase)
        elif words[i+1] in POSITIVE_WORDS or words[i+1] in NEGATIVE_WORDS:
            phrase = f"{words[i]} {words[i+1]}"
            key_phrases.append(phrase)

    # Top words (excluding common stop words)
    stop_words = set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
                      'for', 'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been',
                      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                      'could', 'should', 'may', 'might', 'this', 'that', 'these',
                      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my',
                      'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which',
                      'who', 'how', 'when', 'where', 'why', 'not', 'no', 'so'])

    filtered_words = [w for w in words if w not in stop_words and len(w) > 2]
    word_freq = Counter(filtered_words)
    top_words = [{'word': w, 'count': c} for w, c in word_freq.most_common(10)]

    avg_sentence_length = round(len(words) / max(len(sentences), 1), 1)

    return {
        'sentiment': sentiment,
        'score': round(score, 3),
        'confidence': confidence,
        'positive_count': positive_count,
        'negative_count': negative_count,
        'emotions': emotions,
        'key_phrases': list(set(key_phrases))[:8],
        'word_count': len(words),
        'sentence_count': len(sentences),
        'avg_sentence_length': avg_sentence_length,
        'top_words': top_words
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    text = data.get('text', '')
    result = analyze_sentiment(text)
    return jsonify(result)


@app.route('/analyze_text', methods=['POST'])
def analyze_text():
    """Analyze pasted/typed text directly"""
    data = request.get_json()
    text = data.get('text', '')
    result = analyze_sentiment(text)
    result['transcription'] = text
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
