/*
  History Duel — Frontend Only
  ─────────────────────────────
  Стек: React + Framer Motion + встроенный CSS
  Бэкенд: подключить sendMessage() и sendToAll() — помечено TODO
  Дизайн: Imperial Russia XIX век
*/

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import chaadaevImg from './assets/Chaadaev_portrait.jpeg';
import khomyakovImg from './assets/KhomyakovA_AvtoportretABR.jpg';

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=IM+Fell+English:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --gold:          #c9a84c;
  --gold-light:    #f0d080;
  --gold-dim:      rgba(201,168,76,0.22);
  --parchment:     #f2e4c4;
  --parchment-dim: rgba(242,228,196,0.68);
  --ink:           #140e06;
  --west-deep:     #05111f;
  --west-accent:   #2a6496;
  --west-glow:     rgba(42,100,150,0.5);
  --slav-deep:     #1a0804;
  --slav-accent:   #9b2215;
  --slav-glow:     rgba(155,34,21,0.5);
}

body { overflow: hidden; background: #050302; }

::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 2px; }

/* ── Animations ── */
@keyframes candle {
  0%,100% { opacity:1; transform:scaleY(1) scaleX(1); }
  25%  { opacity:.91; transform:scaleY(1.05) scaleX(.97); }
  50%  { opacity:.96; transform:scaleY(.97) scaleX(1.02); }
  75%  { opacity:.87; transform:scaleY(1.07) scaleX(.95); }
}
@keyframes shimmer-gold {
  0%   { background-position:-300% center; }
  100% { background-position:300% center; }
}
@keyframes rise {
  from { opacity:0; transform:translateY(14px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes divider-glow {
  0%,100% { box-shadow:0 0 8px var(--gold),0 0 24px rgba(201,168,76,.3); }
  50%     { box-shadow:0 0 18px var(--gold),0 0 50px rgba(201,168,76,.5); }
}
@keyframes float-rune {
  0%,100% { transform:translateY(0) rotate(0deg);  opacity:.09; }
  50%     { transform:translateY(-14px) rotate(4deg); opacity:.17; }
}
@keyframes dot-pulse {
  0%,80%,100% { transform:scale(0.6); opacity:.4; }
  40%         { transform:scale(1);   opacity:1;  }
}

/* ── Utility classes ── */
.shimmer {
  background: linear-gradient(90deg,var(--gold) 0%,var(--gold-light) 40%,var(--gold) 60%,var(--gold-light) 100%);
  background-size:300% auto;
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
  animation:shimmer-gold 5s linear infinite;
}

.ornament-border {
  position:absolute; inset:12px;
  border:1px solid var(--gold-dim);
  pointer-events:none; z-index:4;
}

.message-appear { animation:rise .4s ease forwards; opacity:0; }

.thinking-dot {
  display:inline-block; width:6px; height:6px; border-radius:50%;
  background:var(--gold);
  animation:dot-pulse 1.4s ease-in-out infinite;
}
.thinking-dot:nth-child(2) { animation-delay:.2s; }
.thinking-dot:nth-child(3) { animation-delay:.4s; }

/* ── Mode switcher buttons ── */
.mode-btn {
  font-family:'Cormorant Garamond',serif;
  font-size:.78rem; letter-spacing:.22em; text-transform:uppercase;
  padding:7px 20px; border:none; background:transparent;
  color:rgba(242,228,196,.38); cursor:pointer; transition:color .3s;
}
.mode-btn:hover  { color:rgba(242,228,196,.75); }
.mode-btn.active { color:var(--gold-light); }

/* ── Chat input ── */
textarea.chat-input {
  background:rgba(0,0,0,.55);
  border:1px solid var(--gold-dim);
  color:var(--parchment);
  font-family:'Cormorant Garamond',serif;
  font-size:1.05rem; line-height:1.5;
  padding:.7rem 1rem; resize:none; outline:none;
  transition:border-color .3s, box-shadow .3s;
  width:100%; height:52px;
}
textarea.chat-input:focus {
  border-color:var(--gold);
  box-shadow:0 0 14px rgba(201,168,76,.18);
}
textarea.chat-input::placeholder { color:rgba(242,228,196,.28); font-style:italic; }

/* ── Send button ── */
.send-btn {
  font-family:'Playfair Display',serif;
  font-size:.72rem; font-weight:700; letter-spacing:.15em; text-transform:uppercase;
  padding:.7rem 1.5rem; height:52px;
  background:linear-gradient(135deg,#c9a84c,#8a6820);
  color:var(--ink); border:none; cursor:pointer;
  transition:filter .25s, transform .2s; white-space:nowrap;
}
.send-btn:hover:not(:disabled) { filter:brightness(1.3); transform:translateY(-1px); }
.send-btn:disabled { opacity:.35; cursor:not-allowed; }

/* ── Film grain overlay ── */
.noise-overlay {
  position:fixed; inset:0; pointer-events:none; z-index:9999;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  opacity:.038;
}
`;

/* ─────────────────────────────────────────────
   CHARACTER DATA
───────────────────────────────────────────── */
const CHARS = {
  west: {
    id: "west",
    shortName: "Чаадаев",
    fullName: "Пётр Яковлевич Чаадаев",
    role: "Западник",
    years: "1794 — 1856",
    portrait: chaadaevImg,
    deepBg: "#05111f",
    accentHex: "#2a6496",
    accentRgb: "42,100,150",
    glowColor: "rgba(42,100,150,0.5)",
    gradFull: "linear-gradient(160deg,#05111f 0%,#0c2340 45%,#132d50 100%)",
    gradPreview: "linear-gradient(180deg,rgba(5,17,31,0.2) 0%,rgba(5,17,31,0.96) 100%)",
    quote: "«Мы не принадлежим ни к одному из великих семейств человеческого рода»",
    bio: "Русский философ и публицист. Автор «Философических писем» — трактата, потрясшего основы российского самосознания. Объявлен властями официально сумасшедшим за критику исторического пути России.",
    fullBio: `Пётр Яковлевич Чаадаев (1794–1856) — русский философ, публицист и общественный мыслитель, один из наиболее самобытных умов своей эпохи.\n\nРодился в дворянской семье, рано лишился родителей и воспитывался под опекой тётки. Получил блестящее образование, участвовал в Отечественной войне 1812 года и заграничных походах. В 1821 году неожиданно для всех вышел в отставку в чине ротмистра гвардии — поступок, так и оставшийся загадкой для современников.\n\nГлавный труд Чаадаева — «Философические письма» (1829–1831), написанные по-французски. В первом из них он беспощадно критикует историческое прошлое России: по его мнению, страна стоит вне мировой цивилизации, не внесла ничего в общую сокровищницу человечества и лишена исторической памяти. Публикация первого письма в журнале «Телескоп» в 1836 году вызвала грандиозный скандал: журнал был закрыт, редактор сослан, а сам Чаадаев по личному указу Николая I объявлен сумасшедшим и отдан под медицинский надзор.\n\nНесмотря на это, Чаадаев продолжал посещать московские салоны и участвовать в интеллектуальной жизни. В «Апологии сумасшедшего» (1837) он смягчил свои взгляды, признав за Россией особую историческую миссию — но не в прошлом, а в будущем.\n\nЧаадаев оказал огромное влияние на всю последующую русскую мысль, став невольным отцом полемики между западниками и славянофилами.`,
    keyIdeas: ["Европейский путь", "Реформы и прогресс", "Рационализм", "Права личности"],
  },
  slav: {
    id: "slav",
    shortName: "Хомяков",
    fullName: "Алексей Степанович Хомяков",
    role: "Славянофил",
    years: "1804 — 1860",
    portrait: khomyakovImg,
    deepBg: "#1a0804",
    accentHex: "#9b2215",
    accentRgb: "155,34,21",
    glowColor: "rgba(155,34,21,0.5)",
    gradFull: "linear-gradient(160deg,#1a0804 0%,#3a1008 45%,#4d1508 100%)",
    gradPreview: "linear-gradient(180deg,rgba(26,8,4,0.2) 0%,rgba(26,8,4,0.96) 100%)",
    quote: "«Россия сильна не единством власти, а единством духа»",
    bio: "Русский религиозный философ, поэт и богослов. Один из основоположников славянофильства. Отстаивал идею соборности, особого духовного пути России через православие и общинный уклад.",
    fullBio: `Алексей Степанович Хомяков (1804–1860) — русский религиозный философ, богослов, поэт и публицист, один из основателей и главных идеологов славянофильства.\n\nРодился в старинной дворянской семье, получил домашнее образование, в юности увлекался математикой и живописью. Служил в кавалерии, участвовал в русско-турецкой войне 1828–1829 годов, после чего вышел в отставку и полностью посвятил себя литературе, философии и богословию.\n\nЦентральное понятие философии Хомякова — «соборность»: свободное единство людей в любви и истине, основанное на православной вере. В противовес западному рационализму он утверждал, что истина открывается не отдельному разуму, а живой церковной общине. Католицизм он критиковал за авторитаризм, протестантизм — за индивидуализм; православие, по его убеждению, единственно верно хранит апостольское предание.\n\nВ историософии Хомяков противопоставлял два начала: «иранское» (духовное, свободное) и «кушитское» (материальное, принудительное). Россия и славянство в целом принадлежат к иранскому типу и призваны обновить дряхлеющую западную цивилизацию.\n\nХомяков был человеком энциклопедического ума: помимо философии занимался агрономией, изобрёл новый тип паровой машины и ружьё особой конструкции. Его богословские труды при жизни не могли быть изданы в России из-за цензуры и выходили за рубежом.`,
    keyIdeas: ["Соборность", "Православный дух", "Общинный уклад", "Самобытный путь"],
  },
};

/* ─────────────────────────────────────────────
   FLOATING RUNES (декор)
───────────────────────────────────────────── */
const RUNE_SET = ["Ѣ","Ъ","Ѳ","Ѵ","Ѡ","Ѧ","Ѫ","Ѯ","Ѱ","Ф"];
function FloatingRunes({ color }) {
  const items = useRef(
    Array.from({ length: 7 }, (_, i) => ({
      id: i,
      rune: RUNE_SET[i % RUNE_SET.length],
      x: 8 + Math.random() * 82,
      y: 8 + Math.random() * 82,
      delay: Math.random() * 4,
      dur: 5 + Math.random() * 5,
      size: 14 + Math.random() * 30,
    }))
  ).current;

  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:1 }}>
      {items.map(item => (
        <span key={item.id} style={{
          position:"absolute",
          left:`${item.x}%`, top:`${item.y}%`,
          fontSize:item.size, fontFamily:"serif",
          color, opacity:0.1,
          animation:`float-rune ${item.dur}s ease-in-out ${item.delay}s infinite`,
          userSelect:"none",
        }}>
          {item.rune}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SINGLE CHAT PANEL
   TODO для бэкендщика: заменить mock-ответ в sendMessage()
───────────────────────────────────────────── */
function ChatSingle({ char }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const [bioOpen, setBioOpen]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const { accentRgb } = char;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, thinking]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 700); }, []);

  async function sendMessage() {
    const q = input.trim();
    if (!q || thinking) return;
    setInput("");
    setMessages(p => [...p, { from:"user", text:q }]);
    setThinking(true);

    // ══════════════════════════════════════════
    // TODO: бэкендщик заменяет этот блок на
    //       реальный fetch('/api/chat', { ... })
    //       и берёт ответ из data.reply
    await new Promise(r => setTimeout(r, 1200)); // имитация задержки
    const mockReply = `[Ответ ${char.shortName} на запрос: "${q}"] — здесь будет текст от бэкенда.`;
    // ══════════════════════════════════════════

    setMessages(p => [...p, { from:"ai", text:mockReply }]);
    setThinking(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", paddingTop:"80px" }}>

      {/* Биография */}
      <div style={{ padding:"0 2.5rem 1.25rem", flexShrink:0 }}>
        <div style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:"0.7rem", letterSpacing:"0.3em",
          textTransform:"uppercase", color:"var(--gold)", marginBottom:"0.35rem",
        }}>
          {char.role} · {char.years}
        </div>
        <h2 style={{
          fontFamily:"'Playfair Display',serif",
          fontSize:"clamp(1.5rem,2.2vw,2.4rem)",
          fontWeight:900, color:"var(--parchment)",
          lineHeight:1.1, marginBottom:"0.7rem",
        }}>
          {char.fullName}
        </h2>
        <p style={{
          fontFamily:"'IM Fell English',serif",
          fontSize:"0.93rem", color:"rgba(242,228,196,0.6)",
          fontStyle:"italic", lineHeight:1.7,
          marginBottom:"0.6rem", maxWidth:520,
        }}>
          {char.bio}
        </p>

        {/* Кнопка Подробнее */}
        <button
          onClick={() => setBioOpen(true)}
          style={{
            fontFamily:"'Cormorant Garamond',serif",
            fontSize:"0.72rem", letterSpacing:"0.2em",
            textTransform:"uppercase",
            background:"transparent",
            border:`1px solid rgba(${accentRgb},0.4)`,
            color:`rgba(${accentRgb},1)`,
            padding:"4px 14px", cursor:"pointer",
            marginBottom:"0.9rem",
            transition:"all .25s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = `rgba(${accentRgb},0.15)`;
            e.currentTarget.style.borderColor = `rgba(${accentRgb},0.8)`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = `rgba(${accentRgb},0.4)`;
          }}
        >
          Подробнее
        </button>

        {/* Модальное окно с полной биографией */}
        <AnimatePresence>
          {bioOpen && (
            <motion.div
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              style={{
                position:"fixed", inset:0, zIndex:100,
                background:"rgba(0,0,0,0.85)",
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"2rem",
              }}
              onClick={() => setBioOpen(false)}
            >
              <motion.div
                initial={{ opacity:0, y:30 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:30 }}
                transition={{ duration:0.35 }}
                onClick={e => e.stopPropagation()}
                style={{
                  background:`linear-gradient(160deg, ${char.deepBg}, #0a0806)`,
                  border:`1px solid rgba(${accentRgb},0.3)`,
                  maxWidth:680, width:"100%",
                  maxHeight:"80vh", overflowY:"auto",
                  padding:"2.5rem",
                  position:"relative",
                }}
              >
                {/* Закрыть */}
                <button
                  onClick={() => setBioOpen(false)}
                  style={{
                    position:"absolute", top:"1rem", right:"1rem",
                    background:"transparent", border:"none",
                    color:"rgba(242,228,196,0.4)", fontSize:"1.2rem",
                    cursor:"pointer", lineHeight:1,
                    transition:"color .2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--gold)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(242,228,196,0.4)"}
                >
                  ✕
                </button>

                <div style={{
                  fontFamily:"'Cormorant Garamond',serif",
                  fontSize:"0.65rem", letterSpacing:"0.35em",
                  textTransform:"uppercase", color:`rgba(${accentRgb},0.9)`,
                  marginBottom:"0.5rem",
                }}>
                  {char.role}
                </div>
                <h2 style={{
                  fontFamily:"'Playfair Display',serif",
                  fontSize:"clamp(1.4rem,2vw,2rem)", fontWeight:900,
                  color:"var(--parchment)", marginBottom:"1.5rem",
                  lineHeight:1.15,
                }}>
                  {char.fullName}
                </h2>

                <div style={{
                  height:1, marginBottom:"1.5rem",
                  background:`linear-gradient(90deg,rgba(${accentRgb},0.6),transparent)`,
                }} />

                <p style={{
                  fontFamily:"'IM Fell English',serif",
                  fontSize:"1rem", color:"rgba(242,228,196,0.75)",
                  lineHeight:1.9, whiteSpace:"pre-wrap",
                }}>
                  {char.fullBio}
                </p>

                <div style={{
                  marginTop:"2rem",
                  fontFamily:"'Cormorant Garamond',serif",
                  fontStyle:"italic", fontSize:"0.8rem",
                  color:"rgba(242,228,196,0.25)", textAlign:"center",
                  letterSpacing:"0.15em",
                }}>
                  нажмите за пределами окна, чтобы закрыть
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.35rem" }}>
          {char.keyIdeas.map(idea => (
            <span key={idea} style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:"0.72rem", letterSpacing:"0.1em",
              padding:"3px 10px",
              border:`1px solid rgba(${accentRgb},0.32)`,
              color:"rgba(242,228,196,0.55)",
              background:`rgba(${accentRgb},0.1)`,
            }}>
              {idea}
            </span>
          ))}
        </div>
      </div>

      {/* Разделитель */}
      <div style={{
        height:1, margin:"0 2.5rem .75rem",
        background:`linear-gradient(90deg,transparent,rgba(${accentRgb},1),transparent)`,
        opacity:.35, flexShrink:0,
      }} />

      {/* Сообщения */}
      <div style={{
        flex:1, overflowY:"auto", padding:"0 2.5rem",
        display:"flex", flexDirection:"column", gap:"0.9rem",
      }}>
        {messages.length === 0 && (
          <div style={{
            margin:"auto", textAlign:"center",
            fontFamily:"'IM Fell English',serif",
            fontStyle:"italic", fontSize:"1rem",
            color:"rgba(242,228,196,0.2)", lineHeight:2, userSelect:"none",
          }}>
            <div style={{ fontSize:"2rem", marginBottom:"0.5rem", opacity:.2 }}>✦</div>
            Задайте вопрос мыслителю<br/>
            <span style={{ fontSize:"0.85rem" }}>о судьбах России, истории, культуре…</span>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="message-appear" style={{
            alignSelf: m.from === "user" ? "flex-end" : "flex-start",
            maxWidth:"85%", animationDelay:`${i * 0.04}s`,
          }}>
            {m.from === "user" ? (
              <div style={{
                background:"rgba(201,168,76,0.11)",
                border:"1px solid rgba(201,168,76,0.32)",
                padding:"0.6rem 0.95rem",
                fontFamily:"'Cormorant Garamond',serif",
                fontSize:"1rem", color:"var(--parchment)", lineHeight:1.6,
              }}>
                {m.text}
              </div>
            ) : (
              <div style={{
                background:`rgba(${accentRgb},0.1)`,
                border:`1px solid rgba(${accentRgb},0.3)`,
                padding:"0.85rem 1rem",
                fontFamily:"'IM Fell English',serif",
                fontSize:"0.95rem", color:"var(--parchment-dim)",
                lineHeight:1.8, whiteSpace:"pre-wrap",
              }}>
                {m.text}
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div style={{
            alignSelf:"flex-start",
            padding:"0.65rem 0.95rem",
            border:`1px solid rgba(${accentRgb},0.28)`,
            background:`rgba(${accentRgb},0.09)`,
            display:"flex", gap:"6px", alignItems:"center",
          }}>
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div style={{ padding:"0.75rem 2.5rem 0", display:"flex", gap:"0.5rem", flexShrink:0 }}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Вопрос историческому мыслителю…"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <button className="send-btn" onClick={sendMessage} disabled={thinking || !input.trim()}>
          {thinking ? "…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DEBATE VIEW (параллельный режим)
   TODO для бэкендщика: заменить mock в sendToAll()
───────────────────────────────────────────── */
function DebateView() {
  const [exchanges, setExchanges] = useState([]);
  const [input, setInput]         = useState("");
  const [thinking, setThinking]   = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [exchanges, thinking]);

  async function sendToAll() {
    const q = input.trim();
    if (!q || thinking) return;
    setInput("");
    setThinking(true);
    setExchanges(p => [...p, { question:q, west:null, slav:null }]);

    // ══════════════════════════════════════════
    // TODO: бэкендщик заменяет этот блок на
    //       два параллельных fetch к /api/chat
    //       с разными character: 'west' / 'slav'
    await new Promise(r => setTimeout(r, 1400));
    const mockWest = `[Чаадаев о "${q}"] — ответ западника придёт от бэкенда.`;
    const mockSlav = `[Хомяков о "${q}"] — ответ славянофила придёт от бэкенда.`;
    // ══════════════════════════════════════════

    setExchanges(p => {
      const u = [...p];
      u[u.length - 1] = { question:q, west:mockWest, slav:mockSlav };
      return u;
    });
    setThinking(false);
  }

  return (
    <div style={{
      width:"100%", height:"100vh",
      background:"linear-gradient(160deg,#080604 0%,#0e0a05 100%)",
      display:"flex", flexDirection:"column", color:"var(--parchment)",
    }}>


      {/* Диспуты */}
      <div style={{
        flex:1, overflowY:"auto", padding:"80px 2rem 20px",
        display:"flex", flexDirection:"column", gap:"1.75rem",
      }}>
        {exchanges.length === 0 && (
          <div style={{
            margin:"auto", textAlign:"center",
            fontFamily:"'IM Fell English',serif",
            fontStyle:"italic", fontSize:"1rem",
            color:"rgba(242,228,196,0.18)", lineHeight:2, userSelect:"none",
          }}>
            <div style={{ fontSize:"2.5rem", opacity:.13, marginBottom:"0.5rem" }}>⚔</div>
            Задайте вопрос — оба мыслителя ответят одновременно<br/>
            <span style={{ fontSize:"0.85rem" }}>Сравните позиции и сделайте вывод</span>
          </div>
        )}

        {exchanges.map((ex, i) => (
          <div key={i} className="message-appear" style={{ animationDelay:`${i * 0.04}s` }}>
            {/* Вопрос */}
            <div style={{
              textAlign:"center", marginBottom:"0.9rem",
              display:"flex", alignItems:"center", gap:"0.75rem",
            }}>
              <div style={{ flex:1, height:1, background:"rgba(201,168,76,0.1)" }} />
              <span style={{
                fontFamily:"'Cormorant Garamond',serif",
                fontStyle:"italic", fontSize:"0.88rem",
                color:"rgba(201,168,76,0.58)", letterSpacing:"0.05em",
              }}>
                {ex.question}
              </span>
              <div style={{ flex:1, height:1, background:"rgba(201,168,76,0.1)" }} />
            </div>

            {/* Ответы в двух колонках */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
              {[
                { key:"west", rgb:"42,100,150",  text:ex.west },
                { key:"slav", rgb:"155,34,21",   text:ex.slav },
              ].map(({ key, rgb, text }) => (
                <div key={key} style={{
                  padding:"0.9rem 1.05rem",
                  background:`rgba(${rgb},0.08)`,
                  border:`1px solid rgba(${rgb},0.26)`,
                  fontFamily:"'IM Fell English',serif",
                  fontSize:"0.92rem", color:"var(--parchment-dim)",
                  lineHeight:1.8, whiteSpace:"pre-wrap", minHeight:80,
                }}>
                  {text ?? (
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Поле ввода */}
      <div style={{
        padding:"0.9rem 2rem 1.4rem",
        borderTop:"1px solid rgba(201,168,76,0.08)",
        display:"flex", gap:"0.5rem", flexShrink:0,
      }}>
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Задайте вопрос обоим мыслителям одновременно…"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendToAll(); } }}
        />
        <button className="send-btn" onClick={sendToAll} disabled={thinking || !input.trim()}>
          {thinking ? "…" : "К диспуту"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PANEL (одна из двух половин экрана)
───────────────────────────────────────────── */
function Panel({ char, active, setActive }) {
  const isActive      = active === char.id;
  const isOtherActive = active && !isActive;

  return (
    <motion.div
      animate={{ width: isActive ? "100%" : isOtherActive ? "0%" : "50%" }}
      transition={{ duration:0.75, ease:[0.76,0,0.24,1] }}
      style={{ position:"relative", height:"100vh", overflow:"hidden", flexShrink:0 }}
    >
      {/* Фон */}
      <div style={{ position:"absolute", inset:0, background:char.gradFull, zIndex:0 }} />

      {/* Портрет */}
      <img
        src={char.portrait}
        alt=""
        style={{
          position:"absolute", inset:0,
          width:"100%", height:"100%",
          objectFit:"cover", objectPosition:"center top",
          filter:"grayscale(100%) sepia(30%) contrast(1.1)",
          opacity: isActive ? 0.14 : 0.3,
          zIndex:1, transition:"opacity 1s ease",
        }}
      />

      {/* Оверлей */}
      <div style={{
        position:"absolute", inset:0, zIndex:2,
        background: isActive
          ? `linear-gradient(180deg,${char.deepBg}cc 0%,${char.deepBg}aa 100%)`
          : char.gradPreview,
      }} />

      <FloatingRunes color={char.accentHex} />
      {!isOtherActive && <div className="ornament-border" />}

      {/* ── СОСТОЯНИЕ ПОКОЯ ── */}
      <AnimatePresence>
        {!isActive && !isOtherActive && (
          <motion.div
            key="idle"
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.4 }}
            onClick={() => setActive(char.id)}
            style={{
              position:"absolute", inset:0, zIndex:5,
              display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center",
              cursor:"pointer", gap:"1.1rem", padding:"2rem",
            }}
          >
            {/* Портрет в круге */}
            <motion.div
              whileHover={{ scale:1.05 }}
              transition={{ duration:0.5 }}
              style={{
                width:128, height:128, borderRadius:"50%",
                overflow:"hidden",
                border:"1px solid rgba(201,168,76,0.42)",
                boxShadow:`0 0 36px ${char.glowColor},0 0 72px ${char.glowColor.replace('0.5','0.15')}`,
                animation:"candle 4s ease-in-out infinite",
              }}
            >
              <img src={char.portrait} alt="" style={{
                width:"100%", height:"100%",
                objectFit:"cover", objectPosition:"center top",
                filter:"grayscale(80%) sepia(30%) contrast(1.1)",
              }} />
            </motion.div>

            <div style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:"0.65rem", letterSpacing:"0.38em",
              textTransform:"uppercase", color:"var(--gold)", opacity:.72,
            }}>
              {char.role}
            </div>

            <div style={{
              fontFamily:"'Playfair Display',serif",
              fontSize:"clamp(1rem,1.7vw,1.55rem)", fontWeight:900,
              color:"var(--parchment)", textAlign:"center",
              lineHeight:1.2, textShadow:`0 0 30px ${char.glowColor}`,
            }}>
              {char.fullName}
            </div>

            <div style={{
              fontFamily:"'IM Fell English',serif",
              fontStyle:"italic", fontSize:"0.8rem",
              color:"rgba(242,228,196,0.36)",
            }}>
              {char.years}
            </div>

            <div style={{
              fontFamily:"'IM Fell English',serif",
              fontStyle:"italic", fontSize:"0.78rem",
              color:"rgba(242,228,196,0.28)",
              textAlign:"center", lineHeight:1.7,
              maxWidth:240, paddingTop:"0.25rem",
            }}>
              {char.quote}
            </div>

            <div style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:"0.64rem", letterSpacing:"0.28em",
              textTransform:"uppercase", color:"rgba(201,168,76,0.35)",
              marginTop:"0.3rem",
            }}>
              нажмите для диалога
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── АКТИВНОЕ СОСТОЯНИЕ ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="active"
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ delay:0.3, duration:0.5 }}
            style={{ position:"absolute", inset:0, zIndex:5 }}
          >
            <button
              onClick={() => setActive(null)}
              style={{
                position:"absolute", top:"2rem", left:"1.4rem",
                background:"rgba(0,0,0,0.65)",
                border:"1px solid rgba(201,168,76,0.25)",
                color:"rgba(242,228,196,0.62)",
                fontFamily:"'Cormorant Garamond',serif",
                fontSize:"0.72rem", letterSpacing:"0.2em",
                textTransform:"uppercase", padding:"0.4rem 1rem",
                cursor:"pointer", zIndex:10, transition:"all .25s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(201,168,76,0.16)";
                e.currentTarget.style.borderColor = "var(--gold)";
                e.currentTarget.style.color = "var(--gold-light)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(0,0,0,0.65)";
                e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)";
                e.currentTarget.style.color = "rgba(242,228,196,0.62)";
              }}
            >
              ← Назад
            </button>
            <ChatSingle char={char} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   ЦЕНТРАЛЬНЫЙ РАЗДЕЛИТЕЛЬ
───────────────────────────────────────────── */
function CenterDivider({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity:0, scaleY:0 }}
          animate={{ opacity:1, scaleY:1 }}
          exit={{ opacity:0, scaleY:0 }}
          transition={{ duration:0.5 }}
          style={{
            position:"absolute", left:"50%", top:"8%", bottom:"8%",
            transform:"translateX(-50%)", width:1,
            background:"linear-gradient(180deg,transparent,var(--gold) 20%,var(--gold) 80%,transparent)",
            animation:"divider-glow 3s ease-in-out infinite",
            zIndex:20, pointerEvents:"none",
          }}
        >
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            width:44, height:44, borderRadius:"50%",
            background:"radial-gradient(circle,#1a1408,#0a0806)",
            border:"1px solid rgba(201,168,76,0.52)",
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:"0 0 24px rgba(201,168,76,0.38),0 0 60px rgba(201,168,76,0.12)",
          }}>
            <span style={{
              fontFamily:"'Playfair Display',serif",
              fontSize:"0.6rem", fontWeight:900,
              letterSpacing:"0.1em", color:"var(--gold)",
            }}>VS</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────── */
export default function App() {
  const [active, setActive] = useState(null);        // "west" | "slav" | null
  const [mode,   setMode]   = useState("single");    // "single" | "debate"

  return (
    <>
      <style>{STYLES}</style>
      <div className="noise-overlay" />

      <div style={{ width:"100vw", height:"100vh", overflow:"hidden", position:"relative" }}>

        {/* РЕЖИМ ДИСПУТА */}
        <AnimatePresence>
          {mode === "debate" && (
            <motion.div
              key="debate"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.45 }}
              style={{ position:"absolute", inset:0, zIndex:30 }}
            >
              <DebateView />
            </motion.div>
          )}
        </AnimatePresence>

        {/* РЕЖИМ МОНОЛОГА (split-панели) */}
        <AnimatePresence>
          {mode === "single" && (
            <motion.div
              key="split"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.4 }}
              style={{ position:"absolute", inset:0, display:"flex" }}
            >
              <Panel char={CHARS.slav} active={active} setActive={setActive} />
              <Panel char={CHARS.west} active={active} setActive={setActive} />
              <CenterDivider visible={!active} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ */}
        <motion.div
          initial={{ opacity:0, y:16 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.7 }}
          style={{
            position:"absolute", top:0, left:0, right:0,
            display:"flex", justifyContent:"center", zIndex:40,
            display:"flex", alignItems:"center",
            background:"rgba(5,3,2,0.82)",
            border:"1px solid rgba(201,168,76,0.16)",
            backdropFilter:"blur(16px)",
          }}
        >
          <button
            className={`mode-btn ${mode === "single" ? "active" : ""}`}
            onClick={() => { setMode("single"); setActive(null); }}
          >
            Монолог
          </button>
          <div style={{ width:1, height:22, background:"rgba(201,168,76,0.16)" }} />
          <button
            className={`mode-btn ${mode === "debate" ? "active" : ""}`}
            onClick={() => { setMode("debate"); setActive(null); }}
          >
            Диспут
          </button>
        </motion.div>



      </div>
    </>
  );
}