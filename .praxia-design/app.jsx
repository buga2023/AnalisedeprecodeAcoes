// app.jsx — Praxia top-level: design canvas + tweaks shell

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5b7cff",
  "tone": "casual",
  "density": "regular"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const accent = t.accent;

  return (
    <>
      <DesignCanvas>
        <DCSection id="hero" title="Praxia · Prototype" subtitle="App de análise e precificação de ações com IA mentora. Clique no FAB azul para conversar com a Pra (responde de verdade via Claude). Navegue pelas abas, abra ações, compre, etc.">
          <DCArtboard id="main" label="Fluxo principal · interativo" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <PraxiaPrototype accent={accent} tone={t.tone} density={t.density}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="onboarding-a" label="Onboarding A · Hero glow" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <ScreenOnboarding onStart={() => {}} accent={accent}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="onboarding-b" label="Onboarding B · Type-led" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <VarOnboardingTypeLed accent={accent}/>
            </IOSDevice>
          </DCArtboard>
        </DCSection>

        <DCSection id="home-variants" title="Home · variações" subtitle="Três abordagens para o dashboard.">
          <DCArtboard id="home-a" label="A · Card hero" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenHome accent={accent} density={t.density} onOpenStock={() => {}} onTab={() => {}}/>
                <BottomNav tab="home" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="home-b" label="B · Dense / list-led" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <VarHomeDense accent={accent}/>
                <BottomNav tab="home" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="home-c" label="C · Tile grid" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <VarHomeGrid accent={accent}/>
                <BottomNav tab="home" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="home-d" label="D · Performance-led" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <VarHomePerformance accent={accent}/>
                <BottomNav tab="home" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>
        </DCSection>

        <DCSection id="chat-variants" title="Chat com a Pra · variações" subtitle="Como a IA aparece no app.">
          <DCArtboard id="chat-a" label="A · Sheet flutuante (no fluxo principal)" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenHome accent={accent} density={t.density} onOpenStock={() => {}} onTab={() => {}}/>
                <ChatSheet open={true} onClose={() => {}} accent={accent} tone={t.tone}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="chat-b" label="B · Tela dedicada com briefing" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <VarChatFullscreen accent={accent}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="chat-c" label="C · Sugestão contextual" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <VarChatPopover accent={accent}/>
            </IOSDevice>
          </DCArtboard>
        </DCSection>

        <DCSection id="quickwatch" title="Quick Watch · preview rápido" subtitle="Bottom sheet que abre ao tocar numa ação na lista — Buy/Sell direto sem entrar na tela cheia.">
          <DCArtboard id="qw-home" label="Sobre a Home" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenHome accent={accent} density={t.density} onOpenStock={() => {}} onTab={() => {}}/>
                <QuickWatch stock={Stocks[3]} open={true} accent={accent} onClose={() => {}} onBuy={() => {}} onSell={() => {}} onSeeDetail={() => {}}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="qw-down" label="Posição em baixa" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenMarket accent={accent} onOpenStock={() => {}}/>
                <QuickWatch stock={Stocks[2]} open={true} accent={accent} onClose={() => {}} onBuy={() => {}} onSell={() => {}} onSeeDetail={() => {}}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>
        </DCSection>

        <DCSection id="flow-screens" title="Telas do fluxo" subtitle="Screens individuais do fluxo principal para inspeção isolada.">
          <DCArtboard id="quiz" label="Quiz de perfil" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <ScreenQuiz onComplete={() => {}} accent={accent}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="market" label="Mercado / watchlist" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenMarket accent={accent} onOpenStock={() => {}}/>
                <BottomNav tab="market" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="stock" label="Detalhe da ação" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <ScreenStockDetail stock={Stocks[3]} accent={accent} onBack={() => {}} onBuy={() => {}}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="order" label="Nova ordem" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <ScreenOrder stock={Stocks[3]} accent={accent} onBack={() => {}} onConfirm={() => {}}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="review" label="Order Review" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <ScreenOrderReview stock={Stocks[3]} order={{ shares: 50, total: 7115, fee: 0, orderType: 'Mercado' }} accent={accent} onClose={() => {}} onBuy={() => {}}/>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="profile" label="Perfil" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenProfile accent={accent} onRestart={() => {}}/>
                <BottomNav tab="profile" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>

          <DCArtboard id="activity" label="Atividade" width={402} height={874}>
            <IOSDevice dark width={402} height={874}>
              <FakePraxia>
                <ScreenActivity accent={accent}/>
                <BottomNav tab="activity" setTab={() => {}} accent={accent}/>
              </FakePraxia>
            </IOSDevice>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel>
        <TweakSection label="Identidade"/>
        <TweakColor label="Cor de destaque" value={t.accent}
          options={['#5b7cff', '#42e8a3', '#a78bfa', '#ff8a4d', '#f3b94d']}
          onChange={(v) => setTweak('accent', v)}/>
        <TweakSection label="IA · Pra"/>
        <TweakRadio label="Tom da conversa" value={t.tone}
          options={[{label: 'Casual', value: 'casual'}, {label: 'Formal', value: 'formal'}]}
          onChange={(v) => setTweak('tone', v)}/>
        <TweakSection label="Layout"/>
        <TweakRadio label="Densidade" value={t.density}
          options={[{label: 'Compacta', value: 'compact'}, {label: 'Padrão', value: 'regular'}]}
          onChange={(v) => setTweak('density', v)}/>
      </TweaksPanel>
    </>
  );
}

// Wrap component to give it relative position so absolute nav/sheet land correctly
function FakePraxia({ children }) {
  return <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#02030f' }}>{children}</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

Object.assign(window, { App, FakePraxia });
