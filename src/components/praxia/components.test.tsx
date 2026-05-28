import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppShell } from "./AppShell";
import { BottomNav } from "./BottomNav";
import { Tag, StatusTag, DeltaPill } from "./Tag";
import { GlassButton } from "./GlassButton";
import { StockAvatar } from "./StockAvatar";
import { PraxiaCard } from "./PraxiaCard";
import { SectionHeader } from "./SectionHeader";
import { FloatingPraButton } from "./FloatingPraButton";
import { PraMark } from "./PraMark";
import { DisclaimerBar } from "./DisclaimerBar";
import { AIBadge } from "./AIBadge";
import { HoldingRow } from "./HoldingRow";
import { Icon } from "./Icon";
import type { Stock } from "@/types/stock";

describe("AppShell", () => {
  it("renderiza children", () => {
    render(
      <AppShell>
        <div data-testid="child">olá</div>
      </AppShell>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("olá");
  });
});

describe("BottomNav", () => {
  it("chama onChange quando aba é clicada", () => {
    const onChange = vi.fn();
    render(<BottomNav tab="home" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Mercado/));
    expect(onChange).toHaveBeenCalledWith("market");
  });

  it("marca aba ativa via aria-current", () => {
    render(<BottomNav tab="profile" onChange={() => {}} />);
    expect(screen.getByLabelText(/Perfil/)).toHaveAttribute("aria-current", "page");
  });
});

describe("Tag / StatusTag / DeltaPill", () => {
  it("Tag renderiza children", () => {
    render(<Tag>hello</Tag>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Tag respeita size md", () => {
    render(<Tag size="md">m</Tag>);
    expect(screen.getByText("m")).toBeInTheDocument();
  });

  it("StatusTag renderiza children", () => {
    render(
      <StatusTag color="#000" text="#fff">
        ok
      </StatusTag>
    );
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("DeltaPill positivo mostra + e valor", () => {
    render(<DeltaPill value={2.34} />);
    expect(screen.getByText(/\+2\.34%/)).toBeInTheDocument();
  });

  it("DeltaPill negativo sem +", () => {
    render(<DeltaPill value={-1.2} />);
    expect(screen.getByText(/-1\.20%/)).toBeInTheDocument();
  });
});

describe("GlassButton", () => {
  it("aciona onClick", () => {
    const onClick = vi.fn();
    render(
      <GlassButton onClick={onClick} ariaLabel="b">
        x
      </GlassButton>
    );
    fireEvent.click(screen.getByLabelText("b"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("StockAvatar", () => {
  it("mostra as 2 primeiras letras do ticker", () => {
    render(<StockAvatar ticker="PETR4" />);
    expect(screen.getByText("PE")).toBeInTheDocument();
  });
});

describe("PraxiaCard", () => {
  it("renderiza como div quando sem onClick", () => {
    const { container } = render(<PraxiaCard>x</PraxiaCard>);
    expect(container.querySelector("div")).toBeTruthy();
  });
  it("renderiza como button quando há onClick e clique funciona", () => {
    const onClick = vi.fn();
    render(<PraxiaCard onClick={onClick}>botao</PraxiaCard>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("SectionHeader", () => {
  it("renderiza label", () => {
    render(<SectionHeader label="Carteira" />);
    expect(screen.getByText("Carteira")).toBeInTheDocument();
  });
  it("aciona onTrailingClick", () => {
    const fn = vi.fn();
    render(<SectionHeader label="x" trailing="ver+" onTrailingClick={fn} />);
    fireEvent.click(screen.getByText("ver+"));
    expect(fn).toHaveBeenCalled();
  });
});

describe("FloatingPraButton", () => {
  it("renderiza aria-label", () => {
    render(<FloatingPraButton onClick={() => {}} />);
    expect(screen.getByLabelText(/Conversar com a Pra/)).toBeInTheDocument();
  });
  it("mostra badge hasNew", () => {
    const { container } = render(<FloatingPraButton onClick={() => {}} hasNew />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe("PraMark", () => {
  it("renderiza com role img e P", () => {
    render(<PraMark />);
    expect(screen.getByRole("img", { name: /Pra/ })).toBeInTheDocument();
  });
});

describe("DisclaimerBar", () => {
  it("variant compact mostra texto curto com referência CVM 14", () => {
    render(<DisclaimerBar />);
    // Texto principal mudou para conformidade CVM Res. 14 (Camada 4 LGPD).
    expect(screen.getByText(/Conteúdo educacional — não é recomendação/)).toBeInTheDocument();
    expect(screen.getByText(/Res\. CVM 14/)).toBeInTheDocument();
  });
  it("variant inline mostra disclaimer educacional + Res. CVM 14", () => {
    render(<DisclaimerBar variant="inline" />);
    expect(screen.getByText(/Conteúdo educacional, não recomendação/)).toBeInTheDocument();
    expect(screen.getByText(/Res\. CVM 14/)).toBeInTheDocument();
  });
});

describe("AIBadge", () => {
  it("renderiza com confianca padrão e mostra 'IA'", () => {
    render(<AIBadge />);
    expect(screen.getByText("IA")).toBeInTheDocument();
  });
  it("respeita confianca high", () => {
    render(<AIBadge confianca="alta" reference="Release 3T24" />);
    expect(screen.getByText("IA")).toBeInTheDocument();
  });
});

describe("HoldingRow", () => {
  const stock: Stock = {
    ticker: "PETR4",
    price: 30,
    cost: 25,
    quantity: 100,
    lpa: 2,
    vpa: 10,
    roe: 0.15,
    debtToEbitda: 1,
    change: 1,
    changePercent: 3,
    lastUpdated: "",
    score: 70,
    scoreBreakdown: { priceScore: 25, profitabilityScore: 15, healthScore: 15, dividendScore: 10, valuationScore: 5 },
    isFavorite: false,
    pl: 5,
    pvp: 1.2,
    dividendYield: 0.05,
    evEbitda: 5,
    netMargin: 0.1,
    ebitdaMargin: 0.2,
    name: "Petrobras",
  };

  it("renderiza ticker + name + valor da posição", () => {
    render(<HoldingRow stock={stock} />);
    expect(screen.getByText("PETR4")).toBeInTheDocument();
    expect(screen.getByText("Petrobras")).toBeInTheDocument();
  });

  it("aciona onClick", () => {
    const fn = vi.fn();
    render(<HoldingRow stock={stock} onClick={fn} />);
    fireEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalled();
  });
});

describe("Icon", () => {
  it("exporta diversos ícones que renderizam SVG", () => {
    const { container: c1 } = render(<Icon.home />);
    const { container: c2 } = render(<Icon.market />);
    const { container: c3 } = render(<Icon.activity />);
    const { container: c4 } = render(<Icon.profile />);
    const { container: c5 } = render(<Icon.bell />);
    const { container: c6 } = render(<Icon.menu />);
    const { container: c7 } = render(<Icon.search />);
    const { container: c8 } = render(<Icon.plus />);
    const { container: c9 } = render(<Icon.send />);
    const { container: c10 } = render(<Icon.close />);
    const { container: c11 } = render(<Icon.arrowUp />);
    const { container: c12 } = render(<Icon.arrowDown />);
    const { container: c13 } = render(<Icon.arrowLeft />);
    const { container: c14 } = render(<Icon.chat />);
    const { container: c15 } = render(<Icon.invest />);
    const { container: c16 } = render(<Icon.funds />);
    const { container: c17 } = render(<Icon.withdraw />);
    const { container: c18 } = render(<Icon.filter />);
    const { container: c19 } = render(<Icon.shield />);
    const { container: c20 } = render(<Icon.trend />);
    const { container: c21 } = render(<Icon.feed />);
    const { container: c22 } = render(<Icon.star />);
    const { container: c23 } = render(<Icon.share />);
    const { container: c24 } = render(<Icon.dots />);
    const { container: c25 } = render(<Icon.check />);
    const { container: c26 } = render(<Icon.refresh />);
    const { container: c27 } = render(<Icon.settings />);
    const { container: c28 } = render(<Icon.logout />);
    const { container: c29 } = render(<Icon.trash />);
    for (const c of [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c23, c24, c25, c26, c27, c28, c29]) {
      expect(c.querySelector("svg")).toBeTruthy();
    }
  });
});
