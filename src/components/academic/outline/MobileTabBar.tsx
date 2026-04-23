"use client";

export type MobileTab = "victor" | "outline" | "paper";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  outlineHasUpdate: boolean;
  paperHasUpdate: boolean;
  showPaperTab: boolean;
}

export function MobileTabBar({
  activeTab,
  onTabChange,
  outlineHasUpdate,
  paperHasUpdate,
  showPaperTab,
}: MobileTabBarProps) {
  return (
    <div className="mobile-tab-bar">
      <button
        type="button"
        className={`mobile-tab ${activeTab === "victor" ? "mobile-tab--active" : ""}`}
        onClick={() => onTabChange("victor")}
        aria-label="Victor conversation"
      >
        Victor
      </button>
      <button
        type="button"
        className={`mobile-tab ${activeTab === "outline" ? "mobile-tab--active" : ""}`}
        onClick={() => onTabChange("outline")}
        aria-label="Outline panel"
      >
        Outline
        {outlineHasUpdate ? <span className="mobile-tab-badge" aria-label="Updated" /> : null}
      </button>
      {showPaperTab ? (
        <button
          type="button"
          className={`mobile-tab ${activeTab === "paper" ? "mobile-tab--active" : ""}`}
          onClick={() => onTabChange("paper")}
          aria-label="Generated paper"
        >
          Paper
          {paperHasUpdate ? <span className="mobile-tab-badge" aria-label="Updated" /> : null}
        </button>
      ) : null}
    </div>
  );
}
