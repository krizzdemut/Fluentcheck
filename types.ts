export enum AppState {
  HOME = 'HOME',
  TOPIC_SELECTION = 'TOPIC_SELECTION',
  PRACTICE_SESSION = 'PRACTICE_SESSION',
  UNSCRAMBLE_SESSION = 'UNSCRAMBLE_SESSION',
  TALK_SCENARIO_SELECTION = 'TALK_SCENARIO_SELECTION',
  TALK_SESSION = 'TALK_SESSION',
}

export enum DifficultyLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
}

export enum Topic {
  DAILY_LIFE = 'Daily Life',
  EIGHTIES_VS_NOW = 'Life in the 80s vs Now',
  COUNTRY_VS_CITY = 'Country Life vs City Life',
  TECHNOLOGY = 'The Development of Technology',
  HOBBIES = 'Hobbies',
  WEIRD_TYPICAL = 'Weird and Typical',
  MOVIES = 'Movies',
  HOLIDAYS = 'Holidays',
  FOOD = 'Food',
  BUSINESS = "Business in Today's World",
  TRAVEL = 'Travel',
}

export interface AnalysisResult {
  mispronouncedWords: string[];
  feedback: string;
}

export interface WordData {
  id: string;
  word: string;
  cleanWord: string; // word without punctuation for matching
  isMispronounced: boolean;
}

export interface LessonContent {
  paragraph: string;
  questions: string[];
}

export interface GrammarAnalysis {
  isCorrect: boolean;
  markedAnswer: string; // The user's text with errors wrapped in [[ ]]
  correction: string;
  feedback: string;
  commonMistakes: string;
}

export interface UnscrambleSentence {
  id: string;
  scrambled: string[];
  correctSentence: string;
  grammarPoint: string;
}

export interface UnscrambleGameData {
  sentences: UnscrambleSentence[];
}

// --- Talk / Role Play Interfaces ---

export interface TalkScenario {
  id: string;
  title: string;
  description: string;
  icon: string; // We'll map string keys to icons in the component
  systemPrompt: string;
  initialMessage: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isAudioPlaying?: boolean;
}