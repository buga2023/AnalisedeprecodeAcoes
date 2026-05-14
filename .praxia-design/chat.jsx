// chat.jsx — Pra (AI assistant) conversational sheet
// Uses window.claude.complete for live responses, with conversational fallback

function ChatSheet({ open, onClose, accent, tone = 'casual', context }) {
  const T = PraxiaTokens;
  const [messages, setMessages] = React.useState(() => [
    { role: 'pra', text: greetingFor(tone) },
  ]);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [suggested, setSuggested] = React.useState(true);
  const scrollerRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || thinking) return;
    setInput('');
    setSuggested(false);
    const next = [...messages, { role: 'me', text: t }];
    setMessages(next);
    setThinking(true);

    try {
      const sys = systemPromptFor(tone, context);
      const transcript = next.map(m => ({
        role: m.role === 'me' ? 'user' : 'assistant',
        content: m.text,
      }));
      const reply = await window.claude.complete({
        messages: [
          { role: 'user', content: sys + '\n\n— início da conversa —' },
          ...transcript,
        ],
      });
      setMessages(m => [...m, { role: 'pra', text: (reply || '').trim() || fallbackReply(t) }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'pra', text: fallbackReply(t) }]);
    } finally {
      setThinking(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(2, 3, 20, 0.6)',
        backdropFilter: 'blur(6px)',
        animation: 'praFadeIn 0.2s ease-out',
      }}/>
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 51,
        height: '88%',
        background: `
          radial-gradient(120% 60% at 80% 0%, ${accent}22 0%, transparent 50%),
          linear-gradient(180deg, #0a1030 0%, #050818 80%)
        `,
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        border: `0.5px solid ${T.hairlineStrong}`,
        boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        animation: 'praSlideUp 0.32s cubic-bezier(.2,.7,.3,1)',
        overflow: 'hidden',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}/>
        </div>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px 14px', borderBottom: `0.5px solid ${T.hairline}` }}>
          <div style={{ position: 'relative' }}>
            {Icon.praMark(40, '#fff', accent)}
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5,
              background: T.up, border: '2px solid #0a1030',
            }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.display, fontWeight: 600, fontSize: 15, color: T.ink }}>Pra</div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.ink50 }}>Sua mentora de investimentos · online</div>
          </div>
          <button onClick={onClose} style={glassBtn(T)}>{Icon.close(16, T.ink70)}</button>
        </div>

        {/* messages */}
        <div ref={scrollerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} accent={accent}/>)}
          {thinking && <ThinkingBubble accent={accent}/>}
          {suggested && messages.length === 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: PraxiaTokens.mono, fontSize: 10.5, color: T.ink30, letterSpacing: 0.8, marginBottom: 8 }}>SUGESTÕES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {praSuggestions(context).map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.hairline}`,
                    color: T.ink, fontFamily: T.body, fontSize: 13, cursor: 'pointer',
                    lineHeight: 1.4,
                  }}>
                    <span style={{ color: accent, marginRight: 6 }}>›</span>{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* input */}
        <div style={{
          padding: '12px 16px 24px',
          borderTop: `0.5px solid ${T.hairline}`,
          background: 'rgba(2,3,20,0.5)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            padding: '8px 8px 8px 16px',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.06)',
            border: `0.5px solid ${T.hairlineStrong}`,
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunte algo sobre seus investimentos…"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: T.ink, fontFamily: T.body, fontSize: 14, resize: 'none',
                paddingTop: 9, paddingBottom: 9, maxHeight: 100,
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || thinking} style={{
              width: 36, height: 36, borderRadius: 18, border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
              background: input.trim() ? accent : 'rgba(255,255,255,0.1)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {Icon.send(16, 'white')}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes praFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes praSlideUp {
          from { transform: translateY(100%); opacity: 0.5 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </>
  );
}

function Bubble({ role, text, accent }) {
  const T = PraxiaTokens;
  const isMe = role === 'me';
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', padding: '10px 14px', borderRadius: 18,
        background: isMe ? accent : 'rgba(255,255,255,0.06)',
        color: isMe ? 'white' : T.ink,
        borderTopRightRadius: isMe ? 4 : 18,
        borderTopLeftRadius: isMe ? 18 : 4,
        fontFamily: T.body, fontSize: 13.5, lineHeight: 1.45,
        border: isMe ? 'none' : `0.5px solid ${T.hairline}`,
        whiteSpace: 'pre-wrap',
      }}>{text}</div>
    </div>
  );
}

function ThinkingBubble({ accent }) {
  const T = PraxiaTokens;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        padding: '12px 16px', borderRadius: 18, borderTopLeftRadius: 4,
        background: 'rgba(255,255,255,0.06)', border: `0.5px solid ${T.hairline}`,
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: 3, background: accent, display: 'inline-block',
            animation: `praDot 1s ease-in-out ${i * 0.15}s infinite`,
          }}/>
        ))}
        <style>{`@keyframes praDot { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0) } 40% { opacity: 1; transform: translateY(-3px) } }`}</style>
      </div>
    </div>
  );
}

function greetingFor(tone) {
  if (tone === 'formal') {
    return 'Olá. Sou a Pra, sua assistente de investimentos. Como posso auxiliar você hoje? Posso analisar seu portfólio, comparar ativos ou sugerir oportunidades alinhadas ao seu perfil.';
  }
  return 'Oi! Sou a Pra 👋\nEstou aqui pra ajudar você a investir com mais clareza. Posso explicar uma ação, comparar duas, olhar pro seu portfólio... o que quer fazer?';
}

function fallbackReply(userMsg) {
  const t = userMsg.toLowerCase();
  if (t.includes('petr') || t.includes('petrobras')) {
    return 'Petrobras (PETR4) tá em $38.42 hoje, +2.34%. P/L em 4.2x, bem abaixo da média do setor de energia, e dividend yield robusto. Pelo seu perfil moderado, vale como geradora de renda — mas não passe de 15% da carteira pra evitar concentração em commodities.';
  }
  if (t.includes('aapl') || t.includes('apple')) {
    return 'AAPL fechou em $228.51, +1.18%. Múltiplos esticados, mas margem operacional e recompra de ações seguem fortes. Como você já tem 38% em tech, eu pensaria duas vezes antes de aumentar exposição — talvez olhar setores defensivos como saúde ou utilities?';
  }
  if (t.includes('risco') || t.includes('perfil')) {
    return 'Seu perfil hoje tá moderado: 60% renda variável, 40% renda fixa. A maior concentração é em tech (38%). Se eu fosse fazer um ajuste, daria peso pra setores menos correlacionados com tecnologia — bancos ou consumo defensivo, por exemplo.';
  }
  if (t.includes('dividend') || t.includes('renda')) {
    return 'Pra dividendos consistentes no Brasil, eu olharia Itaú (ITUB4), Taesa, BB Seguridade e Vale. Fora ITUB4 que você já tem, as outras três têm yield acima de 8% e payout estável. Quer que eu detalhe alguma?';
  }
  if (t.includes('rebalance')) {
    return 'Pra rebalancear, eu sugeriria: reduzir tech de 38% pra ~28%, aumentar setor financeiro (de 22% pra ~25%) e adicionar exposição a consumo defensivo (~10%). Isso reduz volatilidade sem sacrificar muito retorno esperado.';
  }
  return `Boa pergunta. Pelo seu perfil moderado e horizonte de 1–5 anos, eu olharia isso pensando em duas coisas: (1) impacto na sua exposição setorial atual e (2) correlação com o que você já tem. Quer que eu detalhe alguma ação específica?`;
}

function praSuggestions(context) {
  return [
    'Como minha carteira tá agora?',
    'Sugira 3 ações pro meu perfil',
    'Vale a pena aumentar tech?',
    'O que é dividend yield?',
  ];
}

function systemPromptFor(tone, context) {
  const personality = tone === 'formal'
    ? 'Você é Pra, uma consultora financeira profissional. Tom respeitoso, claro, com linguagem de mercado mas acessível. Use "você".'
    : 'Você é Pra, uma mentora de investimentos amigável e direta, como um amigo que entende muito de mercado. Tom casual, descontraído, pode usar "tá", "pra". Seja breve.';
  return [
    personality,
    'Responda em português brasileiro.',
    'Mantenha respostas curtas (2-4 frases). Seja específica com números.',
    'Contexto do usuário: perfil moderado, horizonte 1-5 anos, interesse em tech + dividendos. Patrimônio $124.580. Carteira: 38% tech, 22% bancos, 18% energia, 12% mineração, 10% outros.',
    'Posições principais: AAPL, ITUB4, PETR4, NVDA, VALE3, MSFT, WEGE3.',
    'Você não dá conselho financeiro vinculante; sempre lembre que decisões são do usuário. Mas seja útil, dê opiniões concretas com números, não fique em cima do muro.',
    'Nunca use markdown pesado (negrito ok). Não use bullet points longos.',
  ].join('\n');
}

Object.assign(window, { ChatSheet, Bubble, ThinkingBubble });
