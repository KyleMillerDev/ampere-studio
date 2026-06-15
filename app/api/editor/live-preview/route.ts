import { NextResponse } from "next/server"

import { getEditorCache } from "@/lib/cms/editor-cache"
import { EDITOR_SESSION_TTL_MS } from "@/lib/cms/constants"
import { getEditorRepoConfig } from "@/lib/editor/config"
import { getSession, type EditorSession } from "@/lib/editor/session"
import { rewriteHtml } from "@/lib/editor/url-rewrite"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(req: Request) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
  }

  let session: EditorSession | null = getSession(sessionId)

  if (!session) {
    // No in-memory session (server restarted or session expired). Fall back to
    // env config + DynamoDB editor cache so the preview always loads.
    const repoConfig = getEditorRepoConfig()
    if (repoConfig.ok && repoConfig.config.siteUrl) {
      const { owner, name, ref, siteUrl, token } = repoConfig.config
      const cached = await getEditorCache({ owner, name, ref })
      const now = Date.now()
      session = {
        sessionId,
        repoPath: null,
        owner,
        name,
        ref,
        siteUrl,
        pat: token,
        blocks: cached?.blocks ?? [],
        files: cached?.files ?? [],
        extraction: { status: "pending" },
        createdAt: now,
        expiresAt: now + EDITOR_SESSION_TTL_MS,
      }
    }
  }

  if (!session) {
    return NextResponse.json(
      { error: "Editor session not found or expired." },
      { status: 404 }
    )
  }

  if (!session.siteUrl) {
    return NextResponse.redirect(
      new URL(`/content/preview/${encodeURIComponent(sessionId)}`, req.url)
    )
  }

  const pagePath = url.searchParams.get("path") ?? "/"
  const normalizedPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`
  const upstreamUrl = session.siteUrl.replace(/\/$/, "") + normalizedPath

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "Ampere-Studio-Live-Preview",
      Accept: "text/html,application/xhtml+xml",
    },
  })

  const contentType = upstream.headers.get("content-type") ?? ""
  if (!upstream.ok || !contentType.includes("text/html")) {
    return NextResponse.json(
      {
        error: `Could not load ${upstreamUrl}. Upstream returned ${upstream.status}.`,
      },
      { status: 502 }
    )
  }

  const html = await upstream.text()
  const rewritten = rewriteHtml(html, upstreamUrl, sessionId)
  const injected = injectEditor(rewritten, {
    blocks: session.blocks.map((block) => ({
      blockId: block.blockId,
      targetId: block.targetId,
      type: block.type,
      sourceType: block.sourceType,
    })),
  })

  return new NextResponse(injected, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "SAMEORIGIN",
    },
  })
}

/**
 * Pre-script injected at the top of `<head>`. It runs before any of the client
 * site's bundles and does three things that make the live preview behave
 * well inside a same-origin proxy:
 *
 *   1. Wraps `history.pushState` / `history.replaceState` so cross-origin URL
 *      values don't throw `SecurityError` and crash the client router.
 *   2. Patches `IntersectionObserver` so every observed element reports as
 *      intersecting. Scroll-triggered reveal animations (framer-motion
 *      `whileInView`, custom on-scroll hooks, lazy image loaders) fire as
 *      soon as their target is observed, so the editor can see all of the
 *      page content without having to scroll through the short iframe.
 *   3. Leaves a sentinel on `window` so nested iframes / re-entrant injects
 *      don't double-patch.
 */
const previewShims = `<script>(function(){
  if (window.__ampereShim) return;
  window.__ampereShim = true;

  // --- history SecurityError guard -----------------------------------
  var wrap = function(name){
    var orig = history[name];
    if (typeof orig !== 'function') return;
    history[name] = function(state, title, url){
      try { return orig.call(this, state, title, url); }
      catch (err) {
        if (err && err.name === 'SecurityError') {
          try { return orig.call(this, state, title, window.location.href); }
          catch (_) { return; }
        }
        throw err;
      }
    };
  };
  wrap('pushState');
  wrap('replaceState');

  // --- IntersectionObserver force-reveal ----------------------------
  // The iframe viewport is short, so elements below the fold would never
  // intersect and scroll-triggered animations would stay at their hidden
  // initial state. We always report isIntersecting=true so animations fire
  // on mount and stay applied even when the element scrolls out of view.
  var OrigIO = window.IntersectionObserver;
  if (OrigIO) {
    var patchEntries = function(entries){
      return entries.map(function(e){
        return {
          boundingClientRect: e.boundingClientRect,
          intersectionRatio: 1,
          intersectionRect: e.boundingClientRect,
          isIntersecting: true,
          rootBounds: e.rootBounds,
          target: e.target,
          time: e.time
        };
      });
    };
    var PatchedIO = function(callback, options){
      var cb = typeof callback === 'function' ? callback : function(){};
      var wrapped = function(entries, observer){
        try { return cb(patchEntries(entries), observer); }
        catch (_) { /* swallow observer exceptions to avoid breaking rAF */ }
      };
      var observer = new OrigIO(wrapped, options);
      var origObserve = observer.observe.bind(observer);
      observer.observe = function(target){
        origObserve(target);
        // Synthesize an initial intersecting entry so libraries that only
        // trigger once on first intersection fire immediately.
        setTimeout(function(){
          try {
            var rect = target.getBoundingClientRect();
            wrapped([{
              boundingClientRect: rect,
              intersectionRatio: 1,
              intersectionRect: rect,
              isIntersecting: true,
              rootBounds: null,
              target: target,
              time: performance.now ? performance.now() : Date.now()
            }], observer);
          } catch (_) {}
        }, 50);
      };
      return observer;
    };
    PatchedIO.prototype = OrigIO.prototype;
    window.IntersectionObserver = PatchedIO;
  }
})();</script>`

/**
 * CSS override injected after the page's own stylesheets so scroll-triggered
 * reveal animations never leave content invisible in the editor preview.
 *
 * Matches both the framer-motion-style inline initial state
 * (`style="opacity: 0"`) and Tailwind utility classes that hide elements
 * before their entry animation fires (`opacity-0`, `translate-*`, etc.).
 */
const forceRevealStyle = `<style data-ampere-force-reveal>
  [style*="opacity: 0"],
  [style*="opacity:0"],
  .opacity-0,
  [class*=" opacity-0 "],
  [class*=" motion-safe:opacity-0"],
  [data-motion-state="initial"] {
    opacity: 1 !important;
  }
  [style*="opacity: 0"],
  [style*="opacity:0"],
  [style*="translate3d"],
  [style*="translate(0"],
  [style*="translateX"],
  [style*="translateY"],
  [style*="translateZ"] {
    transform: none !important;
  }
  [style*="visibility: hidden"],
  [style*="visibility:hidden"] {
    visibility: visible !important;
  }
</style>`

function injectEditor(
  html: string,
  config: {
    blocks: Array<{
      blockId: string
      targetId: string
      type: string
      sourceType: string
    }>
  }
): string {
  const configScript = `<script>window.__ampereBlockMap=${JSON.stringify(
    config.blocks
  )};</script>`
  const injectScript = `<script src="/editor/inject.js" async></script>`
  const endScripts = `${configScript}${injectScript}`

  let next = html

  // Shims run right after <head> opens so they patch things before the
  // page's own bundles execute.
  const headOpen = /<head(\s[^>]*)?>/i
  if (headOpen.test(next)) {
    next = next.replace(headOpen, (match) => `${match}${previewShims}`)
  } else {
    next = `${previewShims}${next}`
  }

  // Force-reveal stylesheet goes at the end of <head> so it wins over any
  // later rules in the page's own stylesheets by source-order specificity.
  if (next.includes("</head>")) {
    next = next.replace("</head>", `${forceRevealStyle}</head>`)
  } else {
    next = `${forceRevealStyle}${next}`
  }

  // Editor scripts run at the very end so the DOM is in place first.
  if (next.includes("</body>")) {
    return next.replace("</body>", `${endScripts}</body>`)
  }
  if (next.includes("</head>")) {
    return next.replace("</head>", `${endScripts}</head>`)
  }
  return `${next}${endScripts}`
}
