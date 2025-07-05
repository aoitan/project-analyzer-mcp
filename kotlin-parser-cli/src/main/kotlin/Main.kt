import org.jetbrains.kotlin.cli.common.CLIConfigurationKeys
import org.jetbrains.kotlin.cli.common.messages.MessageRenderer
import org.jetbrains.kotlin.cli.common.messages.PrintingMessageCollector
import org.jetbrains.kotlin.cli.jvm.compiler.EnvironmentConfigFiles
import org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment
import org.jetbrains.kotlin.com.intellij.openapi.util.Disposer
import org.jetbrains.kotlin.com.intellij.psi.PsiManager
import org.jetbrains.kotlin.com.intellij.testFramework.LightVirtualFile
import org.jetbrains.kotlin.config.CompilerConfiguration
import org.jetbrains.kotlin.idea.KotlinLanguage
import org.jetbrains.kotlin.psi.KtFile
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlin.system.exitProcess

fun main(args: Array<String>) {
    if (args.isEmpty()) {
        System.err.println("Usage: java -jar kotlin-parser-cli.jar <kotlin_file_path>")
        exitProcess(1)
    }

    val filePath = args[0]
    val fileContent = try {
        java.io.File(filePath).readText()
    } catch (e: Exception) {
        System.err.println("Error reading file: ${e.message}")
        System.err.flush() // 追加
        exitProcess(2)
    }

    val disposable = Disposer.newDisposable()
    try {
        val configuration = CompilerConfiguration()
        configuration.put(CLIConfigurationKeys.MESSAGE_COLLECTOR_KEY, PrintingMessageCollector(System.err, MessageRenderer.PLAIN_FULL_PATHS, false))
        val environment = KotlinCoreEnvironment.createForProduction(disposable, configuration, EnvironmentConfigFiles.JVM_CONFIG_FILES)

        val psiFile = PsiManager.getInstance(environment.project).let {
            psiManager -> psiManager.findFile(LightVirtualFile(filePath, KotlinLanguage.INSTANCE, fileContent))
        } as? KtFile

        if (psiFile != null) {
            val astInfo = psiFile.toAstNodeInfo(fileContent)
            val json = Json { prettyPrint = true }
            println(json.encodeToString(astInfo))
        } else {
            System.out.println("Error: Could not parse Kotlin file.") // System.err から System.out に変更
        }
    } catch (e: Exception) {
        System.err.println("Error processing Kotlin file: ${e.message}")
        e.printStackTrace()
        System.err.flush() // 追加
    } finally {
        Disposer.dispose(disposable)
    }
    exitProcess(0)
}
