from flask import Flask, render_template, request, jsonify
import re
from collections import Counter

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

POSITIVE_WORDS = {
    'good','great','excellent','amazing','wonderful','fantastic','awesome',
    'happy','joy','love','like','best','beautiful','brilliant','perfect',
    'positive','success','win','winning','pleased','glad','thankful',
    'grateful','outstanding','superb','magnificent','incredible','marvelous',
    'delightful','exciting','enjoy','enjoyed','helpful','hope','hopeful',
    'optimistic','thrilled','proud','confidence','confident','strong',
    'innovative','creative','impressive','admire','celebrate','cheerful',
    'energetic','enthusiastic','inspiring','motivated','peaceful','productive',
    'refreshing','remarkable','satisfied','smart','supportive','terrific',
    'uplifting','vibrant','warmth','welcoming','youthful','lovely','nice',
    'fun','interesting','engaging','passionate','dedicated','kind','caring',
    'friendly','generous','honest','loyal','trustworthy','reliable','capable',
    'skilled','talented','gifted','blessed','fortunate','lucky','excited',
    'joyful','blissful','content','serene','calm','comfortable','safe',
    'secure','valued','appreciated','respected','admired','praised','loved',
    'adored','cherished','treasured','important','meaningful','significant',
    'powerful','effective','efficient','thriving','better','improved','clear'
}

NEGATIVE_WORDS = {
    'bad','terrible','awful','horrible','poor','worst','hate','dislike',
    'sad','angry','upset','disappointing','disappointed','failure','fail',
    'failed','wrong','error','mistake','problem','issue','difficult',
    'hard','struggle','struggling','pain','painful','fear','afraid',
    'worried','worry','concern','concerned','frustrated','frustrating',
    'annoying','annoyed','boring','bored','dull','ugly','broken',
    'damaged','weak','slow','lazy','useless','waste','wasted',
    'dangerous','risk','risky','threat','harmful','hurt','lost',
    'missing','neglect','negative','never','none','nothing','doubt',
    'doubtful','impossible','miserable','overwhelmed','rejected','stuck',
    'tired','exhausted','stressed','anxious','nervous','scared','terrified',
    'hopeless','helpless','powerless','worthless','stupid','dumb','foolish',
    'careless','reckless','irresponsible','dishonest','unfair','cruel',
    'mean','harsh','rude','selfish','greedy','corrupt','ruined','destroyed',
    'sick','ill','suffer','suffering','agony','misery','grief','sorrow',
    'despair','depression','loneliness','isolation','abandoned','fake','lie',
    'lied','lying','cheat','cheated','betrayed','broken','mess','disaster'
}

INTENSIFIERS = {'very','extremely','absolutely','completely','totally','really','so','quite','incredibly','hugely','deeply','truly','highly','super'}
NEGATORS = {'not','no','never','neither','nor','without','lack','lacks','lacking',"n't","cannot","cant"}

EMOTION_KEYWORDS = {
    'joy':      ['happy','joy','joyful','excited','thrilled','delighted','cheerful','elated','ecstatic','blissful','wonderful','love','celebrate','fun','laugh','smile','fantastic','amazing','best','great'],
    'sadness':  ['sad','unhappy','sorrow','grief','miserable','depressed','heartbroken','lonely','gloomy','tears','cry','miss','lost','empty','hopeless','alone','hurt'],
    'anger':    ['angry','furious','rage','mad','irritated','frustrated','annoyed','outraged','hate','resent','bitter','enraged','livid','upset'],
    'fear':     ['afraid','scared','fear','terrified','anxious','worried','nervous','panic','dread','frightened','threatened','uneasy','apprehensive'],
    'surprise': ['surprised','shocked','amazed','astonished','stunned','unexpected','incredible','unbelievable','wow','suddenly'],
    'trust':    ['trust','reliable','confident','secure','believe','faith','honest','loyal','certain','sure','depend','integrity','safe'],
    'disgust':  ['disgusting','gross','nasty','revolting','awful','horrible','terrible','hate','loathe','despise'],
    'anticipation': ['hope','expect','eager','soon','future','plan','goal','dream','looking','forward','anticipate']
}


def analyze_sentiment(text):
    if not text or not text.strip():
        return _empty_result()

    words = re.findall(r"\b[a-zA-Z']+\b", text.lower())
    sentences = [s.strip() for s in re.split(r'[.!?]+', text.strip()) if s.strip()]

    pos_score = 0.0
    neg_score = 0.0
    pos_words_found = []
    neg_words_found = []

    for i, word in enumerate(words):
        clean = word.strip("'")
        window = words[max(0,i-3):i]
        negated = any(n in window for n in NEGATORS)
        intensity = 1.6 if i > 0 and words[i-1] in INTENSIFIERS else 1.0

        if clean in POSITIVE_WORDS:
            if negated:
                neg_score += intensity
                neg_words_found.append(clean)
            else:
                pos_score += intensity
                pos_words_found.append(clean)
        elif clean in NEGATIVE_WORDS:
            if negated:
                pos_score += intensity * 0.5
            else:
                neg_score += intensity
                neg_words_found.append(clean)

    total = pos_score + neg_score
    if total == 0:
        raw_score = 0.0
        confidence = 5
    else:
        raw_score = (pos_score - neg_score) / (len(words) + 1)
        raw_score = max(-1.0, min(1.0, raw_score * 8))
        confidence = min(95, int((total / max(len(words), 1)) * 300))

    if raw_score > 0.06:
        sentiment = 'positive'
    elif raw_score < -0.06:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'

    # Emotions
    emotions = {}
    for emotion, kws in EMOTION_KEYWORDS.items():
        count = sum(words.count(k) for k in kws)
        if count > 0:
            emotions[emotion] = count

    if emotions:
        total_e = sum(emotions.values())
        emotions = {k: round((v/total_e)*100) for k,v in
                    sorted(emotions.items(), key=lambda x:-x[1])}

    key_phrases = set()
    for i, w in enumerate(words):
        if w in POSITIVE_WORDS or w in NEGATIVE_WORDS:
            if i > 0 and len(words[i-1]) > 2:
                key_phrases.add(f"{words[i-1]} {w}")
            if i < len(words)-1 and len(words[i+1]) > 2:
                key_phrases.add(f"{w} {words[i+1]}")

    stops = {'the','a','an','and','or','but','in','on','at','to','for','of',
             'with','is','are','was','were','be','been','have','has','had',
             'do','does','did','will','would','could','should','may','might',
             'this','that','these','those','i','you','he','she','it','we',
             'they','my','your','his','her','its','our','their','what',
             'which','who','how','when','where','why','not','no','so',
             'just','very','really','quite','also','then','than','about',
             'get','got','going','come','came','said','says','know','think'}

    filtered = [w for w in words if w not in stops and len(w) > 2]
    freq = Counter(filtered)
    top_words = [{'word': w, 'count': c} for w,c in freq.most_common(12)]
    avg_len = round(len(words) / max(len(sentences),1), 1)

    return {
        'sentiment': sentiment,
        'score': round(raw_score, 3),
        'confidence': confidence,
        'positive_count': len(pos_words_found),
        'negative_count': len(neg_words_found),
        'positive_words': list(set(pos_words_found))[:8],
        'negative_words': list(set(neg_words_found))[:8],
        'emotions': emotions,
        'key_phrases': list(key_phrases)[:10],
        'word_count': len(words),
        'sentence_count': len(sentences),
        'avg_sentence_length': avg_len,
        'top_words': top_words,
        'readability': _readability(avg_len)
    }


def _readability(avg):
    if avg < 8:   return 'Simple'
    if avg < 14:  return 'Moderate'
    if avg < 20:  return 'Complex'
    return 'Very Complex'


def _empty_result():
    return {
        'sentiment':'neutral','score':0,'confidence':0,
        'positive_count':0,'negative_count':0,
        'positive_words':[],'negative_words':[],
        'emotions':{},'key_phrases':[],'word_count':0,
        'sentence_count':0,'avg_sentence_length':0,
        'top_words':[],'readability':'—'
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    text = data.get('text','').strip()
    if not text:
        return jsonify({'error':'No text provided'}), 400
    return jsonify(analyze_sentiment(text))


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
