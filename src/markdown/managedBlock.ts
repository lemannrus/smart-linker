/**
 * Managed block operations for inserting/updating related links.
 * 
 * The managed block is delimited by special HTML comments:
 * <!-- auto-related:start -->
 * ... content ...
 * <!-- auto-related:end -->
 */

/** Start marker for the managed block */
export const BLOCK_START_MARKER = "<!-- auto-related:start -->";

/** End marker for the managed block */
export const BLOCK_END_MARKER = "<!-- auto-related:end -->";

/**
 * Result of a related note search.
 */
export interface RelatedNote {
	/** Path to the note file */
	path: string;
	/** Cosine similarity score (0-1) */
	score: number;
}

/**
 * Options for generating the managed block content.
 */
export interface ManagedBlockOptions {
	/** Heading text (e.g., "## Related") */
	heading: string;
	/** Whether to show similarity scores */
	showScores: boolean;
	/** Whether to use full path in links */
	usePathLinks: boolean;
}

/**
 * Generates the content of the managed block.
 * 
 * @param relatedNotes - Array of related notes with scores
 * @param options - Block generation options
 * @returns The full managed block content including markers
 */
export function generateManagedBlock(
	relatedNotes: RelatedNote[],
	options: ManagedBlockOptions
): string {
	const lines: string[] = [BLOCK_START_MARKER];
	
	// Add heading
	lines.push(options.heading);
	
	// Add links
	if (relatedNotes.length === 0) {
		lines.push("*No related notes found*");
	} else {
		for (const note of relatedNotes) {
			const noteName = getNoteName(note.path);
			
			// usePathLinks: true  => [[path/to/note.md]]
			// usePathLinks: false => [[path/to/note.md|Note Name]]
			let link: string;
			if (options.usePathLinks) {
				link = `[[${note.path}]]`;
			} else {
				link = `[[${note.path}|${noteName}]]`;
			}
			
			let line = `- ${link}`;
			
			if (options.showScores) {
				line += ` (${note.score.toFixed(3)})`;
			}
			
			lines.push(line);
		}
	}
	
	lines.push(BLOCK_END_MARKER);
	
	return lines.join("\n");
}

/**
 * Extracts the basename from a file path.
 * 
 * @param path - Full file path
 * @returns Filename without directory path
 */
function getBasename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1];
}

/**
 * Extracts the note name (basename without .md extension).
 * 
 * @param path - Full file path
 * @returns Note name for display
 */
function getNoteName(path: string): string {
	let name = getBasename(path);
	if (name.endsWith(".md")) {
		name = name.slice(0, -3);
	}
	return name;
}

/**
 * Finds the position of an existing managed block in the content.
 * 
 * @param content - The note content
 * @returns Object with start/end indices, or null if not found
 */
export function findManagedBlock(
	content: string
): { startIndex: number; endIndex: number } | null {
	const startIndex = content.indexOf(BLOCK_START_MARKER);
	if (startIndex === -1) {
		return null;
	}
	
	const endIndex = content.indexOf(BLOCK_END_MARKER, startIndex);
	if (endIndex === -1) {
		// Start marker found but no end marker - malformed block
		console.warn("Auto Related Links: Found start marker but no end marker");
		return null;
	}
	
	return {
		startIndex,
		endIndex: endIndex + BLOCK_END_MARKER.length,
	};
}

/**
 * Updates the note content with the new managed block.
 * If a managed block exists, it replaces it. Otherwise, appends to the end.
 * 
 * @param content - Original note content
 * @param newBlock - New managed block content
 * @returns Updated note content
 */
export function updateManagedBlock(content: string, newBlock: string): string {
	const existingBlock = findManagedBlock(content);
	
	if (existingBlock) {
		// Replace existing block
		const before = content.substring(0, existingBlock.startIndex);
		const after = content.substring(existingBlock.endIndex);
		
		// Clean up whitespace: remove trailing newlines from before, 
		// then ensure proper spacing
		const cleanBefore = before.trimEnd();
		const cleanAfter = after.trimStart();
		
		// Rebuild with consistent spacing
		let result = cleanBefore;
		if (cleanBefore.length > 0) {
			result += "\n\n";
		}
		result += newBlock;
		if (cleanAfter.length > 0) {
			result += "\n\n" + cleanAfter;
		} else {
			result += "\n";
		}
		
		return result;
	} else {
		// Append to end
		const trimmedContent = content.trimEnd();
		
		// Ensure there's proper spacing before the block
		if (trimmedContent.length === 0) {
			return newBlock + "\n";
		}
		
		return trimmedContent + "\n\n" + newBlock + "\n";
	}
}

/**
 * Removes the managed block from the content.
 * 
 * @param content - Note content
 * @returns Content with managed block removed
 */
export function removeManagedBlock(content: string): string {
	const existingBlock = findManagedBlock(content);
	
	if (!existingBlock) {
		return content;
	}
	
	const before = content.substring(0, existingBlock.startIndex).trimEnd();
	const after = content.substring(existingBlock.endIndex).trimStart();
	
	if (before.length === 0) {
		return after;
	}
	
	if (after.length === 0) {
		return before + "\n";
	}
	
	return before + "\n\n" + after;
}

