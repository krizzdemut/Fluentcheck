import React, { useState, useRef, useEffect } from 'react';
import { TalkScenario, ChatMessage, DifficultyLevel } from '../types';
import { createChatSession, generateSpeech, transcribeAudio } from '../services/gemini';
import { decodePcmAudioData, pcmToWavBlob } from '../utils/audioUtils';
import { ArrowLeft, Send, Mic, Volume2, Loader2, User, Bot, StopCircle, RefreshCw, Globe2, ChevronDown, Play, Pause } from 'lucide-react';
import { Chat } from '@google/genai';

interface TalkSessionProps {
  scenario: TalkScenario;
  difficulty: DifficultyLevel;
  onBack: () => void;
}

const ACCENT_OPTIONS = [
  { 
    id: 'standard', 
    label: 'Standard Accent', 
    voice: 'Fenrir', // Default base voice, overridden by difficulty
    prompt: "You speak with a standard British/American accent. Your tone is neutral and professional." 
  },
  { 
    id: 'indian', 
    label: 'Indian Accent', 
    voice: 'Puck', 
    prompt: "You speak with a natural, authentic Indian English accent. Your tone is warm, polite, and respectful. Use characteristic Indian English phrasing, such as the occasional use of present continuous tense for stative verbs (e.g., 'I am understanding', 'I am thinking') and polite markers like 'kindly'. Avoid exaggerated stereotypes; aim for the natural speech pattern of an educated English speaker from India." 
  },
  { 
    id: 'chinese', 
    label: 'Chinese Accent', 
    voice: 'Charon', 
    prompt: "You speak with a natural, authentic Chinese English accent. Your tone is calm, precise, and measured. Use concise sentence structures that favor directness. You may occasionally use topic-prominent phrasing (e.g., 'The weather, it is very nice today'). Avoid 'broken' English stereotypes; aim for the speech pattern of a fluent, modern professional whose English is influenced by Mandarin logic." 
  }
];

export const TalkSession: React.FC<TalkSessionProps> = ({ scenario, difficulty, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  
  // Voice & Accent State
  const [selectedAccentId, setSelectedAccentId] = useState('standard');
  const [voiceName, setVoiceName] = useState('Fenrir');
  const [showAccentMenu, setShowAccentMenu] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoPlayedMessageIds = useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
    };
  }, []);

  // Initialize/Update Chat based on accent or difficulty
  useEffect(() => {
    initializeChat(selectedAccentId);
  }, [scenario, difficulty, selectedAccentId]);

  const initializeChat = (accentId: string) => {
    // 1. Determine Level Instructions
    let levelInstruction = "";
    switch (difficulty) {
      case DifficultyLevel.INTERMEDIATE:
        levelInstruction = "Speak at a B1/B2 Intermediate level. Use conversational vocabulary and a mix of simple and complex sentences.";
        break;
      case DifficultyLevel.ADVANCED:
        levelInstruction = "Speak at a C1/C2 Advanced level. Use natural, idiomatic, and complex language.";
        break;
      case DifficultyLevel.BEGINNER:
      default:
        levelInstruction = "Speak at an A1/A2 Elementary level. Use simple words, short sentences, and basic grammar.";
        break;
    }

    // 2. Determine Accent/Voice Configuration
    const accentConfig = ACCENT_OPTIONS.find(a => a.id === accentId) || ACCENT_OPTIONS[0];
    
    // Override voice for "Standard" accent based on difficulty
    let targetVoice = accentConfig.voice;

    if (accentId === 'standard') {
       switch (difficulty) {
         case DifficultyLevel.BEGINNER:
           targetVoice = 'Kore'; // Friendly, clear female voice
           break;
         case DifficultyLevel.INTERMEDIATE:
           targetVoice = 'Puck'; // Expressive male voice
           break;
         case DifficultyLevel.ADVANCED:
           targetVoice = 'Fenrir'; // Deeper, more serious male voice
           break;
         default:
           targetVoice = 'Kore';
       }
    }
    // Note: If accent is 'indian' or 'chinese', we use the voice defined in ACCENT_OPTIONS (Puck/Charon) regardless of level

    setVoiceName(targetVoice);

    // 3. Construct Full System Prompt
    const fullSystemPrompt = `${scenario.systemPrompt}
${accentConfig.prompt}

FEEDBACK INSTRUCTION:
If the student makes a grammar or vocabulary mistake, you MUST explain the error.
Provide this feedback in parentheses at the very end of your response using EXACTLY this format:
"(Grammar tip: [explanation of mistake] -> [Corrected phrase])"

IMPORTANT: ${levelInstruction}`;

    // 4. Create Chat Session
    const chat = createChatSession(fullSystemPrompt);
    setChatInstance(chat);

    // 5. Reset Messages (Optional: could keep history, but reset implies new persona settings)
    // For this implementation, we reset to restart the conversation with the new accent.
    setMessages([
      {
        id: 'init',
        role: 'model',
        text: scenario.initialMessage,
      }
    ]);
    autoPlayedMessageIds.current.clear();
  };

  const handleAccentSelect = (accentId: string) => {
    setSelectedAccentId(accentId);
    setShowAccentMenu(false);
    // initializeChat is triggered by useEffect dependency
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-play AI Audio
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    
    // Check if the last message is from the model and hasn't been auto-played yet
    if (lastMessage && lastMessage.role === 'model' && !autoPlayedMessageIds.current.has(lastMessage.id)) {
      autoPlayedMessageIds.current.add(lastMessage.id);
      
      // Small delay to ensure UI updates first
      setTimeout(() => {
        handlePlayAudio(lastMessage.text, lastMessage.id);
      }, 500);
    }
  }, [messages, voiceName]); 

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !chatInstance || isSending) return;

    const userText = inputValue;
    setInputValue('');
    setIsSending(true);

    // Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await chatInstance.sendMessage({ message: userText });
      const responseText = response.text || "I'm sorry, I didn't catch that.";

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      alert("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handlePlayAudio = async (text: string, id: string) => {
    // 1. If currently playing this exact message: toggle pause/play
    if (playingId === id && activeAudioRef.current) {
      if (!isAudioPaused && !activeAudioRef.current.paused) {
        activeAudioRef.current.pause();
        setIsAudioPaused(true);
        return;
      } else {
        try {
          await activeAudioRef.current.play();
          setIsAudioPaused(false);
          return;
        } catch (err) {
          console.error("Resume audio error:", err);
        }
      }
    }

    // 2. Stop any existing playback
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setPlayingId(null);
    setIsAudioPaused(false);

    // Clean text for speech
    let cleanText = text;
    if (cleanText.includes("(Grammar tip:")) {
      cleanText = cleanText.split("(Grammar tip:")[0].trim();
    }
    cleanText = cleanText.replace(/\(.*?\)/g, "").trim();

    if (!cleanText) return;

    try {
      setLoadingAudioId(id);

      let audioUrl = audioCacheRef.current.get(id);
      if (!audioUrl) {
        const pcmData = await generateSpeech(cleanText, voiceName);
        const wavBlob = pcmToWavBlob(pcmData, 24000, 1);
        audioUrl = URL.createObjectURL(wavBlob);
        audioCacheRef.current.set(id, audioUrl);
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onplay = () => {
        setPlayingId(id);
        setIsAudioPaused(false);
        setLoadingAudioId(null);
      };

      audio.onpause = () => {
        if (!audio.ended) {
          setIsAudioPaused(true);
        }
      };

      audio.onended = () => {
        setPlayingId(null);
        setIsAudioPaused(false);
      };

      audio.onerror = () => {
        setPlayingId(null);
        setIsAudioPaused(false);
        setLoadingAudioId(null);
      };

      await audio.play();
    } catch (error) {
      console.error("TTS Error", error);
      setPlayingId(null);
      setIsAudioPaused(false);
      setLoadingAudioId(null);
    }
  };

  const handleRepeatLast = () => {
    const lastModelMessage = [...messages].reverse().find(m => m.role === 'model');
    if (lastModelMessage) {
      handlePlayAudio(lastModelMessage.text, lastModelMessage.id);
    }
  };

  const startRecording = async () => {
    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        setPlayingId(null);
        setIsAudioPaused(false);
      }


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
        handleTranscription(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
        const text = await transcribeAudio(audioBlob);
        if (text) {
            setInputValue(text);
        }
    } catch (error) {
        console.error("Transcription failed", error);
    } finally {
        setIsTranscribing(false);
    }
  };

  const hasModelMessages = messages.some(m => m.role === 'model');
  const activeAccentLabel = ACCENT_OPTIONS.find(a => a.id === selectedAccentId)?.label || 'Accent';

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 relative">
        <button 
          onClick={onBack}
          className="group flex items-center text-slate-400 hover:text-orange-500 transition-colors font-medium text-sm"
        >
          <div className="bg-slate-800 rounded-full p-2 mr-3 shadow-sm group-hover:shadow-md transition-all border border-slate-700/50">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Exit Chat
        </button>

        <div className="flex gap-4 items-start">
            {/* Accent Selector */}
            <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowAccentMenu(!showAccentMenu)}
                  className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700/50 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors shadow-sm"
                >
                    <Globe2 className="w-3.5 h-3.5 text-orange-500" />
                    {activeAccentLabel}
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
                
                {showAccentMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-xl shadow-lg border border-slate-700/50 py-1 z-20 animate-fade-in origin-top-right">
                      {ACCENT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => handleAccentSelect(option.id)}
                            className={`
                                w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors flex items-center justify-between
                                ${selectedAccentId === option.id ? 'text-orange-500 font-medium bg-orange-500/10' : 'text-slate-200'}
                            `}
                          >
                             {option.label}
                             {selectedAccentId === option.id && <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>}
                          </button>
                      ))}
                  </div>
                )}
            </div>

            <div className="text-right flex flex-col items-end">
                <h2 className="text-lg font-semibold text-slate-100">{scenario.title}</h2>
                <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">Role Play</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/50">
                    {difficulty}
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-800 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col relative border border-slate-700/50">
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           {messages.map((msg) => {
             const isUser = msg.role === 'user';
             return (
               <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                 <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-orange-500 text-white' : 'bg-slate-700 text-orange-500'}`}>
                       {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
                    <div className={`
                       p-4 rounded-2xl relative group
                       ${isUser 
                         ? 'bg-orange-500 text-white rounded-br-none' 
                         : 'bg-slate-700/50 text-slate-200 rounded-bl-none border border-slate-600/50'}
                    `}>
                       <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                       
                       {/* Audio Play/Pause Button for AI */}
                       {!isUser && (
                         <button 
                           onClick={() => handlePlayAudio(msg.text, msg.id)}
                           className={`
                             absolute -right-10 bottom-0 p-2 text-slate-400 hover:text-orange-500 transition-colors
                             ${playingId === msg.id || loadingAudioId === msg.id ? 'opacity-100 text-orange-500' : 'opacity-0 group-hover:opacity-100'}
                           `}
                           title={
                             loadingAudioId === msg.id 
                               ? "Loading audio..." 
                               : playingId === msg.id && !isAudioPaused 
                                 ? "Pause speech" 
                                 : playingId === msg.id && isAudioPaused 
                                   ? "Resume speech" 
                                   : "Listen to teacher"
                           }
                         >
                           {loadingAudioId === msg.id ? (
                             <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                           ) : playingId === msg.id && !isAudioPaused ? (
                             <Pause className="w-4 h-4 fill-current text-orange-500" />
                           ) : playingId === msg.id && isAudioPaused ? (
                             <Play className="w-4 h-4 fill-current text-orange-500" />
                           ) : (
                             <Volume2 className="w-5 h-5" />
                           )}
                         </button>
                       )}
                    </div>
                 </div>
               </div>
             );
           })}
           
           {(isSending || isTranscribing) && (
             <div className="flex justify-start">
                <div className="bg-slate-700/50 border border-slate-600/50 p-4 rounded-2xl rounded-bl-none ml-10 flex items-center gap-2">
                   {isTranscribing ? (
                       <span className="text-xs text-slate-400 font-medium flex items-center gap-2">
                           <Loader2 className="w-3 h-3 animate-spin text-orange-500" /> Transcribing...
                       </span>
                   ) : (
                       <>
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-150"></div>
                       </>
                   )}
                </div>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-800 border-t border-slate-700/50 flex items-center gap-2">
           
           {/* Repeat / Pause Last Message Button */}
           <button
             onClick={handleRepeatLast}
             disabled={isSending || isRecording || isTranscribing || !hasModelMessages}
             className={`
               p-3.5 rounded-full border transition-all shadow-sm flex items-center justify-center disabled:opacity-50
               ${playingId && !isAudioPaused
                 ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/30'
                 : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-orange-500 border-slate-600'}
             `}
             title={
               playingId && !isAudioPaused 
                 ? "Pause message" 
                 : playingId && isAudioPaused 
                   ? "Resume message" 
                   : "Repeat last message"
             }
           >
             {playingId && !isAudioPaused ? <Pause className="w-5 h-5 fill-current text-orange-500" /> : <RefreshCw className="w-5 h-5" />}
           </button>


           {/* Mic / Stop Button */}
           <button
             onClick={isRecording ? stopRecording : startRecording}
             disabled={isSending || isTranscribing}
             className={`
               p-3.5 rounded-full transition-all shadow-sm flex items-center justify-center
               ${isRecording 
                 ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50 animate-pulse' 
                 : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-orange-500 border border-slate-600'}
             `}
             title={isRecording ? "Stop Recording" : "Speak Response"}
           >
             {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
           </button>

           <input
             type="text"
             value={inputValue}
             onChange={(e) => setInputValue(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
             placeholder={isRecording ? "Listening..." : "Type or speak to reply..."}
             className={`
                flex-1 bg-slate-700/50 text-slate-200 placeholder:text-slate-500 px-5 py-3.5 rounded-full outline-none 
                focus:ring-2 focus:ring-orange-500/20 focus:bg-slate-700 transition-all border border-slate-600 focus:border-orange-500/50
                ${isRecording ? 'placeholder:text-red-400' : ''}
             `}
             disabled={isSending || isRecording || isTranscribing}
           />
           <button
             onClick={handleSendMessage}
             disabled={!inputValue.trim() || isSending || isRecording}
             className="bg-orange-500 text-white p-3.5 rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:scale-100 hover:scale-105 transition-all shadow-md shadow-orange-500/20"
           >
             <Send className="w-5 h-5" />
           </button>
        </div>
      </div>
    </div>
  );
};
