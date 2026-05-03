import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface RatingQuestion {
  question: string;
  description?: string;
}

interface RatingCategory {
  title: string;
  emoji: string;
  questions: RatingQuestion[];
}

const CATEGORIES: RatingCategory[] = [
  {
    title: 'Atmosphere',
    emoji: '🕯️',
    questions: [
      { question: 'Lighting', description: '1=Harsh fluorescent / 5=Warm, adjustable, relaxing' },
      { question: 'Music', description: '1=None or loud TV / 5=Thoughtfully curated, enhances relaxation' },
      { question: 'Temperature', description: '1=Uncomfortable / 5=Perfect, adjustable' },
      { question: 'Cleanliness', description: '1=Dirty or unhygienic / 5=Spa-level, spotless' },
      { question: 'Ambiance', description: 'Describe the overall vibe in one sentence' },
    ],
  },
  {
    title: 'Space',
    emoji: '🚪',
    questions: [
      { question: 'Privacy', description: '1=Shared room / 5=Excellent private suite' },
      { question: 'Table Comfort', description: '1=Worn or uncomfortable / 5=Heated table, premium linens' },
      { question: 'Room Size', description: '1=Cramped / 5=Spacious and luxurious' },
    ],
  },
  {
    title: 'Therapist',
    emoji: '💆',
    questions: [
      { question: 'Professionalism', description: 'Greeted on time? Clean appearance? Asked about health conditions?' },
      { question: 'Technique', description: '1=Poor or unqualified / 5=Exceptional, intuitive, expert level' },
      { question: 'Communication', description: 'Asked about pressure? Checked in during session?' },
      { question: 'Knowledge', description: 'Seemed to understand anatomy and problem areas?' },
    ],
  },
  {
    title: 'Logistics',
    emoji: '📋',
    questions: [
      { question: 'Ease of Booking', description: 'How easy was it to book? (phone / WhatsApp / online / walk-in)' },
      { question: 'Punctuality', description: 'Did session start on time? Any rushing?' },
      { question: 'Price Transparency', description: 'Were prices clear before booking? Any surprises?' },
      { question: 'Value for Money', description: '1=Very overpriced / 5=Exceptional value' },
    ],
  },
];

const SCORE_LABELS = ['', '😞 Poor', '😐 Fair', '🙂 Okay', '😊 Good', '🤩 Excellent'];

interface Ratings {
  [category: string]: {
    [question: string]: string | boolean;
  };
}

export default function ReviewSubmission() {
  const navigation = useNavigation();
  const [step, setStep] = useState<'intro' | 'rubric' | 'overall' | 'photos' | 'submit'>('intro');
  const [currentCategory, setCurrentCategory] = useState(0);
  const [ratings, setRatings] = useState<Ratings>({});
  const [overallScore, setOverallScore] = useState(5);
  const [wouldReturn, setWouldReturn] = useState(true);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [bestFor, setBestFor] = useState('');
  const [bestThing, setBestThing] = useState('');
  const [biggestDrawback, setBiggestDrawback] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleScore = (category: string, question: string, score: number) => {
    setRatings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [question]: score,
      },
    }));
  };

  const handleTextAnswer = (category: string, question: string, text: string) => {
    setRatings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [question]: text,
      },
    }));
  };

  const cat = CATEGORIES[currentCategory];
  const catKey = cat.title;
  const isSliderQ = (q: RatingQuestion) =>
    q.question !== 'Ease of Booking' && q.question !== 'Ambiance';

  const canProceed = () => {
    const catRatings = ratings[catKey] || {};
    return cat.questions.every(q => catRatings[q.question] !== undefined && catRatings[q.question] !== '');
  };

  const submitReview = async () => {
    setSubmitting(true);
    // Simulate Supabase insert
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    setStep('submit');
  };

  // ── INTRO ──────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🔎</Text>
          <Text style={styles.heroTitle}>Studio Review</Text>
          <Text style={styles.heroSubtitle}>
            You're reviewing this studio on behalf of Massage Club. Your review goes to our team
            before the studio goes live — so be honest and thorough.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happens:</Text>
          {[
            'Fill out the rubric — atmosphere, space, therapist, logistics',
            'Rate each category 1–5 with honest feedback',
            'Upload at least 2 photos (exterior + interior)',
            'Submit — our team reviews within 24 hours',
          ].map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>✅</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Be honest</Text>
          <Text style={styles.cardBody}>
            Your review helps us decide whether to list this studio. If it's not good enough, we
            won't list it. That's the whole point.
          </Text>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => setStep('rubric')}>
          <Text style={styles.btnPrimaryText}>Start Review →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RUBRIC ────────────────────────────────────────────────────────────
  if (step === 'rubric') {
    return (
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progressBar}>
          {CATEGORIES.map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= currentCategory && styles.progressDotActive]}
            />
          ))}
        </View>
        <Text style={styles.stepLabel}>
          {cat.emoji} {cat.title} — {currentCategory + 1} of {CATEGORIES.length}
        </Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {cat.questions.map((q, qi) => {
            const val = (ratings[catKey]?.[q.question] as number) || 0;
            return (
              <View key={qi} style={styles.questionCard}>
                <Text style={styles.questionText}>{q.question}</Text>
                {q.description && (
                  <Text style={styles.questionDesc}>{q.description}</Text>
                )}
                {isSliderQ(q) ? (
                  <View style={styles.sliderRow}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.scoreBtn, val === s && styles.scoreBtnActive]}
                        onPress={() => handleScore(catKey, q.question, s)}
                      >
                        <Text style={[styles.scoreBtnText, val === s && styles.scoreBtnTextActive]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Your answer..."
                    placeholderTextColor="#555"
                    value={(ratings[catKey]?.[q.question] as string) || ''}
                    onChangeText={t => handleTextAnswer(catKey, q.question, t)}
                    multiline
                  />
                )}
                {val > 0 && (
                  <Text style={styles.scoreLabel}>{SCORE_LABELS[val]}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.navRow}>
          {currentCategory > 0 ? (
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => setCurrentCategory(c => c - 1)}
            >
              <Text style={styles.btnSecondaryText}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {currentCategory < CATEGORIES.length - 1 ? (
            <TouchableOpacity
              style={[styles.btnPrimary, !canProceed() && styles.btnDisabled]}
              disabled={!canProceed()}
              onPress={() => setCurrentCategory(c => c + 1)}
            >
              <Text style={styles.btnPrimaryText}>
                Next: {CATEGORIES[currentCategory + 1].emoji} →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, !canProceed() && styles.btnDisabled]}
              disabled={!canProceed()}
              onPress={() => setStep('overall')}
            >
              <Text style={styles.btnPrimaryText}>Overall Score →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── OVERALL ───────────────────────────────────────────────────────────
  if (step === 'overall') {
    return (
      <View style={styles.container}>
        <Text style={styles.stepLabel}>⭐ Overall Assessment</Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Overall Score (1–10)</Text>
            <Text style={styles.questionDesc}>How was the experience overall?</Text>
            <View style={styles.sliderRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.scoreBtn, styles.scoreBtnWide, overallScore === s && styles.scoreBtnActive]}
                  onPress={() => setOverallScore(s)}
                >
                  <Text style={[styles.scoreBtnText, overallScore === s && styles.scoreBtnTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Would you return?</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>No</Text>
              <Switch
                value={wouldReturn}
                onValueChange={setWouldReturn}
                trackColor={{ false: '#333', true: '#f5a623' }}
                thumbColor="#fff"
              />
              <Text style={styles.switchLabel}>Yes</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Would you recommend to a friend?</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>No</Text>
              <Switch
                value={wouldRecommend}
                onValueChange={setWouldRecommend}
                trackColor={{ false: '#333', true: '#f5a623' }}
                thumbColor="#fff"
              />
              <Text style={styles.switchLabel}>Yes</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Best thing about this studio?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. The hot stone technique was incredible..."
              placeholderTextColor="#555"
              value={bestThing}
              onChangeText={setBestThing}
              multiline
            />
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Biggest drawback?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Music was too loud, room was cold..."
              placeholderTextColor="#555"
              value={biggestDrawback}
              onChangeText={setBiggestDrawback}
              multiline
            />
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.questionText}>Who is this studio best for?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Office workers with tight shoulders and upper back pain..."
              placeholderTextColor="#555"
              value={bestFor}
              onChangeText={setBestFor}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep('rubric')}>
            <Text style={styles.btnSecondaryText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, !bestThing && !biggestDrawback && styles.btnDisabled]}
            disabled={!bestThing && !biggestDrawback}
            onPress={() => setStep('photos')}
          >
            <Text style={styles.btnPrimaryText}>Add Photos →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PHOTOS ────────────────────────────────────────────────────────────
  if (step === 'photos') {
    return (
      <View style={styles.container}>
        <Text style={styles.stepLabel}>📸 Photos (minimum 2 required)</Text>

        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Take or upload at least 2 photos. Required: exterior + interior. Optional: massage room,
            products used, lobby.
          </Text>
        </View>

        <View style={styles.photoGrid}>
          {[0, 1, 2, 3].map(i => (
            <TouchableOpacity
              key={i}
              style={[styles.photoSlot, photos[i] && styles.photoSlotFilled]}
              onPress={() => {
                // In production: open camera or image picker
                Alert.alert(
                  'Add Photo',
                  'Camera and gallery integration goes here',
                  [{ text: 'OK' }]
                );
              }}
            >
              {photos[i] ? (
                <Image source={{ uri: photos[i] }} style={styles.photoThumb} />
              ) : (
                <Text style={styles.photoPlus}>+</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.photoHint}>
          <Text style={styles.photoHintText}>📷 Exterior  📷 Interior  📷 Room  📷 Optional</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep('overall')}>
            <Text style={styles.btnSecondaryText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, photos.length < 2 && styles.btnDisabled]}
            disabled={photos.length < 2}
            onPress={submitReview}
          >
            <Text style={styles.btnPrimaryText}>
              {submitting ? 'Submitting...' : 'Submit Review →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── CONFIRMATION ──────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🎉</Text>
        <Text style={styles.heroTitle}>Review Submitted!</Text>
        <Text style={styles.heroSubtitle}>
          Our team will review it within 24 hours. If it passes our standards, this studio goes
          live on Massage Club.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What you covered:</Text>
        {CATEGORIES.map((c, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bullet}>{c.emoji}</Text>
            <Text style={styles.bulletText}>{c.title}</Text>
          </View>
        ))}
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>⭐</Text>
          <Text style={styles.bulletText}>Overall: {overallScore}/10</Text>
        </View>
        <View style={styles.bulletRow}>
          <Text style={styles.bullet}>📸</Text>
          <Text style={styles.bulletText}>{photos.length} photos uploaded</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.btnSecondaryText}>← Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    padding: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f5a623',
    marginBottom: 10,
  },
  cardBody: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    fontSize: 14,
  },
  bulletText: {
    fontSize: 13,
    color: '#ccc',
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: '#f5a623',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPrimaryText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  btnSecondaryText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e1e2e',
  },
  progressDotActive: {
    backgroundColor: '#f5a623',
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  questionCard: {
    backgroundColor: '#111118',
    borderWidth: 1,
    borderColor: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  questionDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  scoreBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  scoreBtnWide: {
    height: 36,
  },
  scoreBtnActive: {
    backgroundColor: '#f5a623',
    borderColor: '#f5a623',
  },
  scoreBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  scoreBtnTextActive: {
    color: '#000',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#f5a623',
    marginTop: 6,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#0a0a0f',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#888',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  photoSlot: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: '#111118',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1e1e2e',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlotFilled: {
    borderStyle: 'solid',
    borderColor: '#f5a623',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  photoPlus: {
    fontSize: 32,
    color: '#333',
  },
  photoHint: {
    marginTop: 12,
    alignItems: 'center',
  },
  photoHintText: {
    fontSize: 12,
    color: '#555',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a24',
  },
});
