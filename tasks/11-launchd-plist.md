# Task 12: launchd Plist

## Status: pending

## Description
Create the launchd agent plist for running the tool every 15 minutes.

## Steps
1. Create `launchd/com.user.reading-list-researcher.plist`
2. Configure: 900-second interval, RunAtLoad, stdout/stderr to /tmp, PATH with homebrew
3. Note: headless browser is configured via `~/.gemini/settings.json`, not env vars

## Files
- `launchd/com.user.reading-list-researcher.plist`
