# Intermittent iPhone score display diagnostics

The missing-score issue is **not yet reproduced or fixed**. This diagnostic mode
collects evidence from the affected phone without needing Safari Web Inspector.
It is disabled by default and sends no diagnostic data to the sync server.

## Capture on the phone

1. Install/load a build containing this change.
2. Open the live-sync dialog, expand **Fehlersuche**, and select
   **Score-Diagnose einschalten**. This reloads the app once and keeps recording
   enabled on that device. This also works inside the installed PWA.
3. Use the app normally, including switching apps or locking the phone.
4. When a field is blank despite its score being included in the total, take a
   screenshot **before focusing the field or reloading**.
5. Tap **Diagnose erfassen**, then **Bericht kopieren**. Keep the report with the
   screenshot and identify the affected row and player column.
6. Close the report, focus the affected field, and capture a second report if
   that makes the score appear.
7. Disable recording through **Fehlersuche → Score-Diagnose ausschalten** when
   finished. This reloads the app and removes saved diagnostic history.

The URL parameters `scoreDiagnostics=1` and `scoreDiagnostics=0` also enable and
disable the recorder. Shared room links omit this option so recipients do not
automatically start recording.

Reports contain scores, timestamps, browser/build information, and connection
events. They omit player names and room IDs. Reports remain on the device until
the user copies them. If clipboard access fails, the report can be selected and
copied from the text area.

## Recorded evidence

- The last 120 events: incoming snapshots, store updates, React commits, input
  events, page visibility, focus, online/offline, and page show/hide events.
- The game state, expected input strings, React's committed input values, native
  DOM input values, and rendered totals for each event.
- A previous saved event buffer, when available. The recorder saves on capture,
  visibility becoming hidden, and pagehide. A process killed without delivering
  these events can still lose its latest history.

The capture button snapshots on pointerdown, before button focus or the dialog
can change the affected input. The background recorder does not rewrite input
values, request layout measurements, force repaints, or add timers. Manual capture
first saves the values and history, then measures field geometry, text styles,
inner scroll offsets, viewport zoom, and the elements hit-tested over each field.
Those measurements may repair stale layout; take the screenshot first. Hit
testing is evidence of overlap, not a readout of painted pixels. Instrumentation can
still influence timing; absence of the failure while recording does not prove a
fix.

`state-before-commit` events intentionally observe the store before React has
necessarily updated the DOM. A mismatch in that event is normal. Compare it with
the following `react-commit` and `manual-capture` events. The `react` property uses
React 18's private host-node props for diagnosis only; null can mean those props
were unavailable, rather than an empty score.

For the affected cell in the pre-focus manual capture:

| Observation | Boundary to investigate |
| --- | --- |
| Expected, React, and DOM values agree, screenshot is blank | Native input rendering/layout |
| Expected and React agree, DOM differs | Native input value update or editing state |
| Expected differs from committed React value | React rendering/subscription or running build |
| Expected value is itself wrong | Received state, reconciliation, or overwrite |

## Investigation so far

The checkout investigated was `d33cad1`. The locally recorded `origin/main` was
two commits ahead at `c68627b`, including the earlier sync-baseline fix. Timing
checks were also run against an isolated copy of that revision.

Using the actual app with a local WebSocket relay and independent browser
contexts, Linux WebKit passed:

- 100 remote updates checking totals, DOM values, and unfocused input pixels.
- 15 first remote values in previously offscreen lower fields, with four players
  and a different field focused.
- 20 queued-message bursts crossing local edits and five socket reconnects.
  The latter two checks passed on both revisions.

Chromium also passed ten freeze/resume cycles while receiving remote scores.
These are **not actual iOS suspension tests**. Playwright documents
[platform differences in WebKit](https://playwright.dev/docs/browsers#webkit).

The score inputs have no focus handler that reloads their data. Inputs and totals
derive from the same game state. These facts make the values captured *before*
focus essential to distinguish a state problem from a display problem.

There was also a measured styling inconsistency in the original checkout: the 24px input height,
16px vertical padding, and 2px border leave 6px of content height for a 16px line.
The `fix/score-input-styling` branch changes this geometry. Live `main` was checked
again before deployment and already includes that fix in `9737108` (PR #8).
The diagnostic deployment is based on that newer revision and preserves the fix.
The old geometry did not produce the reported blank-field symptom in the local
checks, so it has not been established as the cause.

The phone capture was checked in mobile WebKit for capture before blur,
incoming/commit/total evidence, saved history after reload, omission of room IDs,
and opt-out clearing history. Type checking, lint, and production build pass
(lint has two pre-existing React refresh warnings).

## Theories if the DOM value is correct but the number is invisible

These are ranked hypotheses, not a diagnosis. No additional broad reproduction
loops were run for them.

1. **Internal text clipping or displacement, especially on the old build.** The
   original input had only 6px of content height for a 16px line, plus centered
   text in a narrow field. WebKit uses internal text elements, special height
   adjustments, clipping, and internal scrolling for text inputs. Its
   [single-line renderer](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/rendering/RenderTextControlSingleLine.cpp)
   explicitly compensates when text exceeds the content box. Therefore the 6px
   calculation alone does not prove the text is clipped. A stale internal
   position or clip after layout changes remains a plausible mechanism. The
   newer 32px/zero-padding geometry substantially weakens this hypothesis if a
   captured failure demonstrably occurs on that build.
2. **Text repaint invalidation after scrolling or resuming.** A value-only update
   changes text without changing the outer input size. Focus also changes our
   `focus-visible:ring-*` styles, adding a box shadow, as well as invoking native
   editing/selection behavior. Thus focus can recover pixels without fetching a
   new score. The table's horizontal overflow, sticky row labels, nested sticky
   header cells, fixed app header, and asynchronous score updates make this a
   different case from a normal static form. Prediction: on a failing device,
   repainting the field without changing its value or position should reveal
   the number; an unchanged value alone does not discriminate this from clipping.
3. **CSS overlap that focus happens to remove.** Sticky labels and headers can
   cover content; focusing a field can change scroll position. Prediction: the
   failed field's geometry/hit-test stack identifies an overlapping element,
   and the post-focus viewport/scroll position changes enough to uncover it.
   Hit testing is only supporting evidence, since non-interactive paint can
   differ from hit testing.

There are other reports of this *class* of issue. WebKit fixed
[input clipping to the wrong box](https://github.com/WebKit/WebKit/commit/020a45f2e2aa1e6a0c867b4aaaaae9716327c2cc)
and [missing repaint after replacing text content](https://github.com/WebKit/WebKit/commit/359587ba5615020104960ff526a07ec217c3c80d).
Both are historical fixes, not evidence that those exact bugs exist on the
affected current iPhones.

Under the stated assumption, a network race can affect *which* value wins or
*when* rendering occurs, but it does not by itself explain a persistent mismatch
between correct DOM text and visible pixels. Likewise, neither React keys nor
another forced React render is an established fix for a native display problem.
