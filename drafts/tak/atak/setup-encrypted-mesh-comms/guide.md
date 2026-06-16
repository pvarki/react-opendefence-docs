# Setup Encrypted Mesh Comms

META: slides

Lock down your mesh so only your team can see your position, chat, and data packages. Encrypted devices cannot talk to non-encrypted ones, and vice versa.

## Open mesh encryption settings

![ATAK Mesh Encryption panel with Load Key, Forget Key and Generate Key buttons](./01-screenshot.png)

Go to **Settings** > **Network Preferences** > **Network Connection Preferences** > **Configure AES-256 Mesh Encryption**.

## Generate a key

![Mesh Encryption panel highlighting the Generate Key button](./02-screenshot.png)

Tap **Generate Key** to create a new AES-256 encryption key for the team.

## Name and save the key

![File name dialog for the new key with an OK button](./03-screenshot.png)

Enter a file name (no extension) and select **OK**. The key is saved in the `atak/config/prefs` folder.

## Load and share the key

![Select Mesh Encryption Key to Import file browser](./04-screenshot.png)

On each device, tap **Load Key** and browse to the key file. Share the same key with everyone before enabling encryption, or preload it onto the devices.

## Revert to unencrypted

![Mesh Encryption panel highlighting the Forget Key button](./05-screenshot.png)

To drop encryption and go back to plain mesh traffic, tap **Forget Key**.
