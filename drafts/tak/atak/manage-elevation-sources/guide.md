# Manage Elevation Sources

META: slides

Get accurate terrain heights for 3D and viewsheds by streaming and switching elevation data on your device.

## Choose how elevation data loads

![ATAK Elevation Data settings showing the Stream Elevation Data option](./01-screenshot.png)

Go to **Settings** > **Tool Preferences** > **Specific Tool Preferences** > **Elevation Overlays Preferences**. By default ATAK streams data (DTED, SRTM) as needed; uncheck **Stream Elevation Data** to force full downloads instead.

## Check coverage in Overlay Manager

![Map with yellow grids showing downloaded DTED coverage next to the layer list](./02-screenshot.png)

Open **Overlay Manager** and check the outline checkbox for the **DTED** layer. The yellow grids on the map show exactly where DTED0 data has already been downloaded.

## Switch and prioritize sources

![Elevation Manager listing DTED, TAK Terrain and TAK Bathy layers with reorder and visibility controls](./03-screenshot.png)

The **Elevation Manager** lists your sources (DTED, **TAK Terrain**, **TAK Bathy**). Reorder a layer with the arrow buttons to set priority (top wins), and use the visibility buttons to toggle each source on or off.
