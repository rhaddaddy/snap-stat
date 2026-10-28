// SNAP Stat AI relay (a Cloudflare Worker).
// Perplexity, and possibly Grok, don't accept requests straight from a web app, so SNAP Stat sends them here
// and this passes them on. Your key comes from the app with each request and isn't stored here.
// It only works for the SNAP Stat site and only talks to these services (plus snap.fan, for your match link).

const ALLOWED_ORIGINS = ["https://rhaddaddy.github.io"]; // add your own domain here if you get one

const TARGETS = {
  "/perplexity": "https://api.perplexity.ai/chat/completions",
  "/xai": "https://api.x.ai/v1/chat/completions",
  "/xai-models": "https://api.x.ai/v1/models",
};

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!allowed) return new Response("This relay only works with the SNAP Stat app.", { status: 403, headers: cors });

    // Your personal snap.fan link, for automatic match import. Only snap.fan addresses are allowed.
    const here = new URL(request.url);
    if (here.pathname.replace(/\/+$/, "") === "/fetch") {
      let link; try { link = new URL(here.searchParams.get("url") || ""); } catch { return new Response("Bad link.", { status: 400, headers: cors }); }
      if (request.method !== "GET" || link.protocol !== "https:" || !/(^|\.)snap\.fan$/i.test(link.hostname)) return new Response("Only snap.fan links.", { status: 400, headers: cors });
      const got = await fetch(link.toString(), { headers: { "User-Agent": "SNAP-Stat-relay/1.0", Accept: "application/json,text/plain,*/*" } });
      return new Response(got.body, { status: got.status, headers: { ...cors, "content-type": got.headers.get("content-type") || "application/json" } });
    }
    const target = TARGETS[here.pathname.replace(/\/+$/, "")];
    if (!target) return new Response("Unknown service.", { status: 404, headers: cors });
    if (request.method !== "GET" && request.method !== "POST") return new Response("Not allowed.", { status: 405, headers: cors });

    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 8_000_000) return new Response("Too big.", { status: 413, headers: cors });

    const answer = await fetch(target, {
      method: request.method,
      headers: { "content-type": "application/json", authorization: request.headers.get("authorization") || "" },
      body,
    });
    return new Response(answer.body, {
      status: answer.status,
      headers: { ...cors, "content-type": answer.headers.get("content-type") || "application/json" },
    });
  },
};
