# Control Location Providers

META: slides

Pick where ATAK gets your position from — internal GPS, Wi-Fi/cell, or an external receiver — so your dot on the map stays accurate.

## Choose your position source

![Location Input Manager listing all available position providers with Enabled checkboxes](./01-screenshot.png)

Open the **Location Input Manager** to see every provider with a short description. Tick the **Enabled** checkbox to turn a source on or off:

- **Internal GNSS/GPS Receiver** — the device's own GPS chip.
- **WiFi/Cell Signal Derived (NETD)** — position from cell towers and Wi-Fi.
- **Serial Monitor Input** — an external/serial GPS receiver.

## Set the priority order

![Provider list showing the grey drag bars on the left used to reorder priority](./02-screenshot.png)

Drag the grey bar on the left of a provider up or down to reorder it. ATAK uses the first provider in the list and falls back to the next one if it can't get a fix.
