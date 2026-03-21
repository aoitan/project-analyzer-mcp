#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。GitHub ReleaseからSourceKittenバイナリをインストールします。"
        # unzipとjqが必要
        if ! command -v unzip &> /dev/null || ! command -v jq &> /dev/null; then
            echo "必要なツール (unzip, jq) をインストールします。"
            sudo apt-get update && sudo apt-get install -y unzip jq
        fi

        # GitHub APIを使用して最新のダウンロードURLを取得 (GITHUB_TOKENがあれば使用)
        CURL_OPTS=("-s")
        if [ -n "$GITHUB_TOKEN" ]; then
            echo "GITHUB_TOKEN が設定されています。認証を使用して API を呼び出します。"
            CURL_OPTS+=("-H" "Authorization: token $GITHUB_TOKEN")
        else
            echo "GITHUB_TOKEN が設定されていません。匿名で API を呼び出します。"
        fi

        # 最新のリリース情報を取得し、jqでダウンロードURLを抽出
        JSON_RESPONSE=$(curl "${CURL_OPTS[@]}" https://api.github.com/repos/realm/SourceKitten/releases/latest)
        DOWNLOAD_URL=$(echo "$JSON_RESPONSE" | jq -r '.assets[] | select(.name == "sourcekitten-linux-x86_64.zip") | .browser_download_url')

        if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" == "null" ]; then
            echo "SourceKitten のダウンロードURL取得に失敗しました。"
            echo "API 応答の先頭部分:"
            echo "$JSON_RESPONSE" | head -n 20
            exit 1
        fi

        echo "SourceKitten をダウンロードします..."
        curl -L -o sourcekitten.zip "$DOWNLOAD_URL"
        if [ $? -ne 0 ]; then
            echo "SourceKitten のダウンロードに失敗しました。"
            exit 1
        fi

        mkdir -p sourcekitten_dist
        unzip -o sourcekitten.zip -d sourcekitten_dist
        if [ ! -f sourcekitten_dist/sourcekitten ]; then
            echo "展開されたディレクトリに SourceKitten バイナリが見つかりません。"
            rm -rf sourcekitten.zip sourcekitten_dist
            exit 1
        fi

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
