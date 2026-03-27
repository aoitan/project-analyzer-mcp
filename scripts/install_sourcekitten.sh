#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。SourceKittenをインストールします。"
        
        # 1. Homebrew があれば使用 (ubuntu-latest には標準搭載)
        # ただし、パスが通っていない場合があるためチェック
        if [ -f /home/linuxbrew/.linuxbrew/bin/brew ]; then
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        fi

        if command -v brew &> /dev/null; then
            echo "Homebrew を使用してインストールします。"
            HOMEBREW_NO_AUTO_UPDATE=1 brew install sourcekitten
        else
            echo "Homebrew が見つからないため、ソースからビルドを開始します..."
            # ソースビルド
            if ! command -v git &> /dev/null || ! command -v swift &> /dev/null; then
                echo "必要なツール (git, swift) が見つかりません。aptでインストールを試みます。"
                sudo apt-get update && sudo apt-get install -y git
            fi

            rm -rf /tmp/SourceKitten
            git clone --depth 1 https://github.com/jpsim/SourceKitten.git /tmp/SourceKitten
            cd /tmp/SourceKitten
            swift build --configuration release
            # ビルド済みバイナリをコピー (sudoを使用)
            SOURCEKITTEN_BIN=$(swift build --configuration release --show-bin-path)/sourcekitten
            if [ -f "$SOURCEKITTEN_BIN" ]; then
                sudo cp "$SOURCEKITTEN_BIN" /usr/local/bin/
                sudo chmod +x /usr/local/bin/sourcekitten
            else
                echo "ビルドに失敗しました。バイナリが見つかりません: $SOURCEKITTEN_BIN"
                exit 1
            fi
            cd -
        fi
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
    echo "Version: $(sourcekitten version)"
    
    # 簡単なパース確認 (Linuxでの動作検証用)
    echo "func test() {}" > /tmp/test.swift
    echo "SourceKitten structure test:"
    sourcekitten structure --file /tmp/test.swift
else
    echo "SourceKittenのインストールに失敗しました。"
    exit 1
fi
