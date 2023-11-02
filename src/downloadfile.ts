import fetch from 'node-fetch';
import { promises as fsPromises } from 'fs';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {createWriteStream} from "node:fs";
import http from "http";
export async function httpsdownload(url: string, filePath: string, useProxy: boolean = false, proxyUrl?: string) {
  try {
    const fetchOptions: any = {}; // 创建一个可选的 fetch 选项对象

    if (useProxy && proxyUrl) {
      fetchOptions.agent = new SocksProxyAgent(proxyUrl);
    }

    const fetchResponse = await fetch(url, fetchOptions);

    if (!fetchResponse.ok) {
      throw new Error(`ErrorStatus: ${fetchResponse.status}`);
    }

    const data = await fetchResponse.buffer();

    await fsPromises.writeFile(filePath, data);
    console.log(`Downloaded and saved to ${filePath}`);
  } catch (error) {
    console.error('Download error:', error.message);
  }
}

export function httpdownloadFile(url, outputPath) {
  const file = createWriteStream(outputPath);
  //http
  http.get(url, response => {
    if (response.statusCode !== 200) {
      console.error(`HTTP request failed with status code ${response.statusCode}`);
      return;
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        console.log(`File downloaded to: ${outputPath}`);
        url = null;
      });
    });
  });
}
