# SNAP Stat AI relay

Perplexity doesn't accept requests straight from web apps like SNAP Stat, and Grok may not either. This small relay passes those requests along for you. It runs for free on Cloudflare (the free plan allows 100,000 requests a day).

Your API keys stay in the app on your phone. They're sent through the relay with each request and are never stored there. The relay only works for the SNAP Stat site and only talks to Perplexity and Grok.

## Set it up (about 5 minutes, works on a phone)

1. Go to **dash.cloudflare.com** and sign up for a free account (or sign in).
2. Open **Workers & Pages** (under **Compute** in the menu), then tap **Create** and choose to start with **Hello World**.
3. Name it `snapstat-relay` and tap **Deploy**.
4. Tap **Edit code**. Delete everything in the editor.
5. Open [worker.js](worker.js) in this folder, tap **Raw**, copy all of it, and paste it into the editor.
6. Tap **Deploy** again.
7. Copy the worker's address. It looks like `https://snapstat-relay.yourname.workers.dev`.
8. In SNAP Stat, go to **More › Profile & account › AI features**, paste the address under **Relay for Perplexity and Grok**, and tap **Save**.
9. Paste your Perplexity key in its row, tap **Save**, then **Test it**.

Cloudflare's menus change now and then. If a button has a different name, look for the option to create a Worker from the "Hello World" template.

## If you get your own domain later

Add it to `ALLOWED_ORIGINS` at the top of the code (for example `"https://snapstat.app"`) and deploy again.
