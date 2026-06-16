# Set up Element (mobile) #tag:ios #tag:android

META: slides

Set up Element on your phone and connect it to your unit's Matrix home server.
This guide uses Element Classic, but the steps are similar in almost any Matrix
application. Takes about five minutes.

## Welcome to Matrix

![Element Classic welcome screen on a phone](./01-welcome.webp)

This guide uses the Element Classic application, but you can use almost any
Matrix application — the steps are similar elsewhere too.

## Prerequisites

![Deploy App screen showing the Matrix home server address](./02-prerequisites.webp)

Copy the home server address (1). You can return to this guide at any time from
the bottom-right corner (2).

## Sign in to Element Classic

![Element Classic start screen with the Sign in option](./03-signin.webp)

Open Element and select **Sign in**.

## Edit the home server

![Sign-in screen with the Edit button next to the home server](./04-edit-server.webp)

Press **Edit** next to the home server address.

## Paste the server address

![Home server field with the pasted address and the Next button](./05-paste-server.webp)

Paste the server address you copied earlier, then press **Next**.

## Authenticate with Keycloak

![Continue with Keycloak prompt](./06-keycloak.webp)

Press **Continue with Keycloak**. Continue in your browser, which should prompt
for your mTLS certificate — authenticate with your mTLS certificate.

## Element Classic home view

![Element Classic home view with search and new-conversation buttons](./07-home.webp)

You are now logged in and can use Matrix. Search for users and rooms from the
top-right corner (1), and start a conversation from the bottom-right corner (2).
