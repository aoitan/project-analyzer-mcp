import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Path
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import AstNodeInfo

class MainKtTest {

    @TempDir
    lateinit var tempDir: Path

    private fun normalizeContent(content: String): String {
        return content.replace("\r\n", "\n")
    }

    private fun runCli(filePath: String): ProcessResult {
        val processBuilder = ProcessBuilder(
            "java",
            "-jar",
            File(System.getProperty("user.dir"), "build/libs/kotlin-parser-cli.jar").absolutePath, // ビルドされたJARファイルの絶対パス
            filePath
        )
        processBuilder.directory(File(System.getProperty("user.dir"))) // プロジェクトのルートディレクトリで実行
        val process = processBuilder.start()
        val stdout = process.inputStream.bufferedReader().use { it.readText() }
        val stderr = process.errorStream.bufferedReader().use { it.readText() }
        val exitCode = process.waitFor()
        println("CLI stdout: $stdout") // 追加
        println("CLI stderr: $stderr") // 追加
        return ProcessResult(stdout, stderr, exitCode)
    }

    data class ProcessResult(val stdout: String, val stderr: String, val exitCode: Int)

    @Test
    fun `should parse a simple Kotlin file with a function`() {
        val kotlinCode = """
            fun main() {
                println("Hello, World!")
            }
        """
        val kotlinFile = this.tempDir.resolve("test.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val functionNode = astInfo.children[0]
        assertEquals("function", functionNode.type)
        assertEquals("main", functionNode.name)
        assertEquals("fun main()", functionNode.signature)
        assertEquals(kotlinCode.trim(), functionNode.content)
        assertEquals(2, functionNode.startLine)
        assertEquals(4, functionNode.endLine)
    }

    @Test
    fun `should handle non-existent file path`() {
        val nonExistentFile = this.tempDir.resolve("nonExistent.kt").toFile()
        val result = this.runCli(nonExistentFile.absolutePath)

        assertEquals(2, result.exitCode, "CLI should exit with code 2 for non-existent file")
    }

    @Test
    fun `should handle Kotlin file with syntax error`() {
        val kotlinCode = """
            fun main() {
                println("Hello, World!
            }
        """
        val kotlinFile = this.tempDir.resolve("syntaxError.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0 even with syntax error")
        // CLIは構文エラーがあっても0で終了し、エラーメッセージはstderrに出力される
        // assertEquals("", result.stderr, "Stderr should be empty") // エラーメッセージが出力されるためコメントアウト
    }

    @Test
    fun `should parse a simple Kotlin file with a class`() {
        val kotlinCode = """
            class MyClass {
                fun doSomething() {
                    println("Hello from MyClass")
                }
            }
        """
        val kotlinFile = this.tempDir.resolve("testClass.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val classNode = astInfo.children[0]
        assertEquals("class", classNode.type)
        assertEquals("MyClass", classNode.name)
        assertEquals("class MyClass", classNode.signature)
        assertEquals(normalizeContent(kotlinCode).trim(), normalizeContent(classNode.content))
        assertEquals(2, classNode.startLine)
        assertEquals(6, classNode.endLine)

        assertEquals(1, classNode.children.size)
        val functionNode = classNode.children[0]
        assertEquals("function", functionNode.type)
        assertEquals("doSomething", functionNode.name)
        assertEquals("fun doSomething()", functionNode.signature)
    }

    @Test
    fun `should parse a Kotlin file with a global property`() {
        val kotlinCode = """
            val globalVar = "Hello"
        """
        val kotlinFile = this.tempDir.resolve("testGlobalVar.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val propertyNode = astInfo.children[0]
        assertEquals("property", propertyNode.type)
        assertEquals("globalVar", propertyNode.name)
        assertEquals("val globalVar", propertyNode.signature)
        assertEquals(normalizeContent(kotlinCode).trim(), normalizeContent(propertyNode.content))
        assertEquals(2, propertyNode.startLine)
        assertEquals(2, propertyNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with a class property`() {
        val kotlinCode = """
            class MyClassWithProperty {
                val classVar = 123
            }
        """
        val kotlinFile = this.tempDir.resolve("testClassProperty.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val classNode = astInfo.children[0]
        assertEquals("class", classNode.type)
        assertEquals("MyClassWithProperty", classNode.name)
        assertEquals(1, classNode.children.size)

        val propertyNode = classNode.children[0]
        assertEquals("property", propertyNode.type)
        assertEquals("classVar", propertyNode.name)
        assertEquals("val classVar", propertyNode.signature)
        val propertyCode = "val classVar = 123"
        assertEquals(normalizeContent(propertyCode), normalizeContent(propertyNode.content))
        assertEquals(3, propertyNode.startLine)
        assertEquals(3, propertyNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with single line comments`() {
        val kotlinCode = """
            // This is a single line comment
            fun main() { // Another comment
                println("Hello")
            }
        """
        val kotlinFile = this.tempDir.resolve("testSingleLineComment.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size) // Only the function should be parsed as a node

        val functionNode = astInfo.children[0]
        assertEquals("function", functionNode.type)
        assertEquals("main", functionNode.name)
    }

    @Test
    fun `should parse a Kotlin file with multi line comments`() {
        val kotlinCode = """
            /*
             * This is a multi-line comment.
             */
            fun greet() {
                /* Another
                 * multi-line
                 * comment */
                println("Greetings!")
            }
        """
        val kotlinFile = this.tempDir.resolve("testMultiLineComment.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size) // Only the function should be parsed as a node

        val functionNode = astInfo.children[0]
        assertEquals("function", functionNode.type)
        assertEquals("greet", functionNode.name)
    }

    @Test
    fun `should parse a Kotlin file with complex function signature`() {
        val kotlinCode = """
            fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T> where T : Any {
                return items.filter(filter)
            }
        """
        val kotlinFile = this.tempDir.resolve("testComplexFunction.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val functionNode = astInfo.children[0]
        assertEquals("function", functionNode.type)
        assertEquals("processList", functionNode.name)
        assertEquals("fun <T> processList(items: List<T>, filter: (T) -> Boolean = { true }): List<T>", functionNode.signature)
        assertEquals(normalizeContent(kotlinCode).trim(), functionNode.content)
        assertEquals(2, functionNode.startLine)
        assertEquals(4, functionNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with a data class`() {
        val kotlinCode = """
            data class User(val name: String, val age: Int)
        """
        val kotlinFile = this.tempDir.resolve("testDataClass.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val dataClassNode = astInfo.children[0]
        assertEquals("data class", dataClassNode.type) // Data class is still a class
        assertEquals("User", dataClassNode.name)
        assertEquals("data class User(val name: String, val age: Int)", dataClassNode.signature) // 期待値を修正
        assertEquals(kotlinCode.trim(), dataClassNode.content)
        assertEquals(2, dataClassNode.startLine)
        assertEquals(2, dataClassNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with an interface`() {
        val kotlinCode = """
            interface MyInterface {
                fun doSomething()
            }
        """
        val kotlinFile = this.tempDir.resolve("testInterface.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val interfaceNode = astInfo.children[0]
        assertEquals("interface", interfaceNode.type)
        assertEquals("MyInterface", interfaceNode.name)
        assertEquals("interface MyInterface", interfaceNode.signature)
        assertEquals(kotlinCode.trim(), interfaceNode.content)
        assertEquals(2, interfaceNode.startLine)
        assertEquals(4, interfaceNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with an object declaration`() {
        val kotlinCode = """
            object MySingleton {
                fun getInstance() = "instance"
            }
        """
        val kotlinFile = this.tempDir.resolve("testObject.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val objectNode = astInfo.children[0]
        assertEquals("object", objectNode.type)
        assertEquals("MySingleton", objectNode.name)
        assertEquals("object MySingleton", objectNode.signature)
        assertEquals(kotlinCode.trim(), objectNode.content)
        assertEquals(2, objectNode.startLine)
        assertEquals(4, objectNode.endLine)
    }

    @Test
    fun `should parse a Kotlin file with an enum class`() {
        val kotlinCode = """
            enum class Direction {
                NORTH, SOUTH, EAST, WEST
            }
        """
        val kotlinFile = this.tempDir.resolve("testEnum.kt").toFile()
        kotlinFile.writeText(kotlinCode)

        val result = this.runCli(kotlinFile.absolutePath)

        assertEquals(0, result.exitCode, "CLI should exit with code 0")
        assertEquals("", result.stderr, "Stderr should be empty")

        val astInfo = Json { ignoreUnknownKeys = true }.decodeFromString<AstNodeInfo>(result.stdout)

        assertEquals("File", astInfo.type)
        assertEquals(1, astInfo.children.size)

        val enumNode = astInfo.children[0]
        assertEquals("enum class", enumNode.type) // Enum class is a specific type of class
        assertEquals("Direction", enumNode.name)
        assertEquals("enum class Direction", enumNode.signature)
        assertEquals(kotlinCode.trim(), enumNode.content)
        assertEquals(2, enumNode.startLine)
        assertEquals(4, enumNode.endLine)
    }
}
