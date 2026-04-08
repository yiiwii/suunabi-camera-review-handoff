# Camera Review Cropping Box - Implementation Constraints

This document is a direct implementation spec for native iOS and Android teams. Treat it as a behavior contract, not a visual moodboard.

## 1. Screen Model

- The outer frame is a real device screen, not a mockup shell.
- The camera review area must adapt to the actual device screen size and safe areas.
- Do not hardcode a single device canvas size.
- All geometry should be derived from the rendered screen bounds at runtime.
- Use the top-left of the camera viewport as the origin for box coordinates.

## 2. Box Defaults

- Initial box:
  - size: `320 x 120` reference proportion
  - position: centered in the camera viewport
- New box:
  - size: `120 x 120` reference proportion
  - position: centered in the camera viewport
- Minimum box size:
  - width: `72`
  - height: `72`

The reference sizes should scale with the actual viewport if needed. The intent is proportion, not a fixed device pixel canvas.

## 3. Interaction States

Each box has four states:
- idle
- active drag
- active resize
- snap correction

State rules:
- active drag and active resize both allow temporary overlap
- active state changes must be immediate
- release state should clear active styling

## 4. Drag Constraint

### Drag hit area

- The drag hit area is the box interior, but not the whole box.
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

## 5. Resize Constraint

### Resize hit area

- Resize uses four square corner hit zones.
- Hit zones may be larger than the visible corner brackets.
- The top-right resize corner must be specially reduced or offset to avoid conflict with the close button.

### Resize behavior

- Resize is permissive while the pointer is down.
- Do not block live movement because of overlap.
- Enforce the minimum size during resize.
- Do not snap during resize.

## 6. Close Constraint

- Close button visual size: `20 x 20`
- Close hit target size: `32 x 32`
- The visible icon should sit slightly inset from the hit target.
- Close must have higher priority than drag and resize.
- Tapping close removes the box immediately.
- Close must never start a drag or resize gesture.

## 7. Release Resolution

When the user releases a dragged or resized box:

1. Check whether the box overlaps any other box.
2. If it does not overlap, keep the current position.
3. If it overlaps, search for the nearest valid in-bounds position.
4. Keep the box size fixed during resolution.
5. If a valid position exists, snap there.
6. If no valid position exists, revert to the pre-gesture position.

Rules:
- only the edited box is resolved
- other boxes remain unchanged
- release resolution must never leave the system in an invalid overlap state

## 8. Nearest Placement Search

- Search inside the full current camera viewport.
- Evaluate all candidate positions that keep the box inside bounds.
- Reject candidates that overlap any existing box.
- Pick the candidate closest to the released position.
- Use deterministic tie-breaking:
  - smaller vertical movement first
  - then smaller horizontal movement
  - then top-to-bottom
  - then left-to-right

The result must be stable across repeated runs.

## 9. Snap Motion

- Snap animation only happens when release resolution changes the box position.
- Duration: `120ms`
- Timing: `ease-out`
- Animate only the position correction.
- Do not animate every drag frame.
- Do not use spring motion here.

## 10. Full State Handling

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

## 11. Visual Feedback

Active state:
- corner brackets become brand blue
- badge background becomes brand blue
- badge text becomes white

Idle state:
- corner brackets become white
- badge background becomes white
- badge text becomes brand blue

The active-state color change must be immediate on gesture start and revert on release.

## 12. Edge Cases

- Very wide boxes must still feel draggable from the middle and top-middle area.
- Very small boxes must still keep usable drag and close targets.
- The top-right corner is the only corner that needs special conflict handling.
- A box must never remain trapped inside another box after release.
- The user should never need to shrink a box below the minimum size just to move it.

## 13. Native Implementation Guidance

- Keep geometry in a box model with `left`, `top`, `width`, `height`.
- Store the gesture start rect before live updates begin.
- Compute live drag and resize from the start rect plus pointer delta.
- Resolve collisions only on release.
- Derive layout from measured screen bounds, not a hardcoded device canvas.
- Keep hit slop generous while preserving small visual affordances.
- Preserve coordinate precision during collision math; round only for rendering.

## 14. Acceptance Criteria

The implementation is correct when:
- the camera review area fits the real device screen
- the initial box is centered and visually larger
- new boxes are centered and smaller
- drag and resize can overlap temporarily
- release never leaves invalid overlap
- active feedback is visible and immediate
- close remains visually small but easy to tap
- the top-right corner does not conflict with close
- full-state toast appears centered
- snap correction is short and deterministic

