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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString

@Serializable
data class AstNodeInfo(
    val type: String,
    val name: String? = null,
    val signature: String? = null,
    val content: String,
    val startLine: Int,
    val endLine: Int,
    val offset: Int,
    val length: Int,
    val children: List<AstNodeInfo> = emptyList()
)

fun KtFile.toAstNodeInfo(fileContent: String): AstNodeInfo {
    val nodes = mutableListOf<AstNodeInfo>()

    // 関数を抽出
    this.declarations.filterIsInstance<org.jetbrains.kotlin.psi.KtNamedFunction>().forEach { func ->
        val startOffset = func.textRange.startOffset
        val endOffset = func.textRange.endOffset
        val content = fileContent.substring(startOffset, endOffset)
        val startLine = (fileContent.substring(0, startOffset).count { it == '\n' } + 1)
        val endLine = (fileContent.substring(0, endOffset).count { it == '\n' } + 1)

        nodes.add(AstNodeInfo(
            type = "function",
            name = func.name,
            signature = func.text.substringBefore("{").trim(),
            content = content,
            startLine = startLine,
            endLine = endLine,
            offset = startOffset,
            length = content.length
        ))
    }

    // クラスを抽出
    this.declarations.filterIsInstance<org.jetbrains.kotlin.psi.KtClassOrObject>().forEach { cls ->
        val startOffset = cls.textRange.startOffset
        val endOffset = cls.textRange.endOffset
        val content = fileContent.substring(startOffset, endOffset)
        val startLine = (fileContent.substring(0, startOffset).count { it == '\n' } + 1)
        val endLine = (fileContent.substring(0, endOffset).count { it == '\n' } + 1)

        nodes.add(AstNodeInfo(
            type = "class",
            name = cls.name,
            signature = cls.text.substringBefore("{").trim(),
            content = content,
            startLine = startLine,
            endLine = endLine,
            offset = startOffset,
            length = content.length
        ))
    }

    return AstNodeInfo(
        type = "File",
        name = this.name,
        content = fileContent,
        startLine = 1,
        endLine = fileContent.lines().size,
        offset = 0,
        length = fileContent.length,
        children = nodes
    )
}

fun main(args: Array<String>) {
    if (args.isEmpty()) {
        System.err.println("Usage: java -jar kotlin-parser-cli.jar <kotlin_file_path>")
        return
    }

    val filePath = args[0]
    val fileContent = try {
        java.io.File(filePath).readText()
    } catch (e: Exception) {
        System.err.println("Error reading file: ${e.message}")
        return
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
            System.err.println("Error: Could not parse Kotlin file.")
        }
    } catch (e: Exception) {
        System.err.println("Error processing Kotlin file: ${e.message}")
        e.printStackTrace()
    } finally {
        Disposer.dispose(disposable)
    }
}
