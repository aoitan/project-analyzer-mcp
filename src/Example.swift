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

// Example usage:
let myInstance = MyClass(name: "Alice", age: 30)
myInstance.greet(person: "Bob")
let square = myInstance.calculateSquare(number: 5)
print("Square: \(square)")

let myStructInstance = MyStruct(value: 10)
let doubled = myStructInstance.doubleValue()
print("Doubled: \(doubled)")

globalFunction(message: "Hello from global function!")
