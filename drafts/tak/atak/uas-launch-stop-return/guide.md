# Launch, Stop & Return Drone

META: slides

The Quick Flight Toolbar gets your drone in the air, brings it home, and stops it fast when something goes wrong. Here is the safe order to fly it.

## Find the Quick Flight Toolbar

![Quick Flight Toolbar with six numbered buttons: Set Altitude, Emergency Stop, Return to Home, Quick Task, Follow EUD/Recon, Mission Manager](./01-screenshot.png)

The toolbar sits at the top of the UAS menu after takeoff. From left: **Set Altitude**, **Emergency Stop**, **Return To Home**, **Quick Task**, **Follow EUD/Recon**, **Mission Manager**.

## Set your altitude

![Change Altitude Now dialog with a slider and AGL, HAL and MSL readouts](./02-screenshot.png)

Tap **Set Altitude**, drag the slider to the height you want, then tap **Set Altitude** to confirm. Read the height as **AGL** (above ground), **HAL** (above launch) or **MSL** (sea level).

## Take off

![Set Altitude dialog used to fly the drone up to the chosen height](./03-screenshot.png)

On the ground the Set Altitude button shows a green **GO** circle, called **Takeoff Now**. Tap it and the drone launches and climbs to the altitude you set.

## Emergency Stop

![Stop confirmation prompt warning that DJI products may not stop immediately](./04-screenshot.png)

Tap **Emergency Stop** to kill the current task, then **OK** on the prompt. It cancels Quick Tasks, Routes and altitude moves but not manual stick control. WARNING: some aircraft drift or backtrack before stopping.

## Return to Home

![Function table showing button 3 as Return To Home](./05-screenshot.png)

Tap **Return To Home** (button 3) for a short press to fly back to the launch point. Long-press it to open **Home Position Follow Options** so the drone tracks your moving position instead.

## Land and disarm in place

![Set Altitude dialog showing the Land-Now option for landing where the drone is](./06-screenshot.png)

In the Set Altitude dialog, **Land-Now** brings the drone straight down where it hovers. Landing and disarm vary by platform:

- DJI aircraft hover low and need the physical Ground Control Station (GCS) to land and disarm.
- Some MAVLink aircraft will backtrack before landing.

## Reposition with Quick Task

![Quick Task dialog with Cancel, Go Now and Orbit options for a selected coordinate](./07-screenshot.png)

Tap **Quick Task**, then tap a point on the map. Choose **Go Now** to fly there at current height, or **Orbit** to circle it. The **Selected Coordinate** field lets you type exact coordinates.
