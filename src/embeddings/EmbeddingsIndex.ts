/**
 * EmbeddingsIndex - manages loading, caching, and searching embeddings.
 */

import { App, TFile, normalizePath } from "obsidian";
import { autoParseEmbeddings, parseWithManualMapping } from "./parsers";
import type { ManualMappingConfig, EmbeddingEntry } from "./parsers";
import { normalize as normalizeVector, cosineSimilarityNormalized } from "../similarity/cosine";

/**
 * Options for finding nearest neighbors.
 */
export interface FindNearestOptions {
	/** Maximum number of results */
	k: number;
	/** Minimum similarity threshold (0-1) */
	threshold: number;
	/** Paths to exclude (e.g., current file) */
	excludePaths?: string[];
	/** Folder prefixes to exclude */
	excludeFolders?: string[];
}

/**
 * Result of nearest neighbor search.
 */
export interface NearestResult {
	/** Path to the file */
	path: string;
	/** Cosine similarity score */
	score: number;
}

/**
 * Internal entry with pre-normalized vector.
 */
interface IndexEntry {
	path: string;
	/** Normalized vector (L2 norm = 1) for fast similarity computation */
	normalizedVector: Float32Array;
}

/**
 * EmbeddingsIndex manages the embeddings cache and similarity search.
 */
export class EmbeddingsIndex {
	private app: App;
	
	/** Path -> normalized vector mapping for fast lookup */
	private pathIndex: Map<string, Float32Array> = new Map();
	
	/** All entries for iteration during search */
	private entries: IndexEntry[] = [];
	
	/** Whether the index has been loaded */
	private loaded = false;
	
	/** Number of entries loaded */
	private entryCount = 0;
	
	/** Detected/used format description */
	private formatDescription = "";
	
	constructor(app: App) {
		this.app = app;
	}
	
	/**
	 * Returns whether the index has been loaded.
	 */
	isLoaded(): boolean {
		return this.loaded;
	}
	
	/**
	 * Returns the number of entries in the index.
	 */
	getEntryCount(): number {
		return this.entryCount;
	}
	
	/**
	 * Returns the format description of the loaded file.
	 */
	getFormatDescription(): string {
		return this.formatDescription;
	}
	
	/**
	 * Clears the index.
	 */
	clear(): void {
		this.pathIndex.clear();
		this.entries = [];
		this.loaded = false;
		this.entryCount = 0;
		this.formatDescription = "";
	}
	
	/**
	 * Loads embeddings from a JSON file.
	 * 
	 * @param filePath - Path to JSON file (relative to vault or absolute)
	 * @param mode - "auto" for auto-detection, "manual" for manual mapping
	 * @param manualConfig - Configuration for manual mapping mode
	 * @throws Error if file not found or parsing fails
	 */
	async loadFromFile(
		filePath: string,
		mode: "auto" | "manual" = "auto",
		manualConfig?: ManualMappingConfig
	): Promise<void> {
		// Clear existing index
		this.clear();
		
		// Read file content
		const content = await this.readFile(filePath);
		if (content === null) {
			throw new Error(`Embeddings file not found: ${filePath}`);
		}
		
		// Parse JSON
		let data: unknown;
		try {
			data = JSON.parse(content);
			console.log(`Smart Linker: JSON parsed successfully, type: ${typeof data}, isArray: ${Array.isArray(data)}`);
			if (typeof data === "object" && data !== null && !Array.isArray(data)) {
				console.log(`Smart Linker: Object keys: ${Object.keys(data as Record<string, unknown>).join(", ")}`);
			}
		} catch (e) {
			throw new Error(`Invalid JSON in embeddings file: ${e}`);
		}
		
		// Parse using appropriate method
		console.log(`Smart Linker: Parsing with mode: ${mode}`);
		const result = mode === "auto"
			? autoParseEmbeddings(data)
			: parseWithManualMapping(data, manualConfig || { pathKey: "path", embeddingKey: "embedding" });
		
		if (result === null) {
			console.error("Smart Linker: All parsers failed to recognize the format");
			throw new Error("Could not parse embeddings file. Check format or use manual mapping.");
		}
		
		console.log(`Smart Linker: Parse result - ${result.entries.length} entries, format: ${result.formatDescription}`);
		
		// Build index
		this.buildIndex(result.entries);
		this.formatDescription = result.formatDescription;
		
		console.log(`Smart Linker: Loaded ${this.entryCount} embeddings (${result.errorCount} errors)`);
		
		if (result.errorCount > 0) {
			console.warn(`Smart Linker: ${result.errorCount} entries failed to parse`);
		}
		
		this.loaded = true;
	}
	
	/**
	 * Reads file content from vault or filesystem.
	 */
	private async readFile(filePath: string): Promise<string | null> {
		const vault = this.app.vault;
		const adapter = vault.adapter;
		const normalizedPath = normalizePath(filePath);
		
		console.log(`Smart Linker: Attempting to read file: ${filePath}`);
		console.log(`Smart Linker: Normalized path: ${normalizedPath}`);
		
		// For .obsidian paths, use adapter directly (vault doesn't index .obsidian)
		if (normalizedPath.startsWith(".obsidian")) {
			try {
				const exists = await adapter.exists(normalizedPath);
				console.log(`Smart Linker: File exists (adapter): ${exists}`);
				if (exists) {
					const content = await adapter.read(normalizedPath);
					console.log(`Smart Linker: Read ${content.length} bytes via adapter`);
					return content;
				}
			} catch (e) {
				console.error("Smart Linker: Error reading .obsidian file:", e);
			}
			return null;
		}
		
		// Try as vault-relative path first (for regular vault files)
		const abstractFile = vault.getAbstractFileByPath(normalizedPath);
		if (abstractFile instanceof TFile) {
			console.log(`Smart Linker: Found file in vault: ${abstractFile.path}`);
			return await vault.read(abstractFile);
		}
		
		// Try reading via adapter (for paths outside normal vault structure)
		try {
			// Check if path is absolute
			if (filePath.startsWith("/") || filePath.match(/^[A-Za-z]:/)) {
				const exists = await adapter.exists(filePath);
				console.log(`Smart Linker: Absolute path exists: ${exists}`);
				if (exists) {
					return await adapter.read(filePath);
				}
			}
			
			// Try relative to vault root
			const exists = await adapter.exists(normalizedPath);
			console.log(`Smart Linker: Relative path exists: ${exists}`);
			if (exists) {
				return await adapter.read(normalizedPath);
			}
		} catch (e) {
			console.error("Smart Linker: Error reading file:", e);
		}
		
		console.error(`Smart Linker: File not found: ${filePath}`);
		return null;
	}
	
	/**
	 * Builds the internal index from parsed entries.
	 */
	private buildIndex(entries: EmbeddingEntry[]): void {
		for (const entry of entries) {
			// Normalize vector for fast similarity computation
			const normalizedVec = normalizeVector(entry.vector);
			
			// Store in path index (try multiple path variants)
			this.addPathVariants(entry.path, normalizedVec);
			
			// Store in entries list
			this.entries.push({
				path: entry.path,
				normalizedVector: normalizedVec,
			});
		}
		
		this.entryCount = entries.length;
	}
	
	/**
	 * Adds path variants to the index for flexible lookup.
	 */
	private addPathVariants(path: string, vector: Float32Array): void {
		// Original path
		this.pathIndex.set(path, vector);
		
		// Without .md extension
		if (path.endsWith(".md")) {
			this.pathIndex.set(path.slice(0, -3), vector);
		}
		
		// Lowercase version
		const lowerPath = path.toLowerCase();
		if (lowerPath !== path) {
			this.pathIndex.set(lowerPath, vector);
			if (lowerPath.endsWith(".md")) {
				this.pathIndex.set(lowerPath.slice(0, -3), vector);
			}
		}
	}
	
	/**
	 * Gets the embedding vector for a file.
	 * Tries multiple path formats for flexible matching.
	 * 
	 * @param filePath - Vault-relative path to the file
	 * @returns Normalized vector or null if not found
	 */
	getVectorForFile(filePath: string): Float32Array | null {
		// Try exact match first
		let vector = this.pathIndex.get(filePath);
		if (vector) return vector;
		
		// Normalize path (replace backslashes)
		const normalized = filePath.replace(/\\/g, "/");
		vector = this.pathIndex.get(normalized);
		if (vector) return vector;
		
		// Try without .md extension
		if (normalized.endsWith(".md")) {
			vector = this.pathIndex.get(normalized.slice(0, -3));
			if (vector) return vector;
		}
		
		// Try lowercase
		const lower = normalized.toLowerCase();
		vector = this.pathIndex.get(lower);
		if (vector) return vector;
		
		if (lower.endsWith(".md")) {
			vector = this.pathIndex.get(lower.slice(0, -3));
			if (vector) return vector;
		}
		
		// Try basename only
		const basename = this.getBasename(normalized);
		vector = this.pathIndex.get(basename);
		if (vector) return vector;
		
		if (basename.endsWith(".md")) {
			vector = this.pathIndex.get(basename.slice(0, -3));
			if (vector) return vector;
		}
		
		return null;
	}
	
	/**
	 * Finds the nearest neighbors to a given vector.
	 * 
	 * @param queryVector - Query vector (will be normalized)
	 * @param options - Search options
	 * @returns Array of nearest results sorted by score (descending)
	 */
	findNearest(queryVector: Float32Array, options: FindNearestOptions): NearestResult[] {
		if (!this.loaded) {
			console.warn("Smart Linker: Index not loaded");
			return [];
		}
		
		const { k, threshold, excludePaths = [], excludeFolders = [] } = options;
		
		// Normalize query vector
		const normalizedQuery = normalizeVector(queryVector);
		
		// Convert exclude sets for faster lookup
		const excludePathSet = new Set(excludePaths.map((p) => this.normalizePath(p)));
		
		// Compute similarities
		const results: NearestResult[] = [];
		
		for (const entry of this.entries) {
			// Check exclusions
			const normalizedEntryPath = this.normalizePath(entry.path);
			
			if (excludePathSet.has(normalizedEntryPath)) {
				continue;
			}
			
			// Check folder exclusions
			if (this.isInExcludedFolder(entry.path, excludeFolders)) {
				continue;
			}
			
			// Compute similarity (dot product of normalized vectors)
			const score = cosineSimilarityNormalized(normalizedQuery, entry.normalizedVector);
			
			if (score >= threshold) {
				results.push({ path: entry.path, score });
			}
		}
		
		// Deduplicate by path - keep highest score for each file
		const bestByPath = new Map<string, NearestResult>();
		for (const result of results) {
			const normalizedPath = this.normalizePath(result.path);
			const existing = bestByPath.get(normalizedPath);
			if (!existing || result.score > existing.score) {
				bestByPath.set(normalizedPath, result);
			}
		}
		
		// Convert back to array and sort by score descending
		const deduplicated = Array.from(bestByPath.values());
		deduplicated.sort((a, b) => b.score - a.score);
		
		// Return top K
		return deduplicated.slice(0, k);
	}
	
	/**
	 * Checks if a path is in an excluded folder.
	 */
	private isInExcludedFolder(path: string, excludeFolders: string[]): boolean {
		const normalizedPath = this.normalizePath(path).toLowerCase();
		
		for (const folder of excludeFolders) {
			const normalizedFolder = folder.replace(/\\/g, "/").toLowerCase();
			
			// Check if path starts with folder (considering folder boundaries)
			if (
				normalizedPath.startsWith(normalizedFolder + "/") ||
				normalizedPath === normalizedFolder
			) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * Normalizes a path for comparison.
	 */
	private normalizePath(path: string): string {
		return path.replace(/\\/g, "/").toLowerCase();
	}
	
	/**
	 * Gets basename from a path.
	 */
	private getBasename(path: string): string {
		const parts = path.split("/");
		return parts[parts.length - 1];
	}
}

