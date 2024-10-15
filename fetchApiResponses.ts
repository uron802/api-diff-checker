import axios, { Method } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// 設定ファイルを読み込む関数
function loadConfig(filePath: string): any {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    console.error(`Config file not found: ${filePath}`);
    process.exit(1);
  }
}

// APIリクエストを送信し、レスポンスを取得する関数
async function fetchApiResponse(url: string, method: Method, headers: any, params: any, version: string) {
  try {
    const response = await axios({
      url: url,
      method: method,
      headers: headers,
      data: method === 'POST' ? params : undefined  // POSTの場合はデータを送信
    });
    console.log(`Fetched response from ${version} ${url}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch data from ${version} ${url}:`, error);
    return null;
  }
}

// APIレスポンスをファイルに保存する関数
function saveApiResponseToFile(response: any, filePath: string) {
  fs.writeFileSync(filePath, JSON.stringify(response, null, 2), 'utf-8');
  console.log(`Response saved to ${filePath}`);
}

// 複数のAPIのレスポンスを取得し、ファイルに出力する関数
async function fetchAndSaveApiResponses(configFilePath: string, outputDir: string) {
  const config = loadConfig(configFilePath);

  for (const api of config.apis) {
    const response = await fetchApiResponse(api.url, api.method as Method, api.headers, api.params || {}, config.version);
    if (response) {
      // ファイル名はAPIのnameのみに
      const outputFilePath = path.join(outputDir, `${api.name}.json`);
      saveApiResponseToFile(response, outputFilePath);
    }
  }
}

// コマンドライン引数からバージョン情報（v1、v2など）とJSON設定ファイルパスを取得
const version = process.argv[2];
const configPath = process.argv[3];

if (!version || !configPath) {
  console.error('Usage: ts-node fetchApiResponses.ts <version> <configFilePath>');
  process.exit(1);
}

// 出力ディレクトリをバージョンに基づいて分ける
const outputDir = `./apiResponses/${version}`;

// 出力ディレクトリが存在しない場合は作成
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fetchAndSaveApiResponses(configPath, outputDir);
