import React, { useState } from 'react';
import { TopicSelector } from './components/TopicSelector';
import { PracticeSession } from './components/PracticeSession';
import { UnscrambleSession } from './components/UnscrambleSession';
import { TalkScenarioSelector } from './components/TalkScenarioSelector';
import { TalkSession } from './components/TalkSession';
import { AppState, Topic, DifficultyLevel, UnscrambleSentence, TalkScenario } from './types';
import { generateParagraph, generateUnscrambleGame } from './services/gemini';
import { Mic, LayoutGrid, MessageCircle } from 'lucide-react';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  
  // Practice Session State
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  const [currentParagraph, setCurrentParagraph] = useState<string>("");
  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>(DifficultyLevel.BEGINNER);
  
  // Unscramble Session State
  const [unscrambleSentences, setUnscrambleSentences] = useState<UnscrambleSentence[]>([]);

  // Talk Session State
  const [currentScenario, setCurrentScenario] = useState<TalkScenario | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // --- Handlers for Pronunciation Coach ---
  const handleSelectTopic = async (topic: Topic, difficulty: DifficultyLevel) => {
    setIsLoading(true);
    try {
      const lessonContent = await generateParagraph(topic, difficulty);
      setCurrentTopic(topic);
      setCurrentDifficulty(difficulty);
      setCurrentParagraph(lessonContent.paragraph);
      setCurrentQuestions(lessonContent.questions);
      setAppState(AppState.PRACTICE_SESSION);
    } catch (error) {
      console.error(error);
      alert("Failed to generate a lesson. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers for Unscramble ---
  const handleStartUnscramble = async (difficulty: DifficultyLevel) => {
    setIsLoading(true);
    try {
      const gameData = await generateUnscrambleGame(difficulty);
      setUnscrambleSentences(gameData.sentences);
      setCurrentDifficulty(difficulty);
      setAppState(AppState.UNSCRAMBLE_SESSION);
    } catch (error) {
      console.error(error);
      alert("Failed to generate unscramble exercises. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers for Talk ---
  const handleSelectScenario = (scenario: TalkScenario, difficulty: DifficultyLevel) => {
    setCurrentScenario(scenario);
    setCurrentDifficulty(difficulty);
    setAppState(AppState.TALK_SESSION);
  };

  const handleBackToHome = () => {
    setAppState(AppState.HOME);
    setCurrentParagraph("");
    setCurrentQuestions([]);
    setCurrentTopic(null);
    setUnscrambleSentences([]);
    setCurrentScenario(null);
  };

  const handleBackToTopics = () => {
    setAppState(AppState.TOPIC_SELECTION);
  };
  
  const handleBackToScenarios = () => {
    setAppState(AppState.TALK_SCENARIO_SELECTION);
  }

  return (
    <div className="min-h-screen font-sans text-slate-200 bg-slate-900">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 transition-all duration-300">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div 
              className="flex items-center cursor-pointer group gap-3" 
              onClick={handleBackToHome}
              title="Go to Home"
            >
                {/* Logo Section - Styled capital A */}
                <div className="h-10 w-10 bg-orange-500 rounded-lg shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-105 text-white text-xl font-bold">
                  A
                </div>

                {/* App Name */}
                <span className="text-xl font-semibold text-orange-500 tracking-tight">Fluent Check</span>
            </div>
            
            <nav className="hidden sm:flex space-x-8 text-[13px] font-medium text-slate-400">
                <button onClick={handleBackToHome} className="hover:text-slate-200 transition-colors">Home</button>
                <button className="hover:text-slate-200 transition-colors">Students</button>
                <button className="hover:text-slate-200 transition-colors">About</button>
            </nav>
        </div>
      </header>

      <main className="py-12 px-6">
        {/* --- HOME DASHBOARD --- */}
        {appState === AppState.HOME && (
          <div className="max-w-6xl mx-auto animate-fade-in-up">
            <div className="text-center mb-16">
               <h1 className="text-5xl font-semibold text-orange-500 mb-6 tracking-tight">Welcome, Student.</h1>
               <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
                 Choose a mode to start your daily practice.
               </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Card 1: Pronunciation Coach */}
              <button 
                onClick={() => setAppState(AppState.TOPIC_SELECTION)}
                className="group relative bg-slate-800 rounded-[2rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] hover:scale-[1.02] transition-all duration-300 text-left overflow-hidden h-full flex flex-col border border-slate-700/50"
              >
                 <div className="h-14 w-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Mic className="w-7 h-7" />
                 </div>
                 <h2 className="text-xl font-semibold text-slate-100 mb-3">Pronunciation Coach</h2>
                 <p className="text-slate-400 leading-relaxed text-sm mb-6 flex-1">
                   Read paragraphs aloud, get instant AI feedback on your pronunciation, and answer comprehension questions.
                 </p>
                 <span className="inline-block mt-auto text-orange-500 font-medium group-hover:translate-x-1 transition-transform text-sm">
                   Start Speaking &rarr;
                 </span>
              </button>

              {/* Card 2: Afluent Unscramble */}
              <div className="group relative bg-slate-800 rounded-[2rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.2)] transition-all duration-300 text-left overflow-hidden h-full flex flex-col border border-slate-700/50">
                 <div className="h-14 w-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <LayoutGrid className="w-7 h-7" />
                 </div>
                 <h2 className="text-xl font-semibold text-slate-100 mb-3">Afluent Unscramble</h2>
                 <p className="text-slate-400 leading-relaxed text-sm mb-6 flex-1">
                   Practice sentence structure and grammar by unscrambling sentences. 6 exercises per level.
                 </p>
                 
                 {/* Level Select for Unscramble */}
                 <div className="space-y-3 mt-auto">
                   <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Difficulty</p>
                   <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => !isLoading && handleStartUnscramble(DifficultyLevel.BEGINNER)}
                        className="px-3 py-1.5 rounded-full bg-slate-700 text-slate-200 text-xs font-medium hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        A1/A2
                      </button>
                      <button 
                        onClick={() => !isLoading && handleStartUnscramble(DifficultyLevel.INTERMEDIATE)}
                        className="px-3 py-1.5 rounded-full bg-slate-700 text-slate-200 text-xs font-medium hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        B1/B2
                      </button>
                      <button 
                        onClick={() => !isLoading && handleStartUnscramble(DifficultyLevel.ADVANCED)}
                        className="px-3 py-1.5 rounded-full bg-slate-700 text-slate-200 text-xs font-medium hover:bg-orange-500 hover:text-white transition-colors"
                      >
                        C1/C2
                      </button>
                   </div>
                 </div>
                 
                 {isLoading && (
                    <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[2rem]">
                       <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-orange-500 border-t-transparent"></div>
                    </div>
                 )}
              </div>

              {/* Card 3: Afluent Talk (New) */}
              <button 
                onClick={() => setAppState(AppState.TALK_SCENARIO_SELECTION)}
                className="group relative bg-slate-800 rounded-[2rem] p-8 shadow-[0_2px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] hover:scale-[1.02] transition-all duration-300 text-left overflow-hidden h-full flex flex-col border border-slate-700/50"
              >
                 <div className="h-14 w-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <MessageCircle className="w-7 h-7" />
                 </div>
                 <h2 className="text-xl font-semibold text-slate-100 mb-3">Afluent Talk</h2>
                 <p className="text-slate-400 leading-relaxed text-sm mb-6 flex-1">
                   Role-play scenarios with an AI partner. Practice ordering coffee, job interviews, and more in a realistic chat.
                 </p>
                 <span className="inline-block mt-auto text-orange-500 font-medium group-hover:translate-x-1 transition-transform text-sm">
                   Start Conversation &rarr;
                 </span>
              </button>

            </div>
          </div>
        )}

        {/* --- PRONUNCIATION COACH FLOW --- */}
        {appState === AppState.TOPIC_SELECTION && (
          <TopicSelector 
            onSelectTopic={handleSelectTopic} 
            isLoading={isLoading} 
          />
        )}

        {appState === AppState.PRACTICE_SESSION && currentTopic && (
          <PracticeSession 
            topic={currentTopic}
            paragraph={currentParagraph}
            questions={currentQuestions}
            difficulty={currentDifficulty}
            onBack={handleBackToTopics}
          />
        )}

        {/* --- UNSCRAMBLE FLOW --- */}
        {appState === AppState.UNSCRAMBLE_SESSION && (
          <UnscrambleSession
             sentences={unscrambleSentences}
             difficulty={currentDifficulty}
             onBack={handleBackToHome}
             onNewGame={handleStartUnscramble}
             isLoading={isLoading}
          />
        )}

        {/* --- TALK FLOW --- */}
        {appState === AppState.TALK_SCENARIO_SELECTION && (
          <TalkScenarioSelector onSelectScenario={handleSelectScenario} />
        )}

        {appState === AppState.TALK_SESSION && currentScenario && (
          <TalkSession 
            scenario={currentScenario}
            difficulty={currentDifficulty}
            onBack={handleBackToScenarios}
          />
        )}

      </main>
    </div>
  );
}

export default App;