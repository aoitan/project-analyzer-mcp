#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。GitHub ReleaseからSourceKittenバイナリをインストールします。"
        # unzipが必要
        if ! command -v unzip &> /dev/null; then
            echo "unzip がインストールされていません。インストールします。"
            sudo apt-get update && sudo apt-get install -y unzip
        fi

        # 最新のリリースを取得してバイナリをダウンロード (Ubuntu環境を想定)
        SOURCEKITTEN_VERSION=$(curl -s https://api.github.com/repos/realm/SourceKitten/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
        if [ -z "$SOURCEKITTEN_VERSION" ]; then
            echo "SourceKitten の最新バージョン取得に失敗しました。"
            exit 1
        fi

        echo "SourceKitten $SOURCEKITTEN_VERSION をダウンロードします..."
        curl -L -o sourcekitten.zip "https://github.com/realm/SourceKitten/releases/download/$SOURCEKITTEN_VERSION/sourcekitten-linux-x86_64.zip"
        if [ $? -ne 0 ]; then
            echo "SourceKitten のダウンロードに失敗しました。"
            exit 1
        fi

        mkdir -p sourcekitten_dist
        unzip -o sourcekitten.zip -d sourcekitten_dist
        sudo cp sourcekitten_dist/sourcekitten /usr/local/bin/
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
