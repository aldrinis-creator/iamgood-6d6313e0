## Goal
In the Ask Check-iN floating help chat (`src/components/ProductHelpChat.tsx`), keep the suggested-questions list visible at all times so the user can tap another question after the assistant has answered — not only on the empty state.

## Change
Single file: `src/components/ProductHelpChat.tsx`.

1. Remove the `messages.length === 0` gate around the SUGGESTIONS block so the chips render whenever the widget is open.
2. Move the suggestions out of the scrolling transcript into a compact horizontally-scrollable strip pinned just above the input (so it doesn't push chat history and stays reachable). Keep the intro paragraph only when `messages.length === 0`.
3. Style each suggestion as a small pill button (`rounded-full`, border, `whitespace-nowrap`, `text-xs`), inside a `flex gap-2 overflow-x-auto` row with subtle top border and background matching the composer area.
4. Disable the pills while `busy` so users can't queue multiple requests; clicking a pill still calls `send(s)`.
5. No changes to the edge function, KB, or message rendering.

## Out of scope
- No changes to suggestion contents (still the 4 in `SUGGESTIONS`).
- No persistence or personalization of suggestions.
- No changes to the voice assistant or other chat surfaces.
