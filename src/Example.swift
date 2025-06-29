// これはテスト目的のSwiftファイルの例です。

import Foundation

/// 解析をデモンストレーションするためのシンプルなクラスです。
class MyClass {
    var name: String
    private var age: Int

    init(name: String, age: Int) {
        self.name = name
        self.age = age
    }

    /// 名前で挨拶をします。
    /// - Parameter person: 挨拶する人の名前。
    func greet(person: String) -> String {
        let greeting = "こんにちは、\(person)さん！私の名前は\(name)です。"
        print(greeting)
        return greeting
    }

    /// 数値の二乗を計算します。
    /// - Parameter number: 二乗する数値。
    /// - Returns: 数値の二乗。
    func calculateSquare(number: Int) -> Int {
        return number * number
    }

    /// 内部ヘルパー関数です。
    private func internalHelper() {
        print("これは内部ヘルパーです。")
    }
}

/// 構造体の例です。
struct MyStruct {
    var value: Int

    func doubleValue() -> Int {
        return value * 2
    }
}


/// グローバル関数の例です。
func globalFunction(message: String) {
    print("グローバル: \(message)")
}


// --- largeFunction 定義の開始 ---

/// これはテスト目的の非常に大きく複雑な関数です。
/// 複数の行にまたがり、様々な制御フロー文、コメント、
/// およびネストされた構造を含み、現実世界のシナリオをシミュレートします。
/// 目的は、\`get_function_chunk\` ツールが大きな関数の
/// 完全なコード内容を抽出する能力をテストすることです。
func largeFunction(input: [String: Any]) -> String {
    var result = ""
    // 基本的な条件をチェック
    if let name = input["name"] as? String, !name.isEmpty {
        result += "名前: \(name)\n"
    } else {
        result += "名前: N/A\n"
    }

    // 年齢を処理
    if let age = input["age"] as? Int {
        switch age {
        case 0..<13:
            result += "年齢層: 子供\n"
        case 13..<20:
            result += "年齢層: ティーンエイジャー\n"
        case 20..<65:
            result += "年齢層: 大人\n"
        default:
            result += "年齢層: シニア\n"
        }
    } else {
        result += "年齢: 不明\n"
    }

    // オプションデータを処理
    if let data = input["data"] as? [String: Any] {
        for (key, value) in data {
            result += "データ - \(key): \(value)\n"
        }
    } else {
        result += "追加データなし。\n"
    }

    // いくつかの複雑な計算や操作をシミュレート
    for i in 0..<10 {
        if i % 2 == 0 {
            result += "偶数: \(i)\n"
        }
        else {
            result += "奇数: \(i)\n"
        }
    }

    // ネストされたクロージャの例
    let processCompletion: (String) -> Void = { message in
        result += "完了メッセージ: \(message)\n"
    }
    processCompletion("タスク完了")

    // Guard let の例
    guard let status = input["status"] as? String else {
        result += "ステータス: 未提供\n"
        return result
    }
    result += "ステータス: \(status)\n"

    // Defer ステートメントの例
    defer {
        print("大規模関数実行終了。")
    }

    // 最終概要
    result += "\n--- 概要 ---\n"
    result += "正常に処理されました。\n"

    return result
}

// --- largeFunction 定義の終了 ---

// 使用例:
let myInstance = MyClass(name: "アリス", age: 30)
myInstance.greet(person: "ボブ")
let square = myInstance.calculateSquare(number: 5)
print("二乗: \(square)")

let myStructInstance = MyStruct(value: 10)
let doubled = myStructInstance.doubleValue()
print("2倍: \(doubled)")

globalFunction(message: "グローバル関数からの挨拶！")

let largeFunctionInput: [String: Any] = [
    "name": "テストユーザー",
    "age": 25,
    "data": [
        "key1": "値1",
        "key2": 123
    ],
    "status": "アクティブ"
]
let largeFunctionOutput = largeFunction(input: largeFunctionInput)
print(largeFunctionOutput)
