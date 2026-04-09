# Camera Review Cropping Box - Latest Implementation Constraints

This document is a direct implementation spec for native iOS and Android teams. Treat it as a behavior and layout contract, not a moodboard.

## 1. Screen Model

- The outer frame is a real device screen, not a mockup container.
- The camera review area must adapt to the actual device screen and safe areas.
- Do not hardcode a single device canvas size.
- All geometry should be derived from the rendered screen bounds at runtime.
- Use the top-left of the camera viewport as the origin for box coordinates.

## 2. Visual Hierarchy

The camera area should read as:

1. Base content image
2. Outer dark overlay at `60%` black
3. Selected box cutout area with a lighter `20%` black internal overlay
4. Box border, brackets, label, and close control on top

The result should feel like a focused crop tool, not a flat full-screen dimmer.

## 3. Camera Content

- The current prototype uses a paper/test-sheet image as the camera content.
- This image is only a content placeholder for usability testing.
- Native implementations should support any camera image or live camera feed using the same overlay and box logic.

## 4. Box Defaults

- Initial box:
  - reference size: `320 x 120`
  - position: centered in the camera viewport
- New box:
  - reference size: `120 x 120`
  - position: centered in the camera viewport
- Minimum box size:
  - width: `72`
  - height: `72`

The reference sizes should scale with the actual viewport if needed. The intent is proportion, not a fixed device pixel canvas.

## 5. Interaction States

Each box has four states:
- idle
- active drag
- active resize
- snap correction

State rules:
- active drag and active resize both allow temporary overlap
- active state changes must be immediate
- release state should clear active styling

## 6. Box Styling

### Label

- The `Q1 / Q2 / ...` label badge is always blue.
- Label text is always white.
- The badge should remain visible against bright paper backgrounds.
- Do not switch the label back to a white badge in idle state.

### Close button

- Close button visual size: `20 x 20`
- Close hit target size: `32 x 32`
- The visible icon should sit slightly inset from the hit target.
- The close button background should be `60%` black.
- Close must have higher priority than drag and resize.
- Tapping close removes the box immediately.
- Close must never start a drag or resize gesture.

### Corner brackets

- Corner brackets are stroke-style, not solid blocks.
- Idle state: white brackets
- Active state: brand blue brackets (`#339bc9`)
- The top-right corner must be adjusted so it does not conflict with the close button.

## 7. Drag Constraint

### Drag hit area

- The drag hit area is the box interior, but not the entire visible box.
- For wide rectangles, the usable drag zone should include:
  - the central body
  - the upper middle strip
- The drag zone must avoid:
  - close button
  - resize corners
- The drag zone should remain usable even when the box is short or narrow.

### Drag behavior

- Drag is permissive while the pointer is down.
- Do not block live movement because of overlap.
- Keep the box inside the visible camera viewport during drag.
- Do not snap during drag.

## 8. Resize Constraint

### Resize hit area

- Resize uses four square corner hit zones.
- Hit zones may be larger than the visible corner brackets.
- The top-right resize corner must be specially reduced or offset to avoid conflict with the close button.

### Resize behavior

- Resize is permissive while the pointer is down.
- Do not block live movement because of overlap.
- Enforce the minimum size during resize.
- Do not snap during resize.

## 9. Release Resolution

When the user releases a dragged or resized box:

1. Check whether the box is touching or overlapping any other box.
2. If it does not touch or overlap, keep the current position.
3. If it touches or overlaps, keep the box on the same side and clamp it against the encountered boundary.
4. Keep the box size fixed during resolution.
5. Do not teleport the box to the other side of the obstruction.
6. If the box cannot be kept in a legal same-side position, revert to the pre-gesture position.

Rules:
- only the edited box is resolved
- other boxes remain unchanged
- release resolution must never leave the system in an invalid overlap state
- release resolution must preserve the user’s boundary expectation and must not cross to the opposite side of the obstacle

## 10. Nearest Placement Search

- Search is edge-based, not teleport-based.
- When a drag or resize would overlap another box, clamp the moving edge to the first contacted boundary.
- Preserve the original side of the drag or resize.
- Do not search the full viewport for a different empty slot on the opposite side.
- If multiple boundary contacts are possible, pick the one closest to the released position.
- Use deterministic tie-breaking:
  - smaller vertical movement first
  - then smaller horizontal movement
  - then top-to-bottom
  - then left-to-right

The result must be stable across repeated runs and must feel like the box was stopped by contact, not relocated.

## 11. Snap Motion

- Snap animation only happens when release resolution changes the box position.
- Duration: `120ms`
- Timing: `ease-out`
- Animate only the position correction.
- Do not animate every drag frame.
- Do not use spring motion here.

## 12. Bottom Hint Text

- The hint text must sit outside the camera area, inside the white action section.
- The gap between the camera area and the hint text should be `10px`.
- The hint should be a single line, no wrapping.
- Left and right page margins for the white section should be `20px`.
- Text color should be `rgba(13,14,18,0.6)`.

Example copy:

- `一個の枠内に1問を配置してください。`
- `枠の大きさを調整してください。`

The hint should feel secondary and should not compete with the camera content.

## 13. Full State Handling

If the user tries to add a new box and no legal placement exists:
- do not create the box
- show a centered toast message

Toast text:

```text
当前页面已满。
无法添加更多选框
```

Toast requirements:
- centered in the visible screen
- temporary
- does not block the rest of the app permanently

## 14. Edge Cases

- Very wide boxes must still feel draggable from the middle and top-middle area.
- Very small boxes must still keep usable drag and close targets.
- The top-right corner is the only corner that needs special conflict handling.
- A box must never remain trapped inside another box after release.
- The user should never need to shrink a box below the minimum size just to move it.

## 15. Native Implementation Guidance

- Keep geometry in a box model with `left`, `top`, `width`, `height`.
- Store the gesture start rect before live updates begin.
- Compute live drag and resize from the start rect plus pointer delta.
- Resolve collisions only on release.
- Derive layout from measured screen bounds, not a hardcoded device canvas.
- Keep hit slop generous while preserving small visual affordances.
- Preserve coordinate precision during collision math; round only for rendering.
- Use a composited mask or clip-path approach for the cutout so the inner box remains visually transparent enough to reveal the content image.

## 16. Acceptance Criteria

The implementation is correct when:
- the camera review area fits the real device screen
- the initial box is centered and visually larger
- new boxes are centered and smaller
- the outer overlay is `60%` black
- the box interior retains a lighter `20%` black emphasis while still revealing content
- label badges stay blue with white text in all states
- the close button stays visually small with a `32 x 32` hit target and `60%` black background
- drag and resize can overlap temporarily
- release never leaves invalid overlap and never crosses to the opposite side of the obstacle
- active feedback is visible and immediate
- the top-right corner does not conflict with close
- the hint text is outside the camera area with a `10px` gap
- full-state toast appears centered
- snap correction is short and deterministic
