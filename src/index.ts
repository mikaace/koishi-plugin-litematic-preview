"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
import { Context, Schema } from 'koishi';
import {writeFile,access,mkdir,constants} from 'node:fs';
import {downloadWithSocksProxy,httpdownloadFile} from "./downloadfile";
import express from 'express';
import path from 'path';
export const name = 'LitematicPreview';
export interface Config {
  socksProxyUrl: string
  Domain_name: string
  https: object
}
export const Config: Schema<Config> = Schema.object({
  socksProxyUrl: Schema.string().required().description("下载discord文件使用的代理 socks://address:port"),
  Domain_name: Schema.string().description("预览url中的域名,解析到公网ip,未配置https不会启用"),
  address: Schema.string().description("本机公网ip"),
  https: Schema.object({
    key: Schema.string().description("私钥.key"),
    crt: Schema.string().description("证书.pem")}).collapse(),
});
export async function apply(ctx: Context,Config) {
  let usehttps = null
  async function exists(Path: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      access(Path, constants.F_OK, (err) => {
        if (err) {
          resolve(false); // 文件不存在
        } else {
          resolve(true); // 文件存在
        }
      });
    });
  }
  access("crt", constants.F_OK, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        mkdir("crt", () => {
          console.log("已创建");
        })
      } else {
        return;
      }
    }
  });
  if (Config.https.crt&&Config.https.key){
    if (await exists("crt/private.key")&&await exists("crt/certificate.pem")) {
      usehttps = true;
      //process https
      const app = express();
      const port = 443;
      app.use(express.static(path.join(__dirname, 'web')));
      app.listen(port, () => {
        console.log(`Server is running on https://localhost:${port}`);
      });
    }else{
      writeFile('crt/private.key', Config.https.key, err => {
        if (err) {
          console.error('无法写入 private.key 文件', err);
          return;
        }
        console.log('私钥已成功写入 private.key 文件');
      });
      writeFile('crt/certificate.pem', Config.https.crt, err => {
        if (err) {
          console.error('无法写入 certificate.pem 文件', err);
          return;
        }
        console.log('私钥已成功写入 certificate.pem 文件');
      });
    }
  }else{
    console.log("请提交SSL证书");
    //process http
    const app = express();
    const port = 80;
    app.use(express.static(path.join(__dirname, 'web')));
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  }
  let root:string;
  if (exists("external")){
    root = "/external/litematic-preview/src/web/litematic/";
    access("/external/litematic-preview/src/web/litematic", constants.F_OK, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          mkdir("/external/litematic-preview/src/web/litematic", () => {
          })
        } else {
          return;
        }
      }
    });
    }else{
    root = "/node_modules/koishi-plugin-litematic-preview/src/web/litematic/";
    access("/node_modules/koishi-plugin-litematic-preview/src/web/litematic", constants.F_OK, (err) => {
      if (err) {
        if (err.code === 'ENOENT') {
          mkdir("/node_modules/koishi-plugin-litematic-preview/src/web/litematic", () => {
          })
        } else {
          return;
        }
      }
    });
  }

  function generateURL(usehttps,filename) {
    const address = Config.address || 'localhost';
    const protocol = usehttps ? 'https' : 'http';
    const fileParam = filename || '';

    return `${protocol}://${address}/?file=${fileParam}`;
  }

  ctx.platform("onebot").on('message', (session) => {
    console.log(session.event._data?.file);
    if (session.event._data?.file){
      console.log(session.event._data?.file?.name);
      const filename = session.event._data?.file?.name;
      if (/.litematic/.test(filename)){
        console.log(" 接收到投影文件");
        const url_ = `${session.event._data?.file?.url}`;
        const outputPath = `.${root}/${session.event._data?.file?.name}`;
        httpdownloadFile(url_, outputPath);
        const filename = session.event._data?.file?.name;
        const generated_url = generateURL(usehttps,filename);
        session.send(generated_url);
      }else{
        console.log(" 非投影qq");
        return;
      }
    }else{
      console.log(" 非文件qq");
      return;
    }
  })
  ctx.platform("discord").on('message', (session) => {
    console.log(`文件数 ${session.event._data.d.attachments?.length}`);
    if (session.event._data.d.attachments?.[0]) {
      for (let i = 0; i < session.event._data.d.attachments?.length; i++){
        if (/.litematic/.test(session.event._data.d.attachments?.[i]?.filename)){
          console.log(' '+session.event._data.d.attachments?.[i]?.filename);
          console.log(" 接收到投影文件");
          let url = `${session.event._data.d.attachments?.[i]?.url}`;
          const filePath = `.${root}/${session.event._data.d.attachments?.[i]?.filename}`;
          const proxyUrl = Config.socksProxyUrl;
          console.log(' '+ url);
          downloadWithSocksProxy(proxyUrl,url,filePath);
          const Filename = session.event._data.d.attachments?.[i]?.filename;
          const generated_url = generateURL(usehttps,Filename);
          session.send(generated_url);
        }else{
          console.log(" 非投影dc");
          return;
        }
      }
    } else {
      console.log(" 非文件dc");
      return;
    }
  });
}

