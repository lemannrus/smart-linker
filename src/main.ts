import { Notice, Plugin, TFile } from "obsidian";
import {
	SmartLinkerSettings,
	DEFAULT_SETTINGS,
	SmartLinkerSettingTab,
} from "./settings";
import { EmbeddingsIndex } from "./embeddings/EmbeddingsIndex";
import {
	generateManagedBlock,
	updateManagedBlock,
	type RelatedNote,
} from "./markdown/managedBlock";

/**
 * Smart Linker - Obsidian plugin for semantic similarity-based related notes.
 * 
 * Uses pre-computed embeddings from a JSON file (e.g., from vector-search plugin)
 * to find and insert related note links.
 */
export default class SmartLinkerPlugin extends Plugin {
	settings: SmartLinkerSettings = DEFAULT_SETTINGS;
	embeddingsIndex: EmbeddingsIndex | null = null;

	async onload(): Promise<void> {
		console.log("Smart Linker: Loading plugin...");

		// Load settings
		await this.loadSettings();

		// Initialize embeddings index
		this.embeddingsIndex = new EmbeddingsIndex(this.app);

		// Add settings tab
		this.addSettingTab(new SmartLinkerSettingTab(this.app, this));

		// Add commands
		this.addCommand({
			id: "update-related-links",
			name: "Update related links for current note",
			editorCallback: async (editor, ctx) => {
				const file = ctx.file;
				if (!file) {
					new Notice("No active file");
					return;
				}
				await this.updateRelatedLinksForFile(file);
			},
		});

		this.addCommand({
			id: "reload-embeddings",
			name: "Reload embeddings index",
			callback: async () => {
				await this.reloadEmbeddings();
			},
		});

		// Try to load embeddings on startup if path is configured
		if (this.settings.embeddingsPath) {
			// Use setTimeout to not block plugin loading
			setTimeout(() => this.loadEmbeddingsQuietly(), 1000);
		}

		console.log("Smart Linker: Plugin loaded");
	}

	onunload(): void {
		console.log("Smart Linker: Unloading plugin");
		this.embeddingsIndex?.clear();
	}

	/**
	 * Loads plugin settings from storage.
	 */
	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	/**
	 * Saves plugin settings to storage.
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Loads embeddings without showing errors (for startup).
	 */
	private async loadEmbeddingsQuietly(): Promise<void> {
		try {
			await this.loadEmbeddingsFromSettings();
			console.log(
				`Smart Linker: Loaded ${this.embeddingsIndex?.getEntryCount()} embeddings on startup`
			);
		} catch (e) {
			console.warn("Smart Linker: Could not load embeddings on startup:", e);
		}
	}

	/**
	 * Reloads embeddings and shows notification.
	 */
	async reloadEmbeddings(): Promise<void> {
		if (!this.settings.embeddingsPath) {
			new Notice("Embeddings path not configured. Check plugin settings.");
			return;
		}

		try {
			await this.loadEmbeddingsFromSettings();
			const count = this.embeddingsIndex?.getEntryCount() || 0;
			new Notice(`Loaded ${count} embeddings`);
		} catch (e) {
			console.error("Smart Linker: Failed to reload embeddings:", e);
			new Notice(`Failed to load embeddings: ${e}`);
		}
	}

	/**
	 * Loads embeddings using current settings.
	 */
	private async loadEmbeddingsFromSettings(): Promise<void> {
		if (!this.embeddingsIndex) {
			this.embeddingsIndex = new EmbeddingsIndex(this.app);
		}

		const manualConfig = this.settings.jsonFormatMode === "manual"
			? {
					pathKey: this.settings.manualPathKey,
					embeddingKey: this.settings.manualEmbeddingKey,
			  }
			: undefined;

		await this.embeddingsIndex.loadFromFile(
			this.settings.embeddingsPath,
			this.settings.jsonFormatMode,
			manualConfig
		);
	}

	/**
	 * Updates related links for a specific file.
	 */
	async updateRelatedLinksForFile(file: TFile): Promise<void> {
		// Ensure embeddings are loaded
		if (!this.embeddingsIndex?.isLoaded()) {
			if (!this.settings.embeddingsPath) {
				new Notice("Embeddings path not configured. Check plugin settings.");
				return;
			}

			new Notice("Loading embeddings...");
			try {
				await this.loadEmbeddingsFromSettings();
			} catch (e) {
				new Notice(`Failed to load embeddings: ${e}`);
				return;
			}
		}

		// Get embedding for current file
		const currentVector = this.embeddingsIndex!.getVectorForFile(file.path);
		if (!currentVector) {
			new Notice(
				`No embedding found for "${file.basename}". Check path mapping in embeddings file.`
			);
			return;
		}

		// Find related notes
		const results = this.embeddingsIndex!.findNearest(currentVector, {
			k: this.settings.topK,
			threshold: this.settings.similarityThreshold,
			excludePaths: [file.path],
			excludeFolders: this.settings.excludedFolders,
		});

		// Convert to RelatedNote format
		const relatedNotes: RelatedNote[] = results.map((r) => ({
			path: this.ensureMdExtension(r.path),
			score: r.score,
		}));

		// Generate managed block
		const newBlock = generateManagedBlock(relatedNotes, {
			heading: this.settings.blockHeading,
			showScores: this.settings.showSimilarityScore,
			usePathLinks: this.settings.usePathLinks,
		});

		// Read current content
		const currentContent = await this.app.vault.read(file);

		// Update content with new block
		const newContent = updateManagedBlock(currentContent, newBlock);

		// Write back
		await this.app.vault.modify(file, newContent);

		// Notify user
		const count = relatedNotes.length;
		if (count === 0) {
			new Notice("No related notes found above threshold");
		} else {
			new Notice(`Updated ${count} related link${count !== 1 ? "s" : ""}`);
		}
	}

	/**
	 * Ensures a path has .md extension.
	 */
	private ensureMdExtension(path: string): string {
		if (!path.endsWith(".md")) {
			return path + ".md";
		}
		return path;
	}
}

