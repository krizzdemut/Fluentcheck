import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, DifficultyLevel, LessonContent, GrammarAnalysis, UnscrambleGameData } from "../types";
import { blobToBase64 } from "../utils/audioUtils";

const apiKey = process.env.GEMINI_API_KEY || (process.env as any).API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const getPromptsForLevel = (level: DifficultyLevel) => {
  switch (level) {
    case DifficultyLevel.INTERMEDIATE:
      return {
        paragraph: "a B1/B2 Intermediate English learner. Use moderate vocabulary, varied sentence structures, and natural phrasing suitable for an intermediate student.",
        analysis: "You are a supportive English teacher for B1/B2 Intermediate students. Be moderately strict with pronunciation, focusing on natural flow and clear articulation.",
        grammar: "B1/B2 level grammar (e.g., conditionals, passive voice, relative clauses, perfect tenses)"
      };
    case DifficultyLevel.ADVANCED:
      return {
        paragraph: "a C1/C2 Advanced English learner. Use sophisticated vocabulary, complex sentence structures, idioms, and nuanced expressions suitable for an advanced student.",
        analysis: "You are a precise English teacher for C1/C2 Advanced students. Be strict with pronunciation, intonation, and stress patterns. Point out even minor inaccuracies.",
        grammar: "C1/C2 level grammar (e.g., inversion, mixed conditionals, subjunctive, complex phrasal verbs, cleft sentences)"
      };
    case DifficultyLevel.BEGINNER:
    default:
      return {
        paragraph: "an A1/A2 Beginner English learner. Use simple vocabulary and short, clear sentence structures suitable for a beginner.",
        analysis: "You are a supportive English teacher for A1/A2 Beginner students. Be lenient, focusing only on clear errors that affect understanding.",
        grammar: "A1/A2 level grammar (e.g., present simple, past simple, basic prepositions, basic word order)"
      };
  }
};

// 1. Generate Paragraph AND Questions
export const generateParagraph = async (topic: string, difficulty: DifficultyLevel): Promise<LessonContent> => {
  const levelPrompt = getPromptsForLevel(difficulty);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create an English lesson for ${levelPrompt.paragraph} about the topic: "${topic}".
      
      Return a JSON object with:
      1. 'paragraph': A single, engaging paragraph (about 60-90 words). Do not include intro/outro.
      2. 'questions': An array of exactly 2 reading comprehension questions based on the paragraph.
      `,
      config: {
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            paragraph: { type: Type.STRING },
            questions: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["paragraph", "questions"]
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("Failed to generate content");
    
    // Clean up potential markdown formatting
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

    return JSON.parse(jsonText) as LessonContent;
  } catch (error) {
    console.error("Error generating lesson:", error);
    throw error;
  }
};

// 2. Generate Speech (TTS)
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<ArrayBuffer> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned");
    }

    // Convert Base64 string to ArrayBuffer for playback
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};

// 3. Analyze Pronunciation
export const analyzePronunciation = async (audioBlob: Blob, referenceText: string, difficulty: DifficultyLevel): Promise<AnalysisResult> => {
  const levelPrompt = getPromptsForLevel(difficulty);

  try {
    const base64Audio = await blobToBase64(audioBlob);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio,
            },
          },
          {
            text: `${levelPrompt.analysis}
            The student is reading the following text: "${referenceText}".
            
            Listen to the audio and identify words that are mispronounced, skipped, or unclear.
            
            Return a JSON object with:
            1. 'mispronouncedWords': An array of strings. Each string must be the EXACT word from the text that was mispronounced (matching punctuation/casing is not required, just the word stem).
            2. 'feedback': A short, constructive sentence about their performance tailored to their level.
            `
          },
        ],
      },
      config: {
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mispronouncedWords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of words from the text that were not pronounced correctly."
            },
            feedback: {
              type: Type.STRING,
              description: "Constructive feedback for the student."
            }
          },
          required: ["mispronouncedWords", "feedback"]
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No analysis data returned");
    
    // Clean up potential markdown formatting
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

    return JSON.parse(jsonText) as AnalysisResult;

  } catch (error) {
    console.error("Error analyzing audio:", error);
    return {
      mispronouncedWords: [],
      feedback: "We couldn't analyze the audio this time. Please try again.",
    };
  }
};

// 4. Check Grammar for Comprehension Answers
export const checkGrammar = async (question: string, answer: string): Promise<GrammarAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an English teacher checking a student's answer.
      Question: "${question}"
      Student Answer: "${answer}"

      Analyze the student's answer for grammar and spelling errors suitable for their learning level.
      
      Return a JSON object:
      1. 'isCorrect': boolean (true if the answer is grammatically correct and answers the question).
      2. 'markedAnswer': Return the student's EXACT original text, but wrap the grammatically incorrect parts in double brackets like [[this]]. Example: "He [[go]] to school."
      3. 'correction': The fully corrected sentence.
      4. 'feedback': A brief explanation of the error.
      5. 'commonMistakes': A short note on common pitfalls related to this specific grammar concept (e.g. "Don't forget 's' for third person singular").
      `,
      config: {
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            markedAnswer: { type: Type.STRING },
            correction: { type: Type.STRING },
            feedback: { type: Type.STRING },
            commonMistakes: { type: Type.STRING }
          },
          required: ["isCorrect", "markedAnswer", "correction", "feedback", "commonMistakes"]
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("No grammar analysis returned");
    
    // Clean up potential markdown formatting
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    
    return JSON.parse(jsonText) as GrammarAnalysis;
  } catch (error) {
    console.error("Error checking grammar:", error);
    // Fallback if API fails
    return {
      isCorrect: true,
      markedAnswer: answer,
      correction: answer,
      feedback: "Could not verify grammar at this time.",
      commonMistakes: "N/A"
    };
  }
};

// 5. Generate Unscramble Game
export const generateUnscrambleGame = async (difficulty: DifficultyLevel): Promise<UnscrambleGameData> => {
  const levelPrompt = getPromptsForLevel(difficulty);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create an English sentence unscramble exercise for ${levelPrompt.paragraph}.
      
      Generate exactly 6 scrambled sentences that practice ${levelPrompt.grammar}.
      
      Return a JSON object with an array of 'sentences'. Each item should have:
      1. 'id': unique string id.
      2. 'correctSentence': The complete, grammatically correct sentence.
      3. 'scrambled': An array of strings containing the words of the sentence in random order.
      4. 'grammarPoint': A very short label of the grammar concept (e.g., "Present Perfect", "Inversion").
      `,
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  correctSentence: { type: Type.STRING },
                  scrambled: { type: Type.ARRAY, items: { type: Type.STRING } },
                  grammarPoint: { type: Type.STRING }
                },
                required: ["id", "correctSentence", "scrambled", "grammarPoint"]
              }
            }
          },
          required: ["sentences"]
        }
      }
    });

    let jsonText = response.text;
    if (!jsonText) throw new Error("Failed to generate unscramble game");
    
    // Clean up potential markdown formatting
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '').trim();
    
    return JSON.parse(jsonText) as UnscrambleGameData;
  } catch (error) {
    console.error("Error generating unscramble game:", error);
    throw error;
  }
};

// 6. Chat Session Initialization
export const createChatSession = (systemPrompt: string) => {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemPrompt,
    }
  });
};

// 7. Transcribe Audio (Speech to Text)
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio,
            },
          },
          {
            text: "Transcribe the following audio accurately. It is an English student speaking. Ignore background noise. Return ONLY the transcribed text, with no additional comments."
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "";
