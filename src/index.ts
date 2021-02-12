// import { IoTCClient, IOTC_CONNECT, IIoTCProperty, IIoTCCommand, IIoTCCommandResponse, IOTC_EVENTS, IOTC_CONNECTION_STATUS } from 'azure-iotcentral-device-client';

/** Comment out below line to use local version of the library */
import {
  downloadFile,
  readFirmwareVersion,
  storeFirmwareVersion,
} from "./storage";
import {
  IoTCClient,
  IOTC_CONNECT,
  IIoTCProperty,
  IIoTCCommand,
  IIoTCCommandResponse,
  IOTC_CONNECTION_STATUS,
  IOTC_EVENTS,
} from "azure-iotcentral-device-client";
import { cpuUsage } from "os-utils";
import path from "path";
import fs from "fs";
import { env } from "process";

const ROOT_PATH = process.cwd();

const getCpuUsagePercentage = async () => {
  return new Promise<number>((resolve) => {
    cpuUsage((value) => resolve(100 * value));
  });
};

let envData: {
  deviceId: string;
  scopeId: string;
  deviceKey?: string;
  groupKey?: string;
  modelId?: string;
} = { deviceId: "", scopeId: "", deviceKey: "" }; // use defaults here if not loaded from external file

try {
  envData = JSON.parse(
    fs.readFileSync(path.join(ROOT_PATH, "env.json")).toString()
  );
} catch (ex) {
  console.log(`No env data provided`);
}

let iotc: IoTCClient;
if (!envData.scopeId || !envData.deviceId) {
  console.log(`Credentials not passed to the script`);
  process.exit(1);
}
if (envData.groupKey) {
  iotc = new IoTCClient(
    envData.deviceId,
    envData.scopeId,
    IOTC_CONNECT.SYMM_KEY,
    envData.groupKey
  );
} else if (envData.deviceKey) {
  iotc = new IoTCClient(
    envData.deviceId,
    envData.scopeId,
    IOTC_CONNECT.DEVICE_KEY,
    envData.deviceKey
  );
} else {
  console.log(`Credentials not passed to the script`);
  process.exit(1);
}

if (envData.modelId) {
  iotc.setModelId(envData.modelId);
}

const onPropertyUpdated = async function (prop: IIoTCProperty) {
  console.log(`Received new value '${prop.value}' for property '${prop.name}'`);
  // prop has been successfully applied. report operation result
  await prop.ack();
};

const onCommandReceived = async function (cmd: IIoTCCommand) {
  console.log(
    `Received command '${cmd.name}'${
      cmd.requestPayload ? ` with payload ${cmd.requestPayload}` : "."
    }`
  );
  switch (cmd.name) {
    case "updateFirmware":
      const url = cmd.requestPayload.toString();
      // get firmware version
      const fmv = url.substring(url.lastIndexOf("/") + 1, url.length - 1); //remove trailing quotes
      // command has been successfully executed. reply now so message will arrive before restart
      await cmd.reply(IIoTCCommandResponse.SUCCESS, "Completed");
      await storeFirmwareVersion(fmv);
      await downloadFile(cmd.requestPayload, `${fmv}.bin`);
      console.log("Received new firmware. Restarting...");
      break;

    case "requestUpload":
      // do an upload
      const fileName = cmd.requestPayload.toString().replace(/\"/g, ""); // remove quotes
      console.log(`Uploading file ${fileName}...`);
      await cmd.reply(IIoTCCommandResponse.SUCCESS, "Request received");
      const res = await iotc.uploadFile(
        fileName,
        path.join(__dirname, "..", "uploads", fileName)
      );
      if (res.errorMessage) {
        console.log(`Error uploading file ${fileName}`);
        await iotc.sendTelemetry({
          fileUploadEvent: res.status,
        });
      } else {
        console.log(
          `File ${fileName} successfully uploaded to '${res.destinationPath}`
        );
        await iotc.sendTelemetry({
          fileUploadHistory: {
            fileName,
            fileUrl: res.destinationPath,
            uploadStatusCode: res.status,
          },
          fileUploadEvent: res.status,
        });
        await iotc.sendProperty({ lastUploadFile: res.destinationPath });
      }
      break;
  }
};

const onConnectionStatusChanged = async function (
  status: IOTC_CONNECTION_STATUS
) {
  console.log(`Device is ${IOTC_CONNECTION_STATUS[status]}`);
};

async function run() {
  const firmV = await readFirmwareVersion();
  console.log(`Roche device v${firmV}.`);
  console.log(`Connecting device ${envData.deviceId}...`);
  iotc.on(IOTC_EVENTS.Properties, onPropertyUpdated);
  iotc.on(IOTC_EVENTS.Commands, onCommandReceived);
  iotc.on(IOTC_EVENTS.ConnectionStatus, onConnectionStatusChanged);
  await iotc.connect();
  console.log(`Sending current firmware version '${firmV}'`);
  await iotc.sendProperty({ firmwareVersion: firmV });

  setInterval(async () => {
    const telemObj = { cpuUsage: await getCpuUsagePercentage() };
    console.log(`Sending telemetry ${JSON.stringify(telemObj)}`);
    await iotc.sendTelemetry(telemObj);
  }, 5000);
}

run();
