# Decisions: Pre-game Leaderboard Access

- Date: 2026-10-30
- Status: Confirmed

## D01. Entry points
- **Chosen**: Add a ranking button to both the title screen and stage selection screen.
- **Rationale**: Players can check company results before starting, regardless of whether they have entered stage selection.

## D02. Presentation and return behavior
- **Chosen**: Open a modal ranking window over the existing game scene. Closing it returns to the screen that opened it; on stage selection, preserve the selected stage.
- **Rationale**: The user chose a popup and wants the ranking available inside the game flow.

## D03. Ranking scope and source
- **Chosen**: Both entry points show the same overall top 10 across stages 1–5, reusing the existing leaderboard panel and current ranking order.
- **Rationale**: The user chose the integrated all-stage ranking. Existing order is highest stage, then score, then remaining time.

## D04. Environment-specific records
- **Chosen**: Reuse the current record source: company-wide server records in the hosted Entra app and browser-local records in the local demo.
- **Rationale**: The current app already selects the corresponding record source and loads company records before displaying the game.

## D05. Existing game-over ranking
- **Chosen**: Keep the existing game-over ranking display; add the two requested pre-game entry points only.
- **Rationale**: The request adds title and stage-selection access without removing the ranking players already see after a run.
