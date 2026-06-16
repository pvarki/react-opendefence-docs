# Import Files & Remote Resources

META: slides

Pull maps, imagery and data packages into ATAK from your device, or hook up a network link that refreshes itself.

## Open Import and pick a source

![Select Import Type panel showing Local SD, Gallery, KML Link, HTTP URL and Choose App buttons](./01-screenshot.png)

Tap the **Import** icon. In the **Select Import Type** window choose **Local SD**, **Gallery**, **KML Link**, **HTTP URL** or **Choose App**.

## Import from device storage

![Select Desired Import Method prompt for a DTED file with DTED Manager and Imagery options](./02-screenshot.png)

Pick **Local SD**, browse to the file and tap **OK**. ATAK takes config, data packages, elevation data, imagery and overlays; some types prompt you to choose the handler.

## Choose an import strategy

![Suggested Import Strategy panel with Copy, Move and Use in Place options](./03-screenshot.png)

Tell ATAK how to handle the file. **Copy** duplicates it into the ATAK directory, **Move** relocates it, and **Use in Place** leaves it where it is.

## Add a network link resource

![Add KML Network Link Resource panel with Name, URL and Auto Refresh fields](./04-screenshot.png)

Pick **KML Link** or **HTTP URL**, enter a **Name** and the **URL**, set a refresh interval, then tap **Add**. The link can auto-refresh and clear local content on shutdown.

## Download and track remote resources

![Remote Resources list in Overlay Manager with green and red status indicators](./05-screenshot.png)

Added links appear under **Remote Resources** in Overlay Manager. A red dot means not yet downloaded; tap **Download** to fetch it. Green means it is in and up to date.
