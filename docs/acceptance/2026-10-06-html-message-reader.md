# Formatted email reader — 2026-10-06

Candidate: branch `expand-full-email-view-1` in worktree `t3-2c817935`, extending the
owner-tested full-text reader. The owner approved implementation and asked for
validation followed by a live smoke-test handoff. No built-in skills were used.

## Behavior

HTML email displays in an isolated white reading frame, preserving allowlisted
headings, colours, inline styles, tables and links. Tables fit the popup width;
frame height includes overflowing content. Plain text retains its existing
selectable rendering. HTTP(S) links without credentials open in a browser tab.
External HTTPS images are hidden until Load images is clicked for that message;
the choice lasts for the current popup only. Attachment/cid images and insecure
image URLs remain placeholders. Stylesheets and unsupported active content are
removed, so this is a readable formatted view rather than pixel-identical Gmail
or Outlook rendering.

The sanitizer rebuilds allowed elements and attributes in an inert document.
Event handlers, scripts, forms, embeds, external stylesheet/CSS URLs and arbitrary
navigation are removed. The iframe sandbox never permits scripts, forms or
popups. Same-origin access permits trusted parent sizing and link handling; its
CSP denies resources other than inline safe styles and opt-in HTTPS images.

## Verification

- Node 24.21.0: `npm run verify` passes syntax/extension-identity checks and all
  376 tests. The preceding `npm ci` succeeded with zero reported vulnerabilities.
- New tests cover formatting, malicious/encoded markup, CSS URL removal, strict
  link URLs, external-image default blocking and opt-in, image choice across
  rerenders, and staged read during iframe focus versus popup closure.
- Independent read-only review found frame height clipping for fixed-height
  overflowing content and premature read dismissal from iframe focus. Both
  were corrected and checked in the browser.
- T3 browser, actual popup HTML/CSS/JS with a synthetic Chrome boundary at
  420 × 600: heading colour and table content preserved; full final paragraph
  present; no horizontal overflow; no script or image nodes before image opt-in.
- Parent document resource observations showed no external-image requests during
  sanitization, including after opt-in. The image is added only inside the frame
  with `referrerpolicy=no-referrer`. The synthetic external URL is deliberately
  not a real image: actual image loading still requires live acceptance.
- Browser link handling dispatched the expected synthetic browser-tab request.
  Escape collapsed the card and reopening restored the frame. Focusing a link
  within the frame for longer than five seconds kept the card expanded and
  generated zero read writes. A fixed-height container holding long text grew
  the frame to include its overflowing content.

No live provider reads or mailbox writes were performed for this HTML candidate.
The earlier owner report “ok that works” establishes only the preceding full-text
reader. The owner subsequently reported that all live smoke tests passed; see the result below.

## Live Chrome smoke test

1. At `chrome://extensions`, reload the extension loaded from
   `/home/dave/.t3/worktrees/gmail-outlook-extension/t3-2c817935`.
   If Chrome loads another checkout, select this root with Load unpacked.
2. Refresh the popup and expand a long HTML email/newsletter. Compare with its
   mailbox view: headings, colours, tables and links should appear, and the
   final paragraph must be reachable. Stylesheet-only details may differ.
3. Confirm images are initially hidden. Click Load images: HTTPS external images
   should appear when their host permits loading. Collapse/reopen while the card
   remains available: the choice is retained. Close the popup and reopen a
   different unread email: its images should be hidden again.
4. Click a link. Confirm the expected URL opens in a browser tab. No links should
   navigate inside the email frame.
5. Select/copy text or focus a link inside the email for over five seconds. The
   card should remain while reading. Press Escape: the card collapses. Expanding
   it again should show the message. Closing the popup still commits staged read.
6. Repeat with a plain-text email, an Outlook HTML email and another Gmail
   account where available. Each body must match its own account/message.
7. For attachment/embedded images, expect a placeholder; use Open to view them
   in the mailbox. Existing read, Trash and recovery controls should remain usable.

Report pass/fail and the provider, with any missing formatting, clipped text,
image-loading or card-dismissal issue. Mail contents and credentials are not
needed in the report. Record the owner's result here for this candidate.


## Owner live smoke-test result — 2026-10-06

The owner reported “all smoke test passed” after the formatted-reader checklist
was supplied, and requested commit and PR creation. This records owner-reported
acceptance of the checklist for this candidate, including formatting/full content,
image opt-in, link behavior, selection/focus and collapse, applicable provider
checks and existing controls. No failures were reported. Individual provider,
account and message identities were not supplied; agent-run verification remains
limited to the automated suite and synthetic browser checks above.
