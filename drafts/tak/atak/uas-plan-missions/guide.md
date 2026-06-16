# Plan Drone Missions

META: slides

Plan a drone flight before launch so the aircraft flies your route, perimeter, or survey area on its own.

## Open Mission Manager

![ATAK Route panel with a multi-point route and waypoint list](./01-screenshot.png)

From the Home Screen, **swipe left** to reach **Stored Tasks**, then open **Mission Manager**. You can plan here with no UAS connected.

## Build a Route

![Route panel showing waypoints WP-1, WP-2, WP-3 and Save button](./02-screenshot.png)

Pick **Route** to drop a multi-point path for the aircraft to follow. Tap each point on the map, then tap **Save**. **Existing Route** converts an ATAK route the same way.

## Build a Perimeter

![Route panel with a perimeter shape that loops back to its start](./03-screenshot.png)

Pick **Perimeter** to fly a closed shape. The aircraft follows the outline and returns to the first waypoint. Tap **Save** when the shape is set.

## Build a Survey

![Build Survey Route panel with a blue lawnmower grid over an area](./04-screenshot.png)

Pick **Survey** to cover a whole area with a back-and-forth grid. Set the **Task Name** and **Task Altitude (AGL)**, then tap **Create Task**.

## Create a MAVLink mission

![MAVLink Mission pane with MISSION, FENCE and RALLY tabs](./05-screenshot.png)

For step-by-step tasking, open the Add Task Menu (the **+**) and select **Add**. Use the **MISSION** tab for the flight, **FENCE** for geofences, and **RALLY** for rally points.

## Add takeoff and waypoints

![Mission pane showing a loaded mission with item count and Pencil icon](./06-screenshot.png)

Tap the **Pencil Icon** to add mission items to the map. Add **Takeoff** to arm and climb to an altitude, then add **Waypoint** points for the aircraft to fly to (speed, altitude, yaw, gimbal).

## Set ROI on a target

![Mission pane with the green-ringed item showing the active mission](./07-screenshot.png)

Add **ROI (Region of Interest)** to lock the gimbal onto a point. Add **Cancel ROI** before the mission ends, or the aircraft keeps tracking the target in manual flight.

## Finish with Land or Return to Launch

![Mission list with onboard, received and library missions](./08-screenshot.png)

End the mission with **Land** to set a landing waypoint, or **Return to Launch** to fly back to takeoff and land. Tap **Save** to store the mission, then run it from the **Onboard** list.
