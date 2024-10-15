# ベースイメージとしてnodeを使用
FROM node:18-alpine

# 作業ディレクトリを作成
WORKDIR /usr/src/app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（ts-nodeとtypescriptもインストール）
RUN npm install

# ts-nodeとtypescriptをグローバルインストール
RUN npm install -g ts-node typescript

# プロジェクトファイル全体をコピー
COPY . .

# コンテナ内でシェルを保持
CMD ["/bin/sh"]
