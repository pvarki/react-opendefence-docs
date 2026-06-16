# Create a VNS route

META: slides

The Vehicle Navigation System (VNS) plugin adds road-snapped vehicle routing and
turn-by-turn voice cues to WinTAK's route planning. Once installed, it lives
behind the **Routes** icon.

## Open the Routes tool

![WinTAK Routes panel with the New Route (+) button](./01-screenshot.png)

Open the **Routes** tool on the WinTAK toolbar and select **+** to start a new
route. With VNS active, the New Route planning dialog opens instead of the manual
placement dialog.

## Enter addresses and routing method

![New Route dialog with address fields and Google Route Planner](./02-screenshot.png)

Type the **Start Address** and **Destination Address**, or use the reticles to
drop them on the map. Set **Routing Method** to **Google Route Planner** and tick
any avoidances (**Avoid Ferries / Highways / Tolls**), then select **Create** —
the route snaps to roads and draws on the map. To place a manual point-to-point
route with WinTAK's core tool instead, select **Manual**.

## Work with the route details

![Route Details pane showing checkpoints and per-checkpoint actions](./03-screenshot.png)

The **Route Details** pane opens after creation. From here you can rename the
route, pick its color, set the route type (primary/secondary, infil/exfil), add
remarks, name checkpoints, attach files, set a navigation cue per checkpoint,
view the elevation profile, **Send** the route to other devices, or press **GO**
to begin navigation.

## Set the Google Directions API key

![VNS Preferences with the Google Directions API Key field](./04-screenshot.png)

VNS uses the Google routing engine. Set your key under **Settings > Tool
Preferences > VNS Preferences** — organizations license their own Google
Directions API key.
