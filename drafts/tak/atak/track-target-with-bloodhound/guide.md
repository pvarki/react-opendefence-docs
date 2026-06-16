# Track to a Target with Bloodhound

META: slides

Bloodhound locks a tracker onto a target and gives you live range, bearing and ETA as you close the gap.

## Open the Bloodhound tool

![Bloodhound setup dialog with From, To and Quick Select DP fields](./01-screenshot.png)

Tap the **Bloodhound** icon to open the tool. The **Setup Bloodhound** prompt appears so you can choose your tracker and your target.

## Set tracker and target

![Setup Bloodhound dialog showing the From and To reticle fields](./02-screenshot.png)

Tap **From Reticle** to pick the tracker (defaults to your own Self-Marker), then tap **To Reticle** to pick the target. The target can be another user, a DP, a CoT marker or any map point. Use **Quick Select DP** to grab a DP fast.

## Activate the track

![Map view with a green line drawn from the tracker to the target](./03-screenshot.png)

Tap **OK** to activate. A green line is drawn from you to the target. If you tapped empty map instead of an object, Bloodhound drops a waypoint there and tracks to it.

## Read range, bearing and ETA

![Green Bloodhound widget in the lower-left showing range, bearing and ETA](./04-screenshot.png)

The green widget in the lower-left shows live **Range**, **Bearing** and **ETA**. As either point moves and you navigate toward the target, these values update in real time.

## Watch the line colour

![Bloodhound green line that changes colour as ETA closes](./05-screenshot.png)

The line flashes by ETA: green flashes at 6 minutes out, then 3 minutes, turns flashing yellow at 1 minute, and flashes red until you reach the target. Adjust these in **Settings > Tool Preferences > Specific Tool Preferences > Bloodhound Preferences**.
