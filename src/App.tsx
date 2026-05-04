/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Image as ImageIcon, 
  Send, 
  Loader2, 
  History, 
  Download, 
  Palette,
  Wand2,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Types ---

const ART_STYLES = [
  { id: 'none', label: 'تلقائي', prompt: '' },
  { id: 'oil', label: 'لوحة زيتية', prompt: 'oil painting style, rich textures, visible brushstrokes' },
  { id: 'surreal', label: 'سريالي', prompt: 'surrealism style, dreamlike, otherworldly, Salvador Dali inspired' },
  { id: 'cyberpunk', label: 'سايبر بانك', prompt: 'cyberpunk aesthetic, neon lights, futuristic, high contrast' },
  { id: 'watercolor', label: 'ألوان مائية', prompt: 'watercolor illustration, soft edges, ethereal, flowing' },
  { id: 'digital', label: 'رسم رقمي', prompt: 'modern digital art, clean lines, vibrant colors, detailed' },
  { id: 'sketch', label: 'رسم رصاص', prompt: 'pencil sketch, hand-drawn, graphite texture, artistic' },
  { id: 'vangogh', label: 'فان جوخ', prompt: 'Vincent van Gogh style, starry night swirls, impasto' },
];

interface GeneratedArt {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

// --- App Component ---

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(ART_STYLES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedArt, setGeneratedArt] = useState<GeneratedArt | null>(null);
  const [history, setHistory] = useState<GeneratedArt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ai = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }));

  /** Enhance the user prompt using Gemini */
  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `حول هذا الوصف البسيط لصورة إلى وصف فني مفصل جداً ومحترف باللغة الإنجليزية ليستخدمه نموذج توليد صور. الوصف: "${prompt}". أجب بالوصف الإنجليزي فقط بدون أي نص آخر.`,
      });
      const enhanced = response.text;
      if (enhanced) {
        setPrompt(enhanced);
      }
    } catch (err) {
      console.error("Enhancement failed:", err);
      setError("فشل تحسين الوصف. يرجى المحاولة لاحقاً.");
    } finally {
      setIsEnhancing(false);
    }
  };

  /** Generate Image using Gemini Flash Image */
  const generateImage = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const fullPrompt = `${prompt} ${selectedStyle.prompt}`.trim();
      
      const response = await ai.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: fullPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      // Find the image part in candidates
      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        const newArt: GeneratedArt = {
          id: crypto.randomUUID(),
          url: imageUrl,
          prompt: prompt,
          timestamp: Date.now(),
        };
        setGeneratedArt(newArt);
        setHistory(prev => [newArt, ...prev].slice(0, 10)); // Keep last 10
      } else {
        throw new Error("No image data received");
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError("حدث خطأ أثناء توليد الصورة. تأكد من أن الوصف لا ينتهك السياسات.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `khayal-art-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F0] font-sans selection:bg-[#F27D26]/30" dir="rtl">
      {/* Mesh Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#F27D26] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#6321FF] blur-[120px]" />
      </div>

      <nav className="relative z-10 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F27D26] to-[#6321FF] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">خيال <span className="text-[#F27D26]">AI</span></h1>
          </div>
          <div className="hidden md:flex gap-8 text-sm uppercase tracking-widest opacity-60">
            <span>المعرض</span>
            <span>عن الاستوديو</span>
            <span>الإلهام</span>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-2 gap-16 items-start">
        {/* Left: Input & Controls */}
        <section className="space-y-10">
          <div className="space-y-4">
            <h2 className="text-5xl font-light tracking-tight leading-[1.1]">
              حوّل <span className="italic font-serif">كلماتك</span> <br />
              إلى تحف فنية مذهلة
            </h2>
            <p className="text-white/60 text-lg max-w-md">
              استخدم قوة الذكاء الاصطناعي لتوليد صور فريدة من نوعها في ثوانٍ. ابدأ بوصف ما تتخيله.
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="صف اللوحة التي تتخيلها هنا بكل تفصيل..."
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-6 text-xl placeholder:text-white/20 focus:outline-none focus:border-[#F27D26]/50 transition-all resize-none"
              />
              <button
                onClick={enhancePrompt}
                disabled={!prompt.trim() || isEnhancing}
                className="absolute left-4 bottom-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F27D26] transition-colors disabled:opacity-50"
              >
                {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                تحسين بالذكاء الاصطناعي
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-white/40 uppercase tracking-widest">
                <Palette className="w-4 h-4" />
                اختر النمط الفني
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ART_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={cn(
                      "py-2 px-4 rounded-xl border text-sm transition-all",
                      selectedStyle.id === style.id 
                        ? "bg-[#F27D26] border-[#F27D26] text-white" 
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateImage}
              disabled={!prompt.trim() || isGenerating}
              className="w-full py-5 rounded-2xl bg-[#F5F5F0] text-black font-bold text-lg flex items-center justify-center gap-3 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <ImageIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
                  اصنع اللوحة الآن
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </div>
        </section>

        {/* Right: Display & History */}
        <section className="space-y-8">
          <div className="relative aspect-square rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center group shadow-2xl">
            <AnimatePresence mode="wait">
              {generatedArt ? (
                <motion.div
                  key={generatedArt.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  className="w-full h-full relative"
                >
                  <img
                    src={generatedArt.url}
                    alt={generatedArt.prompt}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8 gap-4">
                    <p className="text-sm line-clamp-2 text-white/80 italic">"{generatedArt.prompt}"</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => downloadImage(generatedArt.url)}
                        className="flex-1 py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        تحميل الصورة
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center space-y-4 opacity-20">
                  <ImageIcon className="w-20 h-20 mx-auto" />
                  <p className="text-xl font-light uppercase tracking-widest">المعرض فارغ</p>
                </div>
              )}
            </AnimatePresence>

            {isGenerating && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-[#F27D26] mx-auto" />
                  <p className="text-[#F27D26] font-medium tracking-[0.2em] uppercase">الذكاء الاصطناعي يرسم لوحتك...</p>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest">
                <History className="w-4 h-4" />
                سجل الإبداعات الأخيرة
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {history.map((art) => (
                  <button
                    key={art.id}
                    onClick={() => setGeneratedArt(art)}
                    className={cn(
                      "flex-shrink-0 w-24 h-24 rounded-xl border-2 overflow-hidden transition-all",
                      generatedArt?.id === art.id ? "border-[#F27D26] scale-105" : "border-white/10 grayscale hover:grayscale-0"
                    )}
                  >
                    <img src={art.url} alt="History Art" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 opacity-40 text-xs tracking-widest uppercase">
          <p>© 2026 خيال AI - جميع الحقوق محفوظة</p>
          <div className="flex gap-8">
            <span>شروط الاستخدام</span>
            <span>الخصوصية</span>
            <span>اتصل بنا</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
