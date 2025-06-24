import axios, { Method } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// 設定ファイルを読み込む関数
export function loadConfig(filePath: string): any {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    console.error(`Config file not found: ${filePath}`);
    return null;
  }
}

// APIリクエストを送信し、レスポンスを取得する関数
export async function fetchApiResponse(url: string, method: Method, headers: any, params: any, version: string) {
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
export function saveApiResponseToFile(response: any, filePath: string) {
  fs.writeFileSync(filePath, JSON.stringify(response, null, 2), 'utf-8');
  console.log(`Response saved to ${filePath}`);
}

// 複数のAPIのレスポンスを取得し、ファイルに出力する関数
export async function fetchAndSaveApiResponses(configFilePath: string, outputDir: string) {
  const config = loadConfig(configFilePath);

  if (!config) {
    return false;
  }

  const csvPath = path.join(outputDir, 'response_times.csv');
  fs.writeFileSync(csvPath, 'API名,レスポンス時間(ms)\n', 'utf-8');

  for (const api of config.apis) {
    const start = Date.now();
    const response = await fetchApiResponse(api.url, api.method as Method, api.headers, api.params || {}, config.version);
    const elapsed = Date.now() - start;
    fs.appendFileSync(csvPath, `${api.name},${elapsed}\n`);
    if (response) {
      // ファイル名はAPIのnameのみに
      const outputFilePath = path.join(outputDir, `${api.name}.json`);
      saveApiResponseToFile(response, outputFilePath);
    }
  }

  return true;
}

// メイン実行関数
export async function main(args: string[]) {
  const version = args[0];
  const configPath = args[1];

  if (!version || !configPath) {
    console.error('Usage: ts-node fetchApiResponses.ts <version> <configFilePath>');
    return 1;
  }

  // 出力ディレクトリをバージョンに基づいて分ける
  const outputDir = `./apiResponses/${version}`;

  // 出力ディレクトリが存在しない場合は作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const result = await fetchAndSaveApiResponses(configPath, outputDir);
  return result ? 0 : 1;
}

// 直接実行される場合のみ実行
if (require.main === module) {
  main(process.argv.slice(2))
    .then(exitCode => process.exit(exitCode))
    .catch(() => process.exit(1));
}
