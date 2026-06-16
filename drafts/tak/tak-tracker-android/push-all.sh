#!/usr/bin/env bash
# Push all TAK Tracker - Android guide drafts to Outline as UNPUBLISHED drafts.
# 1) Review the guide.md files. 2) Run with DRY=1 to preview. 3) Run for real.
# 4) Publish each in Outline, then `pnpm sync`. Nested --chapter auto-creates the
#    "USING TAK TRACKER FEATURES" toporg and its Basic/Advanced Features chapters;
#    "START & CONNECT" already exists and is matched by title.
set -e
FLAG=""; [ "$DRY" = "1" ] && FLAG="--dry-run"
[ "$PUBLISH" = "1" ] && FLAG="$FLAG --publish"

echo "==== START & CONNECT ===="
pnpm author:push drafts/tak/tak-tracker-android/enroll-on-a-server --chapter "START & CONNECT" $FLAG

echo "==== USING TAK TRACKER FEATURES/Basic Features ===="
pnpm author:push drafts/tak/tak-tracker-android/read-status-and-location --chapter "USING TAK TRACKER FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/tak-tracker-android/chat-with-your-team --chapter "USING TAK TRACKER FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/tak-tracker-android/send-emergency-alert-beacon --chapter "USING TAK TRACKER FEATURES/Basic Features" $FLAG

echo "==== USING TAK TRACKER FEATURES/Advanced Features ===="
pnpm author:push drafts/tak/tak-tracker-android/options-and-settings --chapter "USING TAK TRACKER FEATURES/Advanced Features" $FLAG
