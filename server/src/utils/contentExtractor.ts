/**
 * Extracts plain text from TipTap/ProseMirror JSON content
 */
export function extractTextFromRichContent(contentRich: any): string {
  if (!contentRich || typeof contentRich !== 'object') {
    return ''
  }

  try {
    return extractTextFromNode(contentRich).trim()
  } catch (error) {
    console.warn('Error extracting text from rich content:', error)
    return ''
  }
}

/**
 * Recursively extracts text from a ProseMirror node
 */
function extractTextFromNode(node: any): string {
  if (!node || typeof node !== 'object') {
    return ''
  }

  let text = ''

  // If this node has text content, add it
  if (node.text && typeof node.text === 'string') {
    text += node.text
  }

  // If this node has content (children), process them
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childText = extractTextFromNode(child)
      if (childText) {
        // Add space between nodes to prevent words from running together
        if (text && !text.endsWith(' ') && !childText.startsWith(' ')) {
          text += ' '
        }
        text += childText
      }
    }
  }

  // Add line breaks after block-level elements
  if (isBlockElement(node.type)) {
    text += '\n'
  }

  return text
}

/**
 * Determines if a node type is a block-level element
 */
function isBlockElement(nodeType: string): boolean {
  const blockTypes = [
    'paragraph',
    'heading',
    'blockquote',
    'codeBlock',
    'bulletList',
    'orderedList',
    'listItem',
    'horizontalRule'
  ]
  
  return blockTypes.includes(nodeType)
}

/**
 * Generates an excerpt from rich content
 */
export function generateExcerpt(contentRich: any, maxLength: number = 160): string {
  const plainText = extractTextFromRichContent(contentRich)
  
  if (plainText.length <= maxLength) {
    return plainText
  }

  // Find the last space before the max length to avoid cutting words
  const truncated = plainText.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > maxLength * 0.8) { // Only use last space if it's not too far back
    return truncated.substring(0, lastSpace) + '...'
  }
  
  return truncated + '...'
}
