import org.jetbrains.kotlin.psi.KtFile
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import org.jetbrains.kotlin.psi.KtNamedFunction
import org.jetbrains.kotlin.psi.KtProperty
import org.jetbrains.kotlin.psi.KtClassOrObject
import org.jetbrains.kotlin.psi.KtClass
import org.jetbrains.kotlin.psi.KtObjectDeclaration
import org.jetbrains.kotlin.psi.KtElement

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

private fun calculateLineNumber(offset: Int, fileContent: String): Int {
    return fileContent.substring(0, offset).lines().size
}

private fun normalizeContent(content: String): String {
    return content.replace("\r\n", "\n")
}

fun extractDeclarations(element: org.jetbrains.kotlin.psi.KtElement, fileContent: String): List<AstNodeInfo> {

    val nodes = mutableListOf<AstNodeInfo>()

    val declarations = when (element) {
        is KtFile -> element.declarations
        is KtClass -> element.body?.declarations ?: emptyList()
        is KtObjectDeclaration -> element.body?.declarations ?: emptyList()
        else -> emptyList()
    }

    declarations.forEach { declaration ->
        when (declaration) {
            is KtNamedFunction -> {
                val startOffset = declaration.textRange.startOffset
                val endOffset = declaration.textRange.endOffset
                val content = fileContent.substring(startOffset, endOffset)
                val startLine = calculateLineNumber(startOffset, fileContent)
                val endLine = calculateLineNumber(endOffset, fileContent)

                val signatureBuilder = StringBuilder()
                signatureBuilder.append("fun ")
                declaration.typeParameterList?.text?.let { signatureBuilder.append(it).append(" ") }
                declaration.receiverTypeReference?.text?.let { signatureBuilder.append(it).append(".") }
                signatureBuilder.append(declaration.name)
                declaration.valueParameterList?.text?.let { signatureBuilder.append(it) }
                declaration.typeReference?.text?.let { signatureBuilder.append(": ").append(it) }

                nodes.add(AstNodeInfo(
                    type = "function",
                    name = declaration.name,
                    signature = signatureBuilder.toString(),
                    content = normalizeContent(content),
                    startLine = startLine,
                    endLine = endLine,
                    offset = startOffset,
                    length = content.length
                ))
            }
            is KtProperty -> {
                val startOffset = declaration.textRange.startOffset
                val endOffset = declaration.textRange.endOffset
                val content = fileContent.substring(startOffset, endOffset)
                val startLine = calculateLineNumber(startOffset, fileContent)
                val endLine = calculateLineNumber(endOffset, fileContent)

                val signature = (if (declaration.isVar) "var " else "val ") + declaration.name + (declaration.typeReference?.text?.let { ": $it" } ?: "")

                nodes.add(AstNodeInfo(
                    type = "property",
                    name = declaration.name,
                    signature = signature,
                    content = normalizeContent(content),
                    startLine = startLine,
                    endLine = endLine,
                    offset = startOffset,
                    length = content.length
                ))
            }
            is KtClassOrObject -> {
                val startOffset = declaration.textRange.startOffset
                val endOffset = declaration.textRange.endOffset
                val content = fileContent.substring(startOffset, endOffset)
                val startLine = calculateLineNumber(startOffset, fileContent)
                val endLine = calculateLineNumber(endOffset, fileContent)

                val type = when (declaration) {
                    is org.jetbrains.kotlin.psi.KtClass -> {
                        if (declaration.isData()) "data class"
                        else if (declaration.isEnum()) "enum class"
                        else if (declaration.isInterface()) "interface"
                        else "class"
                    }
                    is org.jetbrains.kotlin.psi.KtObjectDeclaration -> "object"
                    else -> "unknown"
                }

                val signature = if (type.contains("class") || type.contains("object") || type.contains("interface")) {
                    type + " " + declaration.name + declaration.typeParameterList?.text.orEmpty() + declaration.primaryConstructor?.text.orEmpty() + declaration.superTypeListEntries.joinToString("") { ": " + it.typeReference?.text.orEmpty() }
                } else {
                    declaration.name + declaration.typeParameterList?.text.orEmpty() + declaration.primaryConstructor?.text.orEmpty() + declaration.superTypeListEntries.joinToString("") { ": " + it.typeReference?.text.orEmpty() }
                }

                val childrenNodes = extractDeclarations(declaration, fileContent)

                nodes.add(AstNodeInfo(
                    type = type,
                    name = declaration.name,
                    signature = signature,
                    content = normalizeContent(content),
                    startLine = startLine,
                    endLine = endLine,
                    offset = startOffset,
                    length = content.length,
                    children = childrenNodes
                ))
            }
        }
    }
    return nodes
}

fun KtFile.toAstNodeInfo(fileContent: String): AstNodeInfo {
    val nodes = extractDeclarations(this, fileContent)

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
