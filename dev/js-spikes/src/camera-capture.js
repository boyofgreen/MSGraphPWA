
'use strict';

const EventEmitter = require('events');

export default class CameraCapture extends EventEmitter {
    constructor(dom, navigator) {
        super();

        // UI elements
        var videoElement = dom.querySelector('video');
        var videoSelect = dom.querySelector('select#videoSource');
        this.videoElement = videoElement;

        // capture elements
        this.captureCanvas = dom.ownerDocument.createElement('canvas');
        this.captureFrame = dom.querySelector('#captureFrame');
        dom.querySelector('#captureButton').addEventListener('click',
            () => this.capture());

        // retrieve list of devices
        navigator.mediaDevices
            .enumerateDevices().then(gotDevices)
            .then(getStream)                    // start with first cam
            .catch(handleError);

        videoSelect.onchange = getStream;       // change video input on ui select

        function gotDevices(deviceInfos) {
            deviceInfos
                .filter(d => d.kind === 'videoinput')
                .forEach(deviceInfo => {
                    var option = dom.ownerDocument.createElement('option');
                    option.value = deviceInfo.deviceId;
                    option.text = deviceInfo.label || 'Camera #' + (videoSelect.length + 1);
                    videoSelect.appendChild(option);
                });
        }

        function getStream() {
            var constraints = {
                video: {
                    deviceId: { exact: videoSelect.value }
                }
            };
            navigator.mediaDevices
                .getUserMedia(constraints)
                .then(stream => videoElement.srcObject = stream)
                .catch(handleError);
        }

        function handleError(error) {
            console.log('Error: ', error);
        }
    }

    capture() {
        var video = this.videoElement;
        var canvas = this.captureCanvas;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        // preview of captured data
        this.captureFrame.src = canvas.toDataURL('image/webp');
        this.captureFrame.classList.remove('off');

        // send image for analysis
        canvas.toBlob((blob) => {
            this.emit('capture', { blob });
        });
    }
}

