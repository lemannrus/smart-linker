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
	}

	onunload(): void {
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
		} catch {
			// Silently fail on startup - user can manually reload
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
	 * Ensures embeddings are loaded and up-to-date.
	 * Automatically reloads if the embeddings file has been modified.
	 * 
	 * @returns true if embeddings are ready, false otherwise
	 */
	private async ensureEmbeddingsLoaded(): Promise<boolean> {
		if (!this.settings.embeddingsPath) {
			new Notice("Embeddings path not configured. Check plugin settings.");
			return false;
		}

		if (!this.embeddingsIndex) {
			this.embeddingsIndex = new EmbeddingsIndex(this.app);
		}

		// Check if we need to reload (file modified or not loaded)
		const needsReload = await this.embeddingsIndex.needsReload(this.settings.embeddingsPath);
		
		if (needsReload) {
			try {
				await this.loadEmbeddingsFromSettings();
			} catch (e) {
				new Notice(`Failed to load embeddings: ${e}`);
				return false;
			}
		}

		return this.embeddingsIndex.isLoaded();
	}

	/**
	 * Updates related links for a specific file.
	 */
	async updateRelatedLinksForFile(file: TFile): Promise<void> {
		// Ensure embeddings are loaded and up-to-date
		const ready = await this.ensureEmbeddingsLoaded();
		if (!ready) {
			return;
		}

		// Get embedding for current file
		const currentVector = this.embeddingsIndex!.getVectorForFile(file.path);
		if (!currentVector) {
			new Notice(
				`No embedding found for "${file.basename}". Check path mapping in embeddings file.`
			);
			return;
		}

		// Find related notes (request more than needed to account for deleted files)
		const results = this.embeddingsIndex!.findNearest(currentVector, {
			k: this.settings.topK * 2,
			threshold: this.settings.similarityThreshold,
			excludePaths: [file.path],
			excludeFolders: this.settings.excludedFolders,
		});

		// Filter out non-existent files and convert to RelatedNote format
		const relatedNotes: RelatedNote[] = [];
		for (const r of results) {
			const notePath = this.ensureMdExtension(r.path);
			
			// Check if file exists in vault
			if (this.fileExists(notePath)) {
				relatedNotes.push({ path: notePath, score: r.score });
				
				// Stop if we have enough
				if (relatedNotes.length >= this.settings.topK) {
					break;
				}
			}
		}

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

	/**
	 * Checks if a file exists in the vault.
	 */
	private fileExists(path: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile;
	}
}

