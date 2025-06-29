#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。Mintを使用してSourceKittenをインストールします。"
        # Mintのインストール（もしインストールされていなければ）
        if ! command -v mint &> /dev/null
        then
            echo "Mintがインストールされていません。インストールします。"
            git clone https://github.com/mint-lang/mint.git /tmp/mint
            cd /tmp/mint
            ./bootstrap.sh
            sudo cp .build/release/mint /usr/local/bin
            cd -
            rm -rf /tmp/mint
        fi
        mint install realm/sourcekitten
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
