# //BUILD 2018 DEMO

## Pre-Requisites

- [VSCode](https://code.visualstudio.com) or [Visual Studio 2017](https://www.visualstudio.com/downloads/)
- [.NET Core 2.0](https://www.microsoft.com/net/download)
- [PWABuilder](https://www.pwabuilder.com/  ) CLI Tool (install it with `npm install -g pwabuilder`)

## Running the application locally in Visual Studio

1. Open the **demo-app.sln** Solution file in VS 2017
2. Press **F5** to run and debug the web application.

## Running the application locally in Visual Studio Code

1. From **VSCode**, use the **Open Folder** option from the **File Menu** and select the `webapp` folder.
2. Press **F5** to run and debug the web application.

    (The first time, VSCode will ask for an Environment, select **.NET Core** and press F5 again)

3. (Alternatively) From a terminal/cmd run `dotnet run` from the `webapp` folder.

## Sideloading the PWA in Windows 10

1. Open a terminal/cmd on the root repository folder.

2. Run `pwabuilder run windows10 package\BUILD2018DEMO` to sideload and start the PWA.
  (Make sure the application is running, otherwise the PWA won't work)


## Configuring Push Notifications

In order to recieve Push Notifications in the PWA when you send emails from Outlook, the application's backend needs to be available to the outside world, so Microsoft Graph can invoke the listening endpoint in the [NotificationsController](./webapp/Controllers/NotificationsController.cs#L28).

1. Create a Windows App registration in the [Windows Dev Center](https://developer.microsoft.com/en-us/store/register) (You'll need to register for a Windows Developer account).

2. Create a Notification Hub in Azure ([more information](https://azure.microsoft.com/en-us/services/notification-hubs/)).

3. Configure the Notification Hub with Windows Native Notifications (WNS), using the PackageSID + Secret from your Windows App registration in the Windows Dev Center ([more information](https://docs.microsoft.com/en-us/azure/notification-hubs/notification-hubs-windows-store-dotnet-get-started-wns-push-notification)).

4. Open [appsettings.json](./webapp/appsettings.json#L8) and update the `HubConnectionString` and `HubName` settings.

5. Either deploy the application or expose your http://localhost:5000/ using [ngrok](https://ngrok.com/) to the outside world.

6. When using ngrok, update the [ClientApp/services/config.ts](./webapp/ClientApp/services/config.ts#5) with the **https** url provided by ngrok. E.g.:

    ```export const BackendBaseUrl: string = 'https://XXXXX.ngrok.io'```

7. Update the [APPX Manifest](./package/BUILD2018DEMO/PWA/Store%20packages/windows10/manifest/appxmanifest.xml#L3) with the *Package Indentity Name* and *Publisher Identity*:

    From: `<Identity Name="INSERT-YOUR-PACKAGE-IDENTITY-NAME-HERE" Publisher="CN=INSERT-YOUR-PACKAGE-IDENTITY-PUBLISHER-HERE" Version="1.0.0.0" ProcessorArchitecture="neutral"/>`

    To: `<Identity Name="12836YourPublisherName.BUILD2018DEMO" Publisher="CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" Version="1.0.0.0" ProcessorArchitecture="neutral"/>`

8. Re-install your PWA using the steps above, **Installing the PWA in Windows 10**.

9. Open the PWA and login.

10. (Recommended) Install the [Microsoft Edge DevTools Preview](http://aka.ms/edgedevtools/preview) to debug and see errors in the Microsoft Graph API Subscription requests. Press F12 once the tools are installed and the PWA opened.
