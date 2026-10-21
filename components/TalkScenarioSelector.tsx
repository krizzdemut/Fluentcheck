import React, { useState } from 'react';
import { TalkScenario, DifficultyLevel } from '../types';
import { Coffee, Stethoscope, Briefcase, Plane, ShoppingBag, MessageCircle } from 'lucide-react';

interface TalkScenarioSelectorProps {
  onSelectScenario: (scenario: TalkScenario, difficulty: DifficultyLevel) => void;
}

const SCENARIOS: TalkScenario[] = [
  {
    id: 'waiter',
    title: 'English Waiter',
    description: 'Order food at a London café. Practice ordering politely.',
    icon: 'coffee',
    systemPrompt: `You are a waiter at a London café. You speak with a British accent (use British spelling/slang like 'mate', 'cheers', 'fancy a cuppa'). Your goal is to take the student's order.
    If the student makes a grammar mistake, gently correct them in parentheses at the end of your reply.
    Keep your responses short (under 2 sentences) to keep the conversation moving.`,
    initialMessage: "Hello mate! Welcome to The Rusty Spoon. What can I get for you today?"
  },
  {
    id: 'interview',
    title: 'Job Interview',
    description: 'Answer common questions for a new job.',
    icon: 'briefcase',
    systemPrompt: `You are a hiring manager at a tech company. You are professional but friendly.
    Ask standard interview questions one by one.
    If the student makes a mistake, correct them in parentheses at the end of your reply.
    Keep responses short.`,
    initialMessage: "Good morning. Thank you for coming in. To start, could you tell me a little bit about yourself?"
  },
  {
    id: 'doctor',
    title: 'At the Doctor',
    description: 'Explain your symptoms and get advice.',
    icon: 'stethoscope',
    systemPrompt: `You are a helpful GP (General Practitioner).
    Ask the patient about their symptoms.
    Correct any grammar errors in parentheses at the end.
    Keep responses short.`,
    initialMessage: "Good afternoon. I see you have an appointment. What seems to be the trouble today?"
  },
  {
    id: 'travel',
    title: 'Immigration Officer',
    description: 'Answer questions at the airport border control.',
    icon: 'plane',
    systemPrompt: `You are a stern but fair Border Control Officer at Heathrow Airport.
    Ask questions about the purpose of visit, duration, and accommodation.
    Correct grammar errors in parentheses at the end.
    Keep responses short.`,
    initialMessage: "Passport, please. What is the purpose of your visit to the United Kingdom?"
  },
  {
    id: 'airport_checkin',
    title: 'At the Airport',
    description: 'Check in for your flight and drop off luggage.',
    icon: 'plane',
    systemPrompt: `You are an airline check-in agent. You are polite and efficient.
    Ask the passenger for their passport and questions about their luggage (checking in bags, hand luggage).
    Correct any grammar errors in parentheses at the end of your reply.
    Keep your responses short to keep the line moving.`,
    initialMessage: "Good morning. Where are you flying to today?"
  },
  {
    id: 'shopping',
    title: 'Shopping Mall',
    description: 'Ask a shop assistant for help finding clothes.',
    icon: 'shopping',
    systemPrompt: `You are a helpful shop assistant in a clothing store.
    Ask the customer what they are looking for, their size, and color preferences.
    Correct grammar errors in parentheses at the end of your reply.
    Keep responses short.`,
    initialMessage: "Hi there! Can I help you find anything in particular today?"
  },
  {
    id: 'small_talk',
    title: 'Making Small Talk',
    description: 'Chat with a friendly stranger about the weather.',
    icon: 'chat',
    systemPrompt: `You are a friendly stranger waiting at a bus stop.
    Make small talk about the weather or the bus being late.
    Correct grammar errors in parentheses at the end of your reply.
    Keep responses short and conversational.`,
    initialMessage: "Lovely weather we're having today, isn't it?"
  },
  {
    id: 'business_meeting',
    title: 'Business Meeting',
    description: 'Discuss project updates with a colleague.',
    icon: 'briefcase',
    systemPrompt: `You are a colleague in a business meeting. You are professional.
    Ask for an update on the current project status and deadlines.
    Correct grammar errors in parentheses at the end of your reply.
    Keep responses short.`,
    initialMessage: "Thanks for joining. Could you give us a quick update on how the project is going?"
  }
];

const ICON_MAP: Record<string, React.ReactNode> = {
  coffee: <Coffee className="w-8 h-8" />,
  briefcase: <Briefcase className="w-8 h-8" />,
  stethoscope: <Stethoscope className="w-8 h-8" />,
  plane: <Plane className="w-8 h-8" />,
  shopping: <ShoppingBag className="w-8 h-8" />,
  chat: <MessageCircle className="w-8 h-8" />
};

const LEVELS = [
  { id: DifficultyLevel.BEGINNER, label: 'Beginner (A1-A2)' },
  { id: DifficultyLevel.INTERMEDIATE, label: 'Intermediate (B1-B2)' },
  { id: DifficultyLevel.ADVANCED, label: 'Advanced (C1-C2)' },
];

export const TalkScenarioSelector: React.FC<TalkScenarioSelectorProps> = ({ onSelectScenario }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DifficultyLevel.BEGINNER);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in-up">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-semibold text-slate-100 mb-6 tracking-tight">Afluent Talk</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mb-10">
          Choose a role-play scenario and your level. Practice real conversations with feedback.
        </p>

        {/* Difficulty Segmented Control */}
        <div className="inline-flex bg-slate-800 p-1.5 rounded-full relative mb-8 border border-slate-700/50">
          {LEVELS.map((level) => (
            <button
              key={level.id}
              onClick={() => setSelectedDifficulty(level.id)}
              className={`
                relative px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-300 z-10
                ${selectedDifficulty === level.id 
                  ? 'text-slate-100 shadow-md bg-slate-700' 
                  : 'text-slate-400 hover:text-slate-200'}
              `}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onSelectScenario(scenario, selectedDifficulty)}
            className="group relative flex flex-col items-start text-left p-8 bg-slate-800 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] hover:scale-[1.02] transition-all duration-300 ease-out border border-slate-700/50"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 text-slate-300 flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
               {ICON_MAP[scenario.icon] || <MessageCircle className="w-8 h-8" />}
            </div>
            
            <h3 className="text-xl font-semibold text-slate-100 group-hover:text-white transition-colors mb-2">
              {scenario.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              {scenario.description}
            </p>
            <span className="mt-auto text-sm font-medium text-orange-500 group-hover:translate-x-1 transition-transform inline-flex items-center">
              Start {selectedDifficulty} Chat <span className="ml-1">&rarr;</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
