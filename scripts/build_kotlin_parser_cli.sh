#!/bin/bash

echo "Building kotlin-parser-cli..."
cd kotlin-parser-cli || { echo "Error: kotlin-parser-cli directory not found."; exit 1; }
./gradlew shadowJar
if [ $? -ne 0 ]; then
    echo "Error: gradlew shadowJar failed."
    exit 1
fi
cd ..
echo "kotlin-parser-cli build complete."
