# Elevation & Viewshed Tools

META: slides

Read the ground before you move: shade terrain by height or slope, check what a position can actually see, and lay down contour lines. Needs elevation data (DTED, SRTM or similar) loaded.

## Shade terrain by height

![ATAK map with a colour heatmap overlay and the Elevation Tool panel open on the Heatmap tab](./01-screenshot.png)

Tap the **Elevation Tools** icon, then on the **Heatmap** tab tick **Show**. Low ground shows blue, high ground red. Tune **Intensity**, **Saturation** and **Value** to taste.

## See the steep ground

![Map with a yellow-to-black slope overlay and the Terrain Slope panel showing an Intensity slider](./02-screenshot.png)

In the **Heatmap** box switch the selection to **Terrain Slope**. Gentle slopes show yellow, steep ground shows black. Drag **Intensity** to make it clearer.

## Drop a viewshed

![Map showing a green-and-red visibility circle around an eye marker with the Viewshed panel open](./03-screenshot.png)

On the **Viewshed** tab tap **Place Viewshed** (the eye), then tap a spot or marker. Green = visible from there, red = blocked. Zoom in if only the eye icon shows.

## Tune what it can see

![Viewshed panel showing Height Above Marker, Radius, Source, Seen and Unseen sliders](./04-screenshot.png)

Set **Height Above marker** and **Radius** for the position. Toggle **Source** between Terrain and Surface, and use the **Seen** / **Unseen** sliders to fade each area. **Remove Viewshed** clears it.

## Lay down contour lines

![Map with contour lines overlaid and the Contour panel showing Interval, Line Color and Generate](./05-screenshot.png)

On the **Contour** tab set the **Interval** and units (m or ft), then tap **Generate** once zoomed to a usable scale. Toggle **Lines** and **Minor Lines** with their **SHOW** buttons.
