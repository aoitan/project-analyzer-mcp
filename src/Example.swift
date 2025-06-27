// src/Example.swift
import Foundation

class MyClass {
    let name: String

    init(name: String) {
        self.name = name
    }

    func greet(person: String) -> String {
        let message = createGreetingMessage(for: person)
        print("Greeting: \(message)")
        logAction("greet", message: message)
        return message
    }

    private func createGreetingMessage(for person: String) -> String {
        return "Hello, \(person)! My name is \(name)."
    }

    func performCalculation(a: Int, b: Int) -> Int {
        let result = a + b
        logAction("calculate", message: "Performed calculation with result \(result)")
        return result
    }
}

func logAction(_ action: String, message: String) {
    print("LOG [\(action)]: \(message)")
}

// Global function example
func globalUtilityFunction() {
    print("This is a global utility function.")
}


