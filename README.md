# Azure IoT Central file transfer device sample

## Prerequisites

- Node.js (12+)
- Azure IoT Central application

## Getting started

### Clone repository and build

```sh
git clone https://github.com/lucadruda/iotc-sample-file-transfer
cd iotc-sample-file
npm install # this will also build code
```

### Setup device credentials

Create a file named "_env.json_" in the root folder with this format:

```json
{
  "deviceId": "<Id of device>",
  "scopeId": "<Scope Id>",
  "groupKey": "<Application SAS Key>",
  "deviceKey": "<Device SAS Key>",
  "modelId": "<Device Template Id>"
}
```

Either use one of "_groupKey_" and "_deviceKey_". When "_deviceKey_" is specified, client will connect to the registered device in IoT Central application. If only "_gropKey_" is specified client will provision a new device with the id in "_deviceId_" and assign it to the device template identified by "_modelId_" above.

### Run sample

From root folder run:

```sh
npm run start
```

## File transfer

The repository contains an "_uploads_" folder that contains some sample images to upload from device.
File are named based on device capability model ([Upload.json](./Upload.json)).

When a firmware update request is received, the new firmware gets downloaded into the "_downloads_" folder and device restarts.
