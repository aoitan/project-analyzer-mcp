#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。SourceKittenをインストールします。"
        
        # 1. Homebrew があれば使用 (ubuntu-latest には標準搭載)
        if command -v brew &> /dev/null; then
            echo "Homebrew を使用してインストールします。"
            HOMEBREW_NO_AUTO_UPDATE=1 brew install sourcekitten
            exit 0
        fi

        # 2. Homebrew がない場合は GitHub Release からバイナリ取得を試みる
        echo "Homebrew が見つからないため、GitHub Release から取得を試みます。"
        if ! command -v unzip &> /dev/null || ! command -v jq &> /dev/null; then
            echo "必要なツール (unzip, jq) をインストールします。"
            sudo apt-get update && sudo apt-get install -y unzip jq
        fi

        # GitHub APIを使用して最新のダウンロードURLを取得 (GITHUB_TOKENがあれば使用)
        CURL_OPTS=("-s")
        if [ -n "$GITHUB_TOKEN" ]; then
            CURL_OPTS+=("-H" "Authorization: token $GITHUB_TOKEN")
        fi

        # 最新のリリース情報を取得し、jqでダウンロードURLを抽出 (リポジトリ名は jpsim/SourceKitten)
        JSON_RESPONSE=$(curl "${CURL_OPTS[@]}" https://api.github.com/repos/jpsim/SourceKitten/releases/latest)
        DOWNLOAD_URL=$(echo "$JSON_RESPONSE" | jq -r '.assets[] | select(.name | contains("linux")) | .browser_download_url' | head -n 1)

        if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
            echo "SourceKitten の Linux 向けバイナリが GitHub Release に見つかりませんでした。"
            echo "ソースからビルドを開始します..."
            git clone --depth 1 https://github.com/jpsim/SourceKitten.git /tmp/SourceKitten
            cd /tmp/SourceKitten
            make install
            exit 0
        fi

        echo "バイナリをダウンロードします: $DOWNLOAD_URL"
        curl -L -o sourcekitten.zip "$DOWNLOAD_URL"
        mkdir -p sourcekitten_dist
        unzip -o sourcekitten.zip -d sourcekitten_dist
        sudo cp sourcekitten_dist/sourcekitten /usr/local/bin/
        sudo chmod +x /usr/local/bin/sourcekitten
        rm -rf sourcekitten.zip sourcekitten_dist
        ;;
    Darwin*)
        echo "macOS環境を検出しました。Homebrewを使用してSourceKittenをインストールします。"
        # Homebrewのインストール（もしインストールされていなければ）
        if ! command -v brew &> /dev/null
        then
            echo "Homebrewがインストールされていません。インストールします。"
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install sourcekitten
        ;;
    *)
        echo "サポートされていないOSです: $OS"
        exit 1
        ;;
esac

if command -v sourcekitten &> /dev/null
then
    echo "SourceKittenのインストールが完了しました。"
else
    echo "SourceKittenのインストールに失敗しました。"
    exit 1
fi
