#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。SourceKittenをインストールします。"
        
        # 1. Homebrew があれば使用 (ubuntu-latest には標準搭載)
        if [ -f /home/linuxbrew/.linuxbrew/bin/brew ]; then
            eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
        fi

        if command -v brew &> /dev/null; then
            echo "Homebrew を使用してインストールします。"
            HOMEBREW_NO_AUTO_UPDATE=1 brew install sourcekitten
        else
            echo "Homebrew が見つからないため、ソースからビルドを開始します..."
            if ! command -v git &> /dev/null || ! command -v swift &> /dev/null; then
                echo "必要なツール (git, swift) が見つかりません。"
                sudo apt-get update && sudo apt-get install -y git
            fi

            rm -rf /tmp/SourceKitten
            git clone --depth 1 https://github.com/jpsim/SourceKitten.git /tmp/SourceKitten
            cd /tmp/SourceKitten
            swift build --configuration release
            SOURCEKITTEN_BIN=$(swift build --configuration release --show-bin-path)/sourcekitten
            if [ -f "$SOURCEKITTEN_BIN" ]; then
                sudo cp "$SOURCEKITTEN_BIN" /usr/local/bin/
                sudo chmod +x /usr/local/bin/sourcekitten
            else
                echo "ビルドに失敗しました。"
                exit 1
            fi
            cd -
        fi

        # 依存ライブラリの確認と設定
        echo "SourceKit 関連ライブラリを検索中..."
        # Swiftのインストールパスから libsourcekitdInProc.so を探す
        LIB_PATH=$(find $(dirname $(which swift))/../lib -name "libsourcekitdInProc.so" | head -n 1)
        if [ -n "$LIB_PATH" ]; then
            SWIFT_LIB_DIR=$(dirname "$LIB_PATH")
            echo "Found SourceKit lib at: $SWIFT_LIB_DIR"
            export LD_LIBRARY_PATH="$SWIFT_LIB_DIR:$LD_LIBRARY_PATH"
            # GITHUB_ENV に書き込む (CI環境用)
            if [ -n "$GITHUB_ENV" ]; then
                echo "LD_LIBRARY_PATH=$SWIFT_LIB_DIR:$LD_LIBRARY_PATH" >> $GITHUB_ENV
            fi
        else
            echo "Warning: libsourcekitdInProc.so not found."
        fi
        ;;
    Darwin*)
        echo "macOS環境を検出しました。Homebrewを使用してSourceKittenをインストールします。"
        if ! command -v brew &> /dev/null; then
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        brew install sourcekitten
        ;;
    *)
        echo "サポートされていないOSです: $OS"
        exit 1
        ;;
esac

if command -v sourcekitten &> /dev/null; then
    echo "SourceKittenのインストールが完了しました。"
    echo "Version: $(sourcekitten version)"
    
    # 簡単なパース確認
    echo "func test() {}" > /tmp/test.swift
    echo "SourceKitten structure test (with LD_LIBRARY_PATH=$LD_LIBRARY_PATH):"
    sourcekitten structure --file /tmp/test.swift
else
    echo "SourceKittenのインストールに失敗しました。"
    exit 1
fi
