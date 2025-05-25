import * as fs from 'fs';
import * as path from 'path';
import { diff } from 'deep-diff';

// レスポンスファイルを読み込む関数
export function loadApiResponse(filePath: string): any {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    return null;
  }
}

// 2つのファイルを比較し、差異を表示する関数
export function compareApiResponses(file1: string, file2: string) {
  const response1 = loadApiResponse(file1);
  const response2 = loadApiResponse(file2);

  if (!response1 && !response2) {
    console.log(`Both files are missing: ${file1} and ${file2}`);
    return;
  }

  if (!response1) {
    console.log(`File missing in version 1: ${file1}`);
    return;
  }

  if (!response2) {
    console.log(`File missing in version 2: ${file2}`);
    return;
  }

  const differences = diff(response1, response2);

  if (differences) {
    console.log(`Differences found between ${file1} and ${file2}:`);
    console.log(JSON.stringify(differences, null, 2));
  } else {
    console.log(`No differences found between ${file1} and ${file2}. The responses match.`);
  }
}

// 2つのディレクトリ内の同名ファイルを比較する関数
export function compareDirectories(dir1: string, dir2: string) {
  const files1 = fs.readdirSync(dir1);
  const files2 = fs.readdirSync(dir2);

  // どちらかのディレクトリにある全てのファイルを比較
  const allFiles = new Set([...files1, ...files2]);

  allFiles.forEach(file => {
    const file1 = path.join(dir1, file);
    const file2 = path.join(dir2, file);
    
    if (!fs.existsSync(file1)) {
      console.log(`File missing in version 1: ${file1}`);
    } else if (!fs.existsSync(file2)) {
      console.log(`File missing in version 2: ${file2}`);
    } else {
      compareApiResponses(file1, file2);
    }
  });
}

// メイン実行部分を関数化
export function main(args: string[]) {
  const version1Dir = args[0];  // 1つ目のディレクトリ (例: v1)
  const version2Dir = args[1];  // 2つ目のディレクトリ (例: v2)

  if (!version1Dir || !version2Dir) {
    console.error('Please provide two directories as arguments (e.g., v1 and v2)');
    return 1;
  }

  // ディレクトリが存在するか確認
  if (!fs.existsSync(version1Dir)) {
    console.error(`Directory not found: ${version1Dir}`);
    return 1;
  }
  if (!fs.existsSync(version2Dir)) {
    console.error(`Directory not found: ${version2Dir}`);
    return 1;
  }

  compareDirectories(version1Dir, version2Dir);
  return 0;
}

// 直接実行される場合のみ実行
if (require.main === module) {
  const exitCode = main(process.argv.slice(2));
  process.exit(exitCode);
}
