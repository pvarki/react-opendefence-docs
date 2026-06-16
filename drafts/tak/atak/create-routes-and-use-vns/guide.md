# Create Routes and use VNS

META: slides

The VNS plug-in snaps your routes to real roads and gives you turn-by-turn audio and visual cues, plus on-the-fly re-routing if you go off track.

## Open the Routes tool

![ATAK toolbar with the plus button circled next to the Routes icon](./01-screenshot.png)

Open the **Routes** tool and select the **+** button to start a new route. With VNS loaded, the Route Planning dialog opens instead of the plain marker dialog.

## Enter addresses and pick a routing method

![New Route dialog with start, waypoint, destination fields, routing method and avoidance checkboxes](./02-screenshot.png)

Fill in the start, one or more **waypoint** and **destination** fields. Pick **Google Routing**, **Offline Routing** or **Private Routing Server**, tick any **Avoid Ferries / Highways / Tolls** boxes, then select **Create**.

## Set each address by hand

![Address field expanded showing GoTo, map select, clear and recent address icons](./03-screenshot.png)

Select the **Menu** button beside any address field to choose how to set it: enter via **GoTo**, **map select**, clear the field, or pick a **recent address**.

## Route around regions

![Route around region settings with geofence and region manager checkboxes and Open Route Around Region Manager button](./04-screenshot.png)

For offline routing, tick **Route around geofences?** to avoid all geofences, or tick **Route around regions in region manager?** and select **Open Route Around Region Manager**.

## Manage the avoidance shapes

![Manage route around regions list showing named shapes with delete icons](./05-screenshot.png)

Pick existing shapes to route around, add new ones with the **+** button, or remove a shape with its trash icon. Select **Done** when finished.

## Name, set checkpoints and cues

![Route details panel showing route name, GO, checkpoint rows, navigation cue and recalculate buttons](./06-screenshot.png)

In the route details you can rename the route, set the **Route Details** type (infil/exfil, primary/secondary), name checkpoints, set a **Navigation Cue** per checkpoint, and **VNS Recalculate** the whole route or a single segment. Select **GO** to start navigating.

## VNS-recalculate a manual route

![Manual route on the map converted to a road-snapped VNS route in the details panel](./07-screenshot.png)

To convert a hand-drawn route, open its details, set it as a driving route in the **Route Details Dropdown**, then select **VNS Recalculate** at the top right for the full route, or on a checkpoint row for just that segment.

## Re-route and Quick Nav safe points

![Add new Quick Nav point screen with named safe house entries on the map](./08-screenshot.png)

During navigation the **Re-routing** icon turns its border green when enabled, so ATAK recalculates if you go off route. Predefine safe points under **Additional Tools** > **VNS** > **Set Quick Nav Points**, name them with **Add new Quick Nav point**, then tap **Quick Nav** in navigation to route to one.

## Download offline routing data

![Offline Region Manager listing data sets with download and delete icons](./09-screenshot.png)

Offline routing and re-routing need a local data set. Go to **Additional Tools** > **VNS** > **Manage Offline Areas**, then select **Download** to pull a data set onto the device or **Delete** to remove one.
