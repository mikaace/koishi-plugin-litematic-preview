"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
import { Context, Schema } from 'koishi';
import {writeFile,access,mkdir,constants} from 'node:fs';
import {httpsdownload,httpdownloadFile} from "./downloadfile";
import express from 'express';
import path from 'path';
import {backupYamlFile} from "./backupKoishiConfig";
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
    key: Schema.string().default("key文件命名为private.key放进crt"),
    crt: Schema.string().default("pem文件命名为certificate.pem放进crt")}).collapse(),
});
export async function apply(ctx: Context,Config) {
  backupYamlFile("koishi.yml","koishi.backup.yml" );
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
      console.log("请提交SSL证书");
      //process http
      const app = express();
      const port = 80;
      app.use(express.static(path.join(__dirname, 'web')));
      app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
      });
    }
  }
  let root:string;
  if (exists("external")){
    root = "/external/litematic-preview/src/web/litematic";
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
    }
  function generateURL(usehttps,filename) {
    const address = usehttps?Config.Domain_name:(Config.address || 'localhost');
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
          httpsdownload(url,filePath,true,proxyUrl);
          const Filename = session.event._data.d.attachments?.[i]?.filename;
          const generated_url = generateURL(usehttps,Filename);
          const button =<button type="link" href={generated_url}>preview litematic</button>
          session.send(button);
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
  ctx.platform("kook").exclude(session => session.event.selfId === session.event.user.id).on('message', (session) => {
    let inputString = session.event.message.content;
    const urlRegex = /https?:\/\/\S+\.litematic/g;
    let matches = inputString.match(urlRegex);
    if (matches) {
      console.log("接收到投影文件")
      const filename = session.event.message.content.match(/file\s+title="([^"]+)"/)
      const filePath = `.${root}/${filename[1]}`;
      httpsdownload(matches[0],filePath,false);
      const generated_url = generateURL(usehttps,filename[1]);
      const button = <button class="primary" type="link" href={generated_url}>预览投影</button>
      session.send(button);
    }else{
      console.log("非投影kook");
    }
  });
  // TODO:a command to change resource_pack
  // TODO:delete .litematic on time
  // TODO:update resource
}

