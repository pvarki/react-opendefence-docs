#!/usr/bin/env bash
# Push all ATAK guide drafts to Outline as UNPUBLISHED drafts.
# 1) Review the guide.md files. 2) Run with DRY=1 to preview. 3) Run for real.
# 4) Publish each in Outline, then `pnpm sync`. Nested --chapter auto-creates
#    the toporgs/sub-orgs (Radio & Video, Supported Plugins > UAS Tool/Reports/GRG Builder).
set -e
FLAG=""; [ "$DRY" = "1" ] && FLAG="--dry-run"
[ "$PUBLISH" = "1" ] && FLAG="$FLAG --publish"

echo "==== USING ATAK FEATURES/Basic Features ===="
pnpm author:push drafts/tak/atak/aug-basic-view-tools-and-toolbar --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/aug-clear-content --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/aug-feeds-with-data-sync --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/aug-geochat --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/aug-point-dropper-quick-pic --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/aug-sending-a-marker --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/broadcast-emergency-alert --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/center-designator-coordinates --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/control-location-providers --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/customize-markers-and-icons --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/digital-pointer --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/drop-casevac-9-line --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/get-location-with-red-x --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/go-to-coordinates --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/manage-contacts --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/measure-range-and-bearing --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/navigate-a-route --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/off-screen-marker-indicators --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/range-rings-and-bullseye --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/report-issues-send-feedback --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/track-target-with-bloodhound --chapter "USING ATAK FEATURES/Basic Features" $FLAG
pnpm author:push drafts/tak/atak/use-3d-terrain-view --chapter "USING ATAK FEATURES/Basic Features" $FLAG

echo "==== USING ATAK FEATURES/Advanced Features ===="
pnpm author:push drafts/tak/atak/add-3d-models-to-map --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/aug-create-and-manage-feeds --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/create-routes-and-use-vns --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/downloading-maps-for-offline-use --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/draw-shapes-and-graphics --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/dynamic-range-and-bearing --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/elevation-and-viewshed-tools --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/georeference-an-image --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/how-to-manage-atak-tools-and-toolbars --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/import-files-and-remote-resources --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/manage-elevation-sources --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/overlay-manager-how-to-manage-the-views --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/resection-no-gps-location --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/scout-with-first-person-view --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/setup-encrypted-mesh-comms --chapter "USING ATAK FEATURES/Advanced Features" $FLAG
pnpm author:push drafts/tak/atak/track-movement-gps-tracks --chapter "USING ATAK FEATURES/Advanced Features" $FLAG

echo "==== USING ATAK FEATURES/Radio & Video ===="
pnpm author:push drafts/tak/atak/connect-prc152-rover-radio --chapter "USING ATAK FEATURES/Radio & Video" $FLAG
pnpm author:push drafts/tak/atak/play-and-capture-video --chapter "USING ATAK FEATURES/Radio & Video" $FLAG

echo "==== Supported Plugins/UAS Tool ===="
pnpm author:push drafts/tak/atak/uas-capture-broadcast-video --chapter "Supported Plugins/UAS Tool" $FLAG
pnpm author:push drafts/tak/atak/uas-launch-stop-return --chapter "Supported Plugins/UAS Tool" $FLAG
pnpm author:push drafts/tak/atak/uas-open-and-read-telemetry --chapter "Supported Plugins/UAS Tool" $FLAG
pnpm author:push drafts/tak/atak/uas-plan-missions --chapter "Supported Plugins/UAS Tool" $FLAG
pnpm author:push drafts/tak/atak/uas-send-to-location --chapter "Supported Plugins/UAS Tool" $FLAG
pnpm author:push drafts/tak/atak/uas-watch-control-camera --chapter "Supported Plugins/UAS Tool" $FLAG

echo "==== Supported Plugins/Reports ===="
pnpm author:push drafts/tak/atak/reports-create --chapter "Supported Plugins/Reports" $FLAG
pnpm author:push drafts/tak/atak/reports-custom-template --chapter "Supported Plugins/Reports" $FLAG
pnpm author:push drafts/tak/atak/reports-find-on-server --chapter "Supported Plugins/Reports" $FLAG
pnpm author:push drafts/tak/atak/reports-save-send-share --chapter "Supported Plugins/Reports" $FLAG
pnpm author:push drafts/tak/atak/reports-settings --chapter "Supported Plugins/Reports" $FLAG

echo "==== Supported Plugins/GRG Builder ===="
pnpm author:push drafts/tak/atak/grg-annotate-style --chapter "Supported Plugins/GRG Builder" $FLAG
pnpm author:push drafts/tak/atak/grg-create-grid --chapter "Supported Plugins/GRG Builder" $FLAG
pnpm author:push drafts/tak/atak/grg-export --chapter "Supported Plugins/GRG Builder" $FLAG

echo "==== USAGE BY ROLE/Fighter ===="
pnpm author:push drafts/tak/atak/aug-use-geochat-for-comms --chapter "USAGE BY ROLE/Fighter" $FLAG
