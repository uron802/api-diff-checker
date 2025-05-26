
# APIレスポンス比較ツール

このプロジェクトは、異なるバージョン（例: v1, v2）のAPIレスポンスを取得し、それらを比較するためのツールです。DockerとTypeScriptを使用して構築されています。

## 目次

- [セットアップ](#セットアップ)
- [設定ファイルの作成](#設定ファイルの作成)
- [使い方](#使い方)
  - [APIレスポンスの取得](#APIレスポンスの取得)
  - [APIレスポンスの比較](#APIレスポンスの比較)
  - [テストの実行](#テストの実行)

## セットアップ

1. リポジトリをクローンします。
2. DockerとDocker Composeがインストールされていることを確認してください。
3. Dockerコンテナをビルドして起動します。

```bash
docker-compose up --build
```

このコマンドにより、環境がセットアップされ、依存関係がインストールされます。

## 設定ファイルの作成

APIのエンドポイント、メソッド、ヘッダー、パラメータはJSONファイルで設定します。

### `config/sourceApis.json`（バージョン1のAPI用設定）

```json
{
  "version": "v1",
  "apis": [
    {
      "name": "API 1",
      "url": "http://api-mock-server:1080/v1/endpoint1",
      "method": "GET",
      "headers": {
        "Authorization": "Bearer token_v1",
        "Accept": "application/json"
      }
    },
    {
      "name": "API 2",
      "url": "http://api-mock-server:1080/v1/endpoint2",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer token_v1",
        "Content-Type": "application/json"
      },
      "params": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
```

### `config/targetApis.json`（バージョン2のAPI用設定）

```json
{
  "version": "v2",
  "apis": [
    {
      "name": "API 1",
      "url": "http://api-mock-server:1080/v2/endpoint1",
      "method": "GET",
      "headers": {
        "Authorization": "Bearer token_v2",
        "Accept": "application/json"
      }
    },
    {
      "name": "API 2",
      "url": "http://api-mock-server:1080/v2/endpoint2",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer token_v2",
        "Content-Type": "application/json"
      },
      "params": {
        "param1": "value1",
        "param2": "value2"
      }
    }
  ]
}
```

### レスポンスの保存ディレクトリ構造

APIレスポンスは `apiResponses` ディレクトリに保存されます。バージョンごとに（例: `v1`, `v2`）ディレクトリを分けることができます。

## 使い方

### コンテナに入る

Dockerコンテナが起動している状態で、以下のコマンドを使用して特定のコンテナに入ることができます。

```bash
docker exec -it api-comparator /bin/sh
```

### APIレスポンスの取得

以下のコマンドで、設定ファイルに基づいてAPIレスポンスを取得します。

```bash
ts-node fetchApiResponses.ts v1 ./config/sourceApis.json
```

このコマンドは、`config/sourceApis.json` に定義されたAPIを実行し、レスポンスを `apiResponses/v1/` ディレクトリに保存します。バージョン2のレスポンスを取得する場合は以下のように実行します。

```bash
ts-node fetchApiResponses.ts v2 ./config/targetApis.json
```

### APIレスポンスの比較

2つのバージョン（例: `v1` と `v2`）のレスポンスを比較するには、次のコマンドを実行します。

```bash
ts-node compareApiResponses.ts ./apiResponses/v1 ./apiResponses/v2
```

このコマンドは、`v1` と `v2` ディレクトリ内の同名ファイルを比較し、ファイルが片方にしかない場合や、レスポンス内容が異なる場合に報告します。

### 出力例

- **レスポンスが一致する場合**: `No differences found between v1/endpoint1.json and v2/endpoint1.json. The responses match.`
- **ファイルが欠けている場合**: `File missing in version 1: v1/endpoint2.json`
- **差異がある場合**: 
  ```json
  Differences found between v1/endpoint1.json and v2/endpoint1.json:
  [
    {
      "kind": "E",
      "path": ["message"],
      "lhs": "Response from v1",
      "rhs": "Response from v2"
    }
  ]
  ```

### テストの実行

プロジェクトのテストは、Jest を使用して実装されています。テストを実行するには、以下の方法を使用できます。

#### ローカル環境でテストを実行

ローカル環境に Node.js がインストールされている場合：

```bash
# 必要な依存関係をインストール
npm install

# テストを実行
npm test
```

#### Docker コンテナ内でテストを実行

Docker コンテナ内でテストを実行するには、次のコマンドを使用します：

```bash
# コンテナをビルドして起動
docker-compose up --build -d

# コンテナ内でテストを実行
docker-compose exec api-comparator npm test
```

または、コンテナに入って対話的にテストを実行することもできます：

```bash
# コンテナに入る
docker exec -it api-comparator /bin/sh

# コンテナ内でテストを実行
npm test
```

このツールを使用して、異なるバージョンのAPIレスポンスを簡単に比較できます。
