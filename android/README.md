# SNAP Stat for Android

The same SNAP Stat web app, in an Android app that can also:

- **Read new screenshots automatically.** Screenshots taken in MARVEL SNAP are picked up when you open the app (usage access tells it which app was open).
- **Track matches.** With your permission, it watches a small copy of the screen while MARVEL SNAP is open, reads the words on it on the phone (Google ML Kit), and saves the end-of-match screen for SNAP Stat's AI to log.

How the tracker spots the end of a match is set in [`tracker-rules.json`](../tracker-rules.json) on the website, so it can be tuned without a new app.

Built and published by [`.github/workflows/android.yml`](../.github/workflows/android.yml). Download: https://github.com/rhaddaddy/snap-stat/releases/latest/download/snap-stat.apk
