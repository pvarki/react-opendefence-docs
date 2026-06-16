# Set up Element (desktop) #tag:windows #tag:macos #tag:linux

META: slides

Set up the Element client on your computer and connect it to your unit's Matrix
home server. This guide uses Element, but the steps are similar in any Matrix
application. Takes about five minutes.

## Welcome to Matrix

![Element welcome screen on the desktop](./01-welcome.webp)

This guide uses the Element application, but you can use any Matrix application —
the steps are similar elsewhere too.

## Prerequisites

![Deploy App screen showing the Matrix home server address](./02-prerequisites.webp)

Copy the home server address (1). You can return to this guide at any time from
the bottom-right corner (2).

## Log in to Element

![Element start screen with the Log in option](./03-login.webp)

Open Element and select **Log in**.

## Edit the home server

![Element login screen with the Edit button next to the home server](./04-edit-server.webp)

Press **Edit** next to the home server address.

## Paste the server address

![Home server field with the pasted address and the Continue button](./05-paste-server.webp)

Paste the server address you copied earlier, then press **Continue**.

## Authenticate with Keycloak

![Continue with Keycloak prompt](./06-keycloak.webp)

Press **Continue with Keycloak**. Continue in your browser, which should prompt
for your mTLS certificate a few times — authenticate with your mTLS certificate.

## Element home view

![Element home view with the Spaces sidebar and direct messages panel](./07-home.webp)

You are now logged in and can use Matrix. View or create Spaces from the sidebar
(1), and see or start direct messages from the left panel (2).
