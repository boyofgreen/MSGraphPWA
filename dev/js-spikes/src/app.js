'use strict';

import { Client as GraphClient } from '@microsoft/microsoft-graph-client';
import { UserAgentApplication } from 'msal';
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
momentDurationFormatSetup(moment);

import "blueimp-canvas-to-blob";

import CameraCapture from './camera-capture';

// Tenant config and permissions
const clientId = 'ea57b9d2-a768-4df7-98c5-4be627e44011';
const redirectUri = window.location.href;
const graphScopes = ['user.read', 'mail.read', 'calendars.readwrite'];
// Computer Vision
const computerVisionKey = 'fa9131ae2fc54e4ca558b663bc7433e3';
const computerVisionRegion = 'westus';

// Demo settings
const meetingDurationThreshold = 60;              // 1 hour
const maxEmailCountForFunSession = 0;

export default class App {
    constructor(dom, navigator) {
        console.log('App.cstr()');

        // Save Document DOM reference
        this.dom = dom;

        // Create ADAL client
        const tokenRecieved = (errorDesc, token, error, tokenType) => {
            if (!token) {
                alert(error + ":" + errorDesc);
            }
        };
        this.adalClient = new UserAgentApplication(clientId, null, tokenRecieved, { cacheLocation: 'localStorage' });

        if(window.Windows){
            this.dom.querySelector('#viewModeBar').className = '';
            this.refreshViewMode();
            this.dom.querySelector('#setLockScreenImageButton').className = '';
        }
            
        // Refresh login status
        this.refreshStatus();

        // Bind UI and refresh status
        this.dom.querySelector('#loginButton').addEventListener('click',
            () => this.login());

        this.dom.querySelector('#logoutButton').addEventListener('click',
            () => this.logout());

        this.dom.querySelector('#changeModeButton').addEventListener('click', 
            () => this.changeViewMode());
        
        this.dom.querySelector('#goat-picture-container').addEventListener('click', 
            () => this.changeViewMode());

        this.dom.querySelector('#setLockScreenImageButton').addEventListener('click', 
            () => this.changeWindowsLockScreenImage("goat-notification.png"));

        window.addEventListener("resize", 
        () => {
            var goatPicture = this.dom.querySelector('#goat-picture');
            goatPicture.width = window.innerWidth;
            goatPicture.height = window.innerHeight;
        });

        // register service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
                    (registration) => {
                        // Registration was successful
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                        this.serviceWorkerRegistration = registration;
                    }, (err) => {
                        // registration failed :(
                        console.log('ServiceWorker registration failed: ', err);
                    });
            });
        }

        // ask for notification access
        this.registerNotifications();

        // init camera capture
        this.cam = new CameraCapture(this.dom.querySelector('#camera-capture'), navigator);

        // on capture, submit to analize
        this.cam.addListener('capture', (e) => {
            var analysisLabel = dom.querySelector('#analysisStatus');
            analysisLabel.className = '';
            analysisLabel.innerText = 'Analyzing...';
            this.analizeWithComputerVision(e.blob)
                .then(result => {
                    console.log('analysis', result);
                    var hasGoat = result.tags.filter(t => t.name.includes('goat')).length > 0;
                    analysisLabel.className = hasGoat ? 'ok' : 'bad';
                    analysisLabel.innerText = hasGoat
                        ? 'It looks you are doing great! I see there is a goat!'
                        : 'It doesn\'t look good. I see no goat =(';
                })
                .catch(err => console.error('error analyzing pic', err));
        })
    }

    refreshStatus() {
        this.checkLoggedUser().then(user => {
            var loggedIn = !!user;
            this.dom.querySelector('#loginButton').className = loggedIn ? 'off' : '';
            this.dom.querySelector('#userBar').className = !loggedIn ? 'off' : '';

            if (loggedIn) {
                this.dom.querySelector('#userName').innerText = this.adalClient.getUser().name;
                this.retrieveData();
            }
        });
    }

    checkLoggedUser() {
        return this.adalClient.acquireTokenSilent(graphScopes)
            .then(token => this.adalClient.getUser())
            .catch(err => (null));
    }

    login() {
        var adalClient = this.adalClient;

        // TODO: Check if Web or Installed PWA
        adalClient.loginRedirect(graphScopes);
        /*
        adalClient.loginPopup(graphScopes).then((idToken) => {
            adalClient.acquireTokenSilent(graphScopes).then(
                (accessToken) => {
                    // set access token and refresh
                    this.refreshStatus();
                },
                (error) => {
                    adalClient.acquireTokenPopup(graphScopes).then(
                        // adalClient.acquireTokenRedirect(graphScopes).then(
                        (accessToken) => {
                            this.refreshStatus();
                        },
                        (error) => {
                            alert("Error acquiring the popup:\n" + error);
                        });
                })
        }, (error) => {
            alert("Error during login:\n" + error);
        });
        */
    }

    logout() {
        this.adalClient.logout();
    }

    changeViewMode() {
        if(window.Windows) {
            if (Windows.UI.ViewManagement.ApplicationView.getForCurrentView().viewMode == Windows.UI.ViewManagement.ApplicationViewMode.default){
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView().tryEnterViewModeAsync(Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay).then(
                    () => {
                        this.dom.querySelector('#main').className = "off";
                        this.dom.querySelector('#goat-picture-container').className = "";                        
                    });
            }
            else {
                Windows.UI.ViewManagement.ApplicationView.getForCurrentView().tryEnterViewModeAsync(Windows.UI.ViewManagement.ApplicationViewMode.default).then(
                    () => {
                        this.dom.querySelector('#main').className = "";
                        this.dom.querySelector('#goat-picture-container').className = "off";                        
                    });
            }
        }
    }

    refreshViewMode() {
        if(window.Windows){
            var viewMode = Windows.UI.ViewManagement.ApplicationView.getForCurrentView().viewMode == Windows.UI.ViewManagement.ApplicationViewMode.compactOverlay ? "compact overlay" : "default";
            this.dom.querySelector('#viewModeLabel').innerText = viewMode;
            console.log("The view mode is " + viewMode);
        }
    }

    retrieveData() {

        var client = GraphClient.init({
            defaultVersion: 'beta',
            authProvider: (done) => {
                // retrieve token from ADAL client
                this.adalClient.acquireTokenSilent(graphScopes)
                    .then(token => done(null, token))
                    .catch(err => {
                        console.log('adal.error', err)
                        done(err);
                    });
            }
        });

        var name = null
        var email = null;

        client
            .api('/me')
            .get()
            .then(res => {
                // Print Name
                name = res.displayName;
                email = res.mail;
                console.log(`Hello ${name}!`); // prints info about authenticated user
                console.log('...', res)
            })
            .then(() => this.retrieveCalendar(client))
            // .then(() => this.retrieveInsights(client))
            .then(() => this.checkEmails(client, email))
            .then(() => this.checkBigMeeting(client))
            .catch(err =>
                console.log('error!', err));
    }

    retrieveCalendar(client) {
        console.log(`Looking into your calendar for today...`); // prints info about authenticated user

        var today = moment().startOf('day');
        var userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Get Calendar for today
        return client
            .api('/me/calendarview')
            .header('Prefer', `outlook.timezone="${userTimezone}"`)
            .query('startdatetime=' + today.format())
            .query('enddatetime=' + today.add(1, 'days').format())
            .get()
            // Map to something easier to handle
            .then(res => res.value.map(o => ({
                subject: o.subject,
                duration: getDuration(o.start.dateTime, o.end.dateTime).format("h:mm"),
                start: o.start.dateTime,
                end: o.end.dateTime,
            })))
            // print
            .then(events => {
                console.log('Your calendar for today:')
                console.table(events);
            });
    }

    retrieveInsights(client) {
        return Promise.all([
            client
                .api('/me/insights/trending')
                .get()
                .then(res => res.value.map(insightDetail))
                .then(res => {
                    console.log('Insights.Trending:')
                    console.table(res);
                }),
            client
                .api('/me/insights/used')
                .get()
                .then(res => res.value.map(insightDetail))
                .then(res => {
                    console.log('Insights.Used:')
                    console.table(res);
                }),
            client
                .api('/me/insights/shared')
                .get()
                .then(res => res.value.map(insightDetail))
                .then(res => {
                    console.log('Insights.Shared:')
                    console.table(res);
                }),
        ]);
    }

    checkEmails(client, userEmail) {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = moment().startOf('day');
        // get messages sent by me today
        return client
            .api(`me/mailFolders('SentItems')/messages`)                    // Read from 'Sent Items' folder
            .header('Prefer', `outlook.timezone="${userTimezone}"`)             // Set Outlook TimeZone to current's user
            .filter(`sentDateTime ge ${today.format()}`)                    // Filter for today's emails only
            .select(['subject', 'sentDateTime'])
            .get()
            .then(res => res.value)
            .then(mails => {
                console.log('Mails you sent today:');
                console.table(mails);
                return mails;
            }).then(mails => {
                if (mails.length >= maxEmailCountForFunSession) {
                    this.displayGoatNotification('You are sending lots of emails!', 'Here, have a goat picture!');
                }
            });
    }

    checkBigMeeting(client) {

        var today = moment().startOf('day');
        var userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        return client
            // Get Calendar for today
            .api('/me/calendarview')
            .header('Prefer', `outlook.timezone="${userTimezone}"`)
            .query('startdatetime=' + today.format())
            .query('enddatetime=' + today.add(1, 'days').format())
            .get()
            // Map to something easier to handle
            .then(res => res.value.map(o => ({
                subject: o.subject,
                duration: getDuration(o.start.dateTime, o.end.dateTime).asMinutes(),
                start: o.start.dateTime,
                end: o.end.dateTime,
            })))
            .then(events => events.filter(m => m.duration > meetingDurationThreshold))
            .then(events => {

                if (!events.length) return;

                // big meeting(s) detected!
                // schedule a "relaxation" session after each meeting
                // TODO: Detect possible overlaps with other meetings

                // 1. read the attachment image
                asDataUri('images/goat-notification.png').then((base64img) => {
                    // 2. for each detected meeting, create a new event
                    var createPromises = events.map(e => {
                        var startOffset = 5;
                        var start = moment(new Date(e.end)).add(startOffset, 'minutes');          // start +5 minutes after previous meeting
                        var end = moment(new Date(e.end)).add(startOffset + 15, 'minutes');       // and last only 15 minutes
                        var relaxationEvent = {
                            subject: "Relaxation Event",
                            start: {
                                dateTime: start.format(),
                                timeZone: userTimezone
                            },
                            end: {
                                dateTime: end.format(),
                                timeZone: userTimezone
                            }
                        };

                        return client
                            .api('/me/events')
                            .post(relaxationEvent)
                            .then((res) => {
                                // 3. Update event with attachment
                                var id = res.id;
                                var attachment = {
                                    '@odata.type': '#microsoft.graph.fileAttachment',
                                    'name': 'goat.png',
                                    'contentBytes': base64img
                                };
                                return client
                                    .api(`/me/events/${id}/attachments`)
                                    .post(attachment)
                            })
                    });

                    return Promise.all(createPromises)
                        .then(() => createPromises.length)
                        .then((eventsCreatedCount) => {
                            console.log('done! events created: ' + eventsCreatedCount);
                            if (eventsCreatedCount) {
                                this.displaySimpleNotification('Check your Calendar', 'I\'ve created a goat yoga session for you!');
                            }
                        });
                });
            })
    }

    registerNotifications() {
        var $status = this.dom.getElementById('notificationStatus');

        if ('Notification' in window) {
            $status.innerText = Notification.permission;
        } else {
            $status.innerText = 'Not Supported!';
        }

        // request permission, will entry automatically if already granted
        Notification.requestPermission(function (result) {
            $status.innerText = result;
        });
    }

    displayGoatNotification(title, body) {
        if (!this.serviceWorkerRegistration) return;

        if(window.Windows) {

            this.showWindowsNotification(title, body, '/images/goat-notification.png');

            return;
        }

        this.serviceWorkerRegistration.showNotification(title, {
            body: body,
            image: '/images/goat-notification.png',
            icon: '/images/icons/icon-96x96.png',
            vibrate: 100
        });
    }

    showWindowsNotification(title, body, image) {
        if(window.Windows) {
            var notifications = Windows.UI.Notifications;

            // Get the toast notification manager for the current app.
            var notificationManager = notifications.ToastNotificationManager;
    
            var toastXml = new Windows.Data.Xml.Dom.XmlDocument();
            toastXml.loadXml('<toast><visual><binding template="ToastGeneric"><text hint-maxLines="1"></text><text></text><image placement="" src=""/></binding></visual></toast>')
            
            // You can use the methods from the XML document to specify the required elements for the toast.
            var images = toastXml.getElementsByTagName("image");

            var url = window.location.protocol + "//" + window.location.host + image;

            images[0].setAttribute("src", url);
            
            // Use hero image
            // images[0].setAttribute("placement", "hero");
    
            //Set notification text
            var textNodes = toastXml.getElementsByTagName("text");
            textNodes[0].innerText = title;
            textNodes[1].innerText = body;
    
            // Create a toast notification from the XML, then create a ToastNotifier object
            // to send the toast.
            var toast = new notifications.ToastNotification(toastXml);
    
            notificationManager.createToastNotifier().show(toast);
        }
    }

    displaySimpleNotification(title, body) {
        if (!this.serviceWorkerRegistration) return;
        this.serviceWorkerRegistration.showNotification(title, {
            body: body,
            icon: '/images/icons/icon-96x96.png'
        });
    }

    analizeWithComputerVision(blob) {
        const url = `https://${computerVisionRegion}.api.cognitive.microsoft.com/vision/v1.0/analyze?visualFeatures=Tags&language=en`;
        return fetch(url, {
            method: 'POST',
            mode: 'cors',
            body: blob,
            headers: {
                'Ocp-Apim-Subscription-Key': computerVisionKey,
                'content-type': 'application/octet-stream'
            }
        }).then(response => response.json());
    }

    changeWindowsLockScreenImage (image) {
        if(!window.Windows || !Windows.System.UserProfile.UserProfilePersonalizationSettings.isSupported()) {
            return;
        }

        var StorageFile = Windows.Storage.StorageFile;
        var uri = new Windows.Foundation.Uri("ms-appx:///images/" + image);
        StorageFile.getFileFromApplicationUriAsync(uri).then((file) => {
            console.log(file);
            var profileSettings = Windows.System.UserProfile.UserProfilePersonalizationSettings.current;
            profileSettings.trySetLockScreenImageAsync(file).then((result) => {
                console.log(result);
            }, (error) => console.error(error));
        }, (error) => console.error(error));
    }
}

const getDuration = (start, end) => {
    var time = new Date(end).getTime() - new Date(start).getTime();
    return moment.duration(time, "milliseconds");
}

const insightDetail = o => ({
    id: o.id,
    title: o.resourceVisualization.title,
    type: o.resourceVisualization.type,
    url: o.resourceReference.webUrl,
    preview: o.resourceVisualization.previewImageUrl
});

const emailDetail = o => ({
    id: o.id,
    subject: o.subject,
    importance: o.importance,
    to: o.toRecipients.map(e => [e.emailAddress.name, e.emailAddress.address]),
    from: [o.from.emailAddress.name, o.from.emailAddress.address],
    preview: o.bodyPreview
});

const asDataUri = (url) => {
    return new Promise((resolve, reject) => {
        var image = new Image();
        image.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
            canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size

            canvas.getContext('2d').drawImage(this, 0, 0);
            var base64 = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, '');
            resolve(base64);
        };

        image.src = url;
    });
};