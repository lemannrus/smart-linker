import { App, PluginSettingTab, Setting } from "obsidian";
import type SmartLinkerPlugin from "./main";

/**
 * Plugin settings interface.
 */
export interface SmartLinkerSettings {
	/** Path to embeddings JSON file (relative to vault or absolute) */
	embeddingsPath: string;
	
	/** Number of top related notes to show */
	topK: number;
	
	/** Minimum similarity threshold (0-1) */
	similarityThreshold: number;
	
	/** Folders to exclude from results (one per line) */
	excludedFolders: string[];
	
	/** Heading text for the related links block */
	blockHeading: string;
	
	/** Use full path in links (true) or basename only (false) */
	usePathLinks: boolean;
	
	/** Show similarity score next to each link */
	showSimilarityScore: boolean;
	
	/** JSON format mode: "auto" for auto-detect, "manual" for manual mapping */
	jsonFormatMode: "auto" | "manual";
	
	/** Manual mapping: JSON key/path to file path field */
	manualPathKey: string;
	
	/** Manual mapping: JSON key/path to embedding vector field */
	manualEmbeddingKey: string;
}

/**
 * Default settings values.
 */
export const DEFAULT_SETTINGS: SmartLinkerSettings = {
	embeddingsPath: "",
	topK: 5,
	similarityThreshold: 0.75,
	excludedFolders: ["Templates", "Daily"],
	blockHeading: "## Related",
	usePathLinks: true,
	showSimilarityScore: false,
	jsonFormatMode: "auto",
	manualPathKey: "path",
	manualEmbeddingKey: "embedding",
};

/**
 * Settings tab for the Smart Linker plugin.
 */
export class SmartLinkerSettingTab extends PluginSettingTab {
	plugin: SmartLinkerPlugin;

	constructor(app: App, plugin: SmartLinkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setHeading()
			.setName("Smart linker settings");

		// --- Core Settings ---
		new Setting(containerEl)
			.setHeading()
			.setName("Core settings");

		new Setting(containerEl)
			.setName("Embeddings JSON path")
			.setDesc("Path to the embeddings JSON file (relative to vault root or absolute path)")
			.addText((text) =>
				text
					.setPlaceholder("path/to/embeddings.json")
					.setValue(this.plugin.settings.embeddingsPath)
					.onChange(async (value) => {
						this.plugin.settings.embeddingsPath = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Top K results")
			.setDesc("Maximum number of related notes to show")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.topK)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.topK = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Similarity threshold")
			.setDesc("Minimum cosine similarity (0.0 - 1.0) to include a note")
			.addSlider((slider) =>
				slider
					.setLimits(0, 1, 0.05)
					.setValue(this.plugin.settings.similarityThreshold)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.similarityThreshold = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc("Folders to exclude from results (one per line)")
			.addTextArea((text) => {
				const configDir = this.app.vault.configDir;
				text
					.setPlaceholder(`${configDir}\nTemplates\nDaily`)
					.setValue(this.plugin.settings.excludedFolders.join("\n"))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value
							.split("\n")
							.map((f) => f.trim())
							.filter((f) => f.length > 0);
						await this.plugin.saveSettings();
					});
			});

		// --- Display Settings ---
		new Setting(containerEl)
			.setHeading()
			.setName("Display settings");

		new Setting(containerEl)
			.setName("Block heading")
			.setDesc("Markdown heading for the related links section")
			.addText((text) =>
				text
					.setPlaceholder("## Related")
					.setValue(this.plugin.settings.blockHeading)
					.onChange(async (value) => {
						this.plugin.settings.blockHeading = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Use full path in links")
			.setDesc("Use full path [[path/to/note.md]] instead of [[basename]]")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.usePathLinks)
					.onChange(async (value) => {
						this.plugin.settings.usePathLinks = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show similarity score")
			.setDesc("Display similarity score next to each link")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSimilarityScore)
					.onChange(async (value) => {
						this.plugin.settings.showSimilarityScore = value;
						await this.plugin.saveSettings();
					})
			);

		// --- JSON Format Settings ---
		new Setting(containerEl)
			.setHeading()
			.setName("JSON format settings");

		new Setting(containerEl)
			.setName("JSON format detection")
			.setDesc("Auto-detect format or manually specify field mappings")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", "Auto-detect")
					.addOption("manual", "Manual mapping")
					.setValue(this.plugin.settings.jsonFormatMode)
					.onChange(async (value: "auto" | "manual") => {
						this.plugin.settings.jsonFormatMode = value;
						await this.plugin.saveSettings();
						// Re-render to show/hide manual fields
						this.display();
					})
			);

		// Show manual mapping fields only in manual mode
		if (this.plugin.settings.jsonFormatMode === "manual") {
			new Setting(containerEl)
				.setName("Path field key")
				.setDesc("JSON key for the file path (e.g., 'path', 'file', 'filepath')")
				.addText((text) =>
					text
						.setPlaceholder("path")
						.setValue(this.plugin.settings.manualPathKey)
						.onChange(async (value) => {
							this.plugin.settings.manualPathKey = value.trim();
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Embedding field key")
				.setDesc("JSON key for the embedding vector (e.g., 'embedding', 'vector', 'values')")
				.addText((text) =>
					text
						.setPlaceholder("embedding")
						.setValue(this.plugin.settings.manualEmbeddingKey)
						.onChange(async (value) => {
							this.plugin.settings.manualEmbeddingKey = value.trim();
							await this.plugin.saveSettings();
						})
				);
		}
	}
}

