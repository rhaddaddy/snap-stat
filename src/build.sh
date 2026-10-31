#!/bin/bash
# Builds both versions of SNAP Stat from the same source files.
set -e
cd "$(dirname "$0")"
CORE="b_data.js b2_cards.js b3_ext.js c_core.js c2_catalog.js c3_extras.js c4_clock.js d_home_play.js e_collection.js f_decks.js g_social.js h_more.js j_import.js i_actions.js l_features.js n_more.js p_more.js q_auto.js r_native.js t_progress.js u_look.js w_wish.js x_nav.js y_data.js y2_more.js y3_ideas.js y4_more.js y5_emotes.js y6_auto.js y7_more.js y8_plans.js y9_turns.js y10_update.js y11_collect.js y12_looks.js y13_sweep.js y14_pc.js y15_stats.js y16_decks.js y17_collection.js y18_home.js y19_social.js y20_knowledge.js y21_tracker.js y22_live.js y23_history.js y24_swipe.js"
cat $CORE z_boot.js > app.js && node --check app.js
{ cat a_head.html; echo '<script>'; cat app.js; echo '</script>'; } > /home/claude/cube-ledger.html
cat $CORE k_firebase.js z_boot.js > app_fb.js && node --check app_fb.js
OUT=/home/claude/snap-stat-firebase; mkdir -p $OUT
python3 - <<'PY'
src=open('a_head.html').read()
i=src.index('<div class="wrap">')
head=src[:i].replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
body=src[i:]
app=open('app_fb.js').read()
import hashlib, json
build=hashlib.sha1((src+app).encode()).hexdigest()[:12]
open('/home/claude/snap-stat-firebase/version.json','w').write(json.dumps({'build': build})+'\n')
html=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0A0918">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="SNAP Stat">
<meta name="description" content="Unofficial fan-made MARVEL SNAP companion: match tracker, collection, decks, seasons and alliance.">
<link rel="manifest" href="manifest.webmanifest?v=2">
<link rel="apple-touch-icon" href="apple-touch-icon-v2.png">
{head}<style>html, body {{ margin: 0; }} :root {{ padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }} img {{ max-width: 100%; }}</style>
<script>window.SNAPSTAT_BUILD = "{build}"; window.SNAPSTAT_STANDALONE = true; window.snapFirebaseReady = new Promise(function (r) {{ window.__resolveFirebase = r; }});</script>
<script src="firebase-config.js"></script>
<script type="module" src="firebase-init.js"></script>
</head>
<body>
{body}
<script>
{app}
</script>
</body>
</html>
'''
open('/home/claude/snap-stat-firebase/index.html','w').write(html)
PY
cp ../fb/firebase-init.js $OUT/firebase-init.js
echo built
