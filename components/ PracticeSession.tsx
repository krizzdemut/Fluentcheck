import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, Topic, WordData, DifficultyLevel, GrammarAnalysis } from '../types';
import { analyzePronunciation, generateSpeech, checkGrammar } from '../services/gemini';
import { decodePcmAudioData } from '../utils/audioUtils';
import { Mic, Square, Volume2, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Send, Sparkles, Lightbulb } from 'lucide-react';
import { TeacherAudioPlayer } from './TeacherAudioPlayer';

interface PracticeSessionProps {
  topic: Topic;
  paragraph: string;
  questions: string[];
  difficulty: DifficultyLevel;
  onBack: () => void;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({ topic, paragraph, questions, difficulty, onBack }) => {
  // --- Audio/Pronunciation State ---
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlayingModelAudio, setIsPlayingModelAudio] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [words, setWords] = useState<WordData[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Comprehension/Grammar State ---
  const [answers, setAnswers] = useState<string[]>(['', '']);
  const [grammarResults, setGrammarResults] = useState<(GrammarAnalysis | null)[]>([null, null]);
  const [checkingGrammar, setCheckingGrammar] = useState<boolean[]>([false, false]);

  useEffect(() => {
    const rawWords = paragraph.split(/\s+/);
    const wordObjects: WordData[] = rawWords.map((word, index) => {
      const clean = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();
      return {
        id: `w-${index}-${clean}`,
        word: word,
        cleanWord: clean,
        isMispronounced: false,
      };
    });
    setWords(wordObjects);
    setAnalysis(null);
    setAnswers(['', '']);
    setGrammarResults([null, null]);
  }, [paragraph]);

  useEffect(() => {
    if (analysis) {
      const badWords = new Set(analysis.mispronouncedWords.map(w => w.toLowerCase()));
      setWords(prev => prev.map(w => ({
        ...w,
        isMispronounced: badWords.has(w.cleanWord)
      })));

      playHintSound(analysis.mispronouncedWords.length === 0);
    }
  }, [analysis]);

  const playHintSound = (isSuccess: boolean) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (isSuccess) {
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      osc.type = "sine";
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.3);
      
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.3);
    }
  };

  const startRecording = async () => {
    // Stop any playing teacher audio before student speaks
    window.dispatchEvent(new CustomEvent('teacher-audio-stop-all'));
    setIsPlayingModelAudio(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        handleAnalysis(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setAnalysis(null);
      setWords(prev => prev.map(w => ({ ...w, isMispronounced: false })));

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalysis = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzePronunciation(audioBlob, paragraph, difficulty);
      setAnalysis(result);
    } catch (error) {
      alert("Something went wrong analyzing your audio.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReadOutLoud = async () => {
    if (isPlayingModelAudio) return;
    setIsPlayingModelAudio(true);

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 'Kore' is the standard US female voice
      const pcmData = await generateSpeech(paragraph, 'Kore');
      const audioBuffer = decodePcmAudioData(pcmData, ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlayingModelAudio(false);
      source.start(0);

    } catch (error) {
      console.error("TTS Error", error);
      setIsPlayingModelAudio(false);
      alert("Could not generate speech audio.");
    }
  };

  const handleWordClick = (word: WordData) => {
    const utterance = new SpeechSynthesisUtterance(word.cleanWord);
    utterance.lang = 'en-US';
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v => v.name.includes('Samantha') || 
           v.name.includes('Google US English') || 
           v.name.includes('Daniel')
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  // --- Comprehension Functions ---

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    // Reset grammar result if user types again
    if (grammarResults[index]) {
      const newResults = [...grammarResults];
      newResults[index] = null;
      setGrammarResults(newResults);
    }
  };

  const handleCheckGrammar = async (index: number) => {
    if (!answers[index].trim()) return;

    const newChecking = [...checkingGrammar];
    newChecking[index] = true;
    setCheckingGrammar(newChecking);

    try {
      const result = await checkGrammar(questions[index], answers[index]);
      const newResults = [...grammarResults];
      newResults[index] = result;
      setGrammarResults(newResults);
    } catch (error) {
      alert("Could not check grammar.");
    } finally {
      const newChecking = [...checkingGrammar];
      newChecking[index] = false;
      setCheckingGrammar(newChecking);
    }
  };

  const renderMarkedAnswer = (markedText: string) => {
    // Regex to find content inside [[ ]]
    const parts = markedText.split(/(\[\[.*?\]\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const content = part.slice(2, -2);
        return (
          <span key={i} className="text-red-400 font-semibold bg-red-400/10 px-1 rounded mx-0.5 line-through decoration-2">
            {content}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getDifficultyLabel = (level: DifficultyLevel) => {
    switch (level) {
      case DifficultyLevel.INTERMEDIATE: return 'Level B1/B2 (Intermediate)';
      case DifficultyLevel.ADVANCED: return 'Level C1/C2 (Advanced)';
      default: return 'Level A1/A2 (Beginner)';
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Navigation */}
      <button 
        onClick={onBack}
        className="group flex items-center text-slate-400 hover:text-orange-500 transition-colors mb-8 font-medium text-sm"
      >
        <div className="bg-slate-800 rounded-full p-2 mr-3 shadow-sm group-hover:shadow-md transition-all border border-slate-700/50">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Back to Topics
      </button>

      {/* Main Card */}
      <div className="bg-slate-800 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.2)] overflow-hidden mb-12 border border-slate-700/50">
        
        {/* Header Section */}
        <div className="px-8 py-8 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              {getDifficultyLabel(difficulty)}
            </span>
            <h2 className="text-3xl font-semibold text-slate-100 tracking-tight">{topic}</h2>
          </div>
          
          <TeacherAudioPlayer
            id="main-paragraph-player"
            text={paragraph}
            voiceName="Kore"
            label="Listen to Teacher"
            variant="banner"
            disabled={isRecording}
            onPlayStateChange={(playing) => setIsPlayingModelAudio(playing)}
          />
        </div>


        <div className="p-8 md:p-12">
          {/* Main Text Area */}
          <div className="prose prose-xl max-w-none text-slate-200 leading-loose">
            <p>
              {words.map((wordData) => (
                <span
                  key={wordData.id}
                  onClick={() => handleWordClick(wordData)}
                  title="Tap to listen"
                  className={`
                    inline-block mr-2 px-1 rounded-md cursor-pointer transition-all duration-200 select-none
                    ${wordData.isMispronounced 
                      ? 'text-red-400 bg-red-400/10 font-medium decoration-red-400/30 underline decoration-2 underline-offset-4' 
                      : 'hover:bg-orange-500/10 hover:text-orange-500'}
                  `}
                >
                  {wordData.word}
                </span>
              ))}
            </p>
          </div>

          {/* Controls & Status */}
          <div className="mt-16 flex flex-col items-center justify-center">
             {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center animate-pulse">
                  <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                  </div>
                  <span className="text-slate-400 font-medium">Analyzing pronunciation...</span>
                </div>
              ) : (
                <>
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={isPlayingModelAudio}
                      className="group relative flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white w-20 h-20 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Mic className="w-8 h-8" strokeWidth={2} />
                      <span className="absolute -bottom-8 text-sm font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Tap to Speak</span>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center">
                      <button
                        onClick={stopRecording}
                        className="flex items-center justify-center bg-red-500 hover:bg-red-600 text-white w-20 h-20 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 animate-pulse"
                      >
                        <Square className="w-8 h-8 fill-current" />
                      </button>
                      <span className="mt-4 text-sm font-medium text-red-400 animate-pulse">Recording in progress...</span>
                    </div>
                  )}
                </>
              )}
          </div>

          {/* Feedback Section */}
          {analysis && !isAnalyzing && (
            <div className="mt-12 bg-slate-700/50 rounded-3xl p-8 animate-fade-in border border-slate-600/50">
              <div className="flex items-start gap-4">
                 <div className={`p-3 rounded-full shrink-0 ${analysis.mispronouncedWords.length === 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                   {analysis.mispronouncedWords.length === 0 ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                 </div>
                 <div className="flex-1">
                   <h3 className="text-lg font-semibold text-slate-100 mb-1">Pronunciation Feedback</h3>
                   <p className="text-slate-300 leading-relaxed">{analysis.feedback}</p>
                   
                   {analysis.mispronouncedWords.length > 0 && (
                     <div className="mt-6">
                       <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Words to improve</p>
                       <div className="flex flex-wrap gap-2">
                         {analysis.mispronouncedWords.map((w, i) => (
                           <button 
                              key={i} 
                              onClick={() => handleWordClick({ id: `err-${i}`, word: w, cleanWord: w, isMispronounced: true })}
                              className="text-sm font-medium bg-slate-800 text-slate-200 px-4 py-2 rounded-full shadow-sm border border-slate-600/50 hover:bg-slate-700 hover:text-orange-500 transition-colors"
                              title="Tap to listen"
                           >
                             {w}
                           </button>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comprehension Check Section */}
      <div className="bg-slate-800 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.2)] overflow-hidden border border-slate-700/50">
        <div className="px-8 py-6 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-slate-100">Comprehension Check</h3>
          </div>
          <p className="text-sm text-slate-400 mt-1">Answer the questions below to practice your writing.</p>
        </div>

        <div className="p-8 space-y-10">
          {questions.map((question, index) => (
            <div key={index} className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="font-medium text-slate-200 text-lg">{index + 1}. {question}</p>
                <TeacherAudioPlayer
                  id={`q-${index}`}
                  text={question}
                  voiceName="Kore"
                  label="Listen to Teacher"
                  variant="pill"
                  disabled={isRecording}
                  className="self-start sm:self-auto shrink-0"
                />
              </div>
              
              <div className="relative">
                <textarea
                  value={answers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  placeholder="Type your answer here..."
                  className={`
                    w-full p-4 rounded-xl border border-slate-600 bg-slate-700/50 
                    focus:bg-slate-700 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all
                    resize-none min-h-[100px] text-slate-200 placeholder-slate-500
                    ${grammarResults[index] ? 'border-none bg-slate-700/80' : ''}
                  `}
                  disabled={checkingGrammar[index]}
                />
                {!grammarResults[index] && answers[index].length > 0 && (
                   <button
                    onClick={() => handleCheckGrammar(index)}
                    disabled={checkingGrammar[index]}
                    className="absolute bottom-3 right-3 bg-orange-500 text-white p-2 rounded-lg shadow-md hover:bg-orange-600 transition-all disabled:opacity-50"
                    title="Check Grammar"
                   >
                     {checkingGrammar[index] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                )}
              </div>

              {/* Grammar Result Feedback */}
              {grammarResults[index] && (
                <div className="animate-fade-in-up bg-slate-700/50 rounded-xl p-5 border border-slate-600/50">
                  <div className="flex gap-3 mb-3">
                    {grammarResults[index]?.isCorrect ? (
                      <div className="bg-green-500/20 text-green-400 p-1.5 rounded-full h-fit">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="bg-orange-500/20 text-orange-400 p-1.5 rounded-full h-fit">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-100 mb-1">
                        {grammarResults[index]?.isCorrect ? "Good job!" : "Needs Improvement"}
                      </p>
                      <p className="text-sm text-slate-300 leading-relaxed mb-3">{grammarResults[index]?.feedback}</p>
                      
                      {/* Common Mistakes Section */}
                      {grammarResults[index]?.commonMistakes && (
                        <div className="flex gap-2 items-start bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
                          <Lightbulb className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-orange-500 text-xs font-bold uppercase tracking-wide block mb-1">Common Mistakes</span>
                            <p className="text-sm text-slate-300">{grammarResults[index]?.commonMistakes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!grammarResults[index]?.isCorrect && (
                    <div className="pl-10 space-y-3 mt-4">
                       <div className="text-sm">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wide block mb-1">Your Errors</span>
                          <p className="text-slate-200 leading-relaxed">
                            {renderMarkedAnswer(grammarResults[index]!.markedAnswer)}
                          </p>
                       </div>
                       <div className="text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-slate-500 text-xs font-bold uppercase tracking-wide block">Better way to say it</span>
                            {grammarResults[index]?.correction && (
                              <TeacherAudioPlayer
                                id={`corr-${index}`}
                                text={grammarResults[index]!.correction}
                                voiceName="Kore"
                                label="Listen to Teacher"
                                variant="pill"
                                disabled={isRecording}
                              />
                            )}
                          </div>
                          <p className="text-orange-500 font-medium leading-relaxed">
                            {grammarResults[index]?.correction}
                          </p>
                       </div>
                    </div>
                  )}

                  
                  <button 
                    onClick={() => {
                        const newResults = [...grammarResults];
                        newResults[index] = null;
                        setGrammarResults(newResults);
                    }}
                    className="text-xs font-medium text-slate-400 hover:text-slate-200 mt-4 underline decoration-slate-600 underline-offset-4 ml-10"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
