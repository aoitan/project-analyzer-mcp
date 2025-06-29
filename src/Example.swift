// This is an example Swift file for testing purposes.

import Foundation

/// A simple class to demonstrate analysis.
class MyClass {
    var name: String
    private var age: Int

    init(name: String, age: Int) {
        self.name = name
        self.age = age
    }

    /// Greets a person by name.
    /// - Parameter person: The name of the person to greet.
    func greet(person: String) -> String {
        let greeting = "Hello, \(person)! My name is \(name)."
        print(greeting)
        return greeting
    }

    /// Calculates the square of a number.
    /// - Parameter number: The number to square.
    /// - Returns: The square of the number.
    func calculateSquare(number: Int) -> Int {
        return number * number
    }

    /// An internal helper function.
    private func internalHelper() {
        print("This is an internal helper.")
    }
}

/// A struct example.
struct MyStruct {
    var value: Int

    func doubleValue() -> Int {
        return value * 2
    }
}

/// A global function example.
func globalFunction(message: String) {
    print("Global: \(message)")
}

/// This is a very large and complex function for testing purposes.
/// It spans multiple lines and contains various control flow statements,
/// comments, and nested structures to simulate a real-world scenario.
/// The purpose is to test the `get_function_chunk` tool's ability
/// to extract the complete code content of large functions.
func largeFunction(input: [String: Any]) -> String {
    var result = ""
    // Check for basic conditions
    if let name = input["name"] as? String, !name.isEmpty {
        result += "Name: \(name)\n"
    } else {
        result += "Name: N/A\n"
    }

    // Process age
    if let age = input["age"] as? Int {
        switch age {
        case 0..<13:
            result += "Age Group: Child\n"
        case 13..<20:
            result += "Age Group: Teenager\n"
        case 20..<65:
            result += "Age Group: Adult\n"
        default:
            result += "Age Group: Senior\n"
        }
    } else {
        result += "Age: Unknown\n"
    }

    // Handle optional data
    if let data = input["data"] as? [String: Any] {
        for (key, value) in data {
            result += "Data - \(key): \(value)\n"
        }
    }
} else {
        result += "No additional data.\n"
    }

    // Simulate some complex calculations or operations
    for i in 0..<10 {
        if i % 2 == 0 {
            result += "Even number: \(i)\n"
        } else {
            result += "Odd number: \(i)\n"
        }
    }

    // Nested closure example
    let processCompletion: (String) -> Void = { message in
        result += "Completion message: \(message)\n"
    }
    processCompletion("Task finished")

    // Guard let example
    guard let status = input["status"] as? String else {
        result += "Status: Not provided\n"
        return result
    }
    result += "Status: \(status)\n"

    // Defer statement example
    defer {
        print("Large function execution finished.")
    }

    // Final summary
    result += "\n--- Summary ---\n"
    result += "Processed successfully.\n"

    return result
}

// Example usage:
let myInstance = MyClass(name: "Alice", age: 30)
myInstance.greet(person: "Bob")
let square = myInstance.calculateSquare(number: 5)
print("Square: \(square)")

let myStructInstance = MyStruct(value: 10)
let doubled = myStructInstance.doubleValue()
print("Doubled: \(doubled)")

globalFunction(message: "Hello from global function!")

let largeFunctionInput: [String: Any] = [
    "name": "Test User",
    "age": 25,
    "data": [
        "key1": "value1",
        "key2": 123
    ],
    "status": "Active"
]
let largeFunctionOutput = largeFunction(input: largeFunctionInput)
print(largeFunctionOutput)