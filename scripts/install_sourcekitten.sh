#!/bin/bash

# SourceKittenのインストールスクリプト

# OSを判定
OS="$(uname -s)"

case "$OS" in
    Linux*)
        echo "Linux環境を検出しました。SourceKittenをインストールします。"
        
        # 必要なシステムライブラリのインストール (Swift/SourceKit用)
        sudo apt-get update && sudo apt-get install -y libxml2-dev libncurses5-dev libcurl4-openssl-dev

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
        SWIFT_BIN_PATH=$(which swift)
        SWIFT_LIB_DIR=$(dirname "$SWIFT_BIN_PATH")/../lib/swift/linux
        
        if [ -d "$SWIFT_LIB_DIR" ]; then
            echo "Found Swift lib dir at: $SWIFT_LIB_DIR"
            # GITHUB_ENV と GITHUB_PATH に書き込む (CI環境用)
            if [ -n "$GITHUB_ENV" ]; then
                echo "LD_LIBRARY_PATH=$SWIFT_LIB_DIR:$LD_LIBRARY_PATH" >> $GITHUB_ENV
                echo "$(dirname "$SWIFT_BIN_PATH")" >> $GITHUB_PATH
            fi
            export LD_LIBRARY_PATH="$SWIFT_LIB_DIR:$LD_LIBRARY_PATH"
        else
            echo "Warning: Swift lib dir not found at $SWIFT_LIB_DIR"
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
    echo "Location: $(which sourcekitten)"
    
    # 簡単なパース確認
    TEST_SWIFT="/tmp/test.swift"
    echo "func test() {}" > "$TEST_SWIFT"
    echo "--- SourceKitten structure test (file path) ---"
    sourcekitten structure --file "$TEST_SWIFT"
else
    echo "SourceKittenのインストールに失敗しました。"
    exit 1
fi
