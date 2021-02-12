import { promises as fs, createWriteStream, existsSync, mkdirSync } from "fs";
import path from "path";
import https from "https";

const FILE_PATH = path.join(__dirname, "..", "store.txt");
const DOWNLOAD_PATH = path.join(__dirname, "..", "downloads");

export async function storeFirmwareVersion(version: string) {
  await fs.writeFile(FILE_PATH, `FIRMWARE_VERSION=${version}`);
}

export async function downloadFile(url: string, destPath: string) {
  return new Promise<void>((resolve, reject) => {
    if (!existsSync(DOWNLOAD_PATH)) {
      mkdirSync(DOWNLOAD_PATH);
    }
    const file = createWriteStream(path.join(DOWNLOAD_PATH, destPath));
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode < 300) {
        // success
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", (err) => {
          fs.unlink(destPath);
          reject();
        });
      } else {
        reject(res.statusCode);
      }
    });
  });
}

export async function readFirmwareVersion() {
  const fileData = (await fs.readFile(FILE_PATH)).toString();
  return fileData.split("=")[1];
}
