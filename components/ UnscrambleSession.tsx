import React, { useState, useEffect } from 'react';
import { UnscrambleSentence, DifficultyLevel } from '../types';
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCcw, MoveRight } from 'lucide-react';
import { TeacherAudioPlayer } from './TeacherAudioPlayer';

interface UnscrambleSessionProps {
  sentences: UnscrambleSentence[];
  difficulty: DifficultyLevel;
  onBack: () => void;
  onNewGame: (difficulty: DifficultyLevel) => void;
  isLoading: boolean;
}

export const UnscrambleSession: React.FC<UnscrambleSessionProps> = ({ 
  sentences, 
  difficulty, 
  onBack,
  onNewGame,
  isLoading 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [availableWords, setAvailableWords] = useState<{id: string, text: string}[]>([]);
  const [userWords, setUserWords] = useState<{id: string, text: string}[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  const currentSentence = sentences[currentIndex];
  const isLastSentence = currentIndex === sentences.length - 1;

  useEffect(() => {
    if (currentSentence) {
      // Create unique IDs for words
      const words = currentSentence.scrambled.map((w, i) => ({
        id: `word-${i}-${Math.random().toString(36).substr(2, 9)}`,
        text: w
      }));
      setAvailableWords(words);
      setUserWords([]);
      setShowResult(false);
      setIsCorrect(false);
    }
  }, [currentSentence]);

  const moveWordToAnswer = (word: {id: string, text: string}) => {
    if (showResult) return;
    setAvailableWords(prev => prev.filter(w => w.id !== word.id));
    setUserWords(prev => [...prev, word]);
  };

  const moveWordToBank = (word: {id: string, text: string}) => {
    if (showResult) return;
    setUserWords(prev => prev.filter(w => w.id !== word.id));
    setAvailableWords(prev => [...prev, word]);
  };

  const handleCheck = () => {
    const userAnswer = userWords.map(w => w.text).join(' ');
    // Simple normalization
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    const correct = normalize(currentSentence.correctSentence);
    const user = normalize(userAnswer);
    
    const isMatch = user === correct;
    
    setIsCorrect(isMatch);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onNewGame(difficulty);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack}
          className="group flex items-center text-slate-400 hover:text-orange-500 transition-colors font-medium text-sm"
        >
          <div className="bg-slate-800 rounded-full p-2 mr-3 shadow-sm group-hover:shadow-md transition-all border border-slate-700/50">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Menu
        </button>
        <span className="text-sm font-semibold text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/50">
           {currentIndex + 1} / {sentences.length}
        </span>
      </div>

      <div className="bg-slate-800 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.2)] overflow-hidden p-8 md:p-12 min-h-[600px] flex flex-col items-center border border-slate-700/50">
        
        {/* Grammar Point Label */}
        <div className="text-center mb-8">
           <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500 mb-2 block">
              {difficulty} Grammar
            </span>
           <h2 className="text-2xl font-semibold text-slate-100">
             {currentSentence.grammarPoint}
           </h2>
        </div>

        {/* Answer Area (Construction Zone) */}
        <div className="w-full mb-8">
            <p className="text-center text-slate-400 text-sm mb-3 font-medium">Your Sentence:</p>
            <div className={`
              min-h-[100px] w-full rounded-2xl bg-slate-700/50 border-2 border-dashed transition-all duration-300 flex flex-wrap gap-3 items-center justify-center p-6
              ${showResult 
                ? (isCorrect ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10') 
                : 'border-slate-600'}
            `}>
               {userWords.length === 0 && (
                 <span className="text-slate-500 text-sm font-medium animate-pulse select-none">Tap words below to build the sentence</span>
               )}
               
               {userWords.map((word) => (
                 <button
                   key={word.id}
                   onClick={() => moveWordToBank(word)}
                   disabled={showResult}
                   className="animate-pop-in bg-slate-800 text-slate-200 shadow-sm border border-slate-600 px-4 py-2 rounded-xl font-medium text-lg transition-transform active:scale-95 hover:border-orange-500"
                 >
                   {word.text}
                 </button>
               ))}
            </div>
        </div>

        {/* Word Bank */}
        <div className="w-full mb-10">
           <div className="flex flex-wrap gap-3 justify-center min-h-[60px]">
              {availableWords.map((word) => (
                <button
                  key={word.id}
                  onClick={() => moveWordToAnswer(word)}
                  disabled={showResult}
                  className="bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-600 px-4 py-2 rounded-xl font-medium text-lg shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {word.text}
                </button>
              ))}
           </div>
        </div>

        {/* Action Button - Orange */}
        <div className="mb-8">
          <button
            onClick={handleCheck}
            disabled={userWords.length === 0 || showResult}
            className={`
              px-8 py-3.5 rounded-full font-semibold shadow-lg transition-all transform
              ${showResult 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-105 shadow-orange-500/30'}
            `}
          >
            I'm happy with my answer
          </button>
        </div>

        {/* Result Section - Appears BELOW the button */}
        {showResult && (
          <div className="w-full max-w-lg animate-fade-in-up border-t border-slate-700/50 pt-8 flex flex-col items-center">
             
             {/* Feedback Header */}
             <div className="flex items-center gap-2 mb-4">
                 {isCorrect ? (
                   <CheckCircle2 className="w-6 h-6 text-green-400" />
                 ) : (
                   <AlertCircle className="w-6 h-6 text-red-400" />
                 )}
                 <span className={`text-xl font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                   {isCorrect ? "Correct!" : "Nice try!"}
                 </span>
             </div>

             {/* Correct Sentence Display */}
             <div className="bg-slate-700/50 w-full p-6 rounded-2xl border border-slate-600 mb-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                    Correct Sentence
                  </p>
                  <TeacherAudioPlayer
                    id={`unscramble-correct-${currentIndex}`}
                    text={currentSentence.correctSentence}
                    voiceName="Kore"
                    label="Listen to Teacher"
                    variant="pill"
                  />
                </div>
                <p className="text-xl text-slate-200 font-medium leading-relaxed text-center sm:text-left">
                  {currentSentence.correctSentence}
                </p>
             </div>

             {/* Next Button */}
             <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-orange-500 text-white px-8 py-3.5 rounded-full font-semibold shadow-lg hover:bg-orange-600 hover:scale-105 transition-all"
            >
              {isLastSentence ? (
                <>
                   <RefreshCcw className="w-4 h-4" />
                   <span>Play Again</span>
                </>
              ) : (
                <>
                   <span>Next Sentence</span>
                   <MoveRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

      </div>
      
      {isLoading && (
         <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-orange-500 border-t-transparent mb-4"></div>
            <p className="text-slate-100 font-medium">Preparing next exercise...</p>
         </div>
      )}
    </div>
  );
};
